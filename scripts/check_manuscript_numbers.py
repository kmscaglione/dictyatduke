#!/usr/bin/env python3
"""Re-derive every count claimed in the NAR manuscript from the shipped assets.

Run before submission (and after any data rebuild) so no figure in the paper
drifts from what the site actually serves:

    python3 scripts/check_manuscript_numbers.py

Exits non-zero if any claim disagrees with the data. Update CLAIMS when the
manuscript text changes, never the derivation.

Two counts cannot be derived from the shipped assets and are reported as
UNVERIFIABLE rather than silently passed:
  * bacterial strains  - stock_center.json merges REGULAR + BACTERIAL and does
    not retain the split; re-running build_stock_center.py records it in _meta.
  * API endpoint count - derived from serve.py below, but "approximately" in the
    prose makes an exact match meaningless; check the order of magnitude.
"""

import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

# What the manuscript currently asserts. Keep in sync with the text.
CLAIMS = {
    "protein-coding genes": 13892,
    "genes with a curated phenotype": 1197,
    "genes with a human ortholog": 3330,
    "genes linked to a human disease": 1502,
    "KEGG genes": 1927,
    "KEGG pathways": 131,
    "developmental proteome proteins": 4502,
    "insoluble/heat-stress proteome proteins": 8043,
    "machine-generated annotation genes": 1374,
    "genes with >=1 GO annotation": 8659,
    "hosted genome assemblies": 20,
    "BLAST-searchable genomes": 19,
    "stock centre strains": 7055,
    "strains in stock": 2130,
    "stock centre plasmids": 1265,
    "GWDI strains (approx)": 21500,
    "screen strains": 2257,
    "screen strains with a defect": 387,
    "screen strains linked to a gene": 337,
    "distinct genes in the screen": 382,
    "orderable screen strains": 1111,
    "genes with an orderable strain": 269,
    "imaging runs with a movie": 3317,
    "teaching lab protocols": 30,
}


def load(name):
    with open(os.path.join(ASSETS, name)) as fh:
        return json.load(fh)


def keys(d):
    return [k for k in d if k != "_meta"]


def derive():
    out = {}

    out["protein-coding genes"] = len(load("gene_index.json"))

    out["genes with a curated phenotype"] = len(keys(load("phenotypes.json")))

    od = load("ortholog_disease.json")
    out["genes with a human ortholog"] = sum(1 for v in od.values() if v.get("orthologs"))
    out["genes linked to a human disease"] = sum(
        1 for v in od.values() if any(o.get("diseases") for o in v.get("orthologs", [])))

    kegg = load("kegg_pathways.json")
    out["KEGG genes"] = len(keys(kegg))
    paths = set()
    for v in kegg.values():
        for p in (v if isinstance(v, list) else []):
            paths.add(p.get("id") or p.get("pathway") or str(p))
    out["KEGG pathways"] = len(paths)

    out["developmental proteome proteins"] = len(keys(load("proteomics_data.json")))
    out["insoluble/heat-stress proteome proteins"] = len(keys(load("heatstress_data.json")))
    out["machine-generated annotation genes"] = len(keys(load("ai_curation.json")))

    # GO coverage: gene_annotations.json is what /api/bulk?dataset=go-gaf exports.
    ga = load("gene_annotations.json")
    go_genes = go_rows = 0
    for k in keys(ga):
        go = (ga[k] or {}).get("go") or {}
        n = sum(len(go.get(a, [])) for a in ("P", "F", "C"))
        go_rows += n
        go_genes += 1 if n else 0
    out["genes with >=1 GO annotation"] = go_genes
    out["_GAF rows exported"] = go_rows          # informational; downloads page cites this

    # genomes: one per assembly prefix carrying a browser FASTA
    # one entry per assembly: most carry <name>_browser.fna, AX4 ships <name>_genome.fna
    gdir = os.path.join(ASSETS, "genomes")
    asm = set()
    for f in os.listdir(gdir):
        for suffix in ("_browser.fna", "_genome.fna"):
            if f.endswith(suffix):
                asm.add(f[: -len(suffix)])
    asm.discard("0")
    out["hosted genome assemblies"] = len(asm)
    src = open(os.path.join(ROOT, "serve.py")).read()
    m = re.search(r"BLAST_DBS\s*=\s*\{(.*?)\n\}", src, re.S)
    out["BLAST-searchable genomes"] = len(re.findall(r'"[a-z0-9.\-]+"\s*:', m.group(1))) if m else -1

    sc = load("stock_center.json")
    out["stock centre strains"] = len(sc["strains"])
    out["strains in stock"] = sum(1 for s in sc["strains"] if s.get("in_stock") is True)
    out["stock centre plasmids"] = len(sc["plasmids"])
    out["GWDI strains (approx)"] = len(load("stock_gwdi.json")["strains"])

    sw = load("sawai2007.json")
    st = sw["strains"]
    out["screen strains"] = len(st)
    out["screen strains with a defect"] = sum(
        1 for s in st if any(v.get("call") not in (None, "normal")
                             for v in (s.get("scores") or {}).values()))
    linked = [s for s in st if s.get("ddb_g")]
    out["screen strains linked to a gene"] = len(linked)
    ids = set()
    for s in linked:
        v = s["ddb_g"]
        ids.update(v if isinstance(v, list) else [v])
    out["distinct genes in the screen"] = len(ids)
    ob = sw["orderable_by_gene"]
    out["genes with an orderable strain"] = len(ob)
    # Each value is {"gwdi": [...], "dsc": [...], "n_gwdi": N, "n_dsc": N}. The stored
    # lists are capped at 20 per gene for display, so the n_* counters are the totals.
    out["orderable screen strains"] = sum(
        v.get("n_gwdi", 0) + v.get("n_dsc", 0) for v in ob.values())
    out["imaging runs with a movie"] = sw["_meta"]["counts"]["runs_with_movie"]

    labs = os.path.join(ASSETS, "teaching-labs")
    out["teaching lab protocols"] = len(os.listdir(labs))

    # public REST endpoints (curator routes excluded)
    eps = {e.rstrip("/.") for e in re.findall(r"/api/[a-zA-Z0-9_./-]+", src)}
    out["_public API endpoints"] = len([e for e in eps if not e.startswith("/api/curator")])
    return out


def main():
    got = derive()
    width = max(len(k) for k in got)
    bad = 0
    print(f"{'claim':<{width}}  {'manuscript':>10}  {'data':>10}   status")
    print("-" * (width + 34))
    for k, v in got.items():
        if k.startswith("_"):
            print(f"{k[1:]:<{width}}  {'-':>10}  {v:>10,}   (informational)")
            continue
        want = CLAIMS.get(k)
        if want is None:
            print(f"{k:<{width}}  {'-':>10}  {v:>10,}   (no claim)")
            continue
        # "approximately" figures: pass within 2%
        near = k.endswith("(approx)") and abs(v - want) <= max(1, want * 0.02)
        ok = v == want or near
        bad += 0 if ok else 1
        print(f"{k:<{width}}  {want:>10,}  {v:>10,}   {'OK' if ok else '*** MISMATCH ***'}")

    print("\nUNVERIFIABLE from shipped assets:")
    print("  bacterial strains  - manuscript says 22; stock_center.json does not retain the")
    print("                       REGULAR/BACTERIAL split. Re-run build_stock_center.py to")
    print("                       record it, or query the DSC API directly.")
    print(f"\n{bad} mismatch(es).")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
