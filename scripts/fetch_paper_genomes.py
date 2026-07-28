#!/usr/bin/env python3
"""Fetch the dictyostelid genomes from Ahmed et al. 2025 (PNAS) and lay them out
the way the rest of the site expects.

Paper: "Hypermutable hotspot enables the rapid evolution of self/non-self
recognition genes in Dictyostelium", PNAS 2025, doi:10.1073/pnas.2520843122
(bioRxiv 2025.08.01.668227). Genomes + annotations are CC BY 4.0, deposited
under NCBI BioProject PRJNA1300491. We mirror the publicly released subset.

Two roles (see app.js / serve.py wiring):
  * "species"  — comparative reps that JOIN the cross-species set: the new species
                 (D. citrinum GS8b, D. dimigraforme), plus the more distant
                 cf. discoideum M4B/S6B and the 2nd D. citrinum (Cf3b).
  * "isolate"  — conspecific D. discoideum wild isolates (AX2-214, CR116C, OT3A),
                 the "Natural variation" panel: individually BLAST-able / browsable
                 / downloadable but NOT part of the cross-species comparison.

For each accession we produce, in assets/genomes/ (gitignored, like the other
genome data), the same trio of files the existing genomes use:
  <Name>_genome.fna.gz   gzipped assembly  (downloads page + blastdb fallback)
  <Name>_browser.fna     uncompressed assembly + .fai  (IGV byte-range)
  <Name>_browser.gff     gene annotation   (downloads + IGV; build_browser_tracks
                                            then bgzip+tabix-indexes it)

After running this:  python3 scripts/build_blastdb.py
                     python3 scripts/build_browser_tracks.py

Idempotent: an accession whose outputs already exist is skipped (use --refresh
to force). curl is used for the download (macOS stdlib urllib fails NCBI TLS
verification); pysam provides faidx. Prints a manifest snippet with real sizes.
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
DL = "https://api.ncbi.nlm.nih.gov/datasets/v2/genome/accession/{acc}/download?include_annotation_type=GENOME_FASTA,GENOME_GFF"

# accession, output Name (filename stem), display label, role
GENOMES_TABLE = [
    # Comparative reps -> cross-species set. Both citrinum strains here; M4B/S6B
    # are "cf. discoideum" (too distant to be conspecific), so species-level too.
    ("GCA_054859325.1", "D_citrinum_GS8b",     "D. citrinum GS8b",       "species"),
    ("GCA_054859025.1", "D_dimigraforme_Ar5b", "D. dimigraforme Ar5b",   "species"),
    ("GCA_054859205.1", "Dd_M4B",     "D. cf. discoideum M4B",  "species"),
    ("GCA_054859235.1", "Dd_S6B",     "D. cf. discoideum S6B",  "species"),
    ("GCA_054859145.1", "D_citrinum_Cf3b", "D. citrinum Cf3b",  "species"),
    # Conspecific D. discoideum wild isolates -> "Natural variation" panel
    ("GCA_054883475.1", "Dd_AX2-214", "D. discoideum AX2-214",  "isolate"),
    ("GCA_054859385.1", "Dd_CR116C",  "D. discoideum CR116C",   "isolate"),
    ("GCA_054859355.1", "Dd_OT3A",    "D. discoideum OT3A",     "isolate"),
]


def outputs_for(name):
    return {
        "gz":  os.path.join(GENOMES, f"{name}_genome.fna.gz"),
        "fna": os.path.join(GENOMES, f"{name}_browser.fna"),
        "fai": os.path.join(GENOMES, f"{name}_browser.fna.fai"),
        "gff": os.path.join(GENOMES, f"{name}_browser.gff"),
    }


def first_seqid(fna_path):
    """First sequence id in a FASTA — used as the IGV default locus seed."""
    with open(fna_path) as fh:
        for line in fh:
            if line.startswith(">"):
                return line[1:].split()[0]
    return None


def fetch_one(acc, name, refresh):
    out = outputs_for(name)
    if not refresh and all(os.path.exists(out[k]) for k in ("gz", "fna", "fai", "gff")):
        print(f"  skip  {name} ({acc}) — already present")
        return out
    url = DL.format(acc=acc)
    with tempfile.TemporaryDirectory() as td:
        zpath = os.path.join(td, "g.zip")
        r = subprocess.run(["curl", "-sL", url, "-o", zpath])
        if r.returncode != 0 or not os.path.exists(zpath):
            print(f"  FAIL  {name} ({acc}) — download error")
            return None
        with zipfile.ZipFile(zpath) as z:
            members = z.namelist()
            fna_m = next((m for m in members if m.endswith("_genomic.fna")), None)
            gff_m = next((m for m in members if m.endswith("genomic.gff")), None)
            if not fna_m:
                print(f"  FAIL  {name} ({acc}) — no FASTA in bundle")
                return None
            z.extract(fna_m, td)
            src_fna = os.path.join(td, fna_m)
            # uncompressed browser FASTA + gzipped assembly download
            shutil.copyfile(src_fna, out["fna"])
            with open(src_fna, "rb") as fi, gzip.open(out["gz"], "wb", compresslevel=6) as fo:
                shutil.copyfileobj(fi, fo)
            if gff_m:
                z.extract(gff_m, td)
                shutil.copyfile(os.path.join(td, gff_m), out["gff"])
            else:
                print(f"  warn  {name} — no annotation (GFF) in bundle")
    # faidx
    import pysam
    if os.path.exists(out["fai"]):
        os.unlink(out["fai"])
    pysam.faidx(out["fna"])
    print(f"  built {name} ({acc})")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true", help="re-download even if outputs exist")
    args = ap.parse_args()
    os.makedirs(GENOMES, exist_ok=True)
    try:
        import pysam  # noqa: F401
    except ImportError:
        sys.exit("pysam is required for faidx (pip install --user pysam).")
    print(f"Fetching {len(GENOMES_TABLE)} genomes into {GENOMES}")
    rows = []
    for acc, name, label, role in GENOMES_TABLE:
        out = fetch_one(acc, name, args.refresh)
        if out:
            rows.append((acc, name, label, role, out))
    print("\n# sizes (for downloads_manifest.json):")
    for acc, name, label, role, out in rows:
        gz = os.path.getsize(out["gz"]) if os.path.exists(out["gz"]) else 0
        gff = os.path.getsize(out["gff"]) if os.path.exists(out["gff"]) else 0
        seed = first_seqid(out["fna"])
        print(f"  {label} [{role}] {acc}: gz={gz} gff={gff} locus={seed}:1-200000")
    print(f"\nDone — {len(rows)}/{len(GENOMES_TABLE)}. "
          "Now run: python3 scripts/build_blastdb.py && python3 scripts/build_browser_tracks.py")


if __name__ == "__main__":
    main()
