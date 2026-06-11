#!/usr/bin/env python3
"""Write reference codon-usage tables for heterologous-expression hosts.

The Dicty table (assets/dicty_codon_usage.json) is computed from the AX4 CDS by
build_codon_usage.py. This script emits matching tables for the two other hosts
the codon optimizer offers — E. coli K-12 and human (Homo sapiens) — from
published genome-wide codon-usage fractions (Kazusa Codon Usage Database).

Output schema matches the Dicty table's optimizer-relevant fields:
  freq_within_aa          codon -> fraction of its amino acid
  preferred               amino acid -> most-frequent codon
  relative_adaptiveness   codon -> fraction / max-fraction within its aa (CAI w)
  source                  provenance note

Output: assets/ecoli_codon_usage.json, assets/human_codon_usage.json
Run:    python3 scripts/build_codon_tables.py
"""
import json
from pathlib import Path

ASSETS = Path(__file__).resolve().parent.parent / "assets"

# Codon-usage fractions within each amino acid (Kazusa Codon Usage Database).
# Each amino acid's synonymous codons sum to ~1.0.
HUMAN = {
    "F": {"TTT": 0.45, "TTC": 0.55},
    "L": {"TTA": 0.07, "TTG": 0.13, "CTT": 0.13, "CTC": 0.20, "CTA": 0.07, "CTG": 0.40},
    "I": {"ATT": 0.36, "ATC": 0.48, "ATA": 0.16},
    "M": {"ATG": 1.00},
    "V": {"GTT": 0.18, "GTC": 0.24, "GTA": 0.11, "GTG": 0.47},
    "S": {"TCT": 0.18, "TCC": 0.22, "TCA": 0.15, "TCG": 0.06, "AGT": 0.15, "AGC": 0.24},
    "P": {"CCT": 0.28, "CCC": 0.33, "CCA": 0.27, "CCG": 0.11},
    "T": {"ACT": 0.24, "ACC": 0.36, "ACA": 0.28, "ACG": 0.12},
    "A": {"GCT": 0.26, "GCC": 0.40, "GCA": 0.23, "GCG": 0.11},
    "Y": {"TAT": 0.43, "TAC": 0.57},
    "H": {"CAT": 0.41, "CAC": 0.59},
    "Q": {"CAA": 0.25, "CAG": 0.75},
    "N": {"AAT": 0.46, "AAC": 0.54},
    "K": {"AAA": 0.42, "AAG": 0.58},
    "D": {"GAT": 0.46, "GAC": 0.54},
    "E": {"GAA": 0.42, "GAG": 0.58},
    "C": {"TGT": 0.45, "TGC": 0.55},
    "W": {"TGG": 1.00},
    "R": {"CGT": 0.08, "CGC": 0.19, "CGA": 0.11, "CGG": 0.21, "AGA": 0.20, "AGG": 0.21},
    "G": {"GGT": 0.16, "GGC": 0.34, "GGA": 0.25, "GGG": 0.25},
    "*": {"TAA": 0.28, "TAG": 0.20, "TGA": 0.52},
}

ECOLI = {  # E. coli K-12
    "F": {"TTT": 0.58, "TTC": 0.42},
    "L": {"TTA": 0.14, "TTG": 0.13, "CTT": 0.12, "CTC": 0.10, "CTA": 0.04, "CTG": 0.47},
    "I": {"ATT": 0.49, "ATC": 0.39, "ATA": 0.11},
    "M": {"ATG": 1.00},
    "V": {"GTT": 0.28, "GTC": 0.20, "GTA": 0.17, "GTG": 0.35},
    "S": {"TCT": 0.17, "TCC": 0.15, "TCA": 0.14, "TCG": 0.14, "AGT": 0.15, "AGC": 0.25},
    "P": {"CCT": 0.18, "CCC": 0.13, "CCA": 0.20, "CCG": 0.49},
    "T": {"ACT": 0.19, "ACC": 0.40, "ACA": 0.17, "ACG": 0.24},
    "A": {"GCT": 0.18, "GCC": 0.26, "GCA": 0.23, "GCG": 0.33},
    "Y": {"TAT": 0.59, "TAC": 0.41},
    "H": {"CAT": 0.57, "CAC": 0.43},
    "Q": {"CAA": 0.34, "CAG": 0.66},
    "N": {"AAT": 0.49, "AAC": 0.51},
    "K": {"AAA": 0.74, "AAG": 0.26},
    "D": {"GAT": 0.63, "GAC": 0.37},
    "E": {"GAA": 0.68, "GAG": 0.32},
    "C": {"TGT": 0.46, "TGC": 0.54},
    "W": {"TGG": 1.00},
    "R": {"CGT": 0.36, "CGC": 0.36, "CGA": 0.07, "CGG": 0.11, "AGA": 0.07, "AGG": 0.04},
    "G": {"GGT": 0.35, "GGC": 0.37, "GGA": 0.13, "GGG": 0.15},
    "*": {"TAA": 0.61, "TAG": 0.09, "TGA": 0.30},
}

TABLES = {
    "human": (HUMAN, "Homo sapiens genome-wide codon usage (Kazusa Codon Usage Database)"),
    "ecoli": (ECOLI, "Escherichia coli K-12 genome-wide codon usage (Kazusa Codon Usage Database)"),
}


def build(by_aa, source):
    freq_within_aa, preferred, relative_adaptiveness = {}, {}, {}
    for aa, codons in by_aa.items():
        best = max(codons, key=codons.get)
        preferred[aa] = best
        top = codons[best]
        for codon, frac in codons.items():
            freq_within_aa[codon] = round(frac, 4)
            relative_adaptiveness[codon] = round(frac / top, 4) if top else 0.0
    return {
        "freq_within_aa": freq_within_aa,
        "preferred": preferred,
        "relative_adaptiveness": relative_adaptiveness,
        "source": source,
    }


def main():
    for name, (by_aa, source) in TABLES.items():
        out = ASSETS / f"{name}_codon_usage.json"
        table = build(by_aa, source)
        out.write_text(json.dumps(table, indent=0))
        # Sanity: 20 aa + stop all have a preferred codon.
        assert len(table["preferred"]) == 21, f"{name}: expected 21 aa, got {len(table['preferred'])}"
        print(f"{name}: {len(table['relative_adaptiveness'])} codons -> {out.name}")


if __name__ == "__main__":
    main()
