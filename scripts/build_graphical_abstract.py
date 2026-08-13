#!/usr/bin/env python3
"""Generate the NAR graphical abstract (SVG + PNG).

Writes docs/graphical-abstract.svg and renders docs/graphical-abstract.png
at 2x via headless Chrome. Layout constants are at the top so the figure can
be re-proportioned without touching the drawing code.

Type sizes are set so the smallest text stays legible when the figure is
placed at ~6.5 inches wide: at that width 1 unit is about 1/270 inch, so the
30-unit body text lands near 8 pt. Keep 30 as the floor.

Usage: python3 scripts/build_graphical_abstract.py [--out DIR]
"""

import argparse
import os
import subprocess

W, H = 1760, 1430
SCALE = 2  # PNG device-scale factor
MARGIN = 58
CONTENT_W = W - 2 * MARGIN

SITE_URL = "https://www.dicty.org"

# vertical layout (baselines / anchors)
RULE_Y = 150
ICON_Y = 350           # life-cycle icon centers
ICON_SCALE = 2.1
ARC_LIFT = 100         # how far above the icons the return arc springs from
LABEL_Y = ICON_Y + 120     # stage name
SUBLABEL_Y = ICON_Y + 158  # stage subtitle
CAPTION_Y = 580        # italic strip caption

TILE_COLS = 3
TILE_GAP = 18
TILE_W = (CONTENT_W - (TILE_COLS - 1) * TILE_GAP) // TILE_COLS
TILE_H = 205
TILE_Y = 640

BAND_Y, BAND_H = 1105, 225
FOOTER_Y = BAND_Y + BAND_H + 54

# life-cycle stage x centers
STAGE_X = [200, 545, 890, 1235, 1580]
ARROW_CLEAR = 115      # gap left around each icon before an arrow starts

INK = "#0a4f47"        # dark teal
ACCENT = "#0b746a"
GOLD = "#f4c84a"
CELL = "#9fb8d6"       # cell body blue-grey
CELL_DARK = "#5f93cb"
TEXT = "#1a2b3c"
MUTED = "#5b6672"
TILE_FILL = "#eef4f3"
TILE_STROKE = "#cfe0dc"

# type scale
FS_TITLE = 58
FS_SUBTITLE = 29
FS_SOURCE_LABEL = 22
FS_SOURCE = 22
FS_STAGE = 34
FS_STAGE_SUB = 30
FS_CAPTION = 28
FS_TILE_NUM = 68
FS_TILE_LABEL = 34
FS_TILE_DESC = 30
FS_BAND_HEAD = 40
FS_BAND_BODY = 30
FS_FOOTER = 34

TILES = [
    ("13,892", "gene records", "curated summaries, GO, phenotypes"),
    ("20", "genomes", "browsable and downloadable"),
    ("3,330", "human orthologs", "1,502 linked to disease"),
    ("7,055", "strains, 1,265 plasmids", "orderable from the site"),
    ("6,556", "developmental movies", "recovered time-lapse screen"),
    ("~40", "API endpoints", "BLAST, enrichment, design tools"),
]

STAGES = [
    ("Amoebae", "feed on bacteria"),
    ("Aggregation", "cAMP chemotaxis"),
    ("Mound", "cell-type choice"),
    ("Slug", "photo/thermotaxis"),
    ("Fruiting body", "spores disperse"),
]


def blob(cx, cy, s=1.0):
    """A small amoeboid cell outline (used singly and in the aggregation swarm)."""
    return (
        f'<path d="M {-14.04*s+cx},{0.78*s+cy} C {-16.38*s+cx},{-7.8*s+cy} {-8.58*s+cx},{-14.04*s+cy} '
        f'{-0.78*s+cx},{-12.48*s+cy} C {6.24*s+cx},{-10.92*s+cy} {10.92*s+cx},{-16.38*s+cy} '
        f'{15.6*s+cx},{-10.14*s+cy} C {21.06*s+cx},{-4.68*s+cy} {13.26*s+cx},{0.78*s+cy} '
        f'{15.6*s+cx},{5.46*s+cy} C {17.94*s+cx},{11.7*s+cy} {7.02*s+cx},{13.26*s+cy} '
        f'{-14.04*s+cx},{0.78*s+cy} Z" fill="{CELL}" stroke="{INK}" stroke-width="1.4"/>'
    )


def amoeba_icon():
    parts = [blob(0, 0)]
    for bx, by in ((-30, 13), (26, -13), (30, 15)):
        parts.append(f'<ellipse cx="{bx}" cy="{by}" rx="3" ry="1.8" fill="{ACCENT}" opacity=".8"/>')
    return "".join(parts)


