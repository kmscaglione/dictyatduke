#!/usr/bin/env python3
"""Build assets/ortholog_disease.json — Dicty genes -> human orthologs -> disease.

Dictyostelium is a model for human disease (e.g. CLN5/Batten, mitochondrial
disease), so a gene's human ortholog and that ortholog's disease associations are
high-value context. There is no local ortholog dataset, so this script builds one
from three open sources and joins them:

  1. UniProt (CC BY 4.0)  -- D. discoideum proteins: entry-name -> DDB_G id +
     gene symbol. This is the join key back to our gene records.
  2. OMA Browser (CC BY-SA 2.5) -- Dicty<->human ortholog pairs (entry-name
     mnemonics + relationship type). Only ~4,860 pairs, so a few paged calls.
  3. HPO annotations (genes_to_disease.txt + phenotype.hpoa) -- human gene
     symbol -> disease ids + names (OMIM / Orphanet / DECIPHER).

LICENSING NOTE: disease associations/names sourced from OMIM via HPO carry
OMIM's redistribution terms. The output _meta records every source + license;
review before any public launch (see the project's legal launch-blocker). Run
with ORPHA_ONLY=1 to keep only the openly-licensed Orphanet subset.

Raw downloads are cached under /tmp so re-runs are fast and resumable.
Usage:  python3 scripts/build_ortholog_disease.py
"""
import datetime
import json
import os
import pathlib
import re
import ssl
import sys
import urllib.request

# Match serve.py: this environment lacks a local CA bundle for urllib (curl
# works, urllib doesn't). We only fetch public reference data over HTTPS.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ortholog_disease.json"
CACHE = pathlib.Path("/tmp/odbuild")
CACHE.mkdir(exist_ok=True)
ORPHA_ONLY = os.environ.get("ORPHA_ONLY") == "1"

UA = {"User-Agent": "dictyBase ortholog-disease build (research)"}


def _fetch(url, attempts=4):
    """GET bytes with retry/backoff for transient 5xx / network hiccups."""
    import time
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90, context=SSL_CTX) as r:
                return r.read()
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            code = getattr(e, "code", None)
            if code and code < 500 and code != 429:
                raise  # genuine client error -- don't retry
            time.sleep(2 * (i + 1))
    raise last


def _get(url, cache_name, binary=False):
    """GET with on-disk cache; returns text (or bytes)."""
    cached = CACHE / cache_name
    if cached.exists():
        return cached.read_bytes() if binary else cached.read_text(encoding="utf-8")
    data = _fetch(url)
    cached.write_bytes(data)
    return data if binary else data.decode("utf-8", "replace")


# ---------------------------------------------------------------- UniProt ----
def uniprot_entryname_to_gene():
    """{UNIPROT_ENTRYNAME or ACCESSION (upper): (DDB_G id, symbol)} for D. discoideum.

    Keyed by both the entry name (e.g. CAPZB_DICDI) and the accession (e.g.
    Q8I7P3) because OMA's canonicalid is the entry name for reviewed proteins but
    the bare accession for unreviewed ones.
    """
    fields = "accession,id,gene_primary,xref_dictybase"
    base = ("https://rest.uniprot.org/uniprotkb/search?"
            f"query=organism_id:44689&fields={fields}&format=tsv&size=500")
    out = {}
    url, page = base, 0
    while url:
        page += 1
        cache_name = f"uniprot_{page:03d}.tsv"
        cached = CACHE / cache_name
        if cached.exists():
            text = cached.read_text(encoding="utf-8")
            nxt = (CACHE / f"{cache_name}.next")
            url = nxt.read_text().strip() if nxt.exists() else None
        else:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
                text = r.read().decode("utf-8", "replace")
                link = r.headers.get("Link", "")
            # NB: the URL contains literal commas (fields=a,b,c), so match the
            # whole <...>; rel="next" rather than splitting on commas.
            m = re.search(r'<([^>]+)>;\s*rel="next"', link)
            url = m.group(1) if m else None
            cached.write_text(text, encoding="utf-8")
            (CACHE / f"{cache_name}.next").write_text(url or "")
        for line in text.splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) < 4:
                continue
            acc, entryname, symbol, ddb = cols[0], cols[1], cols[2], cols[3]
            ddb = ddb.strip().rstrip(";").split(";")[0].strip()
            if ddb.startswith("DDB_G"):
                if entryname:
                    out[entryname.upper()] = (ddb, symbol)
                if acc:
                    out[acc.upper()] = (ddb, symbol)
        print(f"  uniprot page {page}: {len(out)} mapped", file=sys.stderr)
    return out


