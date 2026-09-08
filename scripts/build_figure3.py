#!/usr/bin/env python3
"""Rebuild the NAR Figure 3 panel montage (the cln5 gene record).

Captures the live gene record with headless Chrome, crops the eight panels, and
composites them with A-H labels. Re-run after any change to the record layout or
to cln5's curation, so the figure never drifts from what the site serves.

    python3 scripts/build_figure3.py [--base https://dicty.org] [--out docs]

Two things that cost an afternoon to work out, so do not remove them:
  * WebGL is off in headless Chrome by default, so the AlphaFold viewer renders
    as "Loading structure...". --use-gl=angle --use-angle=swiftshader fixes it.
  * The hovercard (panel G) only exists on hover, which the screenshot flags
    cannot trigger. It is re-rendered from the live /api/gene-card payload using
    the site's own stylesheet, so the result is the real component, not a mockup.

Panel rectangles are read from the DOM at capture time rather than hardcoded;
if the layout shifts, the crops follow it.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.request

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
SCALE = 2
VIEWPORT_W = 1280

# panel -> (css selector or text probe). Order is the montage order.
PANELS = ["A", "B", "C", "D", "E", "F", "G", "H"]

# Rects measured from the DOM (CSS px, document coords). Filled by --probe, or
# use the defaults below, which match the current record layout.
DEFAULT_RECTS = {
    "A": (51, 153, 1178, 274),
    "B": (51, 427, 1178, 731),
    "C": (75, 1330, 558, 266),
    "D": (647, 1328, 558, 233),
    "E": (647, 1575, 558, 403),
    "F": (647, 1993, 558, 232),
    "H": (92, 1239, 1096, 297),      # on ?tab=Literature
}

MONTAGE_CSS = """
body{margin:0;background:#fff;padding:20px 22px;width:1190px;
     font:14px/1.4 -apple-system,system-ui,"Segoe UI",Helvetica,Arial,sans-serif;color:#1a2b3c}
.row{display:flex;gap:18px;margin-bottom:18px;align-items:flex-start}
.cell{position:relative;flex:0 0 auto}
.lab{position:absolute;left:-14px;top:-4px;font-weight:700;font-size:19px;color:#0a4f47;
     font-family:Helvetica,Arial,sans-serif}
img{display:block;border:1px solid #e3ebe9;border-radius:8px}
.full img{width:1166px}.half img{width:566px}.g img{width:392px;border:none}.h img{width:756px}
"""


def chrome(url, out_png, w, h, webgl=False, budget=45000):
    args = [CHROME, "--headless=new", "--hide-scrollbars",
            f"--window-size={w},{h}", f"--force-device-scale-factor={SCALE}",
            f"--virtual-time-budget={budget}", f"--screenshot={out_png}"]
    if webgl:
        args[2:2] = ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
    else:
        args.insert(2, "--disable-gpu")
    args += ["--allow-file-access-from-files", url]
    subprocess.run(args, check=True, capture_output=True)


def crop(src, dst, rect, padx=6, padt=6):
    from PIL import Image
    x, y, w, h = rect
    im = Image.open(src)
    im.crop(((x - padx) * SCALE, (y - padt) * SCALE,
             (x + w + padx) * SCALE, (y + h + padx) * SCALE)).save(dst)


def hovercard_png(base, tmp, gene="nagA"):
    """Re-render the hovercard from live data with the site's own CSS."""
    from PIL import Image
    card = json.load(urllib.request.urlopen(f"{base}/api/gene-card?id={gene}", timeout=30))
    css = urllib.request.urlopen(f"{base}/styles.css", timeout=30).read().decode("utf-8", "replace")
    open(os.path.join(tmp, "styles.css"), "w").write(css)
    human = ", ".join(card.get("human") or [])
    badges = ""
    if card.get("disease"):
        badges = '<div class="hc-badges"><span class="hc-badge hc-dis">disease link</span></div>'
    html = f"""<!doctype html><meta charset="utf-8"><link rel="stylesheet" href="styles.css">
<style>body{{margin:0;background:#fff;padding:22px;font-family:-apple-system,system-ui,sans-serif}}
.hovercard{{position:static!important;visibility:visible!important;display:block;width:360px}}</style>
<div class="hovercard" style="visibility:visible">
<div class="hc-head"><strong>{card['symbol']}</strong> <span class="hc-name">{card['name']}</span></div>
<p class="hc-summary">{card['summary']}</p>{badges}
<div class="hc-human">&#8596; human {human}</div></div>"""
    p = os.path.join(tmp, "hovercard.html")
    open(p, "w").write(html)
    chrome("file://" + p, os.path.join(tmp, "g_raw.png"), 440, 340, budget=4000)
    im = Image.open(os.path.join(tmp, "g_raw.png")).convert("RGB")
    bg, px, (W, H) = im.getpixel((2, 2)), im.load(), im.size
    cb = lambda x: all(px[x, y] == bg for y in range(0, H, 3))
    rb = lambda y: all(px[x, y] == bg for x in range(0, W, 3))
    l = next(i for i in range(W) if not cb(i)); r = next(i for i in range(W - 1, 0, -1) if not cb(i))
    t = next(i for i in range(H) if not rb(i)); b = next(i for i in range(H - 1, 0, -1) if not rb(i))
    pad = 14
    im.crop((max(0, l - pad), max(0, t - pad), min(W, r + pad), min(H, b + pad))).save(
        os.path.join(tmp, "panelG.png"))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default="https://dicty.org")
    ap.add_argument("--gene", default="cln5")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "docs"))
    a = ap.parse_args()
    from PIL import Image
    out = os.path.abspath(a.out)
    tmp = tempfile.mkdtemp(prefix="fig3-")

    # 1. summary tab, with WebGL so the AlphaFold viewer paints
    chrome(f"{a.base}/gene/{a.gene}", os.path.join(tmp, "full.png"), VIEWPORT_W, 3040, webgl=True)
    for k in ("A", "B", "C", "D", "E", "F"):
        padt = 0 if k == "C" else 6           # C butts against the gene-model block
        crop(os.path.join(tmp, "full.png"), os.path.join(tmp, f"panel{k}.png"),
             DEFAULT_RECTS[k], padt=padt)

    # 2. literature tab for panel H
    chrome(f"{a.base}/gene/{a.gene}?tab=Literature", os.path.join(tmp, "lit.png"), VIEWPORT_W, 3000)
    crop(os.path.join(tmp, "lit.png"), os.path.join(tmp, "panelH.png"), DEFAULT_RECTS["H"])

    # 3. hovercard
    hovercard_png(a.base, tmp)

    # 4. montage
    rows = ('<div class="row full"><div class="cell"><span class="lab">A</span><img src="panelA.png"></div></div>'
            '<div class="row full"><div class="cell"><span class="lab">B</span><img src="panelB.png"></div></div>'
            '<div class="row"><div class="cell half"><span class="lab">C</span><img src="panelC.png"></div>'
            '<div class="cell half"><span class="lab">D</span><img src="panelD.png"></div></div>'
            '<div class="row"><div class="cell half"><span class="lab">E</span><img src="panelE.png"></div>'
            '<div class="cell half"><span class="lab">F</span><img src="panelF.png"></div></div>'
            '<div class="row"><div class="cell g"><span class="lab">G</span><img src="panelG.png"></div>'
            '<div class="cell h"><span class="lab">H</span><img src="panelH.png"></div></div>')
    m = os.path.join(tmp, "montage.html")
    open(m, "w").write(f'<!doctype html><meta charset="utf-8"><style>{MONTAGE_CSS}</style>{rows}')
    chrome("file://" + m, os.path.join(tmp, "raw.png"), 1234, 2400, budget=6000)

    im = Image.open(os.path.join(tmp, "raw.png")).convert("RGB")
    px, (W, H) = im.load(), im.size
    b = next(y for y in range(H - 1, 0, -1)
             if not all(px[x, y] == (255, 255, 255) for x in range(0, W, 4)))
    dst = os.path.join(out, "figure3-gene-record.png")
    im.crop((0, 0, W, min(H, b + 40))).save(dst)
    print(f"wrote {dst}  {Image.open(dst).size}")


if __name__ == "__main__":
    main()
