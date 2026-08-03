#!/usr/bin/env python3
"""Per-genome gene sequences: CDS (nucleotide) and protein multi-FASTA, one record
per gene keyed by the submitter gene id. Lets people download the actual sequences
behind the gene models / ortholog ids (Tera Levin's request).

Two sources, one output shape:
  * The 10 sequenced genomes come from the submitter GenBank flat files (.gbf):
    protein straight from the authoritative /translation, CDS spliced from ORIGIN.
  * The annotated legacy/reference genomes (AX4, D. firmibasis, D. purpureum,
    C. fasciculata, H. pallidum PN500, P. violaceum) are spliced + translated from
    their genome FASTA + browser GFF. (The 3 FASTA-only assemblies have no models.)

Writes, into assets/genomes/ (gitignored, like the other genome data):
    <stem>_cds.fasta.gz        nucleotide CDS, >{gene_id}
    <stem>_proteins.fasta.gz   protein,        >{gene_id}

Then add the sizes to downloads_manifest.json (build_gene_sequences prints them).
Standard library only. Point --src at the .gbf folder for the sequenced genomes.
"""
import argparse, gzip, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GENOMES = os.path.join(ROOT, "assets", "genomes")
_GENE = re.compile(r"(?:DDIM|DD|DC|DI)_[A-Z0-9]+_\d+")
_FEAT = re.compile(r"^ {5}(\S+)\s+(.*)$")

# .gbf basename -> output stem (the 10 sequenced genomes; authoritative /translation)
GBF = {
    "Ar5b": "D_dimigraforme_Ar5b", "Ax2.214": "Dd_AX2-214", "Cf3b": "D_citrinum_Cf3b",
    "CRII6C": "Dd_CR116C", "GS8b": "D_citrinum_GS8b", "KGL29A": "D_citrinum_KGL29A",
    "M4B": "Dd_M4B", "OT3A": "Dd_OT3A", "PJ11": "D_intermedium_PJ11", "S6B": "Dd_S6B",
}
# annotated genomes without a .gbf: (stem, fasta, gff) -> splice + translate
GFF_GENOMES = [
    ("D_discoideum_AX4", "D_discoideum_AX4_refseq.fna", "D_discoideum_AX4.gff"),
    ("D_firmibasis", "D_firmibasis_browser.fna", "D_firmibasis_browser.gff"),
    ("D_giganteum", "D_giganteum_browser.fna", "D_giganteum_browser.gff"),
    ("D_purpureum", "D_purpureum_browser.fna", "D_purpureum_browser.gff"),
    ("C_fasciculata_SH3", "C_fasciculata_SH3_browser.fna", "C_fasciculata_SH3_browser.gff"),
    ("H_pallidum_PN500", "H_pallidum_PN500_browser.fna", "H_pallidum_PN500_browser.gff"),
    ("P_violaceum", "P_violaceum_browser.fna", "P_violaceum_browser.gff"),
]

_CODE = {  # standard genetic code
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "CTT": "L", "CTC": "L", "CTA": "L",
    "CTG": "L", "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M", "GTT": "V", "GTC": "V",
    "GTA": "V", "GTG": "V", "TCT": "S", "TCC": "S", "TCA": "S", "TCG": "S", "CCT": "P",
    "CCC": "P", "CCA": "P", "CCG": "P", "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A", "TAT": "Y", "TAC": "Y", "TAA": "*",
    "TAG": "*", "CAT": "H", "CAC": "H", "CAA": "Q", "CAG": "Q", "AAT": "N", "AAC": "N",
    "AAA": "K", "AAG": "K", "GAT": "D", "GAC": "D", "GAA": "E", "GAG": "E", "TGT": "C",
    "TGC": "C", "TGA": "*", "TGG": "W", "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R",
    "AGT": "S", "AGC": "S", "AGA": "R", "AGG": "R", "GGT": "G", "GGC": "G", "GGA": "G",
    "GGG": "G",
}
_COMP = str.maketrans("ACGTacgtNn", "TGCAtgcaNn")


def _revcomp(s):
    return s.translate(_COMP)[::-1]


def _translate(nt):
    aa = [_CODE.get(nt[i:i + 3].upper(), "X") for i in range(0, len(nt) - 2, 3)]
    p = "".join(aa)
    return p[:-1] if p.endswith("*") else p


def _wrap(s, w=60):
    return "\n".join(s[i:i + w] for i in range(0, len(s), w))


def _segments(loc):
    strand = "-" if "complement" in loc else "+"
    segs = [(int(a), int(b)) for a, b in re.findall(r"(\d+)\.\.[<>]?(\d+)", loc)]
    return strand, sorted(segs)