# -------------------------------------------------------------------- OMA ----
def oma_pairs():
    """[(dicty_entryname, human_symbol, human_entryname, rel_type), ...]."""
    pairs, page = [], 0
    while True:
        page += 1
        url = f"https://omabrowser.org/api/pairs/DICDI/HUMAN/?per_page=250&page={page}"
        text = _get(url, f"oma_pairs_{page:03d}.json")
        rows = json.loads(text)
        if not rows:
            break
        for e in rows:
            d = (e.get("entry_1") or {}).get("canonicalid") or ""
            h = (e.get("entry_2") or {}).get("canonicalid") or ""
            # Keep only human entries with a real UniProt mnemonic (SYMBOL_HUMAN);
            # the rest are bare RefSeq ids with no resolvable gene symbol.
            if not d or not h.endswith("_HUMAN"):
                continue
            pairs.append((d.upper(), h.split("_")[0], h, e.get("rel_type", "")))
        print(f"  oma page {page}: {len(pairs)} pairs", file=sys.stderr)
        if len(rows) < 250:
            break
    return pairs


# ------------------------------------------------------------- InParanoid ----
# InParanoiDB 9 (Persson & Sonnhammer, J Mol Biol 2023; CC BY-SA 4.0) covers
# D. discoideum, which OMA calls conservatively — InParanoid recovers many
# well-conserved Dicty<->human orthologs OMA misses. We keep only SEED orthologs
# (inparalog-score 1.0, the main 1:1 pair on each side) for higher confidence,
# and tag each ortholog with its supporting method so both-source calls read as
# high-confidence and single-source calls are visibly weaker (the DIOPT idea).
INPARANOID_URL = "https://inparanoidb.sbc.su.se/download/sqltable/44689&9606&prot"


def inparanoid_seed_pairs():
    """[(dicty_uniprot_acc, human_uniprot_acc), ...] seed orthologs, D.d.<->human."""
    text = _get(INPARANOID_URL, "inparanoid_44689_9606.tsv")
    groups = {}
    for line in text.splitlines():
        c = line.rstrip("\n").split("\t")
        if len(c) < 6:
            continue
        gid, sp, score, acc = c[0], c[2], c[3], c[4]
        try:
            if float(score) < 1.0:      # seed ortholog only (drop lower-score inparalogs)
                continue
        except ValueError:
            continue
        g = groups.setdefault(gid, {"d": [], "h": []})
        if sp.startswith("44689"):
            g["d"].append(acc.upper())
        elif sp.startswith("9606"):
            g["h"].append(acc.upper())
    pairs = [(d, h) for g in groups.values() for d in g["d"] for h in g["h"]]
    print(f"  inparanoid: {len(pairs)} seed Dicty<->human pairs", file=sys.stderr)
    return pairs


def human_uniprot_symbols():
    """Current human gene symbols keyed by BOTH UniProt accession and entry name.

    InParanoid's human side is a bare accession; OMA's canonicalid is the entry
    name (mnemonic, e.g. COR1A_HUMAN) whose embedded symbol can be stale and then
    fails to join to HPO (COR1A vs the current CORO1A). UniProt's gene_primary is
    the current symbol for both, so we resolve each side through it.
    Returns ({ACCESSION: symbol}, {ENTRYNAME: symbol})."""
    url = ("https://rest.uniprot.org/uniprotkb/stream?"
           "query=organism_id:9606+AND+reviewed:true&fields=accession,id,gene_primary&format=tsv")
    text = _get(url, "human_uniprot_symbols.tsv")
    by_acc, by_entry = {}, {}
    for line in text.splitlines()[1:]:
        c = line.split("\t")
        if len(c) < 3 or not c[2]:
            continue
        acc, entry, sym = c[0], c[1], c[2]
        if acc:
            by_acc[acc.upper()] = sym
        if entry:
            by_entry[entry.upper()] = sym
    return by_acc, by_entry


