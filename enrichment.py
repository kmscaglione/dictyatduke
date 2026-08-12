"""GO-term enrichment engine for dictyBase.

Pure, dependency-free (stdlib only) so it is unit-testable without starting the
server. Given a list of genes (DDB ids or symbols), it computes hypergeometric
over-representation of GO terms against a background of all GO-annotated genes,
with Benjamini-Hochberg FDR correction.

Used by serve.py's POST /api/enrichment endpoint and exercised by
tests/test_enrichment.py.
"""
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
ASSETS = ROOT / "assets"

_DDB_RE = re.compile(r"^DDB_G\d+$", re.I)

# lazily-built indices
_state = {}


def _load():
    if _state:
        return _state
    index = json.loads((ASSETS / "gene_index.json").read_text())
    sym2ddb = {}
    all_ddb = set()
    for row in index:
        if len(row) < 2:
            continue
        ddb, sym = row[0], row[1]
        all_ddb.add(ddb)
        if sym:
            sym2ddb.setdefault(sym.lower(), ddb)

    go = json.loads((ASSETS / "go_annotations.json").read_text())
    gene_terms = {}          # ddb -> set(GO id)
    term_genes = {}          # GO id -> set(ddb)
    term_aspect = {}         # GO id -> P|F|C
    for ddb, rows in go.items():
        terms = set()
        for r in rows:
            gid, aspect = r[0], (r[1] if len(r) > 1 else "")
            terms.add(gid)
            term_genes.setdefault(gid, set()).add(ddb)
            term_aspect.setdefault(gid, aspect)
        if terms:
            gene_terms[ddb] = terms

    # partial GO id -> name map harvested from the AI curation layer (the only
    # local source of term names); unknown terms come back with name=None and
    # the UI/caller can resolve live.
    names = {}
    try:
        ai = json.loads((ASSETS / "ai_curation.json").read_text())
        for k, v in ai.items():
            if k.startswith("_"):
                continue
            for gid, aspect, name in v.get("go", []):
                names.setdefault(gid, name)
    except Exception:
        pass

    _state.update(
        sym2ddb=sym2ddb, all_ddb=all_ddb, gene_terms=gene_terms,
        term_genes=term_genes, term_aspect=term_aspect, names=names,
        annotated=set(gene_terms),
    )
    return _state


def resolve_genes(tokens):
    """Map query tokens (DDB ids or gene symbols) to DDB ids.

    Returns (matched_ddb:set, unmatched:list). Case-insensitive; de-duplicated.
    """
    st = _load()
    matched, unmatched = set(), []
    for tok in tokens:
        t = tok.strip()
        if not t:
            continue
        if _DDB_RE.match(t):
            ddb = t.upper().replace("DDB_G", "DDB_G")
            # normalise to the catalog's casing
            cand = next((d for d in st["all_ddb"] if d.upper() == t.upper()), None)
            if cand:
                matched.add(cand)
            else:
                unmatched.append(tok)
        else:
            ddb = st["sym2ddb"].get(t.lower())
            if ddb:
                matched.add(ddb)
            else:
                unmatched.append(tok)
    return matched, unmatched


def _log_choose(n, k):
    if k < 0 or k > n:
        return float("-inf")
    return math.lgamma(n + 1) - math.lgamma(k + 1) - math.lgamma(n - k + 1)


def hypergeom_sf(k, M, n, N):
    """P(X >= k) for X ~ Hypergeometric(M population, n successes, N draws).

    Computed in log space (stdlib only). k = observed successes in the draw.
    """
    if k <= 0:
        return 1.0
    lo, hi = max(0, N - (M - n)), min(n, N)
    if k > hi:
        return 0.0
    denom = _log_choose(M, N)
    total = 0.0
    for i in range(max(k, lo), hi + 1):
        lp = _log_choose(n, i) + _log_choose(M - n, N - i) - denom
        total += math.exp(lp)
    return min(1.0, total)


def _bh(pvals):
    """Benjamini-Hochberg FDR. Returns q-values aligned to the input order."""
    m = len(pvals)
    order = sorted(range(m), key=lambda i: pvals[i])
    q = [0.0] * m
    prev = 1.0
    for rank in range(m - 1, -1, -1):
        i = order[rank]
        val = pvals[i] * m / (rank + 1)
        prev = min(prev, val)
        q[i] = min(1.0, prev)
    return q


