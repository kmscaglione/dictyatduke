#!/usr/bin/env python3
"""Build genome-browser files from a submitter GenBank flat file (.gbf) —
authoritative contig names + gene IDs, and the only source for the genomes still
stuck in GenBank (D. citrinum KGL29A, D. intermedium PJ11).

For each genome it writes, into assets/genomes/ (gitignored, like the other
genome data):
    <Name>_browser.fna       contigs named as the submitter named them (+ .fai)
    <Name>_genome.fna.gz      gzipped assembly (downloads page)
    <Name>_browser.gff        gene models: mRNA + exon + CDS, Name = submitter
                              gene id (DI_PJ_00012771 ...), from the CDS protein_id

Then, as for any genome:  build_blastdb.py  and  build_browser_tracks.py

The .gbf files are ~64 MB each and live outside git. Point --src at their folder.
Standard library + pysam (for faidx, already required by the other genome steps).

Usage:
    python3 scripts/genomes_from_gbf.py --src /path/to/gbf --only KGL29A PJ11
"""
import argparse, gzip, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")

# .gbf basename -> output filename stem (kept consistent with fetch_paper_genomes)
STEMS = {
    "Ar5b": "D_dimigraforme_Ar5b", "Ax2.214": "Dd_AX2-214", "Cf3b": "D_citrinum_Cf3b",
    "CRII6C": "Dd_CR116C", "GS8b": "D_citrinum_GS8b", "KGL29A": "D_citrinum_KGL29A",
    "M4B": "Dd_M4B", "OT3A": "Dd_OT3A", "PJ11": "D_intermedium_PJ11", "S6B": "Dd_S6B",
}
_GENE = re.compile(r"(?:DDIM|DD|DC|DI)_[A-Z0-9]+_\d+")
_FEAT = re.compile(r"^ {5}(\S+)\s+(.*)$")


def _segments(loc):
    """(strand, [(start,end)...]) from a GenBank location string."""
    strand = "-" if "complement" in loc else "+"
    segs = []
    for a, b in re.findall(r"(\d+)\.\.[<>]?(\d+)", loc):
        segs.append((int(a), int(b)))
    if not segs:
        m = re.findall(r"\d+", loc)
        if len(m) >= 2:
            segs = [(int(m[0]), int(m[1]))]
    return strand, segs


def parse(path):
    """Yield ('seq', contig, sequence) and ('cds', contig, gene_id, strand, segs)."""
    contig = None
    cur = None
    in_origin = False
    seqbuf = []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("LOCUS"):
                contig = line.split()[1]
                continue
            if line.startswith("ORIGIN"):
                in_origin = True
                seqbuf = []
                continue
            if line.startswith("//"):
                if in_origin:
                    yield ("seq", contig, "".join(seqbuf))
                in_origin = False
                cur = None
                continue
            if in_origin:
                seqbuf.append(re.sub(r"[^A-Za-z]", "", line))
                continue
            m = _FEAT.match(line)
            if m:
                if cur:
                    yield cur
                    cur = None
                if m.group(1) == "CDS":
                    cur = ["cds", contig, None, m.group(2).strip(), True]  # [tag,contig,gid,loc,in_loc]
                continue
            if cur is not None and len(line) > 21:
                if line[21] == "/":
                    cur[4] = False
                    if line[21:].startswith("/protein_id="):
                        pid = line[21:].split("=", 1)[1].strip().strip('"\n')
                        gm = _GENE.search(pid)
                        if gm:
                            cur[2] = gm.group(0)
                elif cur[4]:
                    cur[3] += line[21:].strip()
        if cur:
            yield cur


def build_one(base, src, do_faidx=True):
    path = os.path.join(src, base + ".gbf")
    stem = STEMS[base]
    if not os.path.exists(path):
        print(f"  skip {base}: not found in {src}")
        return False
    fna = os.path.join(GENOMES, f"{stem}_browser.fna")
    gff = os.path.join(GENOMES, f"{stem}_browser.gff")
    seqs, feats, n_cds = [], [], 0
    for rec in parse(path):
        if rec[0] == "seq":
            _, contig, seq = rec
            seqs.append((contig, seq))
        else:
            _, contig, gid, loc, _ = rec
            if not gid:
                continue
            strand, segs = _segments(loc)
            if not segs:
                continue
            lo, hi = min(s for s, _ in segs), max(e for _, e in segs)
            rid = f"rna-{gid}"
            feats.append((contig, "mRNA", lo, hi, strand, f"ID={rid};Name={gid}"))
            for i, (s, e) in enumerate(segs, 1):
                feats.append((contig, "exon", s, e, strand, f"ID=exon-{gid}-{i};Parent={rid};Name={gid}"))
                feats.append((contig, "CDS", s, e, strand, f"ID=cds-{gid}-{i};Parent={rid};Name={gid}"))
            n_cds += 1
    # FASTA (uncompressed for IGV/blastdb) + gzipped assembly
    with open(fna, "w") as fh:
        for contig, seq in seqs:
            fh.write(f">{contig}\n")
            for i in range(0, len(seq), 70):
                fh.write(seq[i:i + 70] + "\n")
    with open(fna, "rb") as fi, gzip.open(os.path.join(GENOMES, f"{stem}_genome.fna.gz"), "wb", compresslevel=6) as fo:
        fo.writelines(fi)
    # GFF3, sorted by contig then start
    feats.sort(key=lambda f: (f[0], f[2]))
    with open(gff, "w") as fh:
        fh.write("##gff-version 3\n")
        for contig, typ, s, e, strand, attrs in feats:
            fh.write(f"{contig}\tgbf\t{typ}\t{s}\t{e}\t.\t{strand}\t.\t{attrs}\n")
    if do_faidx:
        import pysam
        fai = fna + ".fai"
        if os.path.exists(fai):
            os.unlink(fai)
        pysam.faidx(fna)
    print(f"  built {stem}: {len(seqs)} contigs, {n_cds} genes  <- {base}.gbf")
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "data", "genbank"))
    ap.add_argument("--only", nargs="+", metavar="BASE", help=f"subset of {list(STEMS)}")
    ap.add_argument("--no-faidx", action="store_true")
    args = ap.parse_args()
    os.makedirs(GENOMES, exist_ok=True)
    bases = args.only or list(STEMS)
    print(f"Building {len(bases)} genome(s) from .gbf in {args.src}")
    for b in bases:
        if b in STEMS:
            build_one(b, args.src, do_faidx=not args.no_faidx)
        else:
            print(f"  skip {b}: unknown (known: {list(STEMS)})")
    print("Now run: python3 scripts/build_blastdb.py && python3 scripts/build_browser_tracks.py")


if __name__ == "__main__":
    main()