# -------------------------------------------------------------------- HPO ----
def hpo_gene_to_disease():
    """{human_symbol: [{id, name, source}, ...]}."""
    g2d = _get("https://purl.obolibrary.org/obo/hp/hpoa/genes_to_disease.txt",
               "hpo_genes_to_disease.txt")
    hpoa = _get("https://purl.obolibrary.org/obo/hp/hpoa/phenotype.hpoa",
                "hpo_phenotype.hpoa")
    # disease_id -> name
    names = {}
    for line in hpoa.splitlines():
        if line.startswith("#") or line.startswith("database_id"):
            continue
        c = line.split("\t")
        if len(c) >= 2 and c[0] and c[0] not in names:
            names[c[0]] = c[1]
    out = {}
    for line in g2d.splitlines():
        if line.startswith("ncbi_gene_id") or not line.strip():
            continue
        c = line.split("\t")
        if len(c) < 4:
            continue
        symbol, disease_id = c[1], c[3]
        source = disease_id.split(":")[0]
        if ORPHA_ONLY and source != "ORPHA":
            continue
        rec = {"id": disease_id, "name": names.get(disease_id, ""), "source": source}
        bucket = out.setdefault(symbol, [])
        if disease_id not in {d["id"] for d in bucket}:
            bucket.append(rec)
    return out


# ------------------------------------------------------- ORPHA name backfill --
# HPO's phenotype.hpoa lacks a display name for many Orphanet ids, so those
# disease rows fall back to showing a bare "ORPHA:xxxxx" code on the gene page.
# Resolve the missing names from Orphanet's ORDO ontology via EBI OLS4 (the same
# authority the on-page disease links point at).
def _orpha_label(num):
    cache = CACHE / f"orpha_{num}.txt"
    if cache.exists():
        return cache.read_text(encoding="utf-8").strip()
    url = ("https://www.ebi.ac.uk/ols4/api/ontologies/ordo/terms?"
           f"iri=http://www.orpha.net/ORDO/Orphanet_{num}")
    label = ""
    try:
        d = json.loads(_fetch(url))
        terms = d.get("_embedded", {}).get("terms", [])
        label = (terms[0].get("label") or "") if terms else ""
    except Exception:
        label = ""
    cache.write_text(label, encoding="utf-8")
    return label


def backfill_orpha_names(data):
    """Fill empty `name` for ORPHA disease ids in-place; return rows filled."""
    import time
    missing = set()
    for k, entry in data.items():
        if k.startswith("_"):
            continue
        for o in entry.get("orthologs", []):
            for dis in o.get("diseases", []):
                if dis.get("id", "").startswith("ORPHA:") and not dis.get("name"):
                    missing.add(dis["id"])
    resolved = {}
    for i, did in enumerate(sorted(missing), 1):
        label = _orpha_label(did.split(":")[1])
        if label:
            resolved[did] = label
        if i % 25 == 0:
            print(f"  resolved {i}/{len(missing)} ORPHA names", file=sys.stderr)
        time.sleep(0.05)  # be polite to OLS4
    filled = 0
    for k, entry in data.items():
        if k.startswith("_"):
            continue
        for o in entry.get("orthologs", []):
            for dis in o.get("diseases", []):
                if not dis.get("name") and dis.get("id") in resolved:
                    dis["name"] = resolved[dis["id"]]
                    filled += 1
    print(f"  backfilled {filled} rows from {len(resolved)}/{len(missing)} "
          "unique ORPHA ids", file=sys.stderr)
    return filled