def enrich(tokens, background="annotated", min_study=2, max_terms=200,
           include_predicted=False, gomer_min=0.5):
    """Hypergeometric GO over-representation for a gene list.

    background: "annotated" (all GO-annotated genes) or "genome" (all genes).
    include_predicted: also count the AI, Gomer, author, and community layers, in
    both the study set and the background, so the test stays internally valid.
    gomer_min: Gomer I-TASSER confidence cutoff (0.4/0.5/0.6) for those terms.
    Returns a dict: {study_n, study_resolved, unmatched, background_n, results:[...]}.
    Each result: id, aspect, name, study_count, study_n, pop_count, pop_n,
    fold_enrichment, p_value, q_value, genes (matching DDB ids).
    """
    st = _state_for(include_predicted, gomer_min)
    matched, unmatched = resolve_genes(tokens)

    if background == "genome":
        pop = st["all_ddb"]
    else:
        pop = st["annotated"]
    M = len(pop)
    study = matched & st["annotated"]
    N = len(study)

    results = []
    if N:
        # candidate terms: those annotated to at least one study gene
        cand = {}
        for ddb in study:
            for gid in st["gene_terms"].get(ddb, ()):
                cand.setdefault(gid, []).append(ddb)
        pvals, rows = [], []
        for gid, genes in cand.items():
            k = len(genes)
            if k < min_study:
                continue
            n = len(st["term_genes"].get(gid, ()) & pop)
            if n == 0:
                continue
            p = hypergeom_sf(k, M, n, N)
            expected = N * n / M if M else 0
            rows.append({
                "id": gid,
                "aspect": st["term_aspect"].get(gid, ""),
                "name": st["names"].get(gid),
                "study_count": k,
                "study_n": N,
                "pop_count": n,
                "pop_n": M,
                "fold_enrichment": round(k / expected, 2) if expected else None,
                "p_value": p,
                "genes": sorted(genes),
            })
            pvals.append(p)
        qs = _bh(pvals)
        for row, q in zip(rows, qs):
            row["q_value"] = q
        rows.sort(key=lambda r: (r["p_value"], -r["study_count"]))
        results = rows[:max_terms]

    return {
        "study_n": N,
        "study_resolved": sorted(study),
        "unmatched": unmatched,
        "background": background,
        "background_n": M,
        "results": results,
    }


# --- Phenotype enrichment (curated mutant phenotypes) ---------------------
_pstate = {}


def _load_phenotypes():
    if _pstate:
        return _pstate
    ph = json.loads((ASSETS / "phenotypes.json").read_text())
    gene_terms, term_genes = {}, {}
    for ddb, rows in ph.items():
        terms = set()
        for r in rows:
            t = (r[0] or "").strip() if r else ""
            if not t:
                continue
            terms.add(t)
            term_genes.setdefault(t, set()).add(ddb)
        if terms:
            gene_terms[ddb] = terms
    _pstate.update(gene_terms=gene_terms, term_genes=term_genes,
                   annotated=set(gene_terms))
    return _pstate


def enrich_phenotypes(tokens, min_study=2, max_terms=200):
    """Hypergeometric over-representation of curated phenotypes in a gene list.

    Background = all genes with at least one curated phenotype. Returns the same
    shape as enrich() but with 'term' (the phenotype) instead of GO id/aspect.
    """
    _load()  # for resolve_genes
    pst = _load_phenotypes()
    matched, unmatched = resolve_genes(tokens)
    pop = pst["annotated"]
    M = len(pop)
    study = matched & pop
    N = len(study)

    results = []
    if N:
        cand = {}
        for ddb in study:
            for t in pst["gene_terms"].get(ddb, ()):
                cand.setdefault(t, []).append(ddb)
        pvals, rows = [], []
        for term, genes in cand.items():
            k = len(genes)
            if k < min_study:
                continue
            n = len(pst["term_genes"].get(term, ()))
            p = hypergeom_sf(k, M, n, N)
            expected = N * n / M if M else 0
            rows.append({
                "term": term,
                "study_count": k, "study_n": N,
                "pop_count": n, "pop_n": M,
                "fold_enrichment": round(k / expected, 2) if expected else None,
                "p_value": p, "genes": sorted(genes),
            })
            pvals.append(p)
        qs = _bh(pvals)
        for row, q in zip(rows, qs):
            row["q_value"] = q
        rows.sort(key=lambda r: (r["p_value"], -r["study_count"]))
        results = rows[:max_terms]

    return {
        "study_n": N,
        "study_resolved": sorted(study),
        "unmatched": unmatched,
        "background_n": M,
        "results": results,
    }


