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
_codon_caches = {}

# Codon-usage tables the optimizer can target. Dicty is computed from the AX4
# CDS (build_codon_usage.py); the heterologous hosts come from published
# genome-wide usage (build_codon_tables.py).
CODON_FILES = {
    "dicty": "dicty_codon_usage.json",
    "ecoli": "ecoli_codon_usage.json",
    "human": "human_codon_usage.json",
}


def revcomp(s):
    return s.translate(COMP)[::-1]


def _clean(seq, alphabet="ACGTN"):
    return "".join(c for c in (seq or "").upper() if c in alphabet)


def _codon_tables(organism="dicty"):
    organism = organism if organism in CODON_FILES else "dicty"
    if organism not in _codon_caches:
        _codon_caches[organism] = json.loads((ASSETS / CODON_FILES[organism]).read_text())
    return _codon_caches[organism]


def translate(dna):
    dna = _clean(dna)
    return "".join(GENETIC_CODE.get(dna[i:i + 3], "X") for i in range(0, len(dna) - 2, 3))


def gc_frac(s):
    return (s.count("G") + s.count("C")) / len(s) if s else 0.0


def codon_optimize(seq, organism="dicty"):
    """Optimize a protein/DNA sequence for a target host's codon usage.

    organism is one of CODON_FILES (dicty | ecoli | human). Input CAI, when the
    input is DNA, is scored against the chosen target host.
    """
    raw = re.sub(r"\s|>.*", "", seq or "").upper()
    organism = organism if organism in CODON_FILES else "dicty"
    tables = _codon_tables(organism)
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
        "organism": organism,
    }


# Common cloning restriction enzymes: name -> recognition site (5'->3'). All
# listed sites are palindromic (the usual 6/8-cutters), but the scan also checks
# the reverse complement so a non-palindromic addition would still work.
RESTRICTION_ENZYMES = {
    "EcoRI": "GAATTC", "BamHI": "GGATCC", "HindIII": "AAGCTT", "XhoI": "CTCGAG",
    "XbaI": "TCTAGA", "NotI": "GCGGCCGC", "NcoI": "CCATGG", "NdeI": "CATATG",
    "SalI": "GTCGAC", "SpeI": "ACTAGT", "KpnI": "GGTACC", "SacI": "GAGCTC",
    "PstI": "CTGCAG", "SmaI": "CCCGGG", "BglII": "AGATCT", "ClaI": "ATCGAT",
    "EcoRV": "GATATC", "HpaI": "GTTAAC", "NheI": "GCTAGC", "AscI": "GGCGCGCC",
    "AflII": "CTTAAG", "DraI": "TTTAAA", "SspI": "AATATT", "MfeI": "CAATTG",
}


def _find_all(s, sub):
    pos, start = [], 0
    while True:
        i = s.find(sub, start)
        if i < 0:
            break
        pos.append(i + 1)   # 1-based
        start = i + 1
    return pos


def restriction_sites(seq):
    """Recognition sites for common cloning enzymes in a DNA sequence. Enzymes
    that DON'T cut are reported too (count 0) since a non-cutter is what you want
    for a cloning site — Dicty's AT-rich sequence makes GC-rich sites rare."""
    s = _clean(seq, "ACGT")
    out = []
    for name, site in RESTRICTION_ENZYMES.items():
        positions = _find_all(s, site)
        rc = revcomp(site)
        if rc != site:
            positions = sorted(positions + _find_all(s, rc))
        out.append({"enzyme": name, "site": site, "count": len(positions),
                    "positions": positions[:50]})
    out.sort(key=lambda e: (e["count"], e["enzyme"]))
    return {"length": len(s), "enzymes": out}


