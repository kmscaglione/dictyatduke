#!/usr/bin/env python3
"""Mirror the dictyBase Downloads page (http://dictybase.org/Downloads/) as local
hardcopies, so the data files are preserved and served from our own site.

Downloads every file into assets/dictybase-downloads/<area>/<file> and writes
assets/dictybase-downloads/manifest.json — the section/description structure the
/downloads page renders, with local paths and byte sizes filled in. The page
serves the stored copies; it does not hit dictybase.org at view time. Re-run to
refresh (most files update monthly upstream).

  python3 scripts/fetch_dictybase_downloads.py
"""
import datetime
import json
import pathlib
import sys
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "dictybase-downloads"
DLBASE = "http://dictybase.org/db/cgi-bin/dictyBase/download/download.pl?area={area}&ID={fid}"
UA = "dictyBase-data-sync/1.0 (+https://dicty.labs.duke.edu)"

# Faithful replica of the dictybase.org/Downloads sections. Each file: (label, area, id).
# label is the download-link text; area+id build the source URL and the local path.
SECTIONS = [
    ("Gene Information", "Core gene-level tables, most refreshed monthly.", [
        ("dictyBase ID, gene names, synonyms, and gene products (updated monthly)",
         [("tab-delimited", "general", "gene_information.txt"), ("excel", "general", "gene_information.xls")]),
        ("DDB - DDB_G - UniProt mapping (updated monthly)",
         [("tab-delimited", "general", "DDB-GeneID-UniProt.txt")]),
        ("DDB_G curation status (updated monthly)",
         [("tab-delimited", "general", "DDB_G-curation_status.txt")]),
        ("Curated model history (updated weekly)",
         [("zip", "general", "curated_gene_DDB_map.zip")]),
        ("Ortholog information (Aug 25, 2010)",
         [("tab-delimited", "general", "ortholog_information.txt")]),
        ("Alternative transcripts (updated monthly)",
         [("tab-delimited", "general", "alternative_transcripts.txt"), ("excel", "general", "alternative_transcripts.xls")]),
    ]),
    ("Dictyostelium Sequences and Annotations", "Genome sequences and annotations.", [
        ("Sequences and annotations in GFF3 format (updated monthly)",
         [("zip", "gff3", "dicty_gff3.zip")]),
        ("Promoter sequences — 5' flanking sequence up to the next gene (Mar 30, 2010)",
         [("zip", "sequence_sets", "promoter_sequences.zip")]),
    ]),
    ("Mutant Phenotypes", "Curated mutant strains and their phenotypes (updated monthly).", [
        ("All curated mutants with phenotypes",
         [("tab-delimited", "mutant_phenotypes", "all-mutants.txt"), ("excel", "mutant_phenotypes", "all-mutants.xls")]),
        ("All curated mutants with phenotypes (with a DDB_G ID column)",
         [("tab-delimited", "mutant_phenotypes", "all-mutants-ddb_g.txt"), ("excel", "mutant_phenotypes", "all-mutants-ddb_g.xls")]),
        ("Null mutants",
         [("tab-delimited", "mutant_phenotypes", "null-mutants.txt"), ("excel", "mutant_phenotypes", "null-mutants.xls")]),
        ("Overexpression mutants",
         [("tab-delimited", "mutant_phenotypes", "overexpression-mutants.txt"), ("excel", "mutant_phenotypes", "overexpression-mutants.xls")]),
        ("Multiple mutants",
         [("tab-delimited", "mutant_phenotypes", "multiple-mutants.txt"), ("excel", "mutant_phenotypes", "multiple-mutants.xls")]),
        ("Mutants with developmental defects",
         [("tab-delimited", "mutant_phenotypes", "developmental-mutants.txt"), ("excel", "mutant_phenotypes", "developmental-mutants.xls")]),
        ("Other mutants",
         [("tab-delimited", "mutant_phenotypes", "other-mutants.txt"), ("excel", "mutant_phenotypes", "other-mutants.xls")]),
        ("Insertional (REMI) mutants at BCM",
         [("tab-delimited", "mutant_phenotypes", "remi.txt"), ("excel", "mutant_phenotypes", "remi.xls")]),
    ]),
    ("Dictyostelium Anatomy Ontology", "Gaudet, Williams, Fey and Chisholm, 2008.", [
        ("Terms used to describe Dictyostelium anatomy",
         [("OBO", "pheno_ontology", "dicty_anatomy.obo")]),
    ]),
    ("Dictyostelium Phenotype Ontology", "Terms used to annotate phenotypes (updated monthly).", [
        ("Dictyostelium phenotype ontology",
         [("OBO", "pheno_ontology", "dicty_phenotypes.obo")]),
    ]),
    ("Protein Information", "Domains, codon usage, molecular weight, and modifications.", [
        ("InterPro domains of Dictyostelium proteins (updated quarterly)",
         [("tab-delimited", "general", "Dd_protein_domains.txt"), ("excel", "general", "Dd_protein_domains.xls")]),
        ("D. discoideum codon bias — 11,666 curated protein-coding genes (Nov 2012)",
         [("tab-delimited", "general", "Dd_Codon_Bias.txt")]),
        ("Molecular weight (Da) of all proteins (Nov 2012)",
         [("tab-delimited", "general", "dicty-mw.txt")]),
        ("AX2 phosphoproteome (Aug 2013) — provided by Pascale Charest and Richard Firtel",
         [("excel", "general", "AX2_phosphoproteome.xlsx")]),
        ("N-terminal myristoylation sites (Jul 2006)",
         [("tab-delimited", "general", "NMT.txt"), ("excel", "general", "NMT.xls")]),
    ]),
    ("GO Association Files", "Gene Ontology annotations for Dictyostelium.", [
        ("GO annotations (GAF)",
         [("gzip", "go", "gene_association.dictyBase.gz")]),
        ("GO annotations mapped to GO-slim (Aug 2006)",
         [("text", "goslim", "slim_gene_association.ddb")]),
    ]),
    ("References", "Literature associated with genes (updated monthly).", [
        ("PubMed IDs and associated genes",
         [("tab-delimited", "general", "DDBID_PMID.txt"), ("excel", "general", "DDBID_PMID.xls")]),
        ("High-throughput papers and associated genes",
         [("tab-delimited", "general", "High_throughput_papers.txt")]),
        ("Reviews and associated genes",
         [("tab-delimited", "general", "Reviews.txt")]),
        ("Papers (excluding reviews and high-throughput) and associated genes",
         [("tab-delimited", "general", "not_reviews_not_high_throughput_papers.txt")]),
    ]),
]


