#!/usr/bin/env python3
"""Attach real GO ids to the free-text GO terms in a curation results file.

Curation drafted as prose ("actin filament binding") cannot reach the GAF
export. This resolves each term against the local ontology index and fills in
"go_id" where the match is unambiguous, so authors review a real annotation.

    python3 scripts/map_go_terms.py curation/papers/results/20260730-results.json
    python3 scripts/map_go_terms.py FILE --dry-run

Deliberately conservative. Only an exact match on a term's name or an exact
match on one of its exact synonyms is accepted, after stripping a trailing
parenthetical gloss. A near match is left alone: a wrong id would flow into the
GAF as fact, and the author can now pick the right term from the autocomplete.
"""
import argparse
import json
import os
import pathlib
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import serve  # noqa: E402


def candidates(term):
    """The forms of a written term worth trying, most faithful first."""
    t = " ".join(str(term or "").split())
    yield t
    no_paren = re.sub(r"\s*\([^)]*\)\s*$", "", t).strip()      # "... (why it matters)"
    if no_paren != t:
        yield no_paren
    if ":" in t:                                               # "protein binding, bridging: binds ..."
        yield t.split(":", 1)[0].strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    path = pathlib.Path(args.results).expanduser()
    doc = json.loads(path.read_text())
    terms = serve._load_go_terms()
    if not terms:
        sys.exit("error: assets/go_terms.json is missing. Run scripts/build_go_terms.py first.")

    by_name = {}
    for gid, rec in terms.items():
        by_name.setdefault(rec[0].lower(), (gid, rec[1]))
        for syn in (rec[2] if len(rec) > 2 else []):
            by_name.setdefault(syn.lower(), (gid, rec[1]))

    mapped = unmapped = already = 0
    for r in doc.get("results", []):
        for g in r.get("go", []) or []:
            if g.get("go_id"):
                already += 1
                continue
            hit = next((by_name[c.lower()] for c in candidates(g.get("term")) if c.lower() in by_name), None)
            if hit:
                gid, aspect = hit
                was_aspect = g.get("aspect")
                g["go_id"], g["term"], g["aspect"] = gid, terms[gid][0], aspect
                flag = "" if was_aspect == aspect else f"  (aspect {was_aspect} -> {aspect})"
                print(f"  mapped   {r['pmid']} {g['gene']:7} {gid}  {terms[gid][0]}{flag}")
                mapped += 1
            else:
                print(f"  no match {r['pmid']} {g['gene']:7} {str(g.get('term'))[:66]}")
                unmapped += 1

    print(f"\n{mapped} mapped, {unmapped} left as free text, {already} already had an id")
    if args.dry_run:
        print("dry run, nothing written")
        return 0
    path.write_text(json.dumps(doc, indent=1, ensure_ascii=False))
    print(f"wrote {path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
