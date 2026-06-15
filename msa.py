#!/usr/bin/env python3
"""Lightweight multiple sequence alignment (pure stdlib).

A center-star MSA: pick the longest sequence as the center, globally align every
other sequence to it (Needleman-Wunsch, linear gap), then merge the pairwise
alignments into one MSA by the "once a gap, always a gap" rule. Quality is below
MAFFT/MUSCLE for many divergent sequences, but it's perfectly serviceable for
visualizing a gene's orthologs / paralogs / wild-isolate variants (small sets of
similar sequences) — and needs no external binary, so it deploys anywhere the
stdlib server runs. See serve.py /api/align.

Bounds (to keep it fast): up to MAX_SEQS sequences, each truncated to MAX_LEN.
"""

MAX_SEQS = 30
MAX_LEN = 2000

MATCH = 2
MISMATCH = -1
GAP = -3


def _needleman_wunsch(a, b):
    """Global alignment of strings a, b. Returns (aligned_a, aligned_b)."""
    n, m = len(a), len(b)
    # Score matrix row by row with a traceback matrix (0=diag,1=up(gap in b),2=left(gap in a)).
    prev = [j * GAP for j in range(m + 1)]
    tb = [bytearray(m + 1) for _ in range(n + 1)]
    for j in range(1, m + 1):
        tb[0][j] = 2
    for i in range(1, n + 1):
        tb[i][0] = 1
    ai_prev = None
    for i in range(1, n + 1):
        cur = [0] * (m + 1)
        cur[0] = i * GAP
        ai = a[i - 1]
        row_tb = tb[i]
        for j in range(1, m + 1):
            diag = prev[j - 1] + (MATCH if ai == b[j - 1] else MISMATCH)
            up = prev[j] + GAP
            left = cur[j - 1] + GAP
            best = diag
            d = 0
            if up > best:
                best = up
                d = 1
            if left > best:
                best = left
                d = 2
            cur[j] = best
            row_tb[j] = d
        prev = cur
    # traceback
    i, j = n, m
    oa, ob = [], []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and tb[i][j] == 0:
            oa.append(a[i - 1]); ob.append(b[j - 1]); i -= 1; j -= 1
        elif i > 0 and tb[i][j] == 1:
            oa.append(a[i - 1]); ob.append("-"); i -= 1
        else:
            oa.append("-"); ob.append(b[j - 1]); j -= 1
    return "".join(reversed(oa)), "".join(reversed(ob))


def align(seqs):
    """seqs: list of strings. Returns a list of equal-length gapped strings,
    in the same order. Empty input -> []."""
    seqs = [(s or "").upper().replace("\n", "").replace(" ", "")[:MAX_LEN] for s in seqs][:MAX_SEQS]
    seqs = [s for s in seqs if s]
    n = len(seqs)
    if n == 0:
        return []
    if n == 1:
        return [seqs[0]]
    center = max(range(n), key=lambda i: len(seqs[i]))
    c = seqs[center]
    L = len(c)
    # pair[i] = (center_aligned, seq_i_aligned)
    pairs = [(c, c) if i == center else _needleman_wunsch(c, seqs[i]) for i in range(n)]
    # Per alignment: seg[p] = chars inserted before center residue p (p in 0..L),
    # match[p] = char aligned to center residue p (p in 0..L-1).
    segs, matches = [], []
    for ca, sa in pairs:
        seg = [[] for _ in range(L + 1)]
        match = ["-"] * L
        p = 0
        for cc, sc in zip(ca, sa):
            if cc == "-":
                seg[p].append(sc)
            else:
                if p < L:
                    match[p] = sc
                p += 1
        segs.append(seg)
        matches.append(match)
    # Merged insertion width before each center residue (and trailing).
    G = [max(len(segs[i][p]) for i in range(n)) for p in range(L + 1)]
    out = []
    for i in range(n):
        row = []
        seg, match = segs[i], matches[i]
        for p in range(L):
            ins = "".join(seg[p])
            row.append(ins + "-" * (G[p] - len(ins)))
            row.append(match[p])
        ins = "".join(seg[L])
        row.append(ins + "-" * (G[L] - len(ins)))
        out.append("".join(row))
    return out


def consensus(aligned):
    """Majority-rule consensus across aligned rows (ties -> first; gaps count)."""
    if not aligned:
        return ""
    out = []
    for col in zip(*aligned):
        counts = {}
        for ch in col:
            counts[ch] = counts.get(ch, 0) + 1
        out.append(max(counts, key=lambda k: (counts[k], k != "-")))
    return "".join(out)


def percent_identity(aligned):
    """Mean pairwise % identity over alignment columns where both have a residue."""
    n = len(aligned)
    if n < 2:
        return 100.0
    same = tot = 0
    for col in zip(*aligned):
        res = [c for c in col if c != "-"]
        for x in range(len(res)):
            for y in range(x + 1, len(res)):
                tot += 1
                if res[x] == res[y]:
                    same += 1
    return round(100.0 * same / tot, 1) if tot else 0.0
