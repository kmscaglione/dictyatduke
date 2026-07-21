#!/usr/bin/env python3
"""Regenerate the derived JSON data files used by dictyBase v2.

Run from anywhere:

    python3 scripts/build_data.py          # gene_index, phenotypes, downloads_manifest, corpus merge
    python3 scripts/build_data.py --go      # also (re)download the GO GAF -> go_annotations.json

All outputs are written to ../assets/. Sources live in ../assets/dictybase-corpus/
and ../assets/genomes/. Standard library only. See README.md ("Data pipeline").
"""
import csv, gzip, html, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
CORPUS_SRC = os.path.join(ASSETS, "dictybase-corpus")
GENOMES = os.path.join(ASSETS, "genomes")


def _write(name, obj):
    path = os.path.join(ASSETS, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote {name} ({os.path.getsize(path)/1024:.0f} KB)")


# ---------------------------------------------------------------------------
# gene_index.json  <-  D_discoideum_AX4.gff
# Array of [ddbId, symbol, name, location, ncbiGeneId] for every gene.
# ---------------------------------------------------------------------------
def build_gene_index():
    gff = os.path.join(GENOMES, "D_discoideum_AX4.gff")
    if not os.path.exists(gff):
        print("  SKIP gene_index: assets/genomes/D_discoideum_AX4.gff missing (gitignored)")
        return

    def attrs(col):
        d = {}
        for kv in col.strip().split(";"):
            if "=" in kv:
                k, v = kv.split("=", 1)
                d[k] = urllib.parse.unquote(v)
        return d

    import urllib.parse  # local import; only needed here
    product = {}
    with open(gff) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if len(f) < 9 or f[2] != "mRNA":
                continue
            a = attrs(f[8])
            lt, prod = a.get("locus_tag"), a.get("product") or a.get("Note") or ""
            if lt and prod and lt not in product:
                product[lt] = prod

    rows = []
    with open(gff) as fh:
        for line in fh:
            if line.startswith("#"):
                continue
            f = line.rstrip("\n").split("\t")
            if len(f) < 9 or f[2] not in ("gene", "pseudogene"):
                continue
            a = attrs(f[8])
            ddb = a.get("locus_tag") or ""
            if not ddb.startswith("DDB_G"):
                continue
            symbol = a.get("gene") or a.get("Name") or ddb
            ncbi = ""
            for x in (a.get("Dbxref") or "").split(","):
                if x.startswith("GeneID:"):
                    ncbi = x.split(":", 1)[1]
            rows.append([ddb, symbol, product.get(ddb, ""), f"{f[0]}:{int(f[3]):,}-{int(f[4]):,}", ncbi])
    rows.sort(key=lambda r: r[1].lower())
    _write("gene_index.json", rows)


# ---------------------------------------------------------------------------
# phenotypes.json  <-  strain_phenotype.tsv + strain_genes.tsv
# { ddb: [[term, condition, pmid, note], ...] }
# ---------------------------------------------------------------------------
def build_phenotypes():
    strain_gene = {}
    with open(os.path.join(CORPUS_SRC, "strain_genes.tsv")) as fh:
        for row in csv.reader(fh, delimiter="\t"):
            if len(row) >= 2:
                strain_gene[row[0].strip()] = row[1].strip()

    genes, seen = {}, set()
    with open(os.path.join(CORPUS_SRC, "strain_phenotype.tsv")) as fh:
        for row in csv.reader(fh, delimiter="\t"):
            if len(row) < 2:
                continue
            gene = strain_gene.get(row[0].strip())
            if not gene:
                continue
            term = html.unescape((row[1] if len(row) > 1 else "").strip())
            cond = html.unescape((row[2] if len(row) > 2 else "").strip())
            pmid = (row[4] if len(row) > 4 else "").strip()
            note = html.unescape((row[5] if len(row) > 5 else "").strip())
            if not term:
                continue
            key = (gene, term, cond, pmid)
            if key in seen:
                continue
            seen.add(key)
            genes.setdefault(gene, []).append([term, cond, pmid, note])
    _write("phenotypes.json", genes)


# ---------------------------------------------------------------------------
# dictybase_corpus.json summaries  <-  genesummary.csv
# genesummary.csv is the legacy dictyBase SEED. It fills in genes that haven't
# been hand-curated, but it MUST NOT overwrite a gene edited through the curator
# UI — that path (serve.py write_corpus) stamps `curator_date`, which the CSV
# never sets, so we skip any entry that has one. Without this guard, re-running
# build_data.py would silently wipe every curation. The corpus JSON is the
# source of truth for hand-curated genes; the CSV only seeds the rest.
# ---------------------------------------------------------------------------
def merge_summaries():
    corpus_path = os.path.join(ASSETS, "dictybase_corpus.json")
    corpus = json.load(open(corpus_path)) if os.path.exists(corpus_path) else {}
    kept = 0
    with open(os.path.join(CORPUS_SRC, "genesummary.csv"), newline="") as fh:
        for row in csv.reader(fh, delimiter="\t"):
            if len(row) < 3:
                continue
            ddb = row[0].strip()
            if not ddb.startswith("DDB_G"):
                continue
            summary = "\t".join(row[2:]).strip()
            if not summary:
                continue
            e = corpus.setdefault(ddb, {})
            if e.get("curator_date"):          # hand-curated via the UI — never clobber
                kept += 1
                continue
            e["summary"] = html.unescape(summary)
            if row[1].strip():
                e["curator"] = row[1].strip()
    # decode entities everywhere (idempotent), but leave hand-curated entries as-is
    for v in corpus.values():
        if isinstance(v, dict) and v.get("summary") and not v.get("curator_date"):
            v["summary"] = html.unescape(v["summary"])
    if kept:
        print(f"  preserved {kept} hand-curated summary(ies) (curator_date set)")
    _write("dictybase_corpus.json", corpus)


# ---------------------------------------------------------------------------
# downloads_manifest.json  <-  files present in assets/genomes/
# ---------------------------------------------------------------------------
SPECIES = [
    ("d-discoideum-ax4",  "D. discoideum AX4",  "GCF_000004695.1", "D_discoideum_AX4"),
    ("d-purpureum",       "D. purpureum",       "GCA_000190715.1", "D_purpureum"),
    ("d-firmibasis",      "D. firmibasis",      "GCA_036169595.1", "D_firmibasis"),
    ("c-fasciculata-sh3", "C. fasciculata SH3", "GCA_000203815.1", "C_fasciculata_SH3"),
    ("c-polycephalum",    "C. polycephalum",    "GCA_900092265.1", "C_polycephalum"),
    ("s-polycarpum",      "S. polycarpum",      "GCA_900092255.1", "S_polycarpum"),
    ("h-pallidum-pn500",  "H. pallidum PN500",  "GCA_000004825.1", "H_pallidum_PN500"),
    ("h-pallidum-new",    "H. pallidum (2026)", "GCA_054501735.1", "H_pallidum_new"),
    ("p-violaceum",       "P. violaceum",       "GCA_000277445.1", "P_violaceum"),
]


def build_downloads_manifest():
    if not os.path.isdir(GENOMES):
        print("  SKIP downloads_manifest: assets/genomes/ missing (gitignored)")
        return

    def add(files, label, fname):
        p = os.path.join(GENOMES, fname)
        if os.path.exists(p):
            files.append({"type": label, "name": fname, "url": f"/assets/genomes/{fname}",
                          "size": os.path.getsize(p)})
            return True
        return False

    manifest = []
    for sid, label, asm, pre in SPECIES:
        files = []
        add(files, "Genome assembly · FASTA (gzip)", f"{pre}_genome.fna.gz")
        add(files, "RefSeq genome · FASTA (gzip)", f"{pre}_refseq.fna.gz")
        if not add(files, "Gene annotation · GFF3 (gzip)", f"{pre}.gff.gz"):
            add(files, "Gene annotation · GFF3", f"{pre}_browser.gff")
        manifest.append({"id": sid, "label": label, "assembly": asm, "files": files})
    _write("downloads_manifest.json", manifest)


# ---------------------------------------------------------------------------
# go_annotations.json  <-  GO Consortium GAF (external download, --go only)
# { ddb: [[goId, aspect(F/P/C), evidenceCode, pmid], ...] }
# ---------------------------------------------------------------------------
# https (http 301-redirects) + a real UA (the GOC CDN 403s the default urllib UA).
GAF_URL = "https://current.geneontology.org/annotations/dictybase.gaf.gz"
GAF_UA = "Mozilla/5.0 (compatible; dictyBase-data-sync/1.0; +https://dicty.labs.duke.edu)"
EXP = {"EXP", "IDA", "IPI", "IMP", "IGI", "IEP", "HTP", "HDA", "HMP", "HGI", "HEP"}

# --- Input screening ---------------------------------------------------------
# The GAF is a trusted source, but we still validate every field before it lands
# in a file the site serves: only well-formed IDs, whitelisted evidence codes,
# and known aspects pass. Anything malformed is dropped, not stored. This keeps
# a corrupt or tampered upstream file from injecting junk (or markup) into the
# data the browser renders.
_DDB_RE = re.compile(r"^DDB_G[0-9]{4,}$")
_GO_RE = re.compile(r"^GO:[0-9]{7}$")
_PMID_RE = re.compile(r"^[0-9]{1,9}$")
GO_ASPECTS = {"P", "F", "C"}
GO_EVIDENCE = {  # the complete GO evidence-code set; anything else is rejected
    "EXP", "IDA", "IPI", "IMP", "IGI", "IEP",              # experimental
    "HTP", "HDA", "HMP", "HGI", "HEP",                     # high-throughput
    "IBA", "IBD", "IKR", "IRD",                            # phylogenetic
    "ISS", "ISO", "ISA", "ISM", "IGC", "RCA",              # computational
    "TAS", "NAS", "IC", "ND",                              # author/curator/no-data
    "IEA",                                                 # electronic
}


def _read_gaf(local=None):
    """Return the decoded GAF text, from a local file or the live GOC download."""
    if local:
        with open(local, "rb") as fh:
            raw = fh.read()
    else:
        print(f"  downloading {GAF_URL}")
        req = urllib.request.Request(GAF_URL, headers={"User-Agent": GAF_UA})
        raw = urllib.request.urlopen(req, timeout=90).read()
    return gzip.decompress(raw).decode("utf-8", "replace")


def build_go_annotations(gaf_path=None):
    text = _read_gaf(gaf_path)
    genes, seen = {}, set()
    dropped = kept = 0
    release = ""
    for line in text.splitlines():
        if line.startswith("!"):
            # the GAF concatenates sub-sources (GOC/UniProt/PANTHER), each with its
            # own date header; the first (GOC master assembly) is the release date.
            if line.startswith("!date-generated:") and not release:
                release = line.split(":", 1)[1].strip()
            continue
        c = line.split("\t")
        if len(c) < 9:
            continue
        ddb, go, ref, ev, aspect = c[1], c[4], c[5], c[6], c[8]
        # screen: reject anything that isn't a well-formed, whitelisted value
        if not (_DDB_RE.match(ddb) and _GO_RE.match(go)
                and aspect in GO_ASPECTS and ev in GO_EVIDENCE):
            dropped += 1
            continue
        pmid = ""
        for r in ref.split("|"):
            if r.startswith("PMID:"):
                cand = r.split(":", 1)[1]
                pmid = cand if _PMID_RE.match(cand) else ""   # only accept a clean id
                break
        key = (ddb, go, ev, pmid)
        if key in seen:
            continue
        seen.add(key)
        kept += 1
        genes.setdefault(ddb, []).append([go, aspect, ev, pmid])
    # experimental evidence first, then aspect
    for d in genes:
        genes[d].sort(key=lambda a: (0 if a[2] in EXP else (2 if a[2] == "IEA" else 1), a[1]))
    print(f"  GAF release {release or '?'}: kept {kept} rows across {len(genes)} genes; "
          f"screened out {dropped} malformed/invalid rows")
    _write("go_annotations.json", genes)


def main():
    want_go = "--go" in sys.argv
    gaf_path = sys.argv[sys.argv.index("--gaf") + 1] if "--gaf" in sys.argv else None
    print("Building dictyBase data files...")
    build_gene_index()
    build_phenotypes()
    merge_summaries()
    build_downloads_manifest()
    if want_go or gaf_path:
        build_go_annotations(gaf_path)
    else:
        print("  (skipping go_annotations.json — pass --go to download + rebuild)")
    # Derived facets for the advanced gene finder (needs ortholog_disease +
    # rnaseq_rosengarten; skips gracefully if those upstream assets aren't built yet).
    try:
        import build_gene_facets
        build_gene_facets.main()
    except Exception as exc:  # noqa: BLE001 — best-effort downstream step
        print(f"  (skipped gene_facets.json: {exc})")
    print("Done.")


if __name__ == "__main__":
    main()
