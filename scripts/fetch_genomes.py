#!/usr/bin/env python3
"""Fetch the CORE dictyostelid genomes (D. discoideum AX4 + the legacy comparative
species) from NCBI and lay them out the way serve.py / build_blastdb.py expect.

This is the companion to scripts/fetch_paper_genomes.py, which fetches the Holland*, Ahmed* et al. 2025
et al. 2025 (PNAS) subset. Between the two you get all 17 assemblies listed in
assets/downloads_manifest.json. Run this one for the 9 it covers:

    python3 scripts/fetch_genomes.py                # all 9
    python3 scripts/fetch_genomes.py --only d-purpureum d-firmibasis
    python3 scripts/fetch_genomes.py --refresh      # re-download even if present

Then build the derived data (same as the paper script):

    python3 scripts/build_blastdb.py                # needs makeblastdb on PATH
    python3 scripts/build_browser_tracks.py         # needs: pip install --user pysam

Downloads come from the NCBI Datasets v2 API by accession (curl; stdlib urllib
fails NCBI TLS on some hosts). pysam provides faidx. Idempotent: an assembly
whose outputs already exist is skipped unless --refresh.

Layout produced (in assets/genomes/, gitignored):
  * legacy species (like the paper genomes):
        <Name>_genome.fna.gz     gzipped assembly (downloads + blastdb fallback)
        <Name>_browser.fna(.fai) uncompressed assembly + faidx (IGV byte-range)
        <Name>_browser.gff       gene annotation, when NCBI has one
  * D. discoideum AX4 (special — serve.py reads these UNCOMPRESSED):
        D_discoideum_AX4_refseq.fna(.fai)  GENOME_FASTA + BLAST db + region reads
        D_discoideum_AX4.gff               GENE_GFF (gene_index / gene models)
        D_discoideum_AX4_browser.gff       IGV annotation track (copy of the GFF)
        D_discoideum_AX4_{genome,refseq}.fna.gz, D_discoideum_AX4.gff.gz  (downloads)
      AX4 uses the RefSeq assembly (GCF_…) so hit accessions (NC_…) match
      gene_index.json — that is what lets a BLAST hit link back to a gene page.
"""
import argparse
import gzip
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")
DL = ("https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/{acc}/download"
      "?include_annotation_type=GENOME_FASTA,GENOME_GFF")

AX4_ID = "d-discoideum-ax4"
AX4_ACC = "GCF_000004695.1"

# id, accession, output Name (filename stem) — the 8 legacy comparative species.
# (AX4 is handled separately; the Holland*, Ahmed* et al. 2025 subset is fetch_paper_genomes.py.)
LEGACY = [
    ("d-purpureum",       "GCA_000190715.1", "D_purpureum"),
    ("d-firmibasis",      "GCA_036169595.1", "D_firmibasis"),
    ("c-fasciculata-sh3", "GCA_000203815.1", "C_fasciculata_SH3"),
    ("c-polycephalum",    "GCA_900092265.1", "C_polycephalum"),
    ("s-polycarpum",      "GCA_900092255.1", "S_polycarpum"),
    ("h-pallidum-pn500",  "GCA_000004825.1", "H_pallidum_PN500"),
    ("h-pallidum-new",    "GCA_054501735.1", "H_pallidum_new"),
    ("p-violaceum",       "GCA_000277445.1", "P_violaceum"),
]


def download_bundle(acc, td):
    """Download an accession's Datasets zip and return (fna_path, gff_path|None)."""
    zpath = os.path.join(td, "g.zip")
    r = subprocess.run(["curl", "-sL", DL.format(acc=acc), "-o", zpath])
    if r.returncode != 0 or not os.path.exists(zpath):
        return None, None
    with zipfile.ZipFile(zpath) as z:
        members = z.namelist()
        fna_m = next((m for m in members if m.endswith("_genomic.fna")), None)
        gff_m = next((m for m in members if m.endswith("genomic.gff")), None)
        if not fna_m:
            return None, None
        z.extract(fna_m, td)
        fna = os.path.join(td, fna_m)
        gff = None
        if gff_m:
            z.extract(gff_m, td)
            gff = os.path.join(td, gff_m)
        return fna, gff


def gzip_to(src, dst):
    with open(src, "rb") as fi, gzip.open(dst, "wb", compresslevel=6) as fo:
        shutil.copyfileobj(fi, fo)


