#!/usr/bin/env python3
"""Overlay dictyBase's authoritative gene names onto assets/gene_index.json.

gene_index.json is built from the NCBI RefSeq AX4 GFF, whose `gene=` symbols lag
dictyBase's live nomenclature — so ~700 named genes showed only their DDB_G id and
~150 carried an out-of-date symbol. dictyBase's own gene_information.txt (a clean
GENE ID / Gene Name / Synonyms / Gene products table) is the naming authority, so
we use its Gene Name column as the source of truth for every gene's symbol.

  - a gene dictyBase names (real symbol, not a DDB_G id) -> use that symbol
  - a gene dictyBase leaves unnamed / that isn't in the file -> keep what we have

Standard library only. Run after build_gene_index (or standalone on the committed
gene_index.json):

  python3 scripts/build_gene_names.py                 # download the current file
  python3 scripts/build_gene_names.py --file PATH     # use a local gene_information.txt
"""
import csv
import json
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
IDX = ASSETS / "gene_index.json"
# dictyBase's official gene-names download (dictybase.dev is a SPA / GraphQL and
# exposes no clean symbol; this file's Gene Name column is the canonical source).
URL = "http://dictybase.org/db/cgi-bin/dictyBase/download/download.pl?area=general&ID=gene_information.txt"
UA = "dictyBase-data-sync/1.0 (+https://dicty.labs.duke.edu)"


def load_names(text):
    """DDB_G -> canonical gene symbol (only real names, not DDB_G-based ones)."""
    names = {}
    for row in csv.reader(text.splitlines(), delimiter="\t"):
        if len(row) < 2:
            continue
        ddb, nm = row[0].strip(), row[1].strip()
        if ddb.startswith("DDB_G") and nm and not nm.startswith(ddb):
            names[ddb] = nm
    return names


def main():
    if "--file" in sys.argv:
        text = pathlib.Path(sys.argv[sys.argv.index("--file") + 1]).read_text(errors="replace")
    else:
        print(f"  downloading {URL}")
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        text = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")
    names = load_names(text)
    print(f"  dictyBase names loaded: {len(names)}")

    idx = json.loads(IDX.read_text())
    filled = updated = unchanged = 0
    for r in idx:
        ddb, cur = r[0], r[1]
        new = names.get(ddb)
        if not new or new == cur:
            unchanged += 1
            continue
        if cur.startswith("DDB_G"):
            filled += 1          # was unnamed, now has a symbol
        else:
            updated += 1         # replaced an out-of-date symbol
        r[1] = new
    # re-sort by symbol so the catalog ordering stays consistent with build_gene_index
    idx.sort(key=lambda r: r[1].lower())
    IDX.write_text(json.dumps(idx, separators=(",", ":"), ensure_ascii=False))
    named = sum(1 for r in idx if not r[1].startswith("DDB_G"))
    print(f"  filled (were unnamed):     {filled}")
    print(f"  updated to dictyBase name: {updated}")
    print(f"  unchanged:                 {unchanged}")
    print(f"  -> {named} of {len(idx)} genes now carry a symbol")


if __name__ == "__main__":
    main()
