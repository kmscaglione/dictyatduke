#!/usr/bin/env python3
"""Sort, bgzip, and tabix-index the genome-browser GFF annotation files so IGV.js
can byte-range only the visible window instead of downloading (and re-parsing)
the whole 20-30 MB annotation on every open.

Why: an un-indexed GFF track in IGV.js is downloaded in full to render any
locus. The AX4 annotation alone is ~27 MB, served uncompressed — the dominant
cause of the genome browser's 10-15s load. A bgzipped + tabix-indexed `.gff.gz`
(+ `.tbi`) lets IGV fetch ~tens of KB for the on-screen region (with the Range
support added to serve.py). Measured AX4 open: ~27 MB -> ~9 KB of GFF.

The small RNA-seq bedgraph tracks are intentionally left plain (un-indexed):
IGV.js wig tracks don't use tabix, and at ~100 KB gzipped each the gain is
negligible. serve.py gzips them on the wire.

Build-time only: pysam (which bundles htslib's bgzip/tabix) is required to RUN
this, but the outputs are static `.gff.gz` + `.tbi` files the server streams
directly — no runtime dependency. Outputs live next to the source GFFs in
assets/genomes/ (gitignored / rebuildable like the BLAST DBs), so run this
after the genomes are present (and re-run if the GFFs change):

    python3 scripts/build_browser_tracks.py

Idempotent: existing outputs are overwritten.
"""
import glob
import json
import os
import pathlib
import sys

try:
    import pysam
except ImportError:
    sys.exit("pysam is required (pip install --user pysam). It bundles htslib's "
             "bgzip/tabix. This is a build-time tool only.")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")


# DDB_G -> symbol from the catalog (carries dictyBase's authoritative names, applied
# by build_gene_names). Used to label AX4 transcripts; empty for other species.
def _load_gene_symbols():
    try:
        idx = json.loads((pathlib.Path(__file__).resolve().parents[1]
                          / "assets" / "gene_index.json").read_text())
        return {r[0]: r[1] for r in idx if len(r) > 1 and r[0]}
    except Exception:
        return {}


_GENE_SYM = _load_gene_symbols()


def _relabel_mrna(line):
    """Give IGV a meaningful transcript label. NCBI RefSeq GFFs set an mRNA's
    `Name` to its accession (e.g. XM_635544.2), so the browser shows accessions
    instead of gene names. Rewrite the mRNA `Name` to the catalog symbol for its
    DDB_G locus (dictyBase's authoritative name; the DDB_G id itself when unnamed),
    then the submitter's own transcript id (`orig_transcript_id`, for the paper
    genomes), falling back to the GFF's `gene=`/`locus_tag=`. The GenBank id is
    preserved in `ID=`/`Dbxref=`, so it still shows on click."""
    cols = line.rstrip("\n").split("\t")
    if len(cols) < 9 or cols[2] != "mRNA":
        return line
    parts = cols[8].split(";")
    attrs = dict(kv.partition("=")[::2] for kv in parts if "=" in kv)
    if "Name" not in attrs:
        return line
    locus = (attrs.get("locus_tag") or "").strip()
    # Submitter transcript id: gnl|WGS:JBTAPL|DC_GS_00011627-RA -> DC_GS_00011627-RA
    orig = (attrs.get("orig_transcript_id") or "").rsplit("|", 1)[-1].strip()
    sym = (_GENE_SYM.get(locus) or orig or attrs.get("gene") or locus or "").strip()
    if not sym:
        return line
    cols[8] = ";".join((f"Name={sym}" if kv.startswith("Name=") else kv) for kv in parts)
    return "\t".join(cols) + "\n"


def sorted_records(path, start_col):
    """Yield (header_lines, sorted_feature_lines). Comment/header lines (`#`) are
    kept at the top; feature lines are grouped by seqid then sorted by start.
    `start_col` is the 0-based column holding the start coordinate."""
    headers, feats = [], []
    with open(path, "r", encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("#"):
                # Drop a `##FASTA` section and everything after it (sequence,
                # not features) — it would bloat the index and isn't a track.
                if line.startswith("##FASTA"):
                    break
                headers.append(line)
            elif line.strip():
                feats.append(_relabel_mrna(line))

    def key(line):
        cols = line.split("\t")
        try:
            start = int(cols[start_col])
        except (IndexError, ValueError):
            start = 0
        return (cols[0], start)

    feats.sort(key=key)
    return headers, feats


def index_file(src, preset, start_col, label):
    """Write a sorted plaintext copy, then bgzip + tabix it. Returns output path."""
    if not os.path.exists(src):
        return None
    headers, feats = sorted_records(src, start_col)
    sorted_path = src + ".sorted"
    with open(sorted_path, "w", encoding="utf-8") as out:
        out.writelines(headers)
        out.writelines(feats)
    # tabix_index compresses sorted_path -> sorted_path + ".gz" and writes .tbi.
    pysam.tabix_index(sorted_path, preset=preset, force=True)
    gz_src = sorted_path + ".gz"
    gz_dst = src + ".gz"
    os.replace(gz_src, gz_dst)
    os.replace(gz_src + ".tbi", gz_dst + ".tbi")
    size_mb = os.path.getsize(gz_dst) / 1048576
    print(f"  {label}: {os.path.basename(gz_dst)}  ({size_mb:.2f} MB + .tbi, "
          f"{len(feats):,} features)")
    return gz_dst


def main():
    gffs = sorted(glob.glob(os.path.join(GENOMES, "*.gff")))
    print(f"GFF annotations ({len(gffs)}):")
    for g in gffs:
        index_file(g, preset="gff", start_col=3, label="gff")
    print("Done. IGV points the annotation track at <gffURL>.gz with "
          "indexURL=<gffURL>.gz.tbi and indexed:true (see buildIGVOptions).")


if __name__ == "__main__":
    main()
