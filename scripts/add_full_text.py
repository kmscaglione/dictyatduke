#!/usr/bin/env python3
"""Attach a paper's full text to a curation draft from a local file.

The terminal equivalent of the dashboard's "Upload a copy" button, for when you
are already in a shell or have a pile of PDFs to attach at once. Both call
serve.attach_full_text(), so they behave identically.

"Fetch full text" only reaches openly available copies (PMC OA, Unpaywall,
publisher via DOI, all unauthenticated). This is the path for a paywalled paper
you have through the library, or a manuscript an author sent you.

    python3 scripts/add_full_text.py 42031177 ~/Downloads/paper.pdf
    python3 scripts/add_full_text.py 42031177 paper.txt --source "Author copy"

Accepts .pdf, .txt, .html, .xml. Writes the text into the same private store the
fetcher uses (uploads/curator_state/paper_fulltext/<pmid>.json, never web-served)
and marks the draft so the dashboard shows it and "Export batch" includes it.

The text stays on this machine. It is never committed and never served.

Note: the running server writes the same drafts file. This does a read, modify,
write, so avoid clicking "Fetch full text" for the same paper at the same moment.
"""
import argparse
import os
import pathlib
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import serve  # noqa: E402  (needs the path above)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pmid", help="PubMed ID of a paper already in the draft queue")
    ap.add_argument("file", help="the PDF or text file to attach")
    ap.add_argument("--source", default="",
                    help='provenance label shown to the curator (default "Manual '
                         'upload (<filename>)")')
    args = ap.parse_args()

    pmid = "".join(ch for ch in args.pmid if ch.isdigit())
    if not pmid:
        sys.exit(f"error: {args.pmid!r} is not a PMID.")
    path = pathlib.Path(args.file).expanduser()
    if not path.is_file():
        sys.exit(f"error: no such file: {path}")

    try:
        res = serve.attach_full_text(pmid, path.read_bytes(), path.name, args.source)
    except ValueError as e:
        queued = ", ".join(d.get("pmid", "?")
                           for d in serve._load_paper_drafts().get("drafts", []))
        hint = (f'\nQueue it first with "Draft PMID" on the dashboard. Queued now: '
                f'{queued or "nothing"}') if "not in the draft queue" in str(e) else ""
        sys.exit(f"error: {e}{hint}")

    print(f"{pmid}: attached {res['chars']:,} chars from {res['kind']} ({res['source']})")
    print(f"  {res['title'][:90]}")
    print("Reload the dashboard to see it, then Export batch to curate it.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
