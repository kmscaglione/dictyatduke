#!/usr/bin/env python3
"""Index submitter gene ID -> genome locus from the OrthoFinder genomes' GenBank
flat files (Holland*, Ahmed* et al. 2025): assets/gene_loci.json

Each .gbf CDS carries the submitter's gene id in its protein_id, e.g.
    /protein_id="ACTFIV:DC_GS_00011627-RA:cds1"   ->  gene DC_GS_00011627
and the contig is the LOCUS name (a submitter name: PJ11_contig_1_p8 ...). We map
    { genome_id: { gene_id: "seqid:start-end" } }
so the curated-ortholog table can deep-link into the genome browser and the
variation view can find the true ortholog locus instead of a tblastn best hit.

The seqid must be the one the genome BROWSER uses, which is not always the .gbf
LOCUS name. relabel_paper_genomes.py renames a GenBank scaffold to its submitter
name only when the FASTA defline carries one, so a few keep their accession:
AX2-214's four chromosome-level scaffolds (AX2-214_contig_71_p6 is CM142511.1 in
the browser) and OT3A's two mitochondrial contigs. So each .gbf contig is
translated to its browser seqid with relabel's own naming rule (imported, not
copied), matched by name in the browser FASTA defline or, failing that, by a
unique sequence length. Contig lengths must agree, or the build stops. The
browser seqids and lengths are recorded in _meta.browser_seqids so
check_data.py can verify every locus.

The .gbf files are large (~64 MB each) and live outside git, like the genomes.
Point --src at the folder that holds them (default: data/genbank/), and
--genomes at the folder holding the browser FASTAs (default: assets/genomes/).
Run it where those FASTAs are either all un-relabeled (straight from GenBank) or
exactly as the live server has them; both give the same seqids.

Standard library only. Usage:
    python3 scripts/build_gene_loci.py --src /path/to/gbf_folder [--genomes DIR]
"""
import argparse, json, os, re, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from relabel_paper_genomes import PAPER_STEMS, already_relabeled, build_contig_map  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "gene_loci.json")

# .gbf basename -> site genome id (matches BLAST_DBS / browserOrganisms ids)
FILES = {
    "Ar5b": "d-dimigraforme", "Ax2.214": "dd-ax2-214", "Cf3b": "dc-cf3b",
    "CRII6C": "dd-cr116c", "GS8b": "d-citrinum", "KGL29A": "dc-kgl29a",
    "M4B": "dd-m4b", "OT3A": "dd-ot3a", "PJ11": "di-pj11", "S6B": "dd-s6b",
}
# site genome id -> browser file stem (<stem>_browser.fna), as in serve.py
STEMS = {
    "d-dimigraforme": "D_dimigraforme_Ar5b", "dd-ax2-214": "Dd_AX2-214",
    "dc-cf3b": "D_citrinum_Cf3b", "dd-cr116c": "Dd_CR116C", "d-citrinum": "D_citrinum_GS8b",
    "dc-kgl29a": "D_citrinum_KGL29A", "dd-m4b": "Dd_M4B", "dd-ot3a": "Dd_OT3A",
    "di-pj11": "D_intermedium_PJ11", "dd-s6b": "Dd_S6B", "d-firmibasis": "D_firmibasis",
}
_GENE = re.compile(r"(?:DDIM|DD|DC|DI)_[A-Z0-9]+_\d+")
_FEAT = re.compile(r"^ {5}(\S+)\s+(.*)$")   # 5-space indent, feature type, location


def _cds_records(path, lengths):
    """Yield (contig, gene_id, start, end, strand) for each CDS in a .gbf.
    Fills `lengths` with LOCUS name -> length in bp."""
    contig = None
    cur = None  # {"loc", "pid", "in_loc"}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("LOCUS"):
                f = line.split()
                contig = f[1]
                lengths[contig] = int(f[2])
                continue
            m = _FEAT.match(line)
            if m:
                if cur:
                    yield _finish(contig, cur)
                    cur = None
                if m.group(1) == "CDS":
                    cur = {"loc": m.group(2).strip(), "pid": None, "in_loc": True}
                continue
            if cur is not None and len(line) > 21:
                if line[21] == "/":
                    cur["in_loc"] = False
                    if line[21:].startswith("/protein_id="):
                        cur["pid"] = line[21:].split("=", 1)[1].strip().strip('"\n')
                elif cur["in_loc"]:
                    cur["loc"] += line[21:].strip()
        if cur:
            yield _finish(contig, cur)


