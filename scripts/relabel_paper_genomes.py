#!/usr/bin/env python3
"""Relabel the paper (Holland*, Ahmed* et al. 2025) genome files from GenBank's
WGS accessions back to the submitters' own contig names and gene IDs.

GenBank demotes the submitter's names to secondary fields and shows its own
accession as the primary id, which is why the browser was displaying a mess like
`JBTAPL010000072` and `ACTFIV_003244`. The submitter names are still in the files:

  * contig  -> the FASTA defline's last token   (e.g. GS8b_v4_f1_contig_102_p7)
  * gene    -> the GFF mRNA's orig_transcript_id (e.g. DC_GS_00011606-RA -> gene
               DC_GS_00011606)

This rewrites, in place, each `<Name>_browser.fna` seqid and the matching
`<Name>_browser.gff` seqid (column 1) to the submitter contig name, and sets the
gene/mRNA `Name=` to the submitter gene / transcript id. After this, rerun
build_blastdb.py (so BLAST hits report your contigs) and build_browser_tracks.py
(so IGV serves the relabeled annotation).

Safe by construction:
  * Idempotent — a file already carrying submitter seqids is skipped.
  * A scaffold with no submitter name in its defline (a few chromosome-level
    ones, e.g. AX2-214 chr1 = CM142508.1) keeps its GenBank accession unchanged.
  * The genome data lives outside git and is re-fetchable, so a bad run is
    recoverable with fetch_paper_genomes.py --refresh.

Run order on the server:
  fetch_paper_genomes.py -> relabel_paper_genomes.py -> build_blastdb.py
                         -> build_browser_tracks.py -> web_chown -> restart

Standard library only (+ pysam for faidx, already required by the fetch step).
"""
import argparse
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")

# The eight paper genomes (filename stems). AX4 and the legacy species are RefSeq
# and already carry sensible ids, so they are intentionally left alone.
PAPER_STEMS = [
    "D_citrinum_GS8b", "D_dimigraforme_Ar5b", "Dd_M4B", "Dd_S6B",
    "D_citrinum_Cf3b", "Dd_AX2-214", "Dd_CR116C", "Dd_OT3A",
]

_WGS_SUFFIX = ", whole genome shotgun sequence"
_TX_SUFFIX = re.compile(r"-R[A-Z0-9]+$")   # transcript suffix: -RA, -RB, ...


def submitter_contig(desc):
    """Submitter contig name from a FASTA defline description, or None.

    The submitter name is the last whitespace token before the WGS boilerplate
    and always contains an underscore (GS8b_v4_f1_contig_102_p7, AR5B_contig_..).
    Chromosome-level scaffolds read '... chromosome 1' -> last token '1' -> None.
    """
    d = desc.split(_WGS_SUFFIX)[0].strip()
    if not d:
        return None
    last = d.split()[-1]
    return last if "_" in last else None


def build_contig_map(fna_path):
    """GenBank accession -> submitter contig name, from the FASTA deflines.
    Accessions with no submitter name map to themselves (unchanged)."""
    cmap, seen = {}, set()
    with open(fna_path) as fh:
        for line in fh:
            if not line.startswith(">"):
                continue
            acc, _, desc = line[1:].rstrip("\n").partition(" ")
            name = submitter_contig(desc)
            if name and name not in seen:
                cmap[acc] = name
                seen.add(name)
            else:
                cmap[acc] = acc   # keep GenBank id (no name, or a dup collision)
    return cmap


def _attrs(col9):
    return dict(kv.split("=", 1) for kv in col9.split(";") if "=" in kv)


def gene_id_map(gff_path):
    """GenBank gene ID (col9 `ID`, e.g. 'gene-ACTFIV_005125') -> submitter gene id.

    Derived from each transcript's orig_transcript_id via its Parent gene."""
    gmap = {}
    with open(gff_path) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 9 or c[2] not in ("mRNA", "tRNA", "rRNA", "transcript"):
                continue
            a = _attrs(c[8])
            parent = a.get("Parent")
            orig = a.get("orig_transcript_id")
            if not parent or not orig:
                continue
            tx = orig.rsplit("|", 1)[-1]              # gnl|WGS:JBTAPL|DC_..-RA -> DC_..-RA
            gene = _TX_SUFFIX.sub("", tx)             # DC_GS_00011606-RA -> DC_GS_00011606
            gmap.setdefault(parent, gene)
    return gmap


