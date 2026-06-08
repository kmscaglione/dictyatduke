#!/usr/bin/env python3
"""Remove inline runtime reliance on dictybase.org / dictybase.dev links in the
MIRRORED content (technique protocols, curated summaries, phenotypes), while
keeping all the human-readable text and the separate source/attribution fields.

For each inline `<a href="...dictybase...">TEXT</a>` it does one of three things:

  1. Gene cross-ref  — wiki.dictybase.org/dictywiki/index.php/<X> where <X> is a
     known gene (symbol or DDB_G id, validated against assets/gene_index.json)
     -> internal /gene/<X>. Turns an external wiki link into on-site navigation
     (and the SPA then attaches hovercards to it). Never emits a link to a gene
     not in our catalog.
  2. Real PMID       — dictybase.dev/publication/<PMID> (a genuine PubMed id)
     -> https://pubmed.ncbi.nlm.nih.gov/<PMID>/.  (dictybase.org/publication/<n>
     ids are dictyBase-internal, NOT PMIDs, so those are NOT repointed.)
  3. Everything else — dictywiki concept pages, /db, /editor, internal pub ids,
     technique cross-links with no validated internal slug -> UNWRAP the anchor,
     keeping the visible text. No dead dictybase link remains.

NOT touched: app.js technique tables (their dictybase.dev URLs are the per-
protocol *source/attribution*, shown as "Original record", and are required by
the CC BY-NC terms — attribution stays). This script only rewrites inline links
inside mirrored body content.

    python3 scripts/delink_dictybase.py --dry-run   # report counts, write nothing
    python3 scripts/delink_dictybase.py             # apply

Idempotent: re-running finds nothing left to change.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Mirrored body content only (NOT app.js — that holds attribution source URLs).
TARGETS = [
    "technique-content.js",
    "meetings-content.js",
    "teaching-content.js",
    "assets/dictybase_corpus.json",
    "assets/phenotypes.json",
]

# Inline anchor with an escaped-quote href to any dictybase host. Groups: url, inner.
LINK_RE = re.compile(
    r'<a\s+href=\\"(https?://[^"\\]*?dictybase\.(?:org|dev)/[^"\\]*)\\"[^>]*?>(.*?)</a>',
    re.S)
WIKI_RE = re.compile(r'dictywiki/(?:index\.php/)?([A-Za-z0-9_]+)')
PUB_RE = re.compile(r'dictybase\.dev/publication/(\d+)')


def load_genes():
    """symbols (lowercase -> canonical) and DDB_G id set, from gene_index.json."""
    with open(os.path.join(ROOT, "assets", "gene_index.json")) as fh:
        rows = json.load(fh)
    sym = {}
    ddb = set()
    for r in rows:
        if len(r) > 0 and r[0]:
            ddb.add(r[0].upper())
        if len(r) > 1 and r[1]:
            sym[r[1].lower()] = r[1]
    return sym, ddb


def main():
    dry = "--dry-run" in sys.argv or "-n" in sys.argv
    sym, ddb = load_genes()
    totals = {"gene": 0, "pubmed": 0, "unwrapped": 0}

    for rel in TARGETS:
        path = os.path.join(ROOT, rel)
        if not os.path.isfile(path):
            continue
        text = open(path, encoding="utf-8").read()
        counts = {"gene": 0, "pubmed": 0, "unwrapped": 0}

        def repl(m):
            url, inner = m.group(1), m.group(2)
            wiki = WIKI_RE.search(url)
            if wiki:
                key = wiki.group(1)
                if key.upper() in ddb:
                    counts["gene"] += 1
                    return f'<a href=\\"/gene/{key}\\">{inner}</a>'
                if key.lower() in sym:
                    counts["gene"] += 1
                    return f'<a href=\\"/gene/{sym[key.lower()]}\\">{inner}</a>'
            pub = PUB_RE.search(url)
            if pub:
                counts["pubmed"] += 1
                return f'<a href=\\"https://pubmed.ncbi.nlm.nih.gov/{pub.group(1)}/\\" target=\\"_blank\\" rel=\\"noopener\\">{inner}</a>'
            counts["unwrapped"] += 1
            return inner

        new_text = LINK_RE.sub(repl, text)
        changed = sum(counts.values())
        if changed:
            print(f"{rel}: {counts['gene']} -> /gene/, {counts['pubmed']} -> PubMed, "
                  f"{counts['unwrapped']} unwrapped")
            for k in totals:
                totals[k] += counts[k]
            if not dry:
                open(path, "w", encoding="utf-8").write(new_text)

    left = totals["gene"] + totals["pubmed"] + totals["unwrapped"]
    print(f"\nTotal: {totals['gene']} internal gene links, {totals['pubmed']} PubMed, "
          f"{totals['unwrapped']} unwrapped  ({left} inline dictybase links handled).")
    if dry:
        print("[dry-run] no files written.")


if __name__ == "__main__":
    main()