def _gff_protein_loci(gff_path):
    """protein_id -> 'contig:start-end' from a GFF3's CDS features (NCBI style).
    D. firmibasis isn't a .gbf genome; its OrthoFinder ids are GenBank protein
    accessions (KAK…) which appear as protein_id in its browser GFF, on contigs
    that match the browser — so we can still make those orthologs clickable."""
    spans = {}
    with open(gff_path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("#") or "\t" not in line:
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 9 or c[2] != "CDS":
                continue
            attrs = dict(kv.split("=", 1) for kv in c[8].split(";") if "=" in kv)
            pid = attrs.get("protein_id")
            if not pid:
                continue
            contig, s, e = c[0], int(c[3]), int(c[4])
            key = (contig, pid)
            if key in spans:
                s0, e0 = spans[key]
                spans[key] = (min(s, s0), max(e, e0))
            else:
                spans[key] = (s, e)
    return {pid: f"{contig}:{s}-{e}" for (contig, pid), (s, e) in spans.items()}


def browser_seqids(stem, genomes_dir):
    """Browser seqid -> (length, defline tokens) for <stem>_browser.fna.

    For a paper genome still carrying GenBank accessions, the seqid is what
    relabel_paper_genomes.py will rename it to (its build_contig_map); for one
    already relabeled, or built from a .gbf, it is the FASTA id as it stands."""
    fna = os.path.join(genomes_dir, f"{stem}_browser.fna")
    fai = fna + ".fai"
    if not (os.path.exists(fna) and os.path.exists(fai)):
        return None
    lens = {}
    with open(fai) as fh:
        for line in fh:
            c = line.split("\t")
            lens[c[0]] = int(c[1])
    cmap = (build_contig_map(fna)
            if stem in PAPER_STEMS and not already_relabeled(fna) else {})
    out = {}
    with open(fna) as fh:
        for line in fh:
            if line.startswith(">"):
                acc, _, desc = line[1:].rstrip("\n").partition(" ")
                toks = {t.strip(",[]") for t in desc.split()}
                out[cmap.get(acc, acc)] = (lens[acc], toks)
    return out


def contig_translation(gbf_lengths, browser, label):
    """.gbf LOCUS name -> browser seqid. Match by exact seqid, else by the name in
    the browser defline, else by a unique length among unclaimed seqids. Every
    match must agree on length; anything unmatched stops the build."""
    tr, claimed = {}, set()
    pending = []
    for name, n in gbf_lengths.items():
        if name in browser:
            tr[name] = name
        else:
            hits = [sid for sid, (_, toks) in browser.items() if name in toks]
            if len(hits) == 1:
                tr[name] = hits[0]
            else:
                pending.append(name)
                continue
        claimed.add(tr[name])
    for name in pending:
        n = gbf_lengths[name]
        hits = [sid for sid, (ln, _) in browser.items() if ln == n and sid not in claimed]
        if len(hits) != 1:
            sys.exit(f"  {label}: cannot place .gbf contig {name} ({n} bp) in the browser "
                     f"FASTA ({len(hits)} candidates); refusing to write gene_loci.json")
        tr[name] = hits[0]
        claimed.add(hits[0])
    bad = [f"{k} {gbf_lengths[k]} != {v} {browser[v][0]}"
           for k, v in tr.items() if gbf_lengths[k] != browser[v][0]]
    if bad:
        sys.exit(f"  {label}: contig length mismatch .gbf vs browser: {bad[:5]}; "
                 "refusing to write gene_loci.json")
    if len(set(tr.values())) != len(tr):
        sys.exit(f"  {label}: two .gbf contigs map to one browser seqid; refusing to write")
    return tr


def _finish(contig, cur):
    if not cur["pid"]:
        return None
    gm = _GENE.search(cur["pid"])
    if not gm:
        return None
    nums = [int(n) for n in re.findall(r"\d+", cur["loc"])]
    if not nums:
        return None
    strand = "-" if "complement" in cur["loc"] else "+"
    return (contig, gm.group(0), min(nums), max(nums), strand)


def build(src, genomes_dir):
    genomes, seqid_meta = {}, {}
    for base, gid in FILES.items():
        path = os.path.join(src, base + ".gbf")
        if not os.path.exists(path):
            print(f"  skip {gid}: {base}.gbf not found in {src}")
            continue
        browser = browser_seqids(STEMS[gid], genomes_dir)
        if browser is None:
            sys.exit(f"  {gid}: no {STEMS[gid]}_browser.fna(.fai) in {genomes_dir}; "
                     "loci would not be checked against the browser, refusing to write")
        gbf_len = {}   # filled by _cds_records as it reads the LOCUS lines
        recs = [r for r in _cds_records(path, gbf_len) if r]
        tr = contig_translation(gbf_len, browser, gid)
        renamed = sorted({c for c, *_ in recs if tr[c] != c})
        loci, clamped = {}, 0
        for rec in recs:
            contig, gene, lo, hi, strand = rec
            n = gbf_len[contig]
            if hi > n:   # a few submitter CDSs run past their contig's end
                lo, hi, clamped = min(lo, n), n, clamped + 1
            contig = tr[contig]
            # keep the widest span if a gene id recurs (multi-CDS / isoforms)
            if gene in loci:
                c0, s0, e0 = loci[gene].split(":")[0], *[int(x) for x in loci[gene].split(":")[1].split("-")]
                if c0 == contig:
                    lo, hi = min(lo, s0), max(hi, e0)
            loci[gene] = f"{contig}:{lo}-{hi}"
        genomes[gid] = loci
        seqid_meta[gid] = {sid: ln for sid, (ln, _) in browser.items()}
        note = f"; {len(renamed)} contig(s) to browser seqids" if renamed else ""
        note += f"; {clamped} end(s) clamped to contig" if clamped else ""
        print(f"  {gid:16} {len(loci):6} genes  <- {base}.gbf{note}")
    if not genomes:
        sys.exit(f"  no .gbf files found in {src}; refusing to overwrite gene_loci.json")
    # D. firmibasis: index its GenBank protein accessions from the browser GFF so
    # its OrthoFinder orthologs (KAK…) are clickable too.
    firmi_gff = os.path.join(genomes_dir, "D_firmibasis_browser.gff")
    firmi = browser_seqids("D_firmibasis", genomes_dir)
    if os.path.exists(firmi_gff) and firmi:
        fl = _gff_protein_loci(firmi_gff)
        if fl:
            genomes["d-firmibasis"] = fl
            seqid_meta["d-firmibasis"] = {sid: ln for sid, (ln, _) in firmi.items()}
            print(f"  {'d-firmibasis':16} {len(fl):6} proteins  <- D_firmibasis_browser.gff")
    payload = {"_meta": {"source": "GenBank flat files, Holland*, Ahmed* et al. 2025",
                         "genomes": {g: len(v) for g, v in genomes.items()},
                         "browser_seqids": seqid_meta},
               "loci": genomes}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
    total = sum(len(v) for v in genomes.values())
    print(f"  wrote gene_loci.json: {total} gene loci across {len(genomes)} genomes "
          f"({os.path.getsize(OUT)/1024:.0f} KB)")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "data", "genbank"),
                    help="folder holding the .gbf files")
    ap.add_argument("--genomes", default=os.path.join(ROOT, "assets", "genomes"),
                    help="folder holding the <stem>_browser.fna(.fai) files")
    a = ap.parse_args()
    build(a.src, a.genomes)