def fetch(area, fid):
    url = DLBASE.format(area=area, fid=urllib.parse.quote(fid))
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()


def main():
    manifest_sections, total = [], 0
    for title, blurb, items in SECTIONS:
        m_items = []
        for desc, files in items:
            m_files = []
            for label, area, fid in files:
                out = DEST / area / fid
                out.parent.mkdir(parents=True, exist_ok=True)
                try:
                    data = fetch(area, fid)
                except Exception as exc:  # noqa: BLE001 — keep mirroring the rest
                    print(f"  !! {area}/{fid}: {exc}", file=sys.stderr)
                    continue
                out.write_bytes(data)
                total += len(data)
                m_files.append({"label": label, "path": f"dictybase-downloads/{area}/{fid}",
                                "bytes": len(data)})
                print(f"  {area}/{fid}: {len(data):,} bytes", file=sys.stderr)
            if m_files:
                m_items.append({"desc": desc, "files": m_files})
        manifest_sections.append({"title": title, "blurb": blurb, "items": m_items})

    manifest = {
        "source": "http://dictybase.org/Downloads/",
        "note": "Local mirror of the dictyBase Downloads page, preserved and served "
                "from dicty.labs.duke.edu. Files are dictyBase's; see each dataset's "
                "terms at dictybase.org.",
        "sections": manifest_sections,
        "total_bytes": total,
    }
    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"\nWrote {DEST/'manifest.json'} — {total:,} bytes across "
          f"{sum(len(s['items']) for s in manifest_sections)} datasets", file=sys.stderr)


if __name__ == "__main__":
    main()
