#!/usr/bin/env python3
"""Validate the AI-curation GO suggestions against the independent, curated GO
annotations already in dictyBase.

The AI curation layer (assets/ai_curation.json) proposes GO terms per gene. We
never trained or tuned it on dictyBase's curated GO, so the curated GO
annotations (assets/go_annotations.json) are an independent reference we can
score the suggestions against, with no human re-labeling.

Two passes:

1. Exact GO-id match (always runs, no external data).
     precision = fraction of AI-suggested GO terms that exactly match a curated
                 annotation on the same gene
     recall    = fraction of curated GO terms the AI recovered

   Exact match is a LOWER BOUND on agreement: a suggestion that is a parent or
   child of a curated term (e.g. "lysosome" vs its parent "lytic vacuole")
   scores as a miss.

2. Ontology-aware pass (runs only with --obo / a cached go-basic.obo). Using the
   GO is_a/part_of DAG, each suggested term is classified against the gene's
   curated terms in the same aspect:
       exact          identical GO id
       more_general   a proper ancestor of a curated term (AI broader)
       more_specific  a proper descendant of a curated term (AI narrower)
       sibling        shares a parent-level ancestor (LCA node distance <= 2)
       near           shares a nearby ancestor (distance 3-4)
       distant        a different part of the ontology (> 4), or no curated term
                      in that aspect to compare against
   This answers "are the non-exact suggestions wrong, or just at a different
   granularity?": exact + more_general + more_specific are the same lineage as
   expert annotation. "distant" is an upper bound on possible error, since the
   curated set is itself incomplete (an off-branch suggestion may be a real,
   simply-unannotated function).

Entries are split by the AI layer's own confidence tier:
   core    - hand-authored/checked entries (no `basis` field)
   family  - domain/family-level automatic predictions (basis == "family")

Run:
   python3 scripts/validate_ai_go.py
   python3 scripts/validate_ai_go.py --obo /path/to/go-basic.obo
"""
import argparse
import functools
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")

# Evidence codes denoting experimental / author-stated support (all but IEA).
EXPERIMENTAL = {"IDA", "IMP", "IGI", "IPI", "IEP", "IGC", "IBA", "EXP", "ISS",
                "ISO", "ISA", "ISM", "TAS", "NAS", "IC", "RCA"}

# go-basic.obo is not bundled (it is large and rebuilt server-side). Look in a
# few likely spots; otherwise the ontology pass is skipped with a hint.
OBO_GUESSES = [
    os.path.join(ROOT, "assets", "go-basic.obo"),
    os.path.join(ROOT, os.pardir, "mod-platform", "annotate", "data", "go-basic.obo"),
]


def load(name):
    with open(os.path.join(A, name)) as fh:
        return json.load(fh)


def symbol_to_ddb(gene_index):
    m = {}
    for row in gene_index:
        ddb, symbol, synonyms = row[0], row[1], (row[5] or [])
        if symbol:
            m.setdefault(symbol.lower(), ddb)
        for syn in synonyms:
            m.setdefault(syn.lower(), ddb)
    return m


# ---------------------------------------------------------------- exact pass
def exact_pass(ai, go, sym2ddb):
    cur_all, cur_exp = {}, {}
    for ddb, anns in go.items():
        if ddb.startswith("_"):
            continue
        cur_all[ddb] = {r[0] for r in anns}
        cur_exp[ddb] = {r[0] for r in anns if len(r) > 2 and r[2] in EXPERIMENTAL}

    ai_go = {}
    n_with_go = 0
    tiers = {"core": 0, "family": 0}
    for sym, v in ai.items():
        if sym == "_meta" or not isinstance(v, dict):
            continue
        terms = {x[0] for x in (v.get("go") or [])}
        tier = "family" if v.get("basis") == "family" else "core"
        tiers[tier] += 1
        if terms:
            n_with_go += 1
            ddb = sym2ddb.get(sym.lower())
            if ddb:
                ai_go[ddb] = (tier, terms)

    def score(reference, tier=None):
        tp = ai_tot = cur_tot = genes = genes_hit = 0
        for ddb, (t, terms) in ai_go.items():
            if tier and t != tier:
                continue
            ref = reference.get(ddb)
            if not ref:
                continue
            genes += 1
            inter = len(terms & ref)
            tp += inter
            ai_tot += len(terms)
            cur_tot += len(ref)
            if inter:
                genes_hit += 1
        return dict(genes=genes, genes_hit=genes_hit, tp=tp, ai_tot=ai_tot, cur_tot=cur_tot)

    def line(label, s):
        if not s["ai_tot"]:
            print(f"{label}: no overlap")
            return
        p = s["tp"] / s["ai_tot"] * 100
        r = s["tp"] / s["cur_tot"] * 100 if s["cur_tot"] else 0.0
        gh = s["genes_hit"] / s["genes"] * 100 if s["genes"] else 0.0
        print(f"{label}:")
        print(f"    genes compared         {s['genes']}")
        print(f"    AI terms / curated      {s['ai_tot']} / {s['cur_tot']}")
        print(f"    exact-match precision   {p:5.1f}%   (AI terms confirmed by a curated annotation)")
        print(f"    recall of curated       {r:5.1f}%")
        print(f"    genes with >=1 match    {s['genes_hit']}/{s['genes']} = {gh:.1f}%")

    print("=" * 72)
    print("EXACT GO-id match (a conservative lower bound)\n")
    print("Coverage")
    print(f"    AI entries                {tiers['core'] + tiers['family']} "
          f"(core {tiers['core']}, family {tiers['family']})")
    print(f"    entries with GO           {n_with_go}")
    print(f"    genes with curated GO     {len(cur_all)}\n")
    line("All AI suggestions vs any curated GO", score(cur_all))
    print()
    line("  core tier", score(cur_all, "core"))
    print()
    line("  family tier", score(cur_all, "family"))
    print()
    line("All AI suggestions vs EXPERIMENTAL curated GO only", score(cur_exp))


