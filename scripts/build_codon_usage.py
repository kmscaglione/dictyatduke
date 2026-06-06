#!/usr/bin/env python3
"""Compute the D. discoideum codon-usage table from AX4 CDS -> JSON.

Dictyostelium is extremely AT-rich, so codon-optimizing heterologous genes needs
the organism's real codon preferences. This extracts every gene's CDS (from
gene_models.json + the AX4 genome FASTA), counts codons, and writes per-amino-
acid frequencies + the preferred codon + relative adaptiveness (for CAI).

Output: assets/dicty_codon_usage.json
Run:    python3 scripts/build_codon_usage.py
"""
import collections
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
FASTA = ASSETS / "genomes" / "D_discoideum_AX4_refseq.fna"
MODELS = ASSETS / "gene_models.json"
OUT = ASSETS / "dicty_codon_usage.json"

CODON_TABLE = {  # standard genetic code
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "CTT": "L", "CTC": "L",
    "CTA": "L", "CTG": "L", "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V", "TCT": "S", "TCC": "S",
    "TCA": "S", "TCG": "S", "AGT": "S", "AGC": "S", "CCT": "P", "CCC": "P",
    "CCA": "P", "CCG": "P", "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A", "TAT": "Y", "TAC": "Y",
    "TAA": "*", "TAG": "*", "TGA": "*", "CAT": "H", "CAC": "H", "CAA": "Q",
    "CAG": "Q", "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K", "GAT": "D",
    "GAC": "D", "GAA": "E", "GAG": "E", "TGT": "C", "TGC": "C", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}
COMP = str.maketrans("ACGTacgt", "TGCAtgca")


def load_fasta(path):
    seqs, name, buf = {}, None, []
    for line in path.read_text().splitlines():
        if line.startswith(">"):
            if name:
                seqs[name] = "".join(buf)
            name, buf = line[1:].split()[0], []
        else:
            buf.append(line.strip())
    if name:
        seqs[name] = "".join(buf)
    return seqs


def main():
    genome = load_fasta(FASTA)
    models = json.loads(MODELS.read_text())
    counts = collections.Counter()
    genes = 0
    for m in models.values():
        cds = m.get("cds")
        if not cds:
            continue
        chrom = genome.get(m["chrom"])
        if not chrom:
            continue
        seq = "".join(chrom[s - 1:e] for s, e in sorted(cds))
        if m["strand"] == "-":
            seq = seq.translate(COMP)[::-1]
        seq = seq.upper()
        ok = False
        for i in range(0, len(seq) - 2, 3):
            cod = seq[i:i + 3]
            if cod in CODON_TABLE:
                counts[cod] += 1
                ok = True
        genes += ok

    by_aa = collections.defaultdict(dict)
    for cod, aa in CODON_TABLE.items():
        by_aa[aa][cod] = counts.get(cod, 0)

    freq, preferred, rel_adapt = {}, {}, {}
    for aa, cods in by_aa.items():
        tot = sum(cods.values()) or 1
        best = max(cods, key=cods.get)
        preferred[aa] = best
        cmax = cods[best] or 1
        for cod, c in cods.items():
            freq[cod] = round(c / tot, 4)
            rel_adapt[cod] = round(c / cmax, 4)  # w_i for CAI

    OUT.write_text(json.dumps({
        "counts": dict(counts),
        "freq_within_aa": freq,
        "preferred": preferred,
        "relative_adaptiveness": rel_adapt,
        "genes_counted": genes,
    }, indent=2) + "\n")
    print(f"codon usage from {genes} genes -> {OUT}")
    # quick AT-richness sanity print: preferred codons should skew AT
    print("  preferred (sample):", {a: preferred[a] for a in "FLIVK"})


if __name__ == "__main__":
    main()
