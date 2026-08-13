#!/usr/bin/env python3
"""Re-derive every count claimed in the NAR manuscript from the shipped assets.

Run before submission (and after any data rebuild) so no figure in the paper
drifts from what the site actually serves:

    python3 scripts/check_manuscript_numbers.py

Exits non-zero if any claim disagrees with the data. Update CLAIMS when the
manuscript text changes, never the derivation.

Counting notes, each of which cost a wrong answer once:
  * Strain totals are DISTINCT ids. The DSC API returns the bacterial food strains
    under both REGULAR and BACTERIAL, so the stored list carries duplicate rows.
  * Orderable screen strains come from the n_gwdi/n_dsc counters, not the stored
    lists, which are capped at 20 per gene for display.
  * A screen strain's ddb_g is a list; one insertion can disrupt several genes.
  * GO coverage comes from gene_annotations.json, the source /api/bulk?dataset=
    go-gaf exports, not from go_annotations.json.
  * Endpoints are counted from the request dispatch, not from string matches.

Bacterial strain count is reported UNVERIFIABLE rather than silently passed:
stock_center.json does not retain the REGULAR/BACTERIAL split.
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
    "data + analysis API endpoints": 40,
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

    # Count DISTINCT ids: bacterial food strains come back from both the REGULAR and
    # BACTERIAL queries, so the stored list carries byte-identical duplicate rows.
    sc = load("stock_center.json")
    by_id = {}
    for s in sc["strains"]:
        by_id.setdefault(s["id"], []).append(s)
    out["stock centre strains"] = len(by_id)
    out["strains in stock"] = sum(
        1 for rows in by_id.values() if any(r.get("in_stock") is True for r in rows))
    out["_duplicate strain rows"] = len(sc["strains"]) - len(by_id)
    out["stock centre plasmids"] = len({p["id"] for p in sc["plasmids"]})
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

    # REST endpoints, counted from the request dispatch rather than from string
    # matches (which pick up comments and external URLs such as AlphaFold's
    # /api/prediction). "approximately 40" in the paper means the data and analysis
    # surface, so auth, session and telemetry plumbing is excluded.
    def dispatch(marker):
        i = src.index(marker)
        j = src.find("\n    def ", i + 10)
        return src[i:j if j > 0 else len(src)]

    b = dispatch("    def do_GET(self):") + dispatch("    def do_POST(self):")
    eps = set(re.findall(r'(?:path|self\.path)\s*==\s*["\'](/api/[^"\']+)["\']', b))
    eps |= set(re.findall(
        r'(?:path|self\.path)\.split\(["\']\?["\']\)\[0\]\s*==\s*["\'](/api/[^"\']+)["\']', b))
    for m in re.finditer(r'(?:path|self\.path)\s+in\s+\(([^)]*)\)', b):
        eps |= set(re.findall(r'["\'](/api/[^"\']+)["\']', m.group(1)))
    eps |= set(re.findall(r'(?:path|self\.path)\.startswith\(["\'](/api/[^"\']+)["\']', b))
    eps |= set(re.findall(r're\.match\(r?["\']\^(/api/[a-zA-Z0-9_-]+)', b))
    eps = {e.split("?")[0].rstrip("/") for e in eps} - {"/api", "/api/phenotype-"}
    public = {e for e in eps if not e.startswith("/api/curator")}
    plumbing = {"/api/hit", "/api/health", "/api/job", "/api/ext", "/api/upload",
                "/api/version", "/api/stats", "/api/orcid/start", "/api/orcid/callback",
                "/api/paper-session", "/api/paper-session/submit", "/api/author-curation",
                "/api/gene-curation", "/api/analyze"}
    out["data + analysis API endpoints"] = len(public - plumbing)
    out["_all routed endpoints"] = len(eps)
    out["_public endpoints incl. plumbing"] = len(public)
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
