#!/usr/bin/env python3
"""Parse the Gomer Lab's per-protein I-TASSER annotation document into
assets/gomer_annotations.json.

Source (default): ~/Desktop/Add your annotations here (not yet reviewed).docx
The Gomer Lab (Richard Gomer, Texas A&M) ran I-TASSER + BLAST/InterPro/STRING on
~650 Dictyostelium proteins. Each protein is a free-form block starting with a
"DDB_G####### (annotator)" line, followed by labelled sections whose wording
varies a lot between annotators, so section detection is keyword/regex-based, not
exact-string. Sections are stored as faithful raw lines (they mix commas inside
free text, so field-splitting is unreliable). Provisional, un-reviewed community
data; badged and credited in the UI.

Buckets captured: go, analogs, blast, interpro, string, models, secondary,
ligands, enzymes, notes.  (Hydrophobicity is an image -> skipped.)

Run once, commit the JSON:
    python3 scripts/build_gomer_annotations.py [file.docx ...]
Requires python-docx.
"""
import glob
import json
import os
import re
import sys

import docx  # python-docx

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "gomer_annotations.json")

DEFAULT_SOURCES = [
    os.path.expanduser("~/Desktop/Add your annotations here (not yet reviewed).docx"),
]

PROTEIN_RE = re.compile(r"^(DDB_G\d+)(?:\s+(.*))?$")

# Section header patterns, checked in order (first match wins). Chosen to match
# the HEADER wording, not the data rows under it. GO is checked before InterPro
# so "InterPro GO Terms" lands in `go`, not `interpro`.
HEADER_RULES = [
    (re.compile(r"go[-\s]?score|go\s+terms?\b", re.I), "go"),
    (re.compile(r"\bblast", re.I), "blast"),
    (re.compile(r"similar proteins with known|structural analog|threading template|pdb.*analog", re.I), "analogs"),
    (re.compile(r"significant domain|conserved domain|interpro|family name", re.I), "interpro"),
    (re.compile(r"string.*coexpression|predicted coexpression", re.I), "string"),
    (re.compile(r"3d model|predicted 3d|c[-\s]?score", re.I), "models"),
    (re.compile(r"secondary structure", re.I), "secondary"),
    (re.compile(r"ligand binding", re.I), "ligands"),
    (re.compile(r"\benzyme", re.I), "enzymes"),
    (re.compile(r"kyte|hydrophobicity", re.I), None),   # image -> skip
]
BUCKETS = ("go", "analogs", "blast", "interpro", "string",
           "models", "secondary", "ligands", "enzymes", "notes")
SKIP_PREAMBLE = re.compile(r"^add your annotations|^protein id\b|^any other pertinent", re.I)


def is_header(line):
    """A section header matches a rule AND isn't itself a data row (a GO id row,
    a 'C-score: -4.0' value, or a '<pdbid>: ...' analog row all read as data)."""
    if line.startswith("GO:") or re.match(r"^[Cc]-?\s?score\s*:", line):
        return None, False
    for rx, bucket in HEADER_RULES:
        if rx.search(line):
            # guard: an analog/GO data row can contain a keyword; a header rarely
            # starts with a 4-char PDB id + ':' or a DDB id.
            if re.match(r"^[0-9A-Za-z]{4}[A-Za-z0-9]?\s*:|^DDB[_0-9]", line):
                return None, False
            return bucket, True
    return None, False


def parse_doc(path):
    """Return a LIST of (pid, rec) blocks in document order. A protein annotated
    more than once yields multiple blocks; the caller keeps the richest."""
    blocks = []
    cur = None
    bucket = "notes"          # default: capture preamble/uncategorized content
    skipping = False
    for par in docx.Document(path).paragraphs:
        line = par.text.strip()
        if not line or SKIP_PREAMBLE.match(line):
            continue
        pm = PROTEIN_RE.match(line)
        if pm:
            ann = (pm.group(2) or "").strip(" -–\t")
            # Some header lines carry a BLAST descriptor where the annotator name
            # would be (e.g. "[Dictyostelium discoideum] (1e-132, 98.96%)"); that
            # is data, not a name, so blank it.
            if re.search(r"e-?\d|,\s*\d+\.\d|\d,\s*\d", ann):
                ann = ""
            cur = {"annotator": ann, **{b: [] for b in BUCKETS}}
            blocks.append((pm.group(1), cur))   # cur is mutated in place below
            bucket, skipping = "notes", False
            continue
        if cur is None:
            continue
        b, hdr = is_header(line)
        if hdr:
            bucket, skipping = (b or "notes"), (b is None)
            continue
        if not skipping:
            cur[bucket].append(line)
    return blocks


def content_score(rec):
    return sum(len(rec.get(b, [])) for b in BUCKETS)


def chrom_by_ddb():
    """DDB_G -> chromosome number, from gene_index location contig (NC_00708x)."""
    m = {"NC_007087": 1, "NC_007088": 2, "NC_007089": 3,
         "NC_007090": 4, "NC_007091": 5, "NC_007092": 6}
    out = {}
    try:
        for r in json.load(open(os.path.join(ROOT, "assets", "gene_index.json"))):
            loc = r[3] if len(r) > 3 else ""
            hit = re.match(r"(NC_\d+)", loc or "")
            if hit and hit.group(1) in m:
                out[r[0]] = m[hit.group(1)]
    except (OSError, ValueError):
        pass
    return out


def main():
    files = sys.argv[1:] or [f for f in DEFAULT_SOURCES if os.path.exists(f)]
    if not files:
        print("No source .docx found. Pass the path to the annotations file.")
        return 1
    merged = {}
    for f in files:
        kept = 0
        for pid, rec in parse_doc(f):
            if not any(rec[b] for b in BUCKETS if b != "notes"):
                continue                       # only a header/note, no real annotation
            if pid not in merged or content_score(rec) > content_score(merged[pid]):
                merged[pid] = rec              # richest block wins (dedupe re-annotations)
            kept += 1
        print(f"  {os.path.basename(f)}: {kept} annotated blocks")

    chrom = chrom_by_ddb()
    for k, v in merged.items():
        v["chromosome"] = chrom.get(k)
        for b in BUCKETS:                    # drop empty buckets to keep the file small
            if not v[b]:
                del v[b]

    payload = {"_meta": {
        "layer": "Gomer Lab annotations",
        "source": "Gomer Lab (Richard Gomer, Texas A&M University)",
        "method": "I-TASSER structure/function prediction, plus BLAST, InterPro, STRING",
        "disclaimer": "Community-contributed predictions. Provisional -- not yet curator-reviewed.",
    }}
    payload.update(dict(sorted(merged.items())))
    with open(OUT, "w") as fh:
        json.dump(payload, fh, indent=1, ensure_ascii=False)
    withgo = sum(1 for v in merged.values() if v.get("go"))
    print(f"Wrote {os.path.relpath(OUT, ROOT)} -- {len(merged)} proteins "
          f"({withgo} with GO terms), {os.path.getsize(OUT)//1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