def aggregation_icon():
    swarm = [(-40, -15), (-24, -15), (-12, -12), (36, -20), (28, -10), (18, -4),
             (4, 30), (-4, 20), (-6, 11)]
    parts = [blob(x, y, 0.31) for x, y in swarm]
    parts.append(f'<circle cx="0" cy="0" r="9" fill="{CELL_DARK}" stroke="{INK}" stroke-width="1.4"/>')
    return "".join(parts)


def mound_icon():
    return (
        f'<path d="M -29,17 A 29,25 0 0 1 29,17 Z" fill="{CELL}" stroke="{INK}" stroke-width="1.5"/>'
        f'<line x1="-34" y1="17" x2="34" y2="17" stroke="{INK}" stroke-width="1.5"/>'
    )


def slug_icon():
    return (
        f'<path d="M -39,4 C -39,-10 -17,-13 4,-13 C 27,-13 41,-7 41,3 C 41,10 19,13 -6,13 '
        f'C -25,13 -39,11 -39,4 Z" fill="{CELL}" stroke="{INK}" stroke-width="1.5"/>'
        f'<path d="M 12,-12.6 C 29,-12 41,-7 41,3 C 41,8 29,11.6 12,12.6 Z" fill="{CELL_DARK}" opacity=".9"/>'
    )


def fruiting_icon():
    return (
        f'<ellipse cx="0" cy="29" rx="21" ry="4" fill="{INK}"/>'
        f'<polygon points="-4,27 4,27 2.6,-8 -2.6,-8" fill="{CELL}" stroke="{INK}" stroke-width="1.3"/>'
        f'<circle cx="0" cy="-19" r="15" fill="{GOLD}" stroke="#d9a92a" stroke-width="1.6"/>'
    )


ICONS = [amoeba_icon, aggregation_icon, mound_icon, slug_icon, fruiting_icon]