def _set_name(col9, value):
    """Replace (or insert) the Name= attribute with `value`."""
    parts = col9.split(";")
    out, done = [], False
    for kv in parts:
        if kv.startswith("Name="):
            out.append("Name=" + value)
            done = True
        else:
            out.append(kv)
    if not done:
        out.insert(1 if out else 0, "Name=" + value)
    return ";".join(out)


def relabel_gff(gff_path, cmap, gmap):
    tmp = gff_path + ".tmp"
    n_seq, n_gene, n_tx = 0, 0, 0
    with open(gff_path) as fi, open(tmp, "w") as fo:
        for line in fi:
            if line.startswith("#") or "\t" not in line:
                fo.write(line)
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 9:
                fo.write(line)
                continue
            new = cmap.get(c[0], c[0])
            if new != c[0]:
                c[0] = new
                n_seq += 1
            a = _attrs(c[8])
            if c[2] == "gene":
                gid = gmap.get(a.get("ID", ""))
                if gid:
                    c[8] = _set_name(c[8], gid)
                    n_gene += 1
            elif c[2] in ("mRNA", "tRNA", "rRNA", "transcript"):
                orig = a.get("orig_transcript_id")
                if orig:
                    c[8] = _set_name(c[8], orig.rsplit("|", 1)[-1])
                    n_tx += 1
            fo.write("\t".join(c) + "\n")
    os.replace(tmp, gff_path)
    return n_seq, n_gene, n_tx


def relabel_fna(fna_path, cmap):
    tmp = fna_path + ".tmp"
    n = 0
    with open(fna_path) as fi, open(tmp, "w") as fo:
        for line in fi:
            if line.startswith(">"):
                acc, _, desc = line[1:].rstrip("\n").partition(" ")
                new = cmap.get(acc, acc)
                if new != acc:
                    n += 1
                # keep the GenBank accession in the description for traceability
                fo.write(f">{new} {desc} [GenBank:{acc}]\n" if new != acc
                         else line)
            else:
                fo.write(line)
    os.replace(tmp, fna_path)
    return n


def already_relabeled(fna_path):
    """True if the first seqid is not a bare GenBank WGS/CM accession."""
    with open(fna_path) as fh:
        for line in fh:
            if line.startswith(">"):
                acc = line[1:].split()[0]
                # GenBank accessions: WGS 'JBTAP..010000001.1' or chromosome 'CM..'
                return not re.match(r"^(JB[A-Z]{4}\d|CM\d|[A-Z]{4}\d{8})", acc)
    return False


def relabel_one(stem, refresh_faidx=True):
    fna = os.path.join(GENOMES, f"{stem}_browser.fna")
    gff = os.path.join(GENOMES, f"{stem}_browser.gff")
    if not os.path.exists(fna):
        print(f"  skip  {stem} — no {os.path.basename(fna)}")
        return False
    if already_relabeled(fna):
        print(f"  skip  {stem} — already relabeled")
        return False
    cmap = build_contig_map(fna)
    gmap = gene_id_map(gff) if os.path.exists(gff) else {}
    renamed = sum(1 for k, v in cmap.items() if k != v)
    kept = sum(1 for k, v in cmap.items() if k == v)
    fn = relabel_fna(fna, cmap)
    gs = gg = gt = 0
    if os.path.exists(gff):
        gs, gg, gt = relabel_gff(gff, cmap, gmap)
    if refresh_faidx:
        import pysam
        fai = fna + ".fai"
        if os.path.exists(fai):
            os.unlink(fai)
        pysam.faidx(fna)
    print(f"  {stem}: contigs renamed {fn} (kept {kept} GenBank-only); "
          f"gff seqids {gs}, gene labels {gg}, transcript labels {gt}")
    return True


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", nargs="+", metavar="STEM",
                    help=f"subset of filename stems (default: all). {PAPER_STEMS}")
    ap.add_argument("--no-faidx", action="store_true",
                    help="skip regenerating the .fai (do it later)")
    args = ap.parse_args()
    stems = args.only or PAPER_STEMS
    print(f"Relabeling {len(stems)} paper genome(s) in {GENOMES}")
    done = 0
    for s in stems:
        done += relabel_one(s, refresh_faidx=not args.no_faidx)
    print(f"\nDone — {done} relabeled. Now rerun:\n"
          "  python3 scripts/build_blastdb.py\n"
          "  python3 scripts/build_browser_tracks.py")


if __name__ == "__main__":
    main()
