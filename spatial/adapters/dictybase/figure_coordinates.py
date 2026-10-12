"""Recover per-protein map positions from the authors' t-SNE figure (a vector
PDF written by R), and measure how far that recovery can be trusted.

The figure holds no protein names. It draws every protein once as a grey
circle, then draws classified proteins again in colour. The recovery rests on
one assumption, which is tested rather than taken on faith: the grey circles
are in the same row order as the authors' abundance matrix.

Positions recovered this way are a reconstruction from a drawing. They are not
the authors' original numbers.
"""
import collections
import re
import zlib

GREY = (0.859, 0.855, 0.855)


def content_stream(pdf_bytes):
    """The page's drawing commands as text (the first stream that inflates to them)."""
    for m in re.finditer(rb"stream\s*\n(.*?)endstream", pdf_bytes, re.S):
        for cand in (m.group(1), m.group(1).rstrip(b"\r\n")):
            try:
                text = zlib.decompress(cand).decode("latin-1")
            except zlib.error:
                continue
            if " re W n" in text or " scn" in text:
                return text
    raise ValueError("no drawing stream found in the PDF")


def parse(text):
    """-> (points, ticks). points: [(x, y, fill rgb)] in drawing order, in PDF
    units. ticks: {"x": [...], "y": [...]} tick positions and {"labels": [...]}."""
    points, fill, start = [], None, None
    xt, yt, labels = [], [], []
    for line in text.split("\n"):
        m = re.match(r"\s*([\d.]+) ([\d.]+) ([\d.]+) scn$", line)
        if m:
            fill = tuple(float(v) for v in m.groups())
            continue
        m = re.match(r"\s+([\d.]+) ([\d.]+) m$", line)
        if m:
            start = (float(m.group(1)), float(m.group(2)))
            continue
        m = re.match(r"\s+[\d.]+ [\d.]+ [\d.]+ [\d.]+ ([\d.]+) ([\d.]+) c$", line)
        if m and start is not None:
            # an R circle starts at its leftmost point; the first arc ends at the top
            points.append((float(m.group(1)), start[1], fill))
            start = None
            continue
        m = re.match(r"([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l\s+S$", line)
        if m:
            x1, y1, x2, y2 = (float(v) for v in m.groups())
            if x1 == x2 and abs(y1 - y2) < 10:
                xt.append(x1)
            elif y1 == y2 and abs(x1 - x2) < 10:
                yt.append(y1)
            continue
        m = re.search(r"\(([^)]*)\) Tj$", line)
        if m:
            labels.append(m.group(1))
    return points, {"x": sorted(xt), "y": sorted(yt), "labels": labels}


def calibrate(ticks):
    """Linear PDF-unit -> data-unit maps for both axes, from the tick marks and
    their numeric labels. Returns ((ax, bx), (ay, by), worst residual in data units)."""
    numbers = []
    for s in ticks["labels"]:
        try:
            numbers.append(float(s))
        except ValueError:
            pass
    nx, ny = len(ticks["x"]), len(ticks["y"])
    if nx < 2 or ny < 2 or len(numbers) != nx + ny:
        raise ValueError("could not read the axis ticks")
    out, worst = [], 0.0
    for pos, vals in ((ticks["x"], numbers[:nx]), (ticks["y"], numbers[nx:])):
        vals = sorted(vals)
        a = (vals[-1] - vals[0]) / (pos[-1] - pos[0])
        b = vals[0] - a * pos[0]
        worst = max(worst, max(abs(a * p + b - v) for p, v in zip(pos, vals)))
        out.append((a, b))
    return out[0], out[1], worst


def recover(pdf_bytes, row_ids, decimals=3):
    """-> (coordinates {row id: [x, y]}, overlay groups, facts).

    row_ids is the authors' matrix row order. overlay groups maps each colour
    to the row ids drawn again in that colour."""
    points, ticks = parse(content_stream(pdf_bytes))
    (ax, bx), (ay, by), residual = calibrate(ticks)
    n = len(row_ids)
    base, overlay = points[:n], points[n:]
    if len(base) != n or any(p[2] != GREY for p in base):
        raise ValueError(f"expected {n} grey base points, found {sum(p[2] == GREY for p in points)} grey of {len(points)}")
    coords = {rid: [round(ax * p[0] + bx, decimals), round(ay * p[1] + by, decimals)] for rid, p in zip(row_ids, base)}
    where = collections.defaultdict(list)
    for i, p in enumerate(base):
        where[(p[0], p[1])].append(i)
    groups, unmatched, ambiguous = collections.OrderedDict(), 0, 0
    for p in overlay:
        hit = where.get((p[0], p[1]))
        if not hit:
            unmatched += 1
            continue
        if len(hit) > 1:
            ambiguous += 1
            continue
        groups.setdefault("#%02x%02x%02x" % tuple(int(round(c * 255)) for c in p[2]), []).append(row_ids[hit[0]])
    shared = [[row_ids[i] for i in v] for v in where.values() if len(v) > 1]
    facts = {
        "points_in_figure": len(points), "base_points": len(base), "overlay_points": len(overlay),
        "overlay_points_matched_to_one_base_point": sum(len(v) for v in groups.values()),
        "overlay_points_unmatched": unmatched, "overlay_points_ambiguous": ambiguous,
        "distinct_positions": len(where), "positions_shared_by_several_rows": shared,
        "axis_calibration_worst_residual": round(residual, 4),
        "position_resolution": round(abs(ax) * 0.01, 4),
        "x_range": [round(min(c[0] for c in coords.values()), 2), round(max(c[0] for c in coords.values()), 2)],
        "y_range": [round(min(c[1] for c in coords.values()), 2), round(max(c[1] for c in coords.values()), 2)],
    }
    return coords, groups, facts
