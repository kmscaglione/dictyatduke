#!/usr/bin/env python3
"""Build genome-browser RNA-seq tracks from the Rosengarten et al. 2015 time course.

Turns per-gene normalized expression (assets/rnaseq_rosengarten.json) into one bedGraph per timepoint,
positioned by each gene's D. discoideum AX4 locus (from assets/gene_index.json),
so the IGV.js browser can overlay expression along the genome.

Output: one assets/tracks/rnaseq_{H}h.bedgraph per time point in the data
Run:    python3 scripts/build_rnaseq_tracks.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "tracks"
OUT.mkdir(exist_ok=True)

# Rosengarten 2015 filter-development hours: hourly to 12h, then every 2h to 24h.
TPS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12",
       "14", "16", "18", "20", "22", "24"]
LOC_RE = re.compile(r"^(\S+):([\d,]+)-([\d,]+)$")


def main():
    rna = json.loads((ASSETS / "rnaseq_rosengarten.json").read_text())
    index = json.loads((ASSETS / "gene_index.json").read_text())
    loc = {r[0]: r[3] for r in index if len(r) > 3 and r[3]}

    rows = {tp: [] for tp in TPS}
    placed = skipped = 0
    for ddb, vals in rna.items():
        if ddb.startswith("_"):        # skip _meta
            continue
        m = LOC_RE.match((loc.get(ddb) or "").strip())
        if not m:
            skipped += 1
            continue
        chrom = m.group(1)
        start = int(m.group(2).replace(",", "")) - 1  # bedGraph is 0-based
        end = int(m.group(3).replace(",", ""))
        if start < 0 or end <= start:
            skipped += 1
            continue
        placed += 1
        for tp in TPS:
            v = vals.get(tp)
            if v and v > 0:
                rows[tp].append((chrom, start, end, v))

    for tp in TPS:
        data = sorted(rows[tp], key=lambda x: (x[0], x[1]))
        with open(OUT / f"rnaseq_{tp}h.bedgraph", "w") as f:
            for chrom, s, e, v in data:
                f.write(f"{chrom}\t{s}\t{e}\t{v}\n")

    print(f"placed {placed} genes, skipped {skipped}; "
          f"wrote {len(TPS)} bedGraph tracks to {OUT}")


if __name__ == "__main__":
    main()