# --- KEGG pathway enrichment ----------------------------------------------
_kegg = {}


def _load_kegg():
    if _kegg:
        return _kegg
    data = json.loads((ASSETS / "kegg_pathways.json").read_text())
    gene_terms, term_genes, term_name = {}, {}, {}
    for ddb, paths in data.items():
        terms = set()
        for p in paths:
            pid = p["id"]
            term_name[pid] = p.get("name", pid)
            terms.add(pid)
            term_genes.setdefault(pid, set()).add(ddb)
        if terms:
            gene_terms[ddb] = terms
    _kegg.update(gene_terms=gene_terms, term_genes=term_genes,
                 term_name=term_name, annotated=set(gene_terms))
    return _kegg


def enrich_kegg(tokens, min_study=2, max_terms=200):
    """Hypergeometric over-representation of KEGG pathways in a gene list."""
    _load()
    kg = _load_kegg()
    matched, unmatched = resolve_genes(tokens)
    pop = kg["annotated"]
    M = len(pop)
    study = matched & pop
    N = len(study)
    results = []
    if N:
        cand = {}
        for ddb in study:
            for pid in kg["gene_terms"].get(ddb, ()):
                cand.setdefault(pid, []).append(ddb)
        pvals, rows = [], []
        for pid, genes in cand.items():
            k = len(genes)
            if k < min_study:
                continue
            n = len(kg["term_genes"].get(pid, ()))
            p = hypergeom_sf(k, M, n, N)
            expected = N * n / M if M else 0
            rows.append({
                "id": pid, "term": kg["term_name"].get(pid, pid),
                "study_count": k, "study_n": N, "pop_count": n, "pop_n": M,
                "fold_enrichment": round(k / expected, 2) if expected else None,
                "p_value": p, "genes": sorted(genes),
            })
            pvals.append(p)
        qs = _bh(pvals)
        for row, q in zip(rows, qs):
            row["q_value"] = q
        rows.sort(key=lambda r: (r["p_value"], -r["study_count"]))
        results = rows[:max_terms]
    return {"study_n": N, "study_resolved": sorted(study),
            "unmatched": unmatched, "background_n": M, "results": results}


# --- Co-expression (Pearson over the Rosengarten 2015 developmental time course) --
_coexp = {}
# Rosengarten et al. 2015 filter-development time course (hours). Hourly to 12h,
# then every 2h to 24h — 19 points.
_COEXP_TPS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
              "14", "16", "18", "20", "22", "24"]


def _load_coexp():
    if _coexp:
        return _coexp
    rna = json.loads((ASSETS / "rnaseq_rosengarten.json").read_text())
    vecs = {}  # ddb -> (mean-centered profile vector, norm)
    for ddb, vals in rna.items():
        if ddb.startswith("_"):        # skip _meta
            continue
        v = [float(vals.get(tp, 0) or 0) for tp in _COEXP_TPS]
        m = sum(v) / len(v)
        c = [x - m for x in v]
        norm = sum(x * x for x in c) ** 0.5
        if norm > 0:  # drop flat/zero profiles (no correlation defined)
            vecs[ddb] = (c, norm)
    idx = json.loads((ASSETS / "gene_index.json").read_text())
    sym = {r[0]: (r[1] or r[0]) for r in idx if r and r[0]}
    _coexp.update(vecs=vecs, sym=sym, raw=rna)
    return _coexp


def expression_profiles(tokens):
    """Raw RNA-seq profiles for a gene list (for the multi-gene comparison)."""
    _load()
    cx = _load_coexp()
    matched, unmatched = resolve_genes(tokens)
    series = []
    for ddb in sorted(matched):
        vals = cx["raw"].get(ddb)
        if not vals:
            continue
        series.append({
            "ddb": ddb, "symbol": cx["sym"].get(ddb, ddb),
            "values": [round(float(vals.get(tp, 0) or 0), 3) for tp in _COEXP_TPS],
        })
    return {"timepoints": _COEXP_TPS, "series": series, "unmatched": unmatched}


