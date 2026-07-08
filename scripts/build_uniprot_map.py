#!/usr/bin/env python3
"""Build assets/uniprot_map.json — DDB_G id -> UniProt accession for D. discoideum.

There is no stored Dicty-gene -> UniProt-accession mapping in the repo: the gene
record resolves a UniProt accession with a *live* browser-side lookup, and the
InterPro domain tool needs that accession too. This script materializes the map
once from the UniProt reference proteome so other builds (and the front-end) can
join against it without a per-gene network call.

Output (assets/uniprot_map.json):
    {
      "_meta": { built, source, license, counts },
      "map":   { "DDB_G0267374": {"acc": "Q8I7P3", "reviewed": true}, ... }
    }

When a DDB_G id maps to several UniProt entries, a Swiss-Prot (reviewed) entry
wins; otherwise the first TrEMBL accession is kept.

Standard library only. Usage:
    python3 scripts/build_uniprot_map.py
"""
import datetime
import json
import os
import pathlib
import re
import ssl
import sys
import time
import urllib.error
import urllib.request

# Match serve.py / build_ortholog_disease.py: this environment lacks a local CA
# bundle for urllib. We only fetch public reference data over HTTPS.
SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "uniprot_map.json"
CACHE = pathlib.Path(os.environ.get("DICTY_CACHE", "/tmp/dicty-uniprot-map"))
CACHE.mkdir(parents=True, exist_ok=True)

UA = {"User-Agent": "dictyBase uniprot-map build (research)"}
ORGANISM_ID = "44689"  # Dictyostelium discoideum


def _fetch(url, attempts=4):
    """GET bytes with retry/backoff for transient 5xx/429/network hiccups."""
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=90, context=SSL_CTX) as r:
                return r.read(), r.headers.get("Link", "")
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            code = getattr(e, "code", None)
            if code and code < 500 and code != 429:
                raise  # genuine client error — don't retry
            time.sleep(2 * (i + 1))
    raise last


def fetch_map():
    """{DDB_G id: {"acc": accession, "reviewed": bool}} from the UniProt proteome."""
    fields = "accession,reviewed,gene_primary,xref_dictybase"
    url = ("https://rest.uniprot.org/uniprotkb/search?"
           f"query=organism_id:{ORGANISM_ID}&fields={fields}&format=tsv&size=500")
    out = {}
    page = 0
    while url:
        page += 1
        cache_name = CACHE / f"uniprot_{page:03d}.tsv"
        nxt_file = CACHE / f"uniprot_{page:03d}.next"
        if cache_name.exists():
            text = cache_name.read_text(encoding="utf-8")
            url = nxt_file.read_text().strip() if nxt_file.exists() else ""
        else:
            body, link = _fetch(url)
            text = body.decode("utf-8", "replace")
            # The URL has literal commas (fields=a,b,c); match the whole <...> link.
            m = re.search(r'<([^>]+)>;\s*rel="next"', link)
            url = m.group(1) if m else ""
            cache_name.write_text(text, encoding="utf-8")
            nxt_file.write_text(url)
        for line in text.splitlines()[1:]:
            cols = line.split("\t")
            if len(cols) < 4:
                continue
            acc, reviewed, _symbol, ddb_raw = cols[0], cols[1], cols[2], cols[3]
            is_reviewed = reviewed.strip().lower() in ("reviewed", "true", "1")
            for ddb in (d.strip() for d in ddb_raw.replace(";", " ").split()):
                if not ddb.startswith("DDB_G") or not acc:
                    continue
                prev = out.get(ddb)
                # Swiss-Prot (reviewed) wins; otherwise keep the first seen.
                if prev is None or (is_reviewed and not prev["reviewed"]):
                    out[ddb] = {"acc": acc, "reviewed": is_reviewed}
        print(f"  uniprot page {page}: {len(out)} DDB_G ids mapped", file=sys.stderr)
    return out


def main():
    print("Fetching UniProt D. discoideum accession map...", file=sys.stderr)
    mapping = fetch_map()
    reviewed = sum(1 for v in mapping.values() if v["reviewed"])
    data = {
        "_meta": {
            "description": "DDB_G id -> UniProt accession for D. discoideum.",
            "built": datetime.date.today().isoformat(),
            "source": {"name": "UniProt", "license": "CC BY 4.0",
                       "url": f"https://rest.uniprot.org/uniprotkb/?query=organism_id:{ORGANISM_ID}"},
            "counts": {"genes_mapped": len(mapping), "reviewed": reviewed,
                       "unreviewed": len(mapping) - reviewed},
        },
        "map": dict(sorted(mapping.items())),
    }
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n",
                   encoding="utf-8")
    tmp.replace(OUT)
    print(f"wrote {OUT}: {len(mapping)} genes ({reviewed} reviewed), "
          f"{OUT.stat().st_size/1024:.0f} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
