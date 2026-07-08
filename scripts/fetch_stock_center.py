#!/usr/bin/env python3
"""Scrape the legacy Dicty Stock Center catalogs into assets/stock_center.json.

Source: dictybase.org (HTTP-only CGI pages that render HTML tables).
  - strains:  /db/cgi-bin/dictyBase/SC/strainlist.pl
  - plasmids: /db/cgi-bin/dictyBase/SC/plasmid_catalog.pl

This is the interim import (see stock-center feature): stand up the catalog now,
replace with a fuller/cleaner export from the Stock Center when available. Output
schema is stable so the front end doesn't change when the source does.

Usage:  python3 scripts/fetch_stock_center.py
"""
import html
import json
import os
import re
import ssl
import sys
import urllib.request
from datetime import date

BASE = "http://dictybase.org/db/cgi-bin/dictyBase/SC"
STRAINS_URL = f"{BASE}/strainlist.pl"
PLASMIDS_URL = f"{BASE}/plasmid_catalog.pl"
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "stock_center.json")

_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "dicty-stock-import/1.0"})
    with urllib.request.urlopen(req, timeout=60, context=_CTX) as r:
        return r.read().decode("utf-8", "replace")


def cell_text(cell_html):
    """Strip tags/entities from one <td> and normalise whitespace."""
    txt = re.sub(r"<[^>]+>", " ", cell_html)
    txt = html.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def rows(page_html):
    for r in re.findall(r"<tr[^>]*>(.*?)</tr>", page_html, re.S | re.I):
        cells = re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", r, re.S | re.I)
        yield [cell_text(c) for c in cells]


def parse_strains(page_html):
    out, started = [], False
    for cells in rows(page_html):
        if len(cells) < 4:
            continue
        if not started:
            if cells[0].lower().startswith("strain descriptor"):
                started = True  # header row — data follows
            continue
        descriptor, summary, genotype, phenotype = (cells + ["", "", "", ""])[:4]
        if not descriptor or descriptor.lower().startswith("strain descriptor"):
            continue
        out.append({
            "id": descriptor,
            "summary": summary,
            "genotype": genotype,
            "phenotype": phenotype,
        })
    return out


def parse_plasmids(page_html):
    out, started = [], False
    for cells in rows(page_html):
        if len(cells) < 4:
            continue
        if not started:
            if cells[0].strip().lower().startswith("id"):
                started = True
            continue
        pid, name, description, depositor = (cells + ["", "", "", ""])[:4]
        if not re.match(r"^\d+$", pid.strip()):
            continue
        out.append({
            "id": pid.strip(),
            "name": name,
            "description": description,
            "depositor": depositor,
        })
    return out


def main():
    print("Fetching strain list…", file=sys.stderr)
    strains = parse_strains(fetch(STRAINS_URL))
    print(f"  {len(strains)} strains", file=sys.stderr)
    print("Fetching plasmid catalog…", file=sys.stderr)
    plasmids = parse_plasmids(fetch(PLASMIDS_URL))
    print(f"  {len(plasmids)} plasmids", file=sys.stderr)
    if not strains or not plasmids:
        sys.exit("Refusing to write: one of the catalogs came back empty.")
    data = {
        "_meta": {
            "description": "Dicty Stock Center catalog — strains and plasmids available to order.",
            "source": {"name": "Dicty Stock Center (dictyBase)", "url": "http://dictybase.org/StockCenter/StockCenter.html"},
            "built": date.today().isoformat(),
            "note": "Interim scrape of the legacy catalog; to be replaced by a full Stock Center export.",
            "counts": {"strains": len(strains), "plasmids": len(plasmids)},
        },
        "strains": strains,
        "plasmids": plasmids,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, indent=1, ensure_ascii=False)
    print(f"Wrote {os.path.relpath(OUT)} ({len(strains)} strains, {len(plasmids)} plasmids)", file=sys.stderr)


if __name__ == "__main__":
    main()