# ------------------------------------------------------------ ontology pass
def parse_obo(path):
    parents, aspect, alt = {}, {}, {}
    asp = {"biological_process": "P", "molecular_function": "F", "cellular_component": "C"}
    with open(path) as fh:
        text = fh.read()
    for block in text.split("\n[")[1:]:
        if not block.startswith("Term]") or re.search(r"^is_obsolete:\s*true", block, re.M):
            continue
        m = re.search(r"^id:\s*(GO:\d+)", block, re.M)
        if not m:
            continue
        gid = m.group(1)
        ns = re.search(r"^namespace:\s*(\w+)", block, re.M)
        aspect[gid] = asp.get(ns.group(1) if ns else "", "?")
        ps = set(re.findall(r"^is_a:\s*(GO:\d+)", block, re.M))
        ps |= set(re.findall(r"^relationship:\s*part_of\s+(GO:\d+)", block, re.M))
        parents[gid] = ps
        for a in re.findall(r"^alt_id:\s*(GO:\d+)", block, re.M):
            alt[a] = gid
    return parents, aspect, alt


def ontology_pass(ai, go, sym2ddb, obo_path):
    parents, aspect, alt = parse_obo(obo_path)
    norm = lambda g: alt.get(g, g)
    sys.setrecursionlimit(100000)

    @functools.lru_cache(maxsize=None)
    def ancestors(t):
        out = set()
        for p in parents.get(t, ()):
            out.add(p)
            out |= ancestors(p)
        return out

    @functools.lru_cache(maxsize=None)
    def depth(t):
        ps = parents.get(t)
        return 0 if not ps else 1 + min(depth(p) for p in ps)

    def node_distance(a, c):
        if a == c:
            return 0
        common = (ancestors(a) | {a}) & (ancestors(c) | {c})
        if not common:
            return 999
        dl = max(depth(x) for x in common)
        return (depth(a) - dl) + (depth(c) - dl)

    cur = {}
    for ddb, anns in go.items():
        if not ddb.startswith("_"):
            cur[ddb] = {norm(r[0]) for r in anns}

    def classify(a, C):
        a = norm(a)
        asp = aspect.get(a)
        Cs = [c for c in C if aspect.get(c) == asp]
        if not Cs:
            return "distant"
        if a in Cs:
            return "exact"
        if any(a in ancestors(c) for c in Cs):
            return "more_general"
        if any(c in ancestors(a) for c in Cs):
            return "more_specific"
        d = min(node_distance(a, c) for c in Cs)
        return "sibling" if d <= 2 else "near" if d <= 4 else "distant"

    order = ["exact", "more_general", "more_specific", "sibling", "near", "distant"]
    tiers = {"all": lambda v: True,
             "core": lambda v: v.get("basis") is None,
             "family": lambda v: v.get("basis") == "family"}

    print("\n" + "=" * 72)
    print("ONTOLOGY-AWARE classification of each suggestion vs the gene's curated")
    print("terms, using the GO is_a/part_of DAG  (obo: %s)\n" % os.path.relpath(obo_path, ROOT))
    for tier, keep in tiers.items():
        counts = {k: 0 for k in order}
        total = genes = 0
        for sym, v in ai.items():
            if sym == "_meta" or not isinstance(v, dict) or not keep(v):
                continue
            terms = [x[0] for x in (v.get("go") or [])]
            ddb = sym2ddb.get(sym.lower())
            if not (ddb and terms and cur.get(ddb)):
                continue
            genes += 1
            C = cur[ddb]
            for t in terms:
                counts[classify(t, C)] += 1
                total += 1
        if not total:
            continue
        lineage = counts["exact"] + counts["more_general"] + counts["more_specific"]
        nonexact = total - counts["exact"]
        print(f"{tier.upper()} tier: {genes} genes, {total} AI terms")
        for k in order:
            print(f"    {k:13s} {counts[k]:5d}  {counts[k] / total * 100:5.1f}%")
        print(f"    identical or same-lineage (parent/child): {lineage / total * 100:.1f}% of all terms")
        if nonexact:
            hc = counts["more_general"] + counts["more_specific"] + counts["sibling"]
            print(f"    of the {nonexact} non-exact: {hc / nonexact * 100:.1f}% parent/child/sibling, "
                  f"{counts['near'] / nonexact * 100:.1f}% cousin, {counts['distant'] / nonexact * 100:.1f}% distant")
        print()


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--obo", help="path to go-basic.obo for the ontology-aware pass")
    args = ap.parse_args()

    ai = load("ai_curation.json")
    go = load("go_annotations.json")
    sym2ddb = symbol_to_ddb(load("gene_index.json"))

    exact_pass(ai, go, sym2ddb)

    obo = args.obo or next((p for p in OBO_GUESSES if os.path.exists(p)), None)
    if obo and os.path.exists(obo):
        ontology_pass(ai, go, sym2ddb, obo)
    else:
        print("\n(ontology-aware pass skipped: no go-basic.obo found. Pass --obo PATH,")
        print(" or build one with scripts/build_go_terms.py, to classify the non-exact")
        print(" suggestions as parent/child/sibling/distant.)")


if __name__ == "__main__":
    main()
