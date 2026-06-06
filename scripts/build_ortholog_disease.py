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

UA = {"User-Agent": "Dicty@Duke ortholog-disease build (research)"}


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


def main():
    print("Fetching UniProt D. discoideum entry-name -> DDB_G map...", file=sys.stderr)
    uni = uniprot_entryname_to_gene()
    print("Fetching OMA Dicty<->human ortholog pairs...", file=sys.stderr)
    pairs = oma_pairs()
    print("Fetching HPO gene -> disease...", file=sys.stderr)
    hpo = hpo_gene_to_disease()

    data, joined, unmapped = {}, 0, 0
    for dicty_en, human_symbol, human_en, rel in pairs:
        hit = uni.get(dicty_en)
        if not hit:
            unmapped += 1
            continue
        ddb, dicty_symbol = hit
        joined += 1
        diseases = hpo.get(human_symbol, [])
        entry = data.setdefault(ddb, {"symbol": dicty_symbol, "orthologs": []})
        if human_symbol not in {o["human_symbol"] for o in entry["orthologs"]}:
            entry["orthologs"].append({
                "human_symbol": human_symbol,
                "human_uniprot": human_en,
                "relationship": rel,
                "diseases": diseases,
            })

    genes_with_disease = sum(
        1 for v in data.values()
        if any(o["diseases"] for o in v["orthologs"]))
    data["_meta"] = {
        "description": "Dictyostelium genes -> human orthologs -> disease, keyed by DDB_G id.",
        "built": datetime.date.today().isoformat(),
        "counts": {
            "genes_with_ortholog": len([k for k in data if not k.startswith("_")]),
            "genes_with_disease": genes_with_disease,
            "oma_pairs": len(pairs),
            "joined": joined,
            "unmapped_dicty_side": unmapped,
        },
        "sources": [
            {"name": "OMA Browser", "use": "Dicty<->human orthologs",
             "license": "CC BY-SA 2.5", "url": "https://omabrowser.org/"},
            {"name": "UniProt", "use": "Dicty entry-name -> DDB_G id + symbol",
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
