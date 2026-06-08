#!/usr/bin/env python3
"""Download the protocol figures that technique-content.js embeds from
storage.dictybase.dev and self-host them, so the genome browser's technique
pages don't break if dictybase's CDN is down (a real runtime <img> dependency).

Downloads each image to assets/technique-images/<uuid>.<ext> (extension sniffed
from magic bytes — the CDN serves application/octet-stream), then rewrites the
src in technique-content.js to the local path.

    python3 scripts/fetch_technique_images.py

Idempotent: already-localized images are skipped; re-running is a no-op once the
file has been rewritten. The protocol text keeps its dictybase source/attribution
links — only the image hosting moves in-house (CC BY-NC permits redistribution
with attribution).
"""
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "technique-content.js")
IMG_DIR = os.path.join(ROOT, "assets", "technique-images")
URL_RE = re.compile(r'https://storage\.dictybase\.dev/[^"\\ ]+')

MAGIC = [
    (b"\x89PNG\r\n\x1a\n", "png"),
    (b"\xff\xd8\xff", "jpg"),
    (b"GIF8", "gif"),
    (b"RIFF", "webp"),   # RIFF....WEBP
    (b"<svg", "svg"), (b"<?xml", "svg"),
]


def sniff(data):
    for sig, ext in MAGIC:
        if data.startswith(sig):
            return ext
    return "bin"


def main():
    text = open(SRC, encoding="utf-8").read()
    urls = sorted(set(URL_RE.findall(text)))
    if not urls:
        print("No storage.dictybase.dev images left in technique-content.js.")
        return
    os.makedirs(IMG_DIR, exist_ok=True)
    print(f"{len(urls)} image(s) to localize:")
    for url in urls:
        uid = url.rstrip("/").split("/")[-1]
        # Use curl: it validates TLS against the system cert store (Python's
        # urllib doesn't on macOS), and the CDN requires HTTPS.
        proc = subprocess.run(["curl", "-sL", "--fail", url], capture_output=True, timeout=60)
        if proc.returncode != 0 or not proc.stdout:
            print(f"  FAILED {uid}: curl exit {proc.returncode}")
            continue
        data = proc.stdout
        ext = sniff(data)
        fname = f"{uid}.{ext}"
        with open(os.path.join(IMG_DIR, fname), "wb") as fh:
            fh.write(data)
        local = f"/assets/technique-images/{fname}"
        text = text.replace(url, local)
        print(f"  {uid}: {len(data)//1024} KB -> {local}")

    open(SRC, "w", encoding="utf-8").write(text)
    remaining = len(URL_RE.findall(text))
    print(f"\nRewrote technique-content.js. Remaining storage.dictybase refs: {remaining}.")


if __name__ == "__main__":
    main()