# ---- .gbf: authoritative protein + spliced CDS -----------------------------
def from_gbf(path):
    contig, seq, cur = None, [], None
    in_origin = False
    seqs = {}
    pending = []  # (contig, gene_id, strand, segs, protein)

    def flush():
        if cur and cur.get("gid") and cur.get("prot"):
            pending.append((contig, cur["gid"], cur["strand"], cur["segs"], "".join(cur["prot"])))

    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("LOCUS"):
                contig = line.split()[1]
                continue
            if line.startswith("ORIGIN"):
                in_origin, seq = True, []
                continue
            if line.startswith("//"):
                if in_origin:
                    seqs[contig] = "".join(seq)
                in_origin = False
                continue
            if in_origin:
                seq.append(re.sub(r"[^A-Za-z]", "", line))
                continue
            m = _FEAT.match(line)
            if m:
                flush()
                cur = None
                if m.group(1) == "CDS":
                    strand, segs = _segments(m.group(2).strip())
                    cur = {"loc": m.group(2).strip(), "strand": strand, "segs": segs,
                           "gid": None, "prot": [], "in": "loc"}
                continue
            if cur is not None and len(line) > 21:
                body = line[21:].rstrip("\n")
                if line[21] == "/":
                    cur["in"] = "qual"
                    if body.startswith("/protein_id="):
                        mm = _GENE.search(body)
                        if mm:
                            cur["gid"] = mm.group(0)
                    elif body.startswith("/translation="):
                        cur["in"] = "trans"
                        cur["prot"].append(body.split("=", 1)[1].strip().strip('"'))
                    else:
                        cur["in"] = "qual"
                elif cur["in"] == "loc":
                    strand, segs = _segments(cur["loc"] + body.strip())
                    cur["strand"], cur["segs"] = strand, segs
                    cur["loc"] += body.strip()
                elif cur["in"] == "trans":
                    cur["prot"].append(body.strip().strip('"'))
        flush()

    seen = set()
    for contig, gid, strand, segs, prot in pending:
        if gid in seen:
            continue
        seen.add(gid)
        cs = seqs.get(contig, "")
        nt = "".join(cs[s - 1:e] for s, e in segs)
        if strand == "-":
            nt = _revcomp(nt)
        yield gid, nt, prot.replace("\n", "")


# ---- GFF + FASTA: splice + translate ---------------------------------------
def _load_fasta(path):
    seqs, name, buf = {}, None, []
    with open(path, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith(">"):
                if name:
                    seqs[name] = "".join(buf)
                name, buf = line[1:].split()[0], []
            else:
                buf.append(line.strip())
    if name:
        seqs[name] = "".join(buf)
    return seqs


def _attrs(col9):
    return dict(kv.split("=", 1) for kv in col9.split(";") if "=" in kv)


def from_gff_fasta(gff, fna):
    seqs = _load_fasta(fna)
    tx = {}  # rna id -> {gid, chrom, strand, parts:[(start,end,phase)]}
    with open(gff, encoding="utf-8", errors="replace") as fh:
        for line in fh:
            if line.startswith("#") or "\t" not in line:
                continue
            c = line.rstrip("\n").split("\t")
            if len(c) < 9 or c[2] != "CDS":
                continue
            a = _attrs(c[8])
            rid = a.get("Parent", a.get("ID", ""))
            phase = 0
            try:
                phase = int(c[7])
            except ValueError:
                phase = 0
            # Prefer the submitter gene id (it's carried in the NCBI-processed
            # models' rna-/cds- IDs, e.g. rna-DC_GS_00004190-RA); else fall back.
            gid = None
            for src in (rid, a.get("ID", ""), a.get("Name", ""), a.get("protein_id", "")):
                m = _GENE.search(src)
                if m:
                    gid = m.group(0)
                    break
            if not gid:
                gid = a.get("Name") or a.get("protein_id") or a.get("locus_tag") or rid
                gid = re.sub(r"^(rna-|cds-|gene-)", "", gid)
                gid = re.sub(r"-R[A-Z0-9]+$", "", gid)
            e = tx.setdefault(rid, {"gid": gid, "chrom": c[0], "strand": c[6], "parts": []})
            e["parts"].append((int(c[3]), int(c[4]), phase))
    seen = set()
    for rid, t in tx.items():
        gid = t["gid"]
        if gid in seen or t["chrom"] not in seqs:
            continue
        seen.add(gid)
        cs = seqs[t["chrom"]]
        parts = sorted(t["parts"])
        nt = "".join(cs[s - 1:e] for s, e, _ in parts)
        if t["strand"] == "-":
            nt = _revcomp(nt)
            lead = parts[-1][2]
        else:
            lead = parts[0][2]
        prot = _translate(nt[lead:] if lead else nt)
        yield gid, nt, prot


def _write(stem, records):
    cds_p = os.path.join(GENOMES, f"{stem}_cds.fasta.gz")
    pro_p = os.path.join(GENOMES, f"{stem}_proteins.fasta.gz")
    n = 0
    with gzip.open(cds_p, "wt") as fc, gzip.open(pro_p, "wt") as fp:
        for gid, nt, prot in records:
            if nt:
                fc.write(f">{gid}\n{_wrap(nt)}\n")
            if prot:
                fp.write(f">{gid}\n{_wrap(prot)}\n")
            n += 1
    print(f"  {stem:22} {n:6} genes  cds={os.path.getsize(cds_p)//1024}KB "
          f"prot={os.path.getsize(pro_p)//1024}KB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=os.path.join(ROOT, "data", "genbank"))
    ap.add_argument("--only", nargs="+")
    args = ap.parse_args()
    os.makedirs(GENOMES, exist_ok=True)
    for base, stem in GBF.items():
        if args.only and stem not in args.only:
            continue
        path = os.path.join(args.src, base + ".gbf")
        fna = os.path.join(GENOMES, f"{stem}_browser.fna")
        gff = os.path.join(GENOMES, f"{stem}_browser.gff")
        if os.path.exists(path):
            _write(stem, from_gbf(path))                       # authoritative /translation
        elif os.path.exists(fna) and os.path.exists(gff):
            print(f"  ({base}.gbf absent — translating {stem} from its GFF+FASTA)")
            _write(stem, from_gff_fasta(gff, fna))             # same models, on-box
        else:
            print(f"  skip {stem}: no {base}.gbf and no browser files")
    for stem, fna, gff in GFF_GENOMES:
        if args.only and stem not in args.only:
            continue
        fp, gp = os.path.join(GENOMES, fna), os.path.join(GENOMES, gff)
        if os.path.exists(fp) and os.path.exists(gp):
            _write(stem, from_gff_fasta(gp, fp))
        else:
            print(f"  skip {stem}: genome/GFF not present")


if __name__ == "__main__":
    main()
