"""Bench/molecular-biology tools for Dicty@Duke (pure, stdlib-only, testable).

- codon_optimize: codon-optimize a protein/DNA for Dictyostelium expression and
  score a coding DNA's CAI, using the AT-rich Dicty codon table
  (assets/dicty_codon_usage.json, built by scripts/build_codon_usage.py).
- crispr_guides: SpCas9 (NGG) guide-RNA candidates in a CDS, with on-target
  scoring (GC, poly-T Pol III terminator, position). Genome off-target counting
  is layered on in serve.py via a single blastn-short pass.
- design_primers: qPCR primer pairs over a cDNA (Dicty-aware Tm/GC).

Used by serve.py's /api/codon-optimize, /api/crispr, /api/primers.
"""
import json
import math
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
ASSETS = ROOT / "assets"
COMP = str.maketrans("ACGTacgt", "TGCAtgca")

GENETIC_CODE = {
    "TTT": "F", "TTC": "F", "TTA": "L", "TTG": "L", "CTT": "L", "CTC": "L",
    "CTA": "L", "CTG": "L", "ATT": "I", "ATC": "I", "ATA": "I", "ATG": "M",
    "GTT": "V", "GTC": "V", "GTA": "V", "GTG": "V", "TCT": "S", "TCC": "S",
    "TCA": "S", "TCG": "S", "AGT": "S", "AGC": "S", "CCT": "P", "CCC": "P",
    "CCA": "P", "CCG": "P", "ACT": "T", "ACC": "T", "ACA": "T", "ACG": "T",
    "GCT": "A", "GCC": "A", "GCA": "A", "GCG": "A", "TAT": "Y", "TAC": "Y",
    "TAA": "*", "TAG": "*", "TGA": "*", "CAT": "H", "CAC": "H", "CAA": "Q",
    "CAG": "Q", "AAT": "N", "AAC": "N", "AAA": "K", "AAG": "K", "GAT": "D",
    "GAC": "D", "GAA": "E", "GAG": "E", "TGT": "C", "TGC": "C", "TGG": "W",
    "CGT": "R", "CGC": "R", "CGA": "R", "CGG": "R", "AGA": "R", "AGG": "R",
    "GGT": "G", "GGC": "G", "GGA": "G", "GGG": "G",
}
_codon_cache = None


def revcomp(s):
    return s.translate(COMP)[::-1]


def _clean(seq, alphabet="ACGTN"):
    return "".join(c for c in (seq or "").upper() if c in alphabet)


def _codon_tables():
    global _codon_cache
    if _codon_cache is None:
        _codon_cache = json.loads((ASSETS / "dicty_codon_usage.json").read_text())
    return _codon_cache


def translate(dna):
    dna = _clean(dna)
    return "".join(GENETIC_CODE.get(dna[i:i + 3], "X") for i in range(0, len(dna) - 2, 3))


def gc_frac(s):
    return (s.count("G") + s.count("C")) / len(s) if s else 0.0


def codon_optimize(seq):
    """Optimize a protein or DNA sequence for Dicty; also report input CAI if DNA."""
    raw = re.sub(r"\s|>.*", "", seq or "").upper()
    tables = _codon_tables()
    pref, w = tables["preferred"], tables["relative_adaptiveness"]
    is_dna = raw != "" and set(raw) <= set("ACGTUN")
    input_cai = None
    if is_dna:
        dna = raw.replace("U", "T")
        protein = translate(dna).rstrip("*")
        # CAI of the input coding sequence
        ws = [w[dna[i:i + 3]] for i in range(0, len(dna) - 2, 3)
              if dna[i:i + 3] in w and GENETIC_CODE.get(dna[i:i + 3]) not in (None, "*")
              and w[dna[i:i + 3]] > 0]
        input_cai = round(math.exp(sum(math.log(x) for x in ws) / len(ws)), 3) if ws else None
    else:
        protein = re.sub(r"[^A-Z]", "", raw).rstrip("*")
    opt = "".join(pref[aa] for aa in protein if aa in pref)
    return {
        "protein": protein,
        "optimized_dna": opt,
        "length_aa": len([a for a in protein if a in pref]),
        "optimized_gc": round(gc_frac(opt), 3),
        "input_was_dna": is_dna,
        "input_cai": input_cai,
    }


def crispr_guides(cds, max_guides=25):
    """SpCas9 NGG guides in a CDS with on-target heuristic scoring."""
    cds = _clean(cds, "ACGT")
    n = len(cds)
    found = []
    # forward-strand PAMs: protospacer is the 20 nt 5' of an NGG
    for m in re.finditer(r"(?=[ACGT]GG)", cds):
        i = m.start()
        if i >= 20:
            found.append((cds[i - 20:i], cds[i:i + 3], i - 20, "+"))
    # reverse strand: scan the reverse complement
    rc = revcomp(cds)
    for m in re.finditer(r"(?=[ACGT]GG)", rc):
        i = m.start()
        if i >= 20:
            found.append((rc[i - 20:i], rc[i:i + 3], n - i, "-"))
    out = []
    for proto, pam, pos, strand in found:
        gc = gc_frac(proto)
        poly_t = "TTTT" in proto  # U6/Pol III terminator
        score = 1.0
        if gc < 0.30 or gc > 0.80:
            score -= 0.4
        if poly_t:
            score -= 0.5
        if pos / max(1, n) > 0.6:  # favor early-CDS cuts for null alleles
            score -= 0.2
        out.append({
            "protospacer": proto, "pam": pam, "position": pos, "strand": strand,
            "gc": round(gc, 2), "poly_t": poly_t, "score": round(score, 2),
        })
    out.sort(key=lambda g: -g["score"])
    return out[:max_guides]


def _tm(p):
    """Approx melting temp: Wallace rule for short, Marmur for >=14 nt."""
    gc = p.count("G") + p.count("C")
    if len(p) >= 14:
        return round(64.9 + 41 * (gc - 16.4) / len(p), 1)
    return float(2 * (len(p) - gc) + 4 * gc)


def design_primers(cdna, product_min=90, product_max=200, n=5):
    """qPCR primer pairs over a cDNA, tuned for Dicty's AT-rich sequences."""
    s = _clean(cdna, "ACGT")
    L = len(s)
    # Dicty is very AT-rich, so primers run low-GC / low-Tm; allow longer oligos
    # and looser GC/Tm floors than a typical (GC-balanced) primer3 default.
    LENS = range(20, 31)

    def ok(p):
        g = gc_frac(p)
        return (0.28 <= g <= 0.62 and 52 <= _tm(p) <= 64
                and "AAAAA" not in p and "TTTTT" not in p)

    pairs, used = [], set()
    for f in range(0, max(0, L - product_min - 30)):
        if len(pairs) >= n:
            break
        fp = None
        for flen in LENS:
            cand = s[f:f + flen]
            if len(cand) == flen and ok(cand):
                fp = cand
                break
        if not fp:
            continue
        placed = False
        for prod in range(product_min, product_max + 1):
            rend = f + prod
            for rlen in LENS:
                rstart = rend - rlen
                if rstart <= f + len(fp) or rend > L:
                    continue
                rp = revcomp(s[rstart:rend])
                if ok(rp) and abs(_tm(fp) - _tm(rp)) <= 3:
                    key = (fp, rp)
                    if key in used:
                        continue
                    used.add(key)
                    pairs.append({
                        "forward": fp, "reverse": rp, "product": prod,
                        "fwd_tm": _tm(fp), "rev_tm": _tm(rp),
                        "fwd_pos": f + 1, "rev_pos": rend,
                    })
                    placed = True
                    break
            if placed:
                break
    return pairs[:n]
