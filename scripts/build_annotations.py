#!/usr/bin/env python3
"""Parse the GO Consortium dictyBase GAF into a rich, provenance-aware
per-gene annotation file: assets/annotations_imported.json

Each gene (keyed by DDB_G id) gets its GO annotations grouped by aspect with
evidence code, qualifier, reference (PMID), date, and who assigned it — plus a
distinct literature list (papers a curator actually read) and summary counts.

Usage:
    python3 scripts/build_annotations.py                 # download latest GAF
    python3 scripts/build_annotations.py --gaf FILE      # use a local .gaf or .gaf.gz

Standard library only. Pair with merge_curation.py to overlay your own curation.
"""
import gzip, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
# GO renamed the per-species GAFs: the old `dictybase.gaf.gz` alias is now FROZEN
# (it stopped updating, so we were ~5,000 dictyBase annotations behind). The live
# file is DICDI-mod.gaf.gz under /annotations/gaf/. Same content shape (keyed by
# DDB_G), just current. DICDI-uniprot.gaf.gz holds the ~500 extra external
# (InterPro/IntAct) annotations if we ever want to merge them too.
GAF_URL = "https://current.geneontology.org/annotations/gaf/DICDI-mod.gaf.gz"

# Evidence codes that mean "a curator read a paper / made a judgement"
MANUAL_EV = {"IDA", "IPI", "IMP", "IGI", "IEP",        # experimental
             "HTP", "HDA", "HMP", "HGI", "HEP",        # high-throughput
             "TAS", "NAS", "IC"}                        # author / curator statement
ASPECT = {"P": "biological_process", "F": "molecular_function", "C": "cellular_component"}


def _read_gaf(path):
    if path:
        opener = gzip.open if path.endswith(".gz") else open
        with opener(path, "rt", encoding="utf-8", errors="replace") as fh:
            yield from fh
    else:
        print(f"  downloading {GAF_URL}")
        raw = urllib.request.urlopen(GAF_URL, timeout=90).read()
        for line in gzip.decompress(raw).decode("utf-8", "replace").splitlines():
            yield line


def _date(d):
    return f"{d[0:4]}-{d[4:6]}-{d[6:8]}" if len(d) == 8 and d.isdigit() else d


def build(gaf_path=None):
    genes = {}
    rows = 0
    for line in _read_gaf(gaf_path):
        if not line or line.startswith("!"):
            continue
        c = line.rstrip("\n").split("\t")
        if len(c) < 15:
            continue
        ddb, sym, qual, go, ref, ev, asp, date, by = (
            c[1], c[2], c[3], c[4], c[5], c[6], c[8], c[13], c[14])
        if not ddb.startswith("DDB_G"):
            # the few UniProtKB-keyed rows carry the DDB_G id in synonyms (col 11)
            ddb = next((s for s in c[10].split("|") if s.startswith("DDB_G")), ddb)
        rows += 1
        g = genes.setdefault(ddb, {"symbol": sym, "go": {"P": [], "F": [], "C": []},
                                   "literature": [], "_lit": set(),
                                   "counts": {"total": 0, "manual": 0, "automated": 0, "papers": 0},
                                   "last_curated": "", "sources": []})
        if sym and sym != ddb and g["symbol"] in ("", ddb):
            g["symbol"] = sym
        manual = ev in MANUAL_EV
        if asp in g["go"]:
            g["go"][asp].append([go, ev, qual, ref, _date(date), by])
        g["counts"]["total"] += 1
        g["counts"]["manual" if manual else "automated"] += 1
        if by not in g["sources"]:
            g["sources"].append(by)
        if by == "dictyBase" and date > g["last_curated"].replace("-", ""):
            g["last_curated"] = _date(date)
        # literature = distinct papers behind manual annotations
        if manual:
            for tok in ref.split("|"):
                if tok.startswith("PMID:") and tok not in g["_lit"]:
                    g["_lit"].add(tok)
                    g["literature"].append(tok)
    for g in genes.values():
        g["counts"]["papers"] = len(g["_lit"])
        del g["_lit"]
    out = os.path.join(ASSETS, "annotations_imported.json")
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(genes, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote annotations_imported.json: {len(genes)} genes, {rows} annotations "
          f"({os.path.getsize(out)/1024:.0f} KB)")
    return genes


if __name__ == "__main__":
    gaf = None
    if "--gaf" in sys.argv:
        gaf = sys.argv[sys.argv.index("--gaf") + 1]
    build(gaf)
