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
FASTA = os.path.join(ROOT, "assets", "genomes", "D_discoideum_AX4_refseq.fna")
OUT = os.path.join(ROOT, "assets", "tracks", "D_discoideum_AX4_restriction.gff3")

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


def main():
    if not os.path.exists(FASTA):
        sys.exit(f"FASTA not found: {FASTA} (run where the AX4 genome is present)")
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    patterns = [(name, re.compile(site)) for name, site in ENZYMES.items()]
    rows, counts = [], {}
    for chrom, seq in read_fasta(FASTA):
        for name, pat in patterns:
            for m in pat.finditer(seq):
                start = m.start() + 1          # GFF3 is 1-based, inclusive
                end = m.end()
                rows.append((chrom, start, end, name))
                counts[name] = counts.get(name, 0) + 1

    rows.sort(key=lambda r: (r[0], r[1]))
    with open(OUT, "w", encoding="utf-8") as out:
        out.write("##gff-version 3\n")
        for chrom, start, end, name in rows:
            out.write(f"{chrom}\trestriction\trestriction_site\t{start}\t{end}\t.\t.\t.\t"
                      f"ID={name}_{chrom}_{start};Name={name};enzyme={name};"
                      f"site={ENZYMES[name]}\n")

    pysam.tabix_index(OUT, preset="gff", force=True)   # -> OUT + ".gz" (+ .tbi)
    gz = OUT + ".gz"
    size_mb = os.path.getsize(gz) / 1048576
    print(f"  wrote {os.path.relpath(gz, ROOT)} ({size_mb:.2f} MB + .tbi, "
          f"{len(rows):,} sites across {len(ENZYMES)} enzymes)")
    for name in sorted(counts, key=lambda n: -counts[n])[:6]:
        print(f"    {name:8} {counts[name]:>7,} sites")


if __name__ == "__main__":
    main()
