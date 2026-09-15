#!/usr/bin/env python3
"""Mirror the dictyNews newsletter archive (1994-2017) before dictybase.org goes
dark. It is an Apache autoindex under /newsletter/, ~42 volume directories each
holding plain-text issues. Not part of any bulk download, so this is the only
preservation copy. Resumable: existing files are skipped.

  python3 scripts/scrape_newsletter.py

Writes to assets/dictybase-downloads/newsletter/Vol_*/<issue>.txt
"""
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEST = os.path.join(ROOT, "assets", "dictybase-downloads", "newsletter")
BASE = "http://dictybase.org/newsletter/"
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45, context=_CTX) as r:
        return r.read() if binary else r.read().decode("utf-8", "replace")


def links(html):
    """Hrefs in an Apache autoindex, minus the parent/sort links."""
    out = []
    for m in re.findall(r'href="([^"?][^"]*)"', html):
        if m in ("/", "../") or m.startswith("/") or m.startswith("#"):
            continue
        if "://" in m or m.startswith("mailto:"):   # external links in the page body
            continue
        out.append(m)
    return out


def main():
    os.makedirs(DEST, exist_ok=True)
    vols = [l for l in links(fetch(BASE)) if l.endswith("/")]
    print(f"{len(vols)} volume directories", file=sys.stderr)
    n_files = n_new = n_bytes = 0
    for vol in sorted(vols):
        vdir = os.path.join(DEST, vol.strip("/"))
        os.makedirs(vdir, exist_ok=True)
        try:
            items = [l for l in links(fetch(BASE + vol)) if not l.endswith("/")]
        except Exception as e:  # noqa: BLE001
            print(f"  ! {vol}: index failed ({e})", file=sys.stderr)
            continue
        for it in items:
            n_files += 1
            dest = os.path.join(vdir, os.path.basename(urllib.parse.unquote(it)))
            if os.path.exists(dest) and os.path.getsize(dest) > 0:
                continue
            try:
                data = fetch(BASE + vol + it, binary=True)
            except Exception as e:  # noqa: BLE001
                print(f"  ! {vol}{it}: {e}", file=sys.stderr)
                continue
            with open(dest, "wb") as fh:
                fh.write(data)
            n_new += 1
            n_bytes += len(data)
            time.sleep(0.15)
        print(f"  {vol}: {len(items)} issues", file=sys.stderr)
    print(f"\ndone: {n_files} issues total, {n_new} newly downloaded "
          f"({n_bytes/1024:.0f} KB)", file=sys.stderr)


if __name__ == "__main__":
    main()