def build_svg():
    p = []
    p.append(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" '
        f"font-family=\"'Helvetica Neue',Helvetica,Arial,sans-serif\" role=\"img\" aria-labelledby=\"gt gd\">"
    )
    p.append('<title id="gt">dictyBase 2026 graphical abstract</title>')
    p.append(
        '<desc id="gd">A reimplementation of the Dictyostelium model organism database. '
        'The life cycle runs across the top; the resource holds 13,892 gene records, 20 genomes, '
        '3,330 human orthologs, the Dicty Stock Center catalogue, 6,556 developmental movies, and '
        'analysis tools. The whole system runs as one self-contained service over static data files, '
        'on one modest virtual machine maintained by one part-time person.</desc>'
    )
    p.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
    p.append(
        f'<defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" '
        f'orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="{INK}"/></marker></defs>'
    )

    # header
    p.append(
        f'<text x="{MARGIN}" y="74" font-size="{FS_TITLE}" font-weight="700" fill="{INK}">dictyBase 2026</text>'
    )
    p.append(
        f'<text x="{MARGIN}" y="120" font-size="{FS_SUBTITLE}" fill="{MUTED}">A reimplementation of the '
        f'<tspan font-style="italic">Dictyostelium</tspan> model organism database</text>'
    )
    p.append(
        f'<text x="{W - MARGIN}" y="52" text-anchor="end" font-size="{FS_SOURCE_LABEL}" font-weight="700" '
        f'fill="{ACCENT}" letter-spacing="0.5">BUILT FROM COMMUNITY DATA SOURCES</text>'
    )
    p.append(
        f'<text x="{W - MARGIN}" y="88" text-anchor="end" font-size="{FS_SOURCE}" fill="{MUTED}">'
        f'Gene Ontology · NCBI · UniProt · InterPro · KEGG · OMA</text>'
    )
    p.append(
        f'<text x="{W - MARGIN}" y="118" text-anchor="end" font-size="{FS_SOURCE}" fill="{MUTED}">'
        f'InParanoid · HPO · AlphaFold · legacy dictyBase · Dicty Stock Center</text>'
    )
    p.append(
        f'<line x1="{MARGIN}" y1="{RULE_Y}" x2="{W - MARGIN}" y2="{RULE_Y}" stroke="#d7e5e0" stroke-width="2"/>'
    )

    # life-cycle strip
    for x, icon, (name, sub) in zip(STAGE_X, ICONS, STAGES):
        p.append(f'<g transform="translate({x},{ICON_Y}) scale({ICON_SCALE})">{icon()}</g>')
        p.append(
            f'<text x="{x}" y="{LABEL_Y}" text-anchor="middle" font-size="{FS_STAGE}" font-weight="700" '
            f'fill="{TEXT}">{name}</text>'
        )
        p.append(
            f'<text x="{x}" y="{SUBLABEL_Y}" text-anchor="middle" font-size="{FS_STAGE_SUB}" '
            f'fill="{MUTED}">{sub}</text>'
        )
    for x1, x2 in zip(STAGE_X, STAGE_X[1:]):
        p.append(
            f'<line x1="{x1 + ARROW_CLEAR}" y1="{ICON_Y}" x2="{x2 - ARROW_CLEAR}" y2="{ICON_Y}" '
            f'stroke="{INK}" stroke-width="2.6" marker-end="url(#ar)" opacity=".75"/>'
        )
    p.append(
        f'<path d="M {STAGE_X[-1]},{ICON_Y - ARC_LIFT} C 1280,{ICON_Y - ARC_LIFT - 90} '
        f'500,{ICON_Y - ARC_LIFT - 90} {STAGE_X[0]},{ICON_Y - ARC_LIFT}" fill="none" stroke="{INK}" '
        f'stroke-width="2.6" marker-end="url(#ar)" opacity=".5"/>'
    )
    p.append(
        f'<text x="{W / 2}" y="{CAPTION_Y}" text-anchor="middle" font-size="{FS_CAPTION}" '
        f'font-style="italic" fill="{MUTED}">starvation triggers a 24-hour developmental program; '
        f'spores germinate and the cycle repeats</text>'
    )

    # stat tiles, 3 across by 2 down so the labels have room to be legible
    for i, (num, label, desc) in enumerate(TILES):
        col, row = i % TILE_COLS, i // TILE_COLS
        x = MARGIN + col * (TILE_W + TILE_GAP)
        y = TILE_Y + row * (TILE_H + TILE_GAP)
        cx = x + TILE_W / 2
        p.append(
            f'<rect x="{x}" y="{y}" width="{TILE_W}" height="{TILE_H}" rx="14" '
            f'fill="{TILE_FILL}" stroke="{TILE_STROKE}" stroke-width="1.5"/>'
        )
        p.append(
            f'<text x="{cx}" y="{y + 82}" text-anchor="middle" font-size="{FS_TILE_NUM}" '
            f'font-weight="700" fill="{INK}">{num}</text>'
        )
        p.append(
            f'<text x="{cx}" y="{y + 130}" text-anchor="middle" font-size="{FS_TILE_LABEL}" '
            f'font-weight="700" fill="{TEXT}">{label}</text>'
        )
        p.append(
            f'<text x="{cx}" y="{y + 174}" text-anchor="middle" font-size="{FS_TILE_DESC}" '
            f'fill="{MUTED}">{desc}</text>'
        )

    # dark summary band
    p.append(
        f'<rect x="{MARGIN}" y="{BAND_Y}" width="{CONTENT_W}" height="{BAND_H}" rx="16" fill="{INK}"/>'
    )
    p.append(
        f'<text x="{W / 2}" y="{BAND_Y + 80}" text-anchor="middle" font-size="{FS_BAND_HEAD}" '
        f'font-weight="700" fill="#ffffff">One self-contained service over static, reproducibly '
        f'built data files</text>'
    )
    p.append(
        f'<text x="{W / 2}" y="{BAND_Y + 132}" text-anchor="middle" font-size="{FS_BAND_BODY}" '
        f'fill="#bcd8d3">No database server. No distributed services.</text>'
    )
    p.append(
        f'<text x="{W / 2}" y="{BAND_Y + 180}" text-anchor="middle" font-size="{FS_BAND_BODY}" '
        f'font-weight="700" fill="{GOLD}">One modest virtual machine, maintained by one '
        f'part-time person.</text>'
    )

    # footer, kept tight under the band
    p.append(
        f'<text x="{W / 2}" y="{FOOTER_Y}" text-anchor="middle" font-size="{FS_FOOTER}" fill="{TEXT}">'
        f'Freely available without registration at '
        f'<tspan font-weight="700" fill="{INK}">{SITE_URL}</tspan></text>'
    )
    p.append("</svg>")
    return "\n".join(p)


CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def render_png(svg_path, png_path):
    subprocess.run(
        [
            CHROME, "--headless=new", f"--screenshot={png_path}",
            f"--window-size={W},{H}", f"--force-device-scale-factor={SCALE}",
            "--default-background-color=FFFFFFFF", "--hide-scrollbars",
            f"file://{os.path.abspath(svg_path)}",
        ],
        check=True, capture_output=True,
    )


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(os.path.dirname(__file__), "..", "docs"))
    args = ap.parse_args()
    out = os.path.abspath(args.out)
    svg_path = os.path.join(out, "graphical-abstract.svg")
    png_path = os.path.join(out, "graphical-abstract.png")
    with open(svg_path, "w") as f:
        f.write(build_svg())
    render_png(svg_path, png_path)
    print(f"wrote {svg_path}")
    print(f"wrote {png_path}")


if __name__ == "__main__":
    main()
