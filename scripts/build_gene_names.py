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


def load_file(text):
    """DDB_G -> (canonical gene symbol, [synonyms]) from the gene_information table.

    Column 1 is the Gene Name (canonical symbol); column 2 is a comma-separated
    Synonyms list (old symbols and alternate names). Only real names are kept as
    the symbol (a DDB_G-based 'name' means dictyBase leaves the gene unnamed)."""
    names, syns = {}, {}
    for row in csv.reader(text.splitlines(), delimiter="\t"):
        if len(row) < 2:
            continue
        ddb, nm = row[0].strip(), row[1].strip()
        if not ddb.startswith("DDB_G"):
            continue
        if nm and not nm.startswith(ddb):
            names[ddb] = nm
        raw = row[2] if len(row) > 2 else ""
        syns[ddb] = [s.strip() for s in raw.split(",") if s.strip()]
    return names, syns


def symbol_like(s):
    """Keep synonyms usable as search aliases: short, symbol-shaped, no spaces
    (drops descriptive phrases like 'folic acid receptor 1' that bloat the index
    and add nothing a name/description search doesn't already cover)."""
    return s and " " not in s and len(s) <= 25


def clean_aliases(raw, symbol, ddb, extra):
    """Dedupe (case-insensitively) symbol-like synonyms; drop the symbol/ddb itself."""
    seen, out = set(), []
    skip = {symbol.lower(), ddb.lower()}
    for s in list(raw) + list(extra):
        lo = s.lower()
        if not symbol_like(s) or lo in skip or lo in seen:
            continue
        seen.add(lo)
        out.append(s)
    return out


def main():
    if "--file" in sys.argv:
        text = pathlib.Path(sys.argv[sys.argv.index("--file") + 1]).read_text(errors="replace")
    else:
        print(f"  downloading {URL}")
        req = urllib.request.Request(URL, headers={"User-Agent": UA})
        text = urllib.request.urlopen(req, timeout=90).read().decode("utf-8", "replace")
    names, syns = load_file(text)
    print(f"  dictyBase names loaded: {len(names)}")

    idx = json.loads(IDX.read_text())
    filled = updated = unchanged = with_syn = 0
    for r in idx:
        ddb, cur = r[0], r[1]
        new = names.get(ddb)
        extra = []
        if new and new != cur:
            if cur.startswith("DDB_G"):
                filled += 1      # was unnamed, now has a symbol
            else:
                updated += 1     # replaced an out-of-date symbol — keep it searchable
                extra.append(cur)
            r[1] = new
        else:
            unchanged += 1
        # attach searchable aliases (dictyBase synonyms + the symbol we replaced) as
        # a 6th field, so the old name still resolves after a rename. Idempotent.
        aliases = clean_aliases(syns.get(ddb, []), r[1], ddb, extra)
        if len(r) >= 6:
            r[5] = aliases
        else:
            r.append(aliases)
        if aliases:
            with_syn += 1
    # re-sort by symbol so the catalog ordering stays consistent with build_gene_index
    idx.sort(key=lambda r: r[1].lower())
    IDX.write_text(json.dumps(idx, separators=(",", ":"), ensure_ascii=False))
    named = sum(1 for r in idx if not r[1].startswith("DDB_G"))
    print(f"  filled (were unnamed):     {filled}")
    print(f"  updated to dictyBase name: {updated}")
    print(f"  unchanged:                 {unchanged}")
    print(f"  genes with search aliases: {with_syn}")
    print(f"  -> {named} of {len(idx)} genes now carry a symbol")


if __name__ == "__main__":
    main()
