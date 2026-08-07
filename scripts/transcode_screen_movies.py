#!/usr/bin/env python3
"""Transcode Sawai/Cox screen movies to browser-playable H.264.

The source movies are 2003-2005 QuickTime files carrying MPEG-4 Part 2 video
(fourcc `mp4v`), which no current browser plays reliably. macOS ships
`avconvert`, which re-encodes them to H.264 in an MP4 container at roughly a
fifth of the size, so no third-party tooling is needed.

Only movies referenced by assets/sawai2007.json are converted, so this stays
proportional to what the site can actually surface. Source files are matched by
basename because the database's stored paths ("hinted_052903/rp052903_02.mov")
do not match the folder layout of the archive.

Output goes to assets/media/screen/, which is gitignored: it is generated from
the archive and must not bloat the repository.

Usage:
  python3 scripts/transcode_screen_movies.py --source ~/Downloads/OneDrive_2026-08-07
  python3 scripts/transcode_screen_movies.py --source <dir> --all      # not just referenced
  python3 scripts/transcode_screen_movies.py --source <dir> --limit 20 # try a few first
"""
import argparse
import json
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "media", "screen")


def index_sources(src_dir):
    """basename -> full path for every .mov under the archive."""
    found = {}
    for root, _dirs, files in os.walk(src_dir):
        for f in files:
            if f.lower().endswith(".mov"):
                found.setdefault(f, os.path.join(root, f))
    return found


def wanted_movies(data, take_all):
    """Basenames the site refers to, in a stable order."""
    if take_all:
        return None
    names = []
    for s in data.get("strains", []):
        for r in s.get("runs", []):
            for key in ("movie", "slug_movie"):
                p = r.get(key)
                if p:
                    names.append(os.path.basename(p))
    seen, out = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            out.append(n)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", required=True, help="archive root holding the .mov files")
    ap.add_argument("--all", action="store_true", help="convert every movie found, not just referenced ones")
    ap.add_argument("--limit", type=int, default=0, help="stop after N conversions")
    ap.add_argument("--preset", default="PresetHighestQuality")
    args = ap.parse_args()

    src_dir = os.path.expanduser(args.source)
    if not os.path.isdir(src_dir):
        sys.exit(f"no such source directory: {src_dir}")
    if not shutil_which("avconvert"):
        sys.exit("avconvert not found. It ships with macOS; on other platforms use ffmpeg instead.")

    data = json.load(open(os.path.join(ASSETS, "sawai2007.json"), encoding="utf-8"))
    sources = index_sources(src_dir)
    names = wanted_movies(data, args.all)
    if names is None:
        names = sorted(sources)

    os.makedirs(OUT, exist_ok=True)
    done = skipped = missing = failed = 0
    saved_in = saved_out = 0

    for i, name in enumerate(names):
        if args.limit and done >= args.limit:
            break
        src = sources.get(name)
        if not src:
            missing += 1
            continue
        dst = os.path.join(OUT, os.path.splitext(name)[0] + ".mp4")
        if os.path.exists(dst) and os.path.getsize(dst) > 0:
            skipped += 1
            continue
        r = subprocess.run(
            ["avconvert", "--preset", args.preset, "--source", src, "--output", dst],
            capture_output=True, text=True)
        if r.returncode != 0 or not os.path.exists(dst):
            failed += 1
            print(f"  FAILED {name}: {r.stderr.strip()[:120]}", file=sys.stderr)
            continue
        saved_in += os.path.getsize(src)
        saved_out += os.path.getsize(dst)
        done += 1
        if done % 25 == 0:
            print(f"  {done} converted…", flush=True)

    print(f"\nconverted {done}, already present {skipped}, "
          f"not in archive {missing}, failed {failed}")
    if saved_in:
        print(f"size {saved_in/1e6:.0f} MB -> {saved_out/1e6:.0f} MB "
              f"({100 * saved_out / saved_in:.0f}%)")
    print(f"output: {os.path.relpath(OUT, ROOT)}")
    return 1 if failed else 0


def shutil_which(cmd):
    from shutil import which
    return which(cmd)


if __name__ == "__main__":
    sys.exit(main())