def coexpression(ddb, n=12, min_r=0.5):
    """Top-n genes whose developmental expression correlates with `ddb`."""
    cx = _load_coexp()
    q = cx["vecs"].get(ddb)
    if not q:
        return {"query": ddb, "results": []}
    qc, qn = q
    scored = []
    for d, (c, nrm) in cx["vecs"].items():
        if d == ddb:
            continue
        r = sum(a * b for a, b in zip(qc, c)) / (qn * nrm)
        scored.append((r, d))
    scored.sort(reverse=True)
    out = []
    for r, d in scored[:n]:
        if r < min_r:
            break
        out.append({"ddb": d, "symbol": cx["sym"].get(d, d), "r": round(r, 4)})
    return {"query": ddb, "results": out}


# --- GO-slim mapper -------------------------------------------------------
# Not a statistical test: maps a gene list onto the high-level dictyBase GO-slim
# categories and counts how many of the list fall in each (like SGD's GO Slim
# Mapper). Per-gene slim assignments are precomputed in gene_extras.goslim.
_GOSLIM = None
_ASPECT_LABEL = {"P": "Biological process", "F": "Molecular function", "C": "Cellular component"}
# The ontology roots carry no information (every annotated gene maps to them).
_GO_ROOTS = {"GO:0008150", "GO:0003674", "GO:0005575", "GO:0007582"}


def _load_goslim():
    global _GOSLIM
    if _GOSLIM is None:
        try:
            gx = json.loads((ASSETS / "gene_extras.json").read_text())
            names = json.loads((ASSETS / "goslim_terms.json").read_text())
        except (OSError, ValueError):
            gx, names = {}, {}
        per = {k: v.get("goslim") for k, v in gx.items()
               if isinstance(v, dict) and v.get("goslim")}
        _GOSLIM = {"per_gene": per, "names": names}
    return _GOSLIM


def map_goslim(tokens):
    """Bucket a gene list into GO-slim categories, grouped by GO aspect."""
    matched, unmatched = resolve_genes(tokens)
    data = _load_goslim()
    per, names = data["per_gene"], data["names"]
    buckets = {}
    mapped = set()
    for ddb in matched:
        slim = per.get(ddb)
        if not slim:
            continue
        mapped.add(ddb)
        for pair in slim:
            go_id, aspect = pair[0], (pair[1] if len(pair) > 1 else "")
            if go_id in _GO_ROOTS:
                continue
            buckets.setdefault((aspect, go_id), set()).add(ddb)
    rows = [{
        "aspect": a, "aspect_label": _ASPECT_LABEL.get(a, a or "other"),
        "id": gid, "name": names.get(gid, gid),
        "count": len(genes), "genes": sorted(genes),
    } for (a, gid), genes in buckets.items()]
    rows.sort(key=lambda r: (r["aspect_label"], -r["count"], r["name"]))
    return {"matched_n": len(matched), "mapped_n": len(mapped),
            "unmatched": unmatched[:50], "results": rows}


# --- Batch gene annotator (SimpleMine-style) ------------------------------
# Paste a gene list, pick columns, get one row per gene assembled from the same
# data the site already serves. Deliberately light: no data warehouse, just a
# join over the JSON assets.
_BATCH = None
PEAK_STAGES = ["0 h", "4 h", "8 h", "12 h", "16 h", "20 h", "24 h"]  # Rosengarten 2015 dev time course
BATCH_COLUMNS = ["symbol", "name", "ddb_g", "ncbi", "synonyms",
                 "go", "phenotypes", "human_ortholog", "disease",
                 "expression_peak", "domains"]


def _load_batch():
    global _BATCH
    if _BATCH is None:
        def L(name):
            try:
                return json.loads((ASSETS / name).read_text())
            except (OSError, ValueError):
                return {}
        idx = json.loads((ASSETS / "gene_index.json").read_text())
        info = {r[0]: {"symbol": r[1], "name": r[2], "ncbi": r[4] if len(r) > 4 else "",
                       "synonyms": r[5] if len(r) > 5 else []} for r in idx}
        _BATCH = {"info": info, "go": L("go_annotations.json"), "pheno": L("phenotypes.json"),
                  "facets": L("gene_facets.json"), "od": L("ortholog_disease.json"),
                  "domains": L("dictybase_domains.json")}
    return _BATCH


