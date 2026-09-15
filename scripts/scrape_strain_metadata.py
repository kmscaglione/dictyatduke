#!/usr/bin/env python3
"""Pull the RICH per-strain metadata from the Dicty Stock Center GraphQL backend
(graphql.dictybase.dev) — the fields our stock_center.json drops: systematic name,
genetic modification, mutagenesis method, characteristics, depositor, associated
genes, publications, and parent strain. Paginated via listStrains(cursor,limit).

Output: assets/dictybase-corpus/strain_metadata.json  { "<DBS id>": {...}, ... }

  python3 scripts/scrape_strain_metadata.py
"""
import json
import os
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "dictybase-corpus", "strain_metadata.json")
URL = "https://graphql.dictybase.dev/graphql"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

QUERY = """
{ listStrains(limit: 100%s) { nextCursor strains {
  id label systematic_name summary in_stock names genotypes
  genetic_modification mutagenesis_method characteristics
  depositor { first_name last_name }
  genes { id name } publications { id doi } parent { id label }
} } }"""


def gql(cursor):
    q = QUERY % (f", cursor: {cursor}" if cursor else "")
    body = json.dumps({"query": q}).encode()
    req = urllib.request.Request(URL, data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": "dicty-preserve/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=_CTX) as r:
        d = json.loads(r.read().decode("utf-8", "replace"))
    # The backend sometimes errors resolving `publications` for a few strains; it
    # still returns the rest of the page (that field just comes back null). Use the
    # partial data rather than discarding the page. Only fail if nothing came back.
    ls = (d.get("data") or {}).get("listStrains")
    if not ls:
        raise RuntimeError((d.get("errors") or [{"message": "no data"}])[0]["message"])
    return ls


def main():
    out, cursor, page = {}, None, 0
    while True:
        block = gql(cursor)
        rows = block.get("strains") or []
        for s in rows:
            dep = s.get("depositor") or {}
            out[s["id"]] = {
                "id": s["id"], "label": s.get("label", ""),
                "systematic_name": s.get("systematic_name", ""),
                "summary": s.get("summary", ""), "in_stock": s.get("in_stock"),
                "names": s.get("names") or [], "genotypes": s.get("genotypes") or [],
                "genetic_modification": s.get("genetic_modification", ""),
                "mutagenesis_method": s.get("mutagenesis_method", ""),
                "characteristics": s.get("characteristics") or [],
                "depositor": (f"{dep.get('last_name','')}".strip() or None),
                "genes": [g.get("id") or g.get("name") for g in (s.get("genes") or [])],
                "publications": [p.get("doi") or p.get("id") for p in (s.get("publications") or []) if (p.get("doi") or p.get("id"))],
                "parent": (s.get("parent") or {}).get("id"),
            }
        page += 1
        cursor = block.get("nextCursor")
        print(f"  page {page}: {len(rows)} strains, total {len(out)}", file=sys.stderr)
        if not rows or not cursor:
            break
        time.sleep(0.1)
    with open(OUT, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    print(f"\ndone: {len(out)} strains with rich metadata -> {os.path.relpath(OUT)}",
          file=sys.stderr)


if __name__ == "__main__":
    main()
