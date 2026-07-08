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


def enrich(tokens, background="annotated", min_study=2, max_terms=200):
    """Hypergeometric GO over-representation for a gene list.

    background: "annotated" (all GO-annotated genes) or "genome" (all genes).
    Returns a dict: {study_n, study_resolved, unmatched, background_n, results:[...]}.
    Each result: id, aspect, name, study_count, study_n, pop_count, pop_n,
    fold_enrichment, p_value, q_value, genes (matching DDB ids).
    """
    st = _load()
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


# --- Co-expression (Pearson over the Parikh developmental time course) -----
_coexp = {}
_COEXP_TPS = ["0", "4", "8", "12", "16", "20", "24"]


def _load_coexp():
    if _coexp:
        return _coexp
    rna = json.loads((ASSETS / "rnaseq_parikh.json").read_text())
    vecs = {}  # ddb -> (mean-centered 7-vector, norm)
    for ddb, vals in rna.items():
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
