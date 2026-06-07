#!/usr/bin/env python3
"""Build assets/gene_facets.json — compact per-gene facets for the advanced finder.

For each gene that has at least one facet, emit a 4-element array:
  ddb: [pheno, ortholog, disease, peak_stage]
where pheno/ortholog/disease are 0/1, and peak_stage is the index (0..6) of the
developmental time point (0,4,8,12,16,20,24 h) with the highest Parikh RNA-seq
value, or -1 if the gene is not meaningfully expressed (max RPKM < threshold).

Genes with no facet at all are omitted to keep the file small. The front-end
joins this against the already-loaded gene_index.json (symbol/name).

Sources: gene_index.json, phenotypes.json, ortholog_disease.json, rnaseq_parikh.json.
Re-run after any of those change:  python3 scripts/build_gene_facets.py
"""
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
PEAK_MIN_RPKM = 5.0
TIMEPOINTS = ["0", "4", "8", "12", "16", "20", "24"]


def load(name):
    return json.loads((ASSETS / name).read_text())


def main():
    index = load("gene_index.json")
    phenos = load("phenotypes.json")
    ortho = load("ortholog_disease.json")
    rna = load("rnaseq_parikh.json")

    facets = {}
    for row in index:
        ddb = row[0]
        p = 1 if ddb in phenos else 0
        od = ortho.get(ddb) or {}
        orths = od.get("orthologs", []) if isinstance(od, dict) else []
        o = 1 if orths else 0
        d = 1 if any(x.get("diseases") for x in orths) else 0
        peak = -1
        prof = rna.get(ddb)
        if prof:
            best_i, best_v = -1, -1.0
            for i, tp in enumerate(TIMEPOINTS):
                v = float(prof.get(tp, 0) or 0)
                if v > best_v:
                    best_v, best_i = v, i
            if best_v >= PEAK_MIN_RPKM:
                peak = best_i
        if p or o or d or peak >= 0:
            facets[ddb] = [p, o, d, peak]

    out = ASSETS / "gene_facets.json"
    out.write_text(json.dumps(facets, separators=(",", ":")))
    n = len(facets)
    counts = (
        sum(1 for v in facets.values() if v[0]),
        sum(1 for v in facets.values() if v[1]),
        sum(1 for v in facets.values() if v[2]),
        sum(1 for v in facets.values() if v[3] >= 0),
    )
    print(f"Wrote {out.relative_to(ROOT)} — {n} genes "
          f"({counts[0]} pheno, {counts[1]} ortholog, {counts[2]} disease, {counts[3]} expressed) "
          f"· {out.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
