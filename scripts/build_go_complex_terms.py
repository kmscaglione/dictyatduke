#!/usr/bin/env python3
"""Build assets/go_complex_terms.json: the GO cellular component terms that are
a kind of "protein-containing complex" (GO:0032991). Only is_a is followed, so
a term is listed only when the ontology says it IS a complex.

    python3 scripts/build_go_complex_terms.py            # downloads go-basic.obo
    python3 scripts/build_go_complex_terms.py --obo FILE

Used by /api/enrichment with set=complexes. The Gene Ontology is CC BY 4.0.
"""
import argparse
import datetime
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OBO_URL = "https://current.geneontology.org/ontology/go-basic.obo"
COMPLEX = "GO:0032991"


def complex_terms(text):
    """-> (data_version, sorted ids that are COMPLEX or reach it through is_a)."""
    version = re.search(r"^data-version:\s*(\S+)", text, re.M)
    parents = {}
    for block in text.split("\n[Term]\n")[1:]:
        block = block.split("\n[Typedef]")[0]
        tid, isa, live = None, set(), True
        for line in block.splitlines():
            key, _, val = line.partition(": ")
            if key == "id":
                tid = val.strip()
            elif key == "is_a":
                isa.add(val.split(" ! ")[0].strip())
            elif key == "is_obsolete" and val.strip() == "true":
                live = False
        if tid and live:
            parents[tid] = isa
    found, changed = {COMPLEX} if COMPLEX in parents else set(), True
    while changed:
        changed = False
        for tid, isa in parents.items():
            if tid not in found and isa & found:
                found.add(tid)
                changed = True
    return (version.group(1) if version else None), sorted(found)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--obo")
    args = ap.parse_args()
    if args.obo:
        text = pathlib.Path(args.obo).read_text(encoding="utf-8")
    else:
        with urllib.request.urlopen(urllib.request.Request(OBO_URL, headers={"User-Agent": "dictyBase build"}), timeout=120) as r:
            text = r.read().decode("utf-8")
    version, ids = complex_terms(text)
    if len(ids) < 100:
        raise SystemExit("too few complex terms found (%d); is this go-basic.obo?" % len(ids))
    out = {"_meta": {"source": OBO_URL, "data_version": version, "license": "CC BY 4.0, Gene Ontology Consortium",
                     "root": COMPLEX, "relations": ["is_a"], "built": datetime.date.today().isoformat(),
                     "builder": "scripts/build_go_complex_terms.py"}, "terms": ids}
    (ROOT / "assets" / "go_complex_terms.json").write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print("%d complex terms, %s" % (len(ids), version))


if __name__ == "__main__":
    main()
