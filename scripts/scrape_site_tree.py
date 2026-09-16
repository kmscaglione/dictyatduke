#!/usr/bin/env python3
"""Mirror a static file tree from the legacy dictybase.org (Apache autoindex)
before it goes dark. Recurses into subdirectories, downloads every file, and
preserves the path layout. Resumable: existing non-empty files are skipped.

  python3 scripts/scrape_site_tree.py <url-path> [<dest-subdir>]
  e.g. python3 scripts/scrape_site_tree.py /Multimedia/ multimedia

Writes under assets/dictybase-downloads/site-mirror/<dest-subdir>/.
"""
import os
import re
import ssl
import sys
import time
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = "http://dictybase.org"
DEST_ROOT = os.path.join(ROOT, "assets", "dictybase-downloads", "site-mirror")
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url, binary=False):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90, context=_CTX) as r:
        return r.read() if binary else r.read().decode("utf-8", "replace")


def links(html):
    out = []
    for m in re.findall(r'href="([^"?][^"]*)"', html):
        if m in ("/", "../") or m.startswith(("/", "#", "mailto:")) or "://" in m:
            continue
        out.append(m)
    return out


def is_index(name):
    return name.rstrip("/").split("/")[-1].lower() in ("index.html", "index.htm")


def mirror(url_path, dest_dir, stats, visited, depth=0):
    """Mirror one directory: download its files, then descend into every
    subdirectory — whether linked as `sub/` (autoindex) or referenced indirectly
    as `sub/page.html` (a curated index that points into an autoindexed subdir)."""
    if url_path in visited or depth > 8:
        return
    visited.add(url_path)
    try:
        html = fetch(BASE + url_path)
    except Exception as e:  # noqa: BLE001
        print(f"  ! index {url_path}: {e}", file=sys.stderr)
        return
    os.makedirs(dest_dir, exist_ok=True)
    subdirs = set()
    for item in links(html):
        if item.endswith("/"):
            subdirs.add(item)
            continue
        if "/" in item:                       # a file inside a subdir -> crawl that subdir
            subdirs.add(item.split("/", 1)[0] + "/")
            continue
        name = os.path.basename(urllib.parse.unquote(item))
        if not name:
            continue
        dest = os.path.join(dest_dir, name)
        stats["seen"] += 1
        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            continue
        try:
            data = fetch(BASE + url_path + item, binary=True)
        except Exception as e:  # noqa: BLE001
            print(f"  ! {url_path}{item}: {e}", file=sys.stderr)
            continue
        with open(dest, "wb") as fh:
            fh.write(data)
        stats["new"] += 1
        stats["bytes"] += len(data)
        time.sleep(0.1)
    for sd in sorted(subdirs):
        mirror(url_path + sd, os.path.join(dest_dir, sd.strip("/")), stats, visited, depth + 1)
    if depth == 0:
        print(f"  {url_path}: {stats['new']} new / {stats['seen']} seen "
              f"({stats['bytes']/1024/1024:.1f} MB)", file=sys.stderr)


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: scrape_site_tree.py <url-path> [<dest-subdir>]")
    url_path = sys.argv[1]
    if not url_path.startswith("/"):
        url_path = "/" + url_path
    if not url_path.endswith("/"):
        url_path += "/"
    dest_sub = sys.argv[2] if len(sys.argv) > 2 else url_path.strip("/").replace("/", "_")
    stats = {"seen": 0, "new": 0, "bytes": 0}
    mirror(url_path, os.path.join(DEST_ROOT, dest_sub), stats, set())
    print(f"\ndone: {url_path} -> {stats['new']} files downloaded "
          f"({stats['bytes']/1024/1024:.1f} MB), {stats['seen']} seen total",
          file=sys.stderr)


if __name__ == "__main__":
    main()
