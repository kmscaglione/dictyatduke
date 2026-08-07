#!/usr/bin/env python3
"""Parse the Gomer Lab's per-protein annotation documents into
assets/gomer_annotations.json.

Source: "Dicty Genome Annotations (Chromosome N).docx" from the Gomer Lab
(Richard Gomer, Texas A&M). Each protein is a free-form block that starts with a
"DDB_G####### <annotator name>" line, followed by labelled sections:
  - BLASTp hits (protein, e-value)
  - Top 5 similar proteins with known functions (structure/analog-based)
  - Kyte-Doolittle hydrophobicity plot  (an image -- skipped, text-only for now)
  - InterPro significant domain hits (family name, ID)
  - STRING predicted coexpression (protein, score)

Sections are stored as faithful raw lines (the entries mix commas inside free
text, so field-splitting is unreliable -- we keep the lines and let the UI show
them). This is provisional, un-reviewed community data; it is badged as such and
credited to the lab + the named annotator in the UI.

Run once with the source docs (default: ~/Downloads), commit the JSON:
    python3 scripts/build_gomer_annotations.py [file1.docx file2.docx ...]

Requires python-docx. Standard library otherwise.
"""
import glob
import json
import os
import re
import sys

import docx  # python-docx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "gomer_annotations.json")

# A real protein header is a DDB_G id followed by whitespace+annotator, or the id
# alone -- NEVER "DDB_G####, ..." which is a STRING/analog data line that merely
# starts with a gene id (that comma is the tell).
PROTEIN_RE = re.compile(r"^(DDB_G\d+)(?:\s+(.*))?$")
CHROM_RE = re.compile(r"[Cc]hromosome\s*(\d+)")

# section header (lowercased startswith) -> bucket key ; None = skip (e.g. image)
SECTIONS = [
    ("blastp hits", "blast"),
    ("top 5 similar proteins", "analogs"),
    ("top 5 alphafold", "analogs"),
    ("interpro significant domain", "interpro"),
    ("conserved domains", "interpro"),
    ("string predicted coexpression", "string"),
    ("predicted coexpression", "string"),
    ("kyte", None),                 # hydrophobicity image -> skip (text-only)
]
# Preamble/boilerplate lines to ignore entirely.
SKIP = ("add your annotations", "protein id", "blast hits w/super low",
        "top 5 alphafold hits (with", "kyte/doolittle hydrophobicity",
        "any other pertinent info")


def section_for(line):
    low = line.lower()
    for prefix, key in SECTIONS:
        if low.startswith(prefix):
            return key, True          # (bucket, is_a_header)
    return None, False


def parse_doc(path):
    chrom = None
    m = CHROM_RE.search(os.path.basename(path))
    if m:
        chrom = int(m.group(1))
    out = {}
    cur = None            # current protein record
    bucket = None         # current section bucket
    skipping_section = False
    for par in docx.Document(path).paragraphs:
        line = par.text.strip()
        if not line:
            continue
        pm = PROTEIN_RE.match(line)
        if pm:            # new protein block
            pid = pm.group(1)
            annotator = (pm.group(2) or "").strip(" -–\t")
            cur = {"annotator": annotator, "chromosome": chrom,
                   "blast": [], "analogs": [], "interpro": [], "string": []}
            out[pid] = cur
            bucket, skipping_section = None, False
            continue
        if cur is None:   # preamble before the first protein
            continue
        key, is_header = section_for(line)
        if is_header:
            bucket = key
            skipping_section = key is None
            continue
        if skipping_section or bucket is None:
            continue
        if line.lower().startswith("splice variant"):
            continue      # keep appending following lines to the same protein
        cur[bucket].append(line)
    return out


def main():
    files = sys.argv[1:] or sorted(glob.glob(
        os.path.expanduser("~/Downloads/Dicty Genome Annotations (Chromosome *).docx")))
    if not files:
        print("No source .docx found (pass paths, or put them in ~/Downloads).")
        return 1
    merged = {}
    for f in files:
        got = parse_doc(f)
        # keep only proteins that actually have some annotation content
        got = {k: v for k, v in got.items()
               if any(v[s] for s in ("blast", "analogs", "interpro", "string"))}
        merged.update(got)
        print(f"  {os.path.basename(f)}: {len(got)} annotated proteins")
    payload = {
        "_meta": {
            "layer": "Gomer Lab annotations",
            "source": "Gomer Lab (Richard Gomer, Texas A&M University)",
            "disclaimer": "Community-contributed structural/functional predictions "
                          "(BLAST, structure-based analogs, InterPro, STRING). "
                          "Provisional -- not yet curator-reviewed.",
            "fields": ["annotator", "chromosome", "blast", "analogs", "interpro", "string"],
        },
    }
    payload.update(dict(sorted(merged.items())))
    with open(OUT, "w") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)
    print(f"Wrote {os.path.relpath(OUT, ROOT)} -- {len(merged)} proteins, "
          f"{os.path.getsize(OUT)//1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