def faidx(path):
    import pysam
    fai = path + ".fai"
    if os.path.exists(fai):
        os.unlink(fai)
    pysam.faidx(path)


def outputs_legacy(name):
    return {
        "gz":  os.path.join(GENOMES, f"{name}_genome.fna.gz"),
        "fna": os.path.join(GENOMES, f"{name}_browser.fna"),
        "fai": os.path.join(GENOMES, f"{name}_browser.fna.fai"),
        "gff": os.path.join(GENOMES, f"{name}_browser.gff"),
    }


def fetch_legacy(sid, acc, name, refresh):
    out = outputs_legacy(name)
    have = os.path.exists(out["gz"]) and os.path.exists(out["fna"]) and os.path.exists(out["fai"])
    if not refresh and have:
        print(f"  skip  {sid} ({acc}) — already present")
        return True
    with tempfile.TemporaryDirectory() as td:
        fna, gff = download_bundle(acc, td)
        if not fna:
            print(f"  FAIL  {sid} ({acc}) — download / no FASTA in bundle")
            return False
        shutil.copyfile(fna, out["fna"])       # uncompressed (IGV + blastdb)
        gzip_to(fna, out["gz"])                 # gzipped assembly (downloads)
        if gff:
            shutil.copyfile(gff, out["gff"])
        else:
            print(f"  warn  {sid} — no annotation (GFF) available at NCBI")
    faidx(out["fna"])
    print(f"  built {sid} ({acc})")
    return True


def fetch_ax4(refresh):
    refseq = os.path.join(GENOMES, "D_discoideum_AX4_refseq.fna")
    gff    = os.path.join(GENOMES, "D_discoideum_AX4.gff")
    have = os.path.exists(refseq) and os.path.exists(gff) and os.path.exists(refseq + ".fai")
    if not refresh and have:
        print(f"  skip  {AX4_ID} ({AX4_ACC}) — already present")
        return True
    with tempfile.TemporaryDirectory() as td:
        fna, gsrc = download_bundle(AX4_ACC, td)
        if not fna:
            print(f"  FAIL  {AX4_ID} ({AX4_ACC}) — download / no FASTA in bundle")
            return False
        # serve.py reads these UNCOMPRESSED (GENOME_FASTA + GENE_GFF):
        shutil.copyfile(fna, refseq)
        gzip_to(fna, os.path.join(GENOMES, "D_discoideum_AX4_refseq.fna.gz"))
        gzip_to(fna, os.path.join(GENOMES, "D_discoideum_AX4_genome.fna.gz"))
        if gsrc:
            shutil.copyfile(gsrc, gff)
            # IGV annotation track globs *_browser.gff; give AX4 one too.
            shutil.copyfile(gsrc, os.path.join(GENOMES, "D_discoideum_AX4_browser.gff"))
            gzip_to(gsrc, os.path.join(GENOMES, "D_discoideum_AX4.gff.gz"))
        else:
            print(f"  warn  {AX4_ID} — no GFF in bundle (gene models will be empty!)")
    faidx(refseq)
    print(f"  built {AX4_ID} ({AX4_ACC})")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--refresh", action="store_true", help="re-download even if outputs exist")
    ap.add_argument("--only", nargs="+", metavar="ID",
                    help=f"subset of ids to fetch (default: all). ids: {AX4_ID} "
                         + " ".join(s[0] for s in LEGACY))
    args = ap.parse_args()

    try:
        import pysam  # noqa: F401
    except ImportError:
        sys.exit("pysam is required for faidx:  pip install --user pysam")

    os.makedirs(GENOMES, exist_ok=True)
    plan = [(AX4_ID, AX4_ACC, None)] + LEGACY
    if args.only:
        want = set(args.only)
        plan = [row for row in plan if row[0] in want]
        missing = want - {row[0] for row in plan}
        if missing:
            sys.exit(f"unknown id(s): {', '.join(sorted(missing))}")

    print(f"Fetching {len(plan)} core genome(s) into {GENOMES}")
    ok = 0
    for sid, acc, name in plan:
        if sid == AX4_ID:
            ok += fetch_ax4(args.refresh)
        else:
            ok += fetch_legacy(sid, acc, name, args.refresh)
    print(f"\nDone — {ok}/{len(plan)} genomes. Next:\n"
          "  python3 scripts/build_blastdb.py\n"
          "  python3 scripts/build_browser_tracks.py\n"
          "  (then have OIT restart the dicty service to clear the empty-genome cache)")


if __name__ == "__main__":
    main()