def annotate_genes(tokens, columns=None, include_predicted=False, gomer_min=0.5):
    """One annotated row per matched gene, restricted to the requested columns.

    include_predicted folds the AI, Gomer (score >= gomer_min), author, and
    community GO terms into the GO column, marked as predicted."""
    cols = [c for c in (columns or BATCH_COLUMNS) if c in BATCH_COLUMNS] or list(BATCH_COLUMNS)
    matched, unmatched = resolve_genes(tokens)
    S = _load_batch()
    pred = predicted_terms(gomer_min) if include_predicted else {}
    rows = []
    for ddb in sorted(matched):
        info = S["info"].get(ddb, {})
        r = {"ddb_g": ddb}
        if "symbol" in cols:
            r["symbol"] = info.get("symbol", "")
        if "name" in cols:
            r["name"] = info.get("name", "")
        if "ncbi" in cols:
            r["ncbi"] = str(info.get("ncbi", "") or "")
        if "synonyms" in cols:
            r["synonyms"] = "; ".join(info.get("synonyms") or [])
        if "go" in cols:
            ids = []
            for g in (S["go"].get(ddb) or []):
                if g[0] not in ids:
                    ids.append(g[0])
            curated_n = len(ids)
            extra = 0
            for gid, _asp, _nm in pred.get(ddb, []):
                if gid not in ids:
                    ids.append(gid)
                    extra += 1
            label = f"{curated_n} terms" + (f" +{extra} predicted" if extra else "")
            r["go"] = label + (f" ({'; '.join(ids[:8])})" if ids else "")
        if "phenotypes" in cols:
            terms = []
            for p in (S["pheno"].get(ddb) or []):
                t = p[0] if isinstance(p, list) else p
                if t and t not in terms:
                    terms.append(t)
            r["phenotypes"] = "; ".join(terms[:12])
        if "human_ortholog" in cols or "disease" in cols:
            od = S["od"].get(ddb) or {}
            humans, diseases, upacc = [], [], ""
            for orth in (od.get("orthologs") or []):
                hs = orth.get("human_symbol")
                if hs and hs not in humans:
                    humans.append(hs)
                for d in (orth.get("diseases") or []):
                    dn = d.get("name") if isinstance(d, dict) else str(d)
                    if dn and dn not in diseases:
                        diseases.append(dn)
            if "human_ortholog" in cols:
                r["human_ortholog"] = "; ".join(humans[:6])
            if "disease" in cols:
                r["disease"] = "; ".join(diseases[:6])
        if "uniprot" in cols:
            r["uniprot"] = (S["od"].get(ddb) or {}).get("uniprot", "") or ""
        if "expression_peak" in cols:
            f = S["facets"].get(ddb) or []
            peak = f[3] if len(f) > 3 else -1
            r["expression_peak"] = PEAK_STAGES[peak] if isinstance(peak, int) and 0 <= peak < len(PEAK_STAGES) else ""
        if "domains" in cols:
            ip = []
            for d in (S["domains"].get(ddb) or []):
                nm = d.get("interpro_name") or d.get("name")
                if nm and nm not in ip:
                    ip.append(nm)
            r["domains"] = "; ".join(ip[:8])
        rows.append(r)
    return {"matched_n": len(matched), "unmatched": unmatched[:100],
            "columns": cols, "rows": rows}


# --- Predicted / unreviewed annotation layers -----------------------------
# Optional expansion of the GO universe beyond the curated + electronic GAF, for
# users who want coverage over confidence. Four layers fold in: the AI
# predictions, the Gomer Lab I-TASSER predictions (kept only at/above a
# caller-chosen confidence score), author-submitted curation awaiting review,
# and community "curated-here" annotations.
GOMER_DEFAULT_MIN = 0.5
GOMER_MIN_CHOICES = (0.4, 0.5, 0.6)
_ASPECT_WORD = {"molecular function": "F", "biological process": "P", "cellular component": "C"}
CURATOR_STATE = ROOT / "uploads" / "curator_state"
_pred_raw = None


def clamp_gomer_min(v):
    """Snap a requested cutoff to the nearest offered choice (0.4/0.5/0.6)."""
    try:
        v = float(v)
    except (TypeError, ValueError):
        return GOMER_DEFAULT_MIN
    return min(GOMER_MIN_CHOICES, key=lambda c: abs(c - v))


def _parse_gomer_go(line):
    """'GO:0008565: molecular function, name, 0.80' -> (gid, aspect, name, score)."""
    mi = re.match(r"\s*(GO:\d+)", line)
    ms = re.search(r",\s*([01](?:\.\d+)?)\s*$", line)
    if not mi or not ms:
        return None
    gid, score = mi.group(1), float(ms.group(1))
    body = re.sub(r",\s*[01](?:\.\d+)?\s*$", "", line[mi.end():]).lstrip(": ").strip()
    aspect, name = "", body
    parts = body.split(",", 1)
    if len(parts) == 2 and parts[0].strip().lower() in _ASPECT_WORD:
        aspect, name = _ASPECT_WORD[parts[0].strip().lower()], parts[1].strip()
    return gid, aspect, name, score


