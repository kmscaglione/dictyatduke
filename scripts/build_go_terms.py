#!/usr/bin/env python3
"""Build assets/go_terms.json: the Gene Ontology term list, id -> [name, aspect].

Why this exists. Until now nothing here knew what a GO id was called: gene pages
fetched names live from EBI QuickGO, and the annotation form asked users to look
a term up there and paste the id by hand. That makes author-supplied GO
annotation error-prone and keeps author curation out of the GAF export, because
free text is not a GO term.

With this index the server can offer a real term autocomplete (GET /api/go-search),
fill the aspect in automatically, and store a genuine GO id that flows through to
the GAF.

    python3 scripts/build_go_terms.py              # download and build
    python3 scripts/build_go_terms.py --obo FILE   # build from a local go-basic.obo

Obsolete terms are dropped: they must never be offered for new annotation.
Output is ~3 MB, read server-side only and never shipped to the browser.
"""
import argparse
import json
import pathlib
import re
import sys
import subprocess

OBO_URL = "https://current.geneontology.org/ontology/go-basic.obo"
ASPECT = {"biological_process": "P", "molecular_function": "F", "cellular_component": "C"}
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "go_terms.json"


def parse_obo(text):
    """id -> [name, aspect, [synonyms]] for every non-obsolete term."""
    terms = {}
    for block in text.split("\n[")[1:]:
        if not block.startswith("Term]"):
            continue
        if re.search(r"^is_obsolete:\s*true", block, re.M):
            continue
        gid = re.search(r"^id:\s*(GO:\d{7})", block, re.M)
        name = re.search(r"^name:\s*(.+)$", block, re.M)
        ns = re.search(r"^namespace:\s*(\w+)", block, re.M)
        if not (gid and name and ns and ns.group(1) in ASPECT):
            continue
        syns = re.findall(r'^synonym:\s*"([^"]+)"\s+EXACT', block, re.M)
        terms[gid.group(1)] = [name.group(1).strip(), ASPECT[ns.group(1)], syns[:4]]
    return terms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--obo", help="a local go-basic.obo instead of downloading")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if args.obo:
        text = pathlib.Path(args.obo).expanduser().read_text(errors="replace")
        print(f"read {args.obo} ({len(text):,} chars)")
    else:
        # curl, not urllib: macOS system Python fails TLS verification here, the
        # same reason scripts/fetch_technique_images.py shells out.
        print(f"downloading {OBO_URL} …")
        out = subprocess.run(["curl", "-fsSL", "--max-time", "300",
                              "-A", "dictyBase-build/1.0", OBO_URL],
                             capture_output=True)
        if out.returncode != 0:
            sys.exit(f"error: download failed ({out.stderr.decode()[:200]})")
        text = out.stdout.decode("utf-8", "replace")
        print(f"  {len(text):,} chars")

    terms = parse_obo(text)
    if len(terms) < 20000:
        sys.exit(f"error: only {len(terms)} terms parsed, that cannot be right")
    counts = {}
    for _, aspect, _ in terms.values():
        counts[aspect] = counts.get(aspect, 0) + 1
    print(f"{len(terms):,} non-obsolete terms  (P {counts.get('P',0):,}  "
          f"F {counts.get('F',0):,}  C {counts.get('C',0):,})")
    if args.dry_run:
        print("dry run, nothing written")
        return 0
    OUT.write_text(json.dumps(terms, separators=(",", ":"), sort_keys=True))
    print(f"wrote {OUT} ({OUT.stat().st_size/1e6:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
