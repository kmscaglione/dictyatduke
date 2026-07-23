#!/usr/bin/env python3
"""Build the AX4 restriction-site track for the genome browser.

Scans the D. discoideum AX4 reference FASTA for the recognition sequences of a
panel of common cloning enzymes and writes a bgzipped + tabix-indexed GFF3 so
IGV byte-ranges only the visible window. Output (committed, ~a couple MB):

    assets/tracks/D_discoideum_AX4_restriction.gff3.gz  (+ .tbi)

Only palindromic enzymes are included, so each recognition sequence is its own
reverse complement and a single forward scan finds every site. The AT-rich
genome (~78% AT) means AT-heavy recognition sites are frequent, so purely-AT
6-cutters (DraI TTTAAA, SspI AATATT) are left out to keep the track usable.

Build-time only (needs the FASTA present + pysam for bgzip/tabix):

    python3 scripts/build_restriction_track.py
"""
import os
import re
import sys

try:
    import pysam
except ImportError:
    sys.exit("pysam is required (pip install --user pysam) — it bundles htslib's "
             "bgzip/tabix. Build-time tool only.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES_DIR = os.path.join(ROOT, "assets", "genomes")
TRACKS_DIR = os.path.join(ROOT, "assets", "tracks")

# Every genome shown in the browser (basename of its <name>.fna). The restriction
# track for each is written as <name>_restriction.gff3.gz next to the RNA-seq
# tracks; the browser derives this path from the organism's fastaURL.
GENOMES = [
    "D_discoideum_AX4_refseq", "D_purpureum_browser", "D_firmibasis_browser",
    "C_fasciculata_SH3_browser", "C_polycephalum_browser", "S_polycarpum_browser",
    "H_pallidum_PN500_browser", "H_pallidum_new_browser", "P_violaceum_browser",
    "D_citrinum_GS8b_browser", "D_dimigraforme_Ar5b_browser", "D_citrinum_Cf3b_browser",
    "Dd_AX2-214_browser", "Dd_CR116C_browser", "Dd_OT3A_browser",
    "Dd_M4B_browser", "Dd_S6B_browser",
]

# Common cloning enzymes with palindromic recognition sequences.
ENZYMES = {
    "EcoRI": "GAATTC", "BamHI": "GGATCC", "HindIII": "AAGCTT", "XhoI": "CTCGAG",
    "XbaI": "TCTAGA", "SalI": "GTCGAC", "PstI": "CTGCAG", "KpnI": "GGTACC",
    "SacI": "GAGCTC", "SmaI": "CCCGGG", "NotI": "GCGGCCGC", "NcoI": "CCATGG",
    "NdeI": "CATATG", "BglII": "AGATCT", "SpeI": "ACTAGT", "ClaI": "ATCGAT",
    "EcoRV": "GATATC", "HpaI": "GTTAAC", "PvuII": "CAGCTG", "ScaI": "AGTACT",
    "StuI": "AGGCCT", "AflII": "CTTAAG", "NheI": "GCTAGC", "SphI": "GCATGC",
}


def read_fasta(path):
    name, seq = None, []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith(">"):
                if name:
                    yield name, "".join(seq)
                name = line[1:].split()[0]
                seq = []
            else:
                seq.append(line.strip().upper())
    if name:
        yield name, "".join(seq)


PATTERNS = [(name, re.compile(site)) for name, site in ENZYMES.items()]


def build_one(base):
    fasta = os.path.join(GENOMES_DIR, base + ".fna")
    if not os.path.exists(fasta):
        print(f"  {base}: FASTA not found, skipped"); return
    out = os.path.join(TRACKS_DIR, base + "_restriction.gff3")
    rows = []
    for chrom, seq in read_fasta(fasta):
        for name, pat in PATTERNS:
            for m in pat.finditer(seq):
                rows.append((chrom, m.start() + 1, m.end(), name))  # GFF3 1-based
    rows.sort(key=lambda r: (r[0], r[1]))
    with open(out, "w", encoding="utf-8") as fh:
        fh.write("##gff-version 3\n")
        for chrom, start, end, name in rows:
            fh.write(f"{chrom}\trestriction\trestriction_site\t{start}\t{end}\t.\t.\t.\t"
                     f"ID={name}_{chrom}_{start};Name={name};enzyme={name};site={ENZYMES[name]}\n")
    pysam.tabix_index(out, preset="gff", force=True)   # -> out + ".gz" (+ .tbi)
    size_mb = os.path.getsize(out + ".gz") / 1048576
    print(f"  {base}: {len(rows):,} sites -> {size_mb:.2f} MB")


def main():
    os.makedirs(TRACKS_DIR, exist_ok=True)
    only = sys.argv[1:] or GENOMES
    for base in only:
        build_one(base)


if __name__ == "__main__":
    main()