def _load_predicted_raw():
    """{ddb -> {gid: (aspect, name, source, score|None)}} across all extra layers."""
    global _pred_raw
    if _pred_raw is not None:
        return _pred_raw
    st = _load()
    per = {}

    def add(ddb, gid, aspect, name, source, score=None):
        if ddb and gid and str(gid).startswith("GO:"):
            per.setdefault(ddb, {}).setdefault(gid, (aspect or "", name, source, score))

    # AI layer (keyed by gene symbol)
    try:
        ai = json.loads((ASSETS / "ai_curation.json").read_text())
        for sym, v in ai.items():
            if sym.startswith("_") or not isinstance(v, dict):
                continue
            ddb = st["sym2ddb"].get(sym.lower())
            for row in (v.get("go") or []):
                add(ddb, row[0], row[1] if len(row) > 1 else "", row[2] if len(row) > 2 else None, "ai")
    except (OSError, ValueError):
        pass

    # Gomer Lab I-TASSER layer (keyed by DDB_G; raw strings with a trailing score)
    try:
        gm = json.loads((ASSETS / "gomer_annotations.json").read_text())
        for ddb, rec in gm.items():
            if not ddb.startswith("DDB_G") or not isinstance(rec, dict):
                continue
            for line in (rec.get("go") or []):
                p = _parse_gomer_go(line)
                if p:
                    add(ddb, p[0], p[1], p[2], "gomer", p[3])
    except (OSError, ValueError):
        pass

    # Author-submitted curation awaiting curator review (paper-session submissions)
    try:
        drafts = json.loads((CURATOR_STATE / "curation_paper_drafts.json").read_text())
        for d in drafts.get("drafts", []):
            sub = d.get("submission")
            if not sub or sub.get("handled"):
                continue
            for g in (sub.get("go") or []):
                gene = str(g.get("gene", ""))
                ddb = st["sym2ddb"].get(gene.lower()) or (gene if gene.startswith("DDB_G") else None)
                add(ddb, g.get("go_id") or "", g.get("aspect", ""), g.get("term"), "author")
    except (OSError, ValueError):
        pass

    # Community "curated-here" GO from the live curation overrides
    try:
        ov = json.loads((CURATOR_STATE / "curation_overrides.json").read_text())
        for ddb, fields in ov.items():
            cur = (fields or {}).get("curated_go")
            if not isinstance(cur, dict):
                continue
            for aspect in ("P", "F", "C"):
                for e in (cur.get(aspect) or []):
                    if e:
                        add(ddb, e[0], aspect, None, "community")
    except (OSError, ValueError):
        pass

    _pred_raw = per
    return _pred_raw


def predicted_terms(gomer_min=GOMER_DEFAULT_MIN):
    """{ddb -> [(gid, aspect, name)]}; Gomer terms kept only at score >= gomer_min."""
    out = {}
    for ddb, terms in _load_predicted_raw().items():
        keep = []
        for gid, (aspect, name, source, score) in terms.items():
            if source == "gomer" and (score is None or score < gomer_min):
                continue
            keep.append((gid, aspect, name))
        if keep:
            out[ddb] = keep
    return out


def _state_for(include_predicted, gomer_min=GOMER_DEFAULT_MIN):
    """Base annotation state, or a copy augmented with the predicted layers."""
    st = _load()
    if not include_predicted:
        return st
    gene_terms = {d: set(t) for d, t in st["gene_terms"].items()}
    term_genes = {g: set(s) for g, s in st["term_genes"].items()}
    term_aspect = dict(st["term_aspect"])
    names = dict(st["names"])
    for ddb, rows in predicted_terms(gomer_min).items():
        for gid, aspect, name in rows:
            gene_terms.setdefault(ddb, set()).add(gid)
            term_genes.setdefault(gid, set()).add(ddb)
            term_aspect.setdefault(gid, aspect)
            if name and gid not in names:
                names[gid] = name
    aug = dict(st)
    aug.update(gene_terms=gene_terms, term_genes=term_genes,
               term_aspect=term_aspect, names=names, annotated=set(gene_terms))
    return aug