def find_orfs(seq, min_aa=30, top=20):
    """ORFs (ATG..stop) across all six reading frames of a DNA sequence. Returns
    the longest, each with strand, frame, 1-based span, lengths, and the
    translated protein. (For a raw 6-frame translation, read the proteins.)"""
    s = _clean(seq, "ACGT")
    n = len(s)
    orfs = []
    for strand, d in (("+", s), ("-", revcomp(s))):
        for frame in range(3):
            i = frame
            while i < len(d) - 2:
                if d[i:i + 3] == "ATG":
                    prot, j = [], i
                    while j < len(d) - 2:
                        aa = GENETIC_CODE.get(d[j:j + 3], "X")
                        if aa == "*":
                            break
                        prot.append(aa)
                        j += 3
                    has_stop = j < len(d) - 2
                    if has_stop and len(prot) >= min_aa:
                        if strand == "+":
                            start, end = i + 1, j + 3
                        else:
                            start, end = n - (j + 3) + 1, n - i
                        orfs.append({
                            "strand": strand, "frame": frame + 1,
                            "start": start, "end": end,
                            "length_nt": (j + 3) - i, "length_aa": len(prot),
                            "protein": "".join(prot),
                        })
                        i = j + 3
                        continue
                i += 3
    orfs.sort(key=lambda o: -o["length_aa"])
    return {"length": n, "orf_count": len(orfs), "orfs": orfs[:top]}


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


# --- Protein physicochemical properties (length, MW, pI, GRAVY) ---
# Average residue masses (Da, water already removed for the peptide bond).
_RESIDUE_MASS = {
    "A": 71.0788, "R": 156.1875, "N": 114.1038, "D": 115.0886, "C": 103.1388,
    "E": 129.1155, "Q": 128.1307, "G": 57.0519, "H": 137.1411, "I": 113.1594,
    "L": 113.1594, "K": 128.1741, "M": 131.1926, "F": 147.1766, "P": 97.1167,
    "S": 87.0782, "T": 101.1051, "W": 186.2132, "Y": 163.1760, "V": 99.1326,
}
# Kyte-Doolittle hydropathy.
_KD = {
    "A": 1.8, "R": -4.5, "N": -3.5, "D": -3.5, "C": 2.5, "E": -3.5, "Q": -3.5,
    "G": -0.4, "H": -3.2, "I": 4.5, "L": 3.8, "K": -3.9, "M": 1.9, "F": 2.8,
    "P": -1.6, "S": -0.8, "T": -0.7, "W": -0.9, "Y": -1.3, "V": 4.2,
}
# pKa values for the ionizable groups (EMBOSS-style set).
_PK_POS = {"Nterm": 9.69, "K": 10.53, "R": 12.48, "H": 6.0}
_PK_NEG = {"Cterm": 2.34, "D": 3.65, "E": 4.25, "C": 8.33, "Y": 10.07}


def _net_charge(counts, ph):
    pos = 0.0
    for grp, pk in _PK_POS.items():
        pos += counts.get(grp, 0) / (1.0 + 10 ** (ph - pk))
    neg = 0.0
    for grp, pk in _PK_NEG.items():
        neg += counts.get(grp, 0) / (1.0 + 10 ** (pk - ph))
    return pos - neg


def _isoelectric_point(counts):
    lo, hi = 0.0, 14.0
    for _ in range(100):
        mid = (lo + hi) / 2
        if _net_charge(counts, mid) > 0:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def protein_props(seq):
    """length, molecular weight, isoelectric point, and GRAVY hydropathy of a
    protein sequence. Non-standard letters (X/B/Z/U, gaps) are ignored."""
    aa = [c for c in re.sub(r"[^A-Za-z]", "", (seq or "").upper()) if c in _RESIDUE_MASS]
    n = len(aa)
    if n == 0:
        return {"error": "no standard protein residues"}
    mw = sum(_RESIDUE_MASS[c] for c in aa) + 18.01524
    gravy = sum(_KD[c] for c in aa) / n
    counts = {"Nterm": 1, "Cterm": 1}
    for c in ("K", "R", "H", "D", "E", "C", "Y"):
        counts[c] = aa.count(c)
    return {"length": n, "mw": round(mw, 1), "mw_kda": round(mw / 1000.0, 1),
            "pi": round(_isoelectric_point(counts), 2), "gravy": round(gravy, 3)}
