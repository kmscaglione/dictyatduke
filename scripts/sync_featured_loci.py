#!/usr/bin/env python3
"""Sync the featured genes' hardcoded genomic locations in app.js to the
authoritative values in assets/gene_index.json.

The ~15 featured "showcase" genes at the top of app.js carry an inline
`location:` string. Those were hand-typed and drifted (wrong chromosome, off by
one) until the 2026 accuracy audit. This script regenerates them from
gene_index.json so they can never drift again. Run it after gene_index.json is
rebuilt (build_all.py does), and check_data.py enforces the result.

Only rewrites `location:` strings inside the featured-gene block (first 400
lines); it never touches the rest of the file. Idempotent. Standard library.

    python3 scripts/sync_featured_loci.py            # apply
    python3 scripts/sync_featured_loci.py --check     # report drift, change nothing
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APP = os.path.join(ROOT, "app.js")
HEAD_LINES = 400


def main():
    check_only = "--check" in sys.argv
    idx = {r[0]: r[3] for r in json.load(open(os.path.join(ROOT, "assets", "gene_index.json")))}
    lines = open(APP).readlines()
    head, tail = "".join(lines[:HEAD_LINES]), "".join(lines[HEAD_LINES:])

    changes = []
    # Walk each featured gene object (anchored on its symbol), find its DDB_G id
    # and current location, and compute the authoritative replacement.
    for m in re.finditer(r'symbol:\s*"([^"]+)"', head):
        seg = head[m.start():m.start() + 900]
        locm = re.search(r'location:\s*"([^"]+)"', seg)
        ddbm = re.search(r'(DDB_G\d+)', seg)
        if not (locm and ddbm):
            continue
        ddb, old = ddbm.group(1), locm.group(1)
        want = idx.get(ddb)
        if want and old.replace(" ", "") != want.replace(" ", ""):
            changes.append((ddb, old, want))

    if not changes:
        print("featured locations already in sync — nothing to do")
        return 0

    if check_only:
        for ddb, old, want in changes:
            print(f"  DRIFT {ddb}: {old!r} -> {want!r}")
        print(f"{len(changes)} featured location(s) out of sync (run without --check to fix)")
        return 1

    for ddb, old, want in changes:
        head = head.replace(f'location: "{old}"', f'location: "{want}"', 1)
        print(f"  fixed {ddb}: {old!r} -> {want!r}")
    open(APP, "w").write(head + tail)
    print(f"updated {len(changes)} featured location(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
