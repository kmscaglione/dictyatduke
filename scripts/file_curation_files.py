#!/usr/bin/env python3
"""File curation batches out of Downloads into Matt's curation folders.

Two folders on the Desktop, one job each:

    Dicty curation  exported files/2026-07-30/dictybase-curation-batch-*.json
        batches downloaded from the dashboard's "Export batch", in a folder per
        day. The date is the file's own timestamp, not today, so filing a
        backlog puts each file under the day it was actually exported.

    Dicty files to import/dictybase-curation-results-*.json
        finished curation, ready to pick in the dashboard's "Import results".
        Kept flat on purpose: the filename already carries the date, and the
        file dialog is one click rather than a dig through dated folders.

The dashboard's "Export batch" is a browser download, and a web page cannot
choose where the browser saves, so batches always land in ~/Downloads first.
This is what moves them on.

    python3 scripts/file_curation_files.py              # file whatever is waiting
    python3 scripts/file_curation_files.py --dry-run    # show what would move
    python3 scripts/file_curation_files.py --copy       # leave the originals alone

All local to this Mac. Nothing here touches the Duke server. Nothing is ever
overwritten: a name collision gets -2, -3 and so on.
"""
import argparse
import datetime
import os
import pathlib
import shutil
import sys
import time

DEFAULT_SRC = pathlib.Path.home() / "Downloads"
DESKTOP = pathlib.Path.home() / "Desktop"
EXPORT_ROOT = DESKTOP / "Dicty curation  exported files"   # batches, dated subfolders
IMPORT_ROOT = DESKTOP / "Dicty files to import"            # finished curation, flat
SETTLE_TIMEOUT = 20         # seconds to wait for a download to finish writing


def settled(path, timeout=SETTLE_TIMEOUT):
    """Wait until the file stops growing. A folder watcher fires the moment a
    download starts, so we wait it out rather than skip it: a skipped file would
    never be filed, because nothing changes in the folder afterwards to fire
    the watcher again."""
    last, deadline = -1, time.time() + timeout
    while time.time() < deadline:
        try:
            size = path.stat().st_size
        except OSError:
            return False
        if size == last and size > 0:
            return True
        last = size
        time.sleep(0.5)
    return False


def unique(path):
    """A path that does not exist yet: name.json, name-2.json, name-3.json…"""
    if not path.exists():
        return path
    for n in range(2, 1000):
        cand = path.with_name(f"{path.stem}-{n}{path.suffix}")
        if not cand.exists():
            return cand
    raise RuntimeError(f"too many files named like {path.name}")


def destination(f, export_root, import_root):
    """Where this file belongs: batches under a dated folder, results kept flat."""
    if f.name.startswith("dictybase-curation-batch-"):
        day = datetime.date.fromtimestamp(f.stat().st_mtime).isoformat()
        return export_root / day / f.name
    return import_root / f.name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--from", dest="src", default=str(DEFAULT_SRC),
                    help=f"where downloads land (default {DEFAULT_SRC})")
    ap.add_argument("--exports", default=os.environ.get("DICTY_EXPORT_DIR", str(EXPORT_ROOT)),
                    help="folder for exported batches")
    ap.add_argument("--imports", default=os.environ.get("DICTY_IMPORT_DIR", str(IMPORT_ROOT)),
                    help="folder for finished curation, ready to import")
    ap.add_argument("--copy", action="store_true", help="copy instead of moving")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen")
    args = ap.parse_args()

    src = pathlib.Path(args.src).expanduser()
    export_root = pathlib.Path(args.exports).expanduser()
    import_root = pathlib.Path(args.imports).expanduser()
    if not src.is_dir():
        sys.exit(f"error: no such folder: {src}")

    moved, skipped = 0, 0
    for pattern in ("dictybase-curation-batch-*.json", "dictybase-curation-results-*.json"):
        for f in sorted(src.glob(pattern)):
            if f.suffix in (".crdownload", ".part") or not settled(f):
                print(f"  still being written after {SETTLE_TIMEOUT}s, skipping: {f.name}")
                skipped += 1
                continue
            dest = unique(destination(f, export_root, import_root))
            if args.dry_run:
                print(f"  would {'copy' if args.copy else 'move'} {f.name} -> {dest}")
            else:
                dest.parent.mkdir(parents=True, exist_ok=True)
                (shutil.copy2 if args.copy else shutil.move)(str(f), str(dest))
                print(f"  {'copied' if args.copy else 'moved'} {f.name} -> {dest}")
            moved += 1

    if not moved and not skipped:
        print(f"nothing to file in {src}")
    else:
        print(f"\n{moved} file(s) {'to file' if args.dry_run else 'filed'}"
              + (f", {skipped} still downloading" if skipped else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
