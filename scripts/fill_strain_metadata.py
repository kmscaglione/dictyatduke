#!/usr/bin/env python3
"""Fill strain_metadata.json with the strains that listStrains pagination misses.

listStrains returns the GWDI insertion bank but not the curated named strains
(racE-, mhcA-, ...). Those are reachable by id, so fetch every strain id we know
about — the Stock Center catalog (stock_center.json) and the phenotyped strains
(strain_gene_links.json) — via batched, aliased GraphQL and merge in anything
missing. Idempotent: strains already present are skipped.

  python3 scripts/fill_strain_metadata.py
"""
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
META = os.path.join(ASSETS, "dictybase-corpus", "strain_metadata.json")
URL = "https://graphql.dictybase.dev/graphql"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

FIELDS = """id label systematic_name summary in_stock names genotypes
  genetic_modification mutagenesis_method characteristics
  depositor { last_name } genes { id name } publications { id doi } parent { id label }"""


def gql(query):
    body = json.dumps({"query": query}).encode()
    req = urllib.request.Request(URL, data=body, method="POST",
                                 headers={"Content-Type": "application/json",
                                          "User-Agent": "dicty-preserve/1.0"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60, context=_CTX) as r:
                return json.loads(r.read().decode("utf-8", "replace")).get("data") or {}
        except Exception:  # noqa: BLE001
            if attempt == 2:
                return {}
            time.sleep(1)


def flatten(s):
    dep = s.get("depositor") or {}
    return {
        "id": s["id"], "label": s.get("label", ""),
        "systematic_name": s.get("systematic_name", ""), "summary": s.get("summary", ""),
        "in_stock": s.get("in_stock"), "names": s.get("names") or [],
        "genotypes": s.get("genotypes") or [],
        "genetic_modification": s.get("genetic_modification", ""),
        "mutagenesis_method": s.get("mutagenesis_method", ""),
        "characteristics": s.get("characteristics") or [],
        "depositor": (dep.get("last_name") or "").strip() or None,
        "genes": [g.get("id") or g.get("name") for g in (s.get("genes") or [])],
        "publications": [p.get("doi") or p.get("id") for p in (s.get("publications") or []) if (p.get("doi") or p.get("id"))],
        "parent": (s.get("parent") or {}).get("id"),
    }


def known_ids():
    ids = set()
    sc = json.load(open(os.path.join(ASSETS, "stock_center.json")))
    for s in sc.get("strains", []):
        if str(s.get("id", "")).startswith("DBS"):
            ids.add(s["id"])
    links = json.load(open(os.path.join(ASSETS, "strain_gene_links.json")))
    for sid in (links.get("by_strain") or {}):
        if sid.startswith("DBS"):
            ids.add(sid)
    return ids


def main():
    out = json.load(open(META)) if os.path.exists(META) else {}
    ids = sorted(known_ids() - set(out))
    print(f"{len(out)} strains already captured; {len(ids)} known ids to fill", file=sys.stderr)
    BATCH = 50
    for i in range(0, len(ids), BATCH):
        chunk = ids[i:i + BATCH]
        # alias each id (alias must be a valid GraphQL name: DBS ids already are).
        q = "{" + " ".join(f'{sid}: strain(id: "{sid}") {{ {FIELDS} }}' for sid in chunk) + "}"
        data = gql(q)
        for sid in chunk:
            s = data.get(sid)
            if s and s.get("id"):
                out[s["id"]] = flatten(s)
        if (i // BATCH) % 10 == 0:
            with open(META, "w") as fh:
                json.dump(out, fh, ensure_ascii=False, indent=0)
            print(f"  ...{i + len(chunk)}/{len(ids)} queried, total {len(out)}", file=sys.stderr)
        time.sleep(0.1)
    with open(META, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    print(f"\ndone: {len(out)} strains total in {os.path.relpath(META)}", file=sys.stderr)


if __name__ == "__main__":
    main()
