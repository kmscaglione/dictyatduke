#!/usr/bin/env python3
"""Build the local BLAST *protein* database for blastp against D. discoideum AX4.

The nucleotide genome databases (scripts/build_blastdb.py) drive blastn/tblastn.
blastp needs a protein database, so this translates every AX4 gene's CDS from the
RefSeq genome + GFF into a proteome FASTA (one sequence per gene, headed by its
DDB_G locus tag) and runs makeblastdb -dbtype prot.

    assets/genomes/blastdb/d-discoideum-ax4-prot.*   (gitignored, built on server)

Because each protein is named by its DDB_G id, a blastp hit's subject accession
is the gene id itself — serve.py maps it straight to the gene page (no genomic
coordinate lookup needed, unlike blastn/tblastn).

Prereq: BLAST+ in ~/.local/blast (makeblastdb + blastp). See build_blastdb.py.
Run:  python3 scripts/build_protein_blastdb.py
Standard library only.
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")
DB_DIR = os.path.join(GENOMES, "blastdb")
BIN_DIR = os.path.expanduser("~/.local/blast")
GFF = os.path.join(GENOMES, "D_discoideum_AX4.gff")
FASTA = os.path.join(GENOMES, "D_discoideum_AX4_refseq.fna")
DB_ID = "d-discoideum-ax4-prot"

_REVCOMP = str.maketrans("ACGTUacgtuN", "TGCAAtgcaaN")
_CODON = {}
for _i, _aa in enumerate("FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"):
    _b = "TCAG"
    _CODON[_b[_i // 16] + _b[(_i // 4) % 4] + _b[_i % 4]] = _aa


def translate(seq):
    seq = seq.upper().replace("U", "T")
    return "".join(_CODON.get(seq[i:i + 3], "X") for i in range(0, len(seq) - 2, 3))


def gene_models():
    """DDB_G -> {chrom, strand, CDS:[(start,end)]} from the GFF (CDS features)."""
    models = {}
    with open(GFF) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if len(f) < 9 or f[2] != "CDS":
                continue
            m = re.search(r"locus_tag=([^;]+)", f[8])
            if not m or not m.group(1).startswith("DDB_G"):
                continue
            g = models.setdefault(m.group(1), {"chrom": f[0], "strand": f[6], "CDS": []})
            g["CDS"].append((int(f[3]), int(f[4])))
    return models


def genome_seq():
    seq, cur, buf = {}, None, []
    with open(FASTA) as fh:
        for line in fh:
            if line.startswith(">"):
                if cur:
                    seq[cur] = "".join(buf)
                cur = line[1:].split()[0]
                buf = []
            else:
                buf.append(line.strip())
    if cur:
        seq[cur] = "".join(buf)
    return seq


def protein_for(g, chrom_seq):
    out = "".join(chrom_seq[s - 1:e] for s, e in sorted(g["CDS"]))
    if g["strand"] == "-":
        out = out.translate(_REVCOMP)[::-1]
    prot = translate(out)
    return prot[:-1] if prot.endswith("*") else prot


def makeblastdb_bin():
    p = os.path.join(BIN_DIR, "makeblastdb")
    return p if os.path.exists(p) else shutil.which("makeblastdb")


def main():
    mk = makeblastdb_bin()
    if not mk:
        sys.exit("makeblastdb not found (install BLAST+ — see build_blastdb.py).")
    if not (os.path.exists(GFF) and os.path.exists(FASTA)):
        sys.exit("Need D_discoideum_AX4.gff + D_discoideum_AX4_refseq.fna in assets/genomes/.")
    os.makedirs(DB_DIR, exist_ok=True)

    models = gene_models()
    chrom = genome_seq()
    faa = os.path.join("/tmp", DB_ID + ".faa")
    n = 0
    with open(faa, "w") as fh:
        for ddb, g in models.items():
            cs = chrom.get(g["chrom"])
            if not cs or not g["CDS"]:
                continue
            prot = protein_for(g, cs)
            if len(prot) < 3 or set(prot) <= {"X"}:
                continue
            fh.write(f">{ddb}\n")
            for i in range(0, len(prot), 60):
                fh.write(prot[i:i + 60] + "\n")
            n += 1
    print(f"  translated {n:,} proteins -> {faa}")

    cmd = [mk, "-dbtype", "prot", "-in", faa, "-out", os.path.join(DB_DIR, DB_ID),
           "-title", "D. discoideum AX4 proteins", "-parse_seqids"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    os.unlink(faa)
    if r.returncode != 0:
        sys.exit(f"makeblastdb failed: {r.stderr.strip()[:300]}")
    print(f"  built {DB_ID} in {DB_DIR}")


if __name__ == "__main__":
    main()