def main():
    # Fast path: patch names into the existing JSON without a full re-fetch.
    if os.environ.get("PATCH_NAMES") == "1":
        data = json.loads(OUT.read_text(encoding="utf-8"))
        print("Backfilling missing ORPHA disease names via OLS4...", file=sys.stderr)
        filled = backfill_orpha_names(data)
        meta = data.setdefault("_meta", {})
        meta["orpha_names_backfilled"] = {
            "rows": filled, "on": datetime.date.today().isoformat(),
            "source": "Orphanet ORDO via EBI OLS4",
        }
        OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"patched {OUT}: {filled} names", file=sys.stderr)
        return 0

    print("Fetching UniProt D. discoideum entry-name -> DDB_G map...", file=sys.stderr)
    uni = uniprot_entryname_to_gene()
    print("Fetching OMA Dicty<->human ortholog pairs...", file=sys.stderr)
    pairs = oma_pairs()
    print("Fetching InParanoid Dicty<->human seed orthologs...", file=sys.stderr)
    inp = inparanoid_seed_pairs()
    print("Fetching UniProt human accession/entry-name -> current symbol...", file=sys.stderr)
    human_by_acc, human_by_entry = human_uniprot_symbols()
    print("Fetching HPO gene -> disease...", file=sys.stderr)
    hpo = hpo_gene_to_disease()

    # Merge both ortholog sources into one registry keyed by (DDB_G, human_symbol),
    # accumulating which method(s) support each call.
    orthos, oma_joined, oma_unmapped, inp_joined = {}, 0, 0, 0

    def add_ortho(ddb, dicty_symbol, human_symbol, human_uniprot, rel, source):
        o = orthos.setdefault((ddb, human_symbol), {
            "dicty_symbol": dicty_symbol, "human_uniprot": human_uniprot,
            "relationship": rel, "sources": set()})
        o["sources"].add(source)
        if not o["human_uniprot"] and human_uniprot:
            o["human_uniprot"] = human_uniprot
        if not o["relationship"] and rel:
            o["relationship"] = rel

    for dicty_en, human_symbol, human_en, rel in pairs:
        hit = uni.get(dicty_en)
        if not hit:
            oma_unmapped += 1
            continue
        oma_joined += 1
        # normalize OMA's (possibly stale) mnemonic symbol to UniProt's current one
        cur = human_by_entry.get(human_en.upper()) or human_symbol
        add_ortho(hit[0], hit[1], cur, human_en, rel, "OMA")

    for d_acc, h_acc in inp:
        hit = uni.get(d_acc)
        hs = human_by_acc.get(h_acc)
        if not hit or not hs:
            continue
        inp_joined += 1
        add_ortho(hit[0], hit[1], hs, h_acc, "", "InParanoid")

    data = {}
    for (ddb, human_symbol), o in orthos.items():
        entry = data.setdefault(ddb, {"symbol": o["dicty_symbol"], "orthologs": []})
        entry["orthologs"].append({
            "human_symbol": human_symbol,
            "human_uniprot": o["human_uniprot"],
            "relationship": o["relationship"],
            "sources": sorted(o["sources"]),
            "diseases": hpo.get(human_symbol, []),
        })
    joined, unmapped = oma_joined, oma_unmapped

    # Set each gene's display symbol from the catalog — dictyBase's authoritative
    # name, or the DDB_G id when unnamed — rather than UniProt's gene_primary, which
    # is sometimes blank or malformed. Keeps the table consistent with gene records
    # and avoids empty/garbled symbols.
    try:
        gi = json.loads((ROOT / "assets" / "gene_index.json").read_text())
        gsym = {r[0]: r[1] for r in gi if r and r[0]}
        for ddb, v in data.items():
            if ddb.startswith("_"):
                continue
            v["symbol"] = gsym.get(ddb) or ddb
    except Exception as exc:  # noqa: BLE001 — best-effort symbol refresh
        print(f"  (skipped gene_index symbol overlay: {exc})", file=sys.stderr)

    print("Backfilling missing ORPHA disease names via OLS4...", file=sys.stderr)
    backfill_orpha_names(data)

    genes_with_disease = sum(
        1 for v in data.values()
        if any(o["diseases"] for o in v["orthologs"]))
    both = sum(1 for v in data.values()
               for o in v["orthologs"] if len(o["sources"]) > 1)
    data["_meta"] = {
        "description": "Dictyostelium genes -> human orthologs -> disease, keyed by DDB_G id. "
        "Each ortholog carries the method(s) that support it (OMA and/or InParanoid).",
        "built": datetime.date.today().isoformat(),
        "counts": {
            "genes_with_ortholog": len([k for k in data if not k.startswith("_")]),
            "genes_with_disease": genes_with_disease,
            "oma_pairs": len(pairs),
            "joined": joined,
            "unmapped_dicty_side": unmapped,
            "inparanoid_seed_pairs": len(inp),
            "inparanoid_joined": inp_joined,
            "orthologs_supported_by_both": both,
        },
        "sources": [
            {"name": "OMA Browser", "use": "Dicty<->human orthologs",
             "license": "CC BY-SA 2.5", "url": "https://omabrowser.org/"},
            {"name": "InParanoiDB 9", "use": "Dicty<->human seed orthologs "
             "(Persson & Sonnhammer, J Mol Biol 2023)",
             "license": "CC BY-SA 4.0", "url": "https://inparanoidb.sbc.su.se/"},
            {"name": "UniProt", "use": "Dicty entry-name -> DDB_G id + symbol; human accession -> symbol",
             "license": "CC BY 4.0", "url": "https://www.uniprot.org/"},
            {"name": "Human Phenotype Ontology (HPO)", "use": "human gene -> disease",
             "license": "see hpo.jax.org; OMIM-derived entries carry OMIM terms",
             "url": "https://hpo.jax.org/"},
        ],
        "license_note": "Disease associations/names from OMIM (via HPO) carry "
        "OMIM redistribution terms; review before public launch. Re-run with "
        "ORPHA_ONLY=1 for the openly-licensed Orphanet-only subset.",
        "orpha_only": ORPHA_ONLY,
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}: {data['_meta']['counts']}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
