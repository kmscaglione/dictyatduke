#!/usr/bin/env python3
"""Build assets/dup_expression.json — the chromosome-2 duplication expression map.

The AX4 strain carries a large partial duplication of chromosome 2, so many genes
exist as two near-identical copies named `X-1` and `X-2` (e.g. carA-1 / carA-2).
RNA-seq reads map to both copies indistinguishably, so the quantifier assigns them
to just one copy — the other shows an empty expression profile even though the gene
is expressed.

This maps each empty duplicate copy -> its sibling that carries the data, so the
gene page can show the (shared) profile on both copies with a note. Scope: pairs
where BOTH copies sit on chromosome 2 (NC_007088) and exactly one has expression —
the documented duplication, so the "chromosome 2" note is always accurate.

Output: { empty_ddb: {"from": sibling_ddb, "symbol": sibling_symbol}, ... }
Run:    python3 scripts/build_dup_expression.py
"""
import collections
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
CHR2 = "NC_007088"   # D. discoideum chromosome 2 (RefSeq NC_007088.x)


def has_expr(prof):
    return bool(prof and any(v for k, v in prof.items() if not str(k).startswith("_")))


def main():
    idx = json.loads((ASSETS / "gene_index.json").read_text())
    rna = json.loads((ASSETS / "rnaseq_rosengarten.json").read_text())

    # group X-1 / X-2 siblings by their base symbol
    pairs = collections.defaultdict(dict)
    row = {}
    for r in idx:
        sym = r[1]
        row[r[0]] = r
        if sym.endswith("-1") or sym.endswith("-2"):
            pairs[sym[:-2]][sym[-1]] = r

    out = {}
    for base, d in pairs.items():
        if "1" not in d or "2" not in d:
            continue
        r1, r2 = d["1"], d["2"]
        # both copies on chromosome 2 (the documented AX4 duplication)
        if not (r1[3].startswith(CHR2 + ".") and r2[3].startswith(CHR2 + ".")):
            continue
        h1, h2 = has_expr(rna.get(r1[0])), has_expr(rna.get(r2[0]))
        if h1 == h2:              # need exactly one copy with data
            continue
        have, empty = (r1, r2) if h1 else (r2, r1)
        out[empty[0]] = {"from": have[0], "symbol": have[1]}

    (ASSETS / "dup_expression.json").write_text(
        json.dumps({**out, "_meta": {
            "description": "Chromosome-2 duplication: empty duplicate copy -> sibling copy carrying the RNA-seq profile.",
            "chromosome": "2 (NC_007088)", "pairs": len(out)}},
            separators=(",", ":")))
    print(f"  wrote assets/dup_expression.json ({len(out)} chr-2 duplicate copies mapped to their expressed sibling)")
    for k, v in list(out.items())[:5]:
        print(f"    {row[k][1]:10} ({k}) -> {v['symbol']} ({v['from']})")


if __name__ == "__main__":
    main()
