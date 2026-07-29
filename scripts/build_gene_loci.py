#!/usr/bin/env python3
"""Index submitter gene ID -> genome locus from the OrthoFinder genomes' GenBank
flat files (Holland*, Ahmed* et al. 2025): assets/gene_loci.json

Each .gbf CDS carries the submitter's gene id in its protein_id, e.g.
    /protein_id="ACTFIV:DC_GS_00011627-RA:cds1"   ->  gene DC_GS_00011627
and the contig is the LOCUS name (a submitter name: PJ11_contig_1_p8 ...). We map
    { genome_id: { gene_id: "contig:start-end" } }
so the curated-ortholog table can deep-link into the genome browser and the
variation view can find the true ortholog locus instead of a tblastn best hit.

The .gbf files are large (~64 MB each) and live outside git, like the genomes.
Point --src at the folder that holds them (default: data/genbank/).

Standard library only. Usage:
    python3 scripts/build_gene_loci.py --src /path/to/gbf_folder
"""
import argparse, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "gene_loci.json")

# .gbf basename -> site genome id (matches BLAST_DBS / browserOrganisms ids)
FILES = {
    "Ar5b": "d-dimigraforme", "Ax2.214": "dd-ax2-214", "Cf3b": "dc-cf3b",
    "CRII6C": "dd-cr116c", "GS8b": "d-citrinum", "KGL29A": "dc-kgl29a",
    "M4B": "dd-m4b", "OT3A": "dd-ot3a", "PJ11": "di-pj11", "S6B": "dd-s6b",
}
_GENE = re.compile(r"(?:DDIM|DD|DC|DI)_[A-Z0-9]+_\d+")
_FEAT = re.compile(r"^ {5}(\S+)\s+(.*)$")   # 5-space indent, feature type, location


def _cds_records(path):
    """Yield (contig, gene_id, start, end, strand) for each CDS in a .gbf."""
    contig = None
    cur = None  # {"loc", "pid", "in_loc"}
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("LOCUS"):
                contig = line.split()[1]
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


def build(src):
    genomes = {}
    for base, gid in FILES.items():
        path = os.path.join(src, base + ".gbf")
        if not os.path.exists(path):
            print(f"  skip {gid}: {base}.gbf not found in {src}")
            continue
        loci = {}
        for rec in _cds_records(path):
            if not rec:
                continue
            contig, gene, lo, hi, strand = rec
            # keep the widest span if a gene id recurs (multi-CDS / isoforms)
            if gene in loci:
                c0, s0, e0 = loci[gene].split(":")[0], *[int(x) for x in loci[gene].split(":")[1].split("-")]
                if c0 == contig:
                    lo, hi = min(lo, s0), max(hi, e0)
            loci[gene] = f"{contig}:{lo}-{hi}"
        genomes[gid] = loci
        print(f"  {gid:16} {len(loci):6} genes  <- {base}.gbf")
    # D. firmibasis: index its GenBank protein accessions from the browser GFF so
    # its OrthoFinder orthologs (KAK…) are clickable too.
    firmi_gff = os.path.join(ROOT, "assets", "genomes", "D_firmibasis_browser.gff")
    if os.path.exists(firmi_gff):
        fl = _gff_protein_loci(firmi_gff)
        if fl:
            genomes["d-firmibasis"] = fl
            print(f"  {'d-firmibasis':16} {len(fl):6} proteins  <- D_firmibasis_browser.gff")
    payload = {"_meta": {"source": "GenBank flat files, Holland*, Ahmed* et al. 2025",
                         "genomes": {g: len(v) for g, v in genomes.items()}},
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
    build(ap.parse_args().src)
