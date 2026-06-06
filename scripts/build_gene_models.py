#!/usr/bin/env python3
"""Extract per-gene exon/CDS structure from the AX4 GFF -> assets/gene_models.json.

For each D. discoideum gene, records its representative transcript's exon and CDS
spans so the gene record can draw a transcript (exon/intron) diagram.

Output (keyed by DDB_G id):
  { "DDB_G...": {chrom, strand, start, end, exons:[[s,e],...], cds:[[s,e],...]} }
Run:  python3 scripts/build_gene_models.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
GFF = ROOT / "assets" / "genomes" / "D_discoideum_AX4.gff"
OUT = ROOT / "assets" / "gene_models.json"

DDB_RE = re.compile(r"DDB_G\d+")


def attrs(col9):
    d = {}
    for kv in col9.strip().split(";"):
        if "=" in kv:
            k, v = kv.split("=", 1)
            d[k] = v
    return d


def main():
    genes = {}          # gene-ID -> {ddb, chrom, strand, start, end}
    gene_first_rna = {}  # gene-ID -> first rna-ID
    rna_parent = {}     # rna-ID -> gene-ID
    exons = {}          # rna-ID -> [(s,e)]
    cds = {}            # rna-ID -> [(s,e)]

    for line in GFF.read_text().splitlines():
        if line.startswith("#") or "\t" not in line:
            continue
        f = line.split("\t")
        if len(f) < 9:
            continue
        chrom, ftype, start, end, strand, a = f[0], f[2], f[3], f[4], f[6], attrs(f[8])
        start, end = int(start), int(end)
        if ftype in ("gene", "pseudogene"):
            gid = a.get("ID", "")
            m = DDB_RE.search(a.get("Dbxref", "")) or DDB_RE.search(gid)
            if not m:
                continue
            genes[gid] = {"ddb": m.group(0), "chrom": chrom, "strand": strand,
                          "start": start, "end": end}
        elif ftype in ("mRNA", "tRNA", "rRNA", "ncRNA", "snoRNA", "snRNA", "scRNA"):
            rid, par = a.get("ID", ""), a.get("Parent", "")
            rna_parent[rid] = par
            gene_first_rna.setdefault(par, rid)
        elif ftype == "exon":
            exons.setdefault(a.get("Parent", ""), []).append((start, end))
        elif ftype == "CDS":
            cds.setdefault(a.get("Parent", ""), []).append((start, end))

    out = {}
    for gid, g in genes.items():
        rid = gene_first_rna.get(gid)
        ex = sorted(exons.get(rid, []))
        cd = sorted(cds.get(rid, []))
        out[g["ddb"]] = {
            "chrom": g["chrom"], "strand": g["strand"],
            "start": g["start"], "end": g["end"],
            "exons": [[s, e] for s, e in ex],
            "cds": [[s, e] for s, e in cd],
        }

    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    multi = sum(1 for v in out.values() if len(v["exons"]) > 1)
    print(f"wrote {OUT}: {len(out)} genes ({multi} multi-exon)")


if __name__ == "__main__":
    main()
