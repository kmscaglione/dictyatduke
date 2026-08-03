#!/usr/bin/env python3
"""Build local BLAST nucleotide databases for the bundled dictyostelid genomes.

Prereq: NCBI BLAST+ installed. The simplest setup used in dev is to drop the
binaries in ~/.local/blast/ (makeblastdb, blastn, tblastn). On Apple Silicon:

    curl -LO https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/ncbi-blast-2.17.0+-aarch64-macosx.tar.gz
    tar xzf ncbi-blast-2.17.0+-aarch64-macosx.tar.gz
    mkdir -p ~/.local/blast && cp ncbi-blast-2.17.0+/bin/{makeblastdb,blastn,tblastn} ~/.local/blast/

Then:  python3 scripts/build_blastdb.py

Outputs BLAST DBs to assets/genomes/blastdb/<species-id>.* (gitignored).
D. discoideum uses the RefSeq FASTA so hit accessions (NC_…) match gene_index,
which is what lets serve.py map a genome hit back to its gene page.
Standard library only. See README ("P6 — local BLAST").
"""
import gzip, os, shutil, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")
DB_DIR = os.path.join(GENOMES, "blastdb")
BIN_DIR = os.path.expanduser("~/.local/blast")

# species id -> (preferred uncompressed FASTA basename, gzipped-genome basename)
SPECIES = [
    ("d-discoideum-ax4",  "D_discoideum_AX4_refseq",   "D_discoideum_AX4"),
    ("d-purpureum",       "D_purpureum_browser",       "D_purpureum"),
    ("d-giganteum",       "D_giganteum_browser",       "D_giganteum"),
    ("d-firmibasis",      "D_firmibasis_browser",      "D_firmibasis"),
    ("c-fasciculata-sh3", "C_fasciculata_SH3_browser", "C_fasciculata_SH3"),
    ("c-polycephalum",    "C_polycephalum_browser",    "C_polycephalum"),
    ("s-polycarpum",      "S_polycarpum_browser",      "S_polycarpum"),
    ("h-pallidum-pn500",  "H_pallidum_PN500_browser",  "H_pallidum_PN500"),
    ("h-pallidum-new",    "H_pallidum_new_browser",    "H_pallidum_new"),
    ("p-violaceum",       "P_violaceum_browser",       "P_violaceum"),
    # Holland*, Ahmed* et al. 2025 (PNAS) — new species reps for the comparative set
    ("d-citrinum",        "D_citrinum_GS8b_browser",     "D_citrinum_GS8b"),
    ("d-dimigraforme",    "D_dimigraforme_Ar5b_browser", "D_dimigraforme_Ar5b"),
    # Holland*, Ahmed* et al. 2025 — D. discoideum (+ 2nd citrinum) wild isolates
    ("dd-ax2-214",        "Dd_AX2-214_browser",      "Dd_AX2-214"),
    ("dd-cr116c",         "Dd_CR116C_browser",       "Dd_CR116C"),
    ("dd-ot3a",           "Dd_OT3A_browser",         "Dd_OT3A"),
    ("dd-m4b",            "Dd_M4B_browser",          "Dd_M4B"),
    ("dd-s6b",            "Dd_S6B_browser",          "Dd_S6B"),
    ("dc-cf3b",           "D_citrinum_Cf3b_browser", "D_citrinum_Cf3b"),
    # Hosted from the submitter GenBank files (genomes_from_gbf.py)
    ("dc-kgl29a",         "D_citrinum_KGL29A_browser",   "D_citrinum_KGL29A"),
    ("di-pj11",           "D_intermedium_PJ11_browser",  "D_intermedium_PJ11"),
]


def makeblastdb_bin():
    p = os.path.join(BIN_DIR, "makeblastdb")
    return p if os.path.exists(p) else shutil.which("makeblastdb")


def fasta_for(base, gz_base):
    """Return a path to an uncompressed FASTA, gunzipping the genome if needed."""
    direct = os.path.join(GENOMES, base + ".fna")
    if os.path.exists(direct):
        return direct, False
    gz = os.path.join(GENOMES, gz_base + "_genome.fna.gz")
    if os.path.exists(gz):
        tmp = os.path.join("/tmp", gz_base + "_genome.fna")
        with gzip.open(gz, "rb") as fi, open(tmp, "wb") as fo:
            shutil.copyfileobj(fi, fo)
        return tmp, True
    return None, False


def main():
    mk = makeblastdb_bin()
    if not mk:
        print("ERROR: makeblastdb not found (install BLAST+ — see this script's docstring).")
        sys.exit(1)
    os.makedirs(DB_DIR, exist_ok=True)
    built = 0
    for sid, base, gz_base in SPECIES:
        src, temp = fasta_for(base, gz_base)
        if not src:
            print(f"  SKIP {sid} (no FASTA in assets/genomes/)")
            continue
        cmd = [mk, "-dbtype", "nucl", "-in", src, "-out", os.path.join(DB_DIR, sid), "-parse_seqids"]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if temp:
            os.unlink(src)
        if r.returncode == 0:
            print(f"  built {sid}  <- {os.path.basename(src)}")
            built += 1
        else:
            print(f"  FAILED {sid}: {r.stderr.strip()[:200]}")
    print(f"Done — {built}/{len(SPECIES)} databases in {DB_DIR}")


if __name__ == "__main__":
    main()
