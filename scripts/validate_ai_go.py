#!/usr/bin/env python3
"""Validate the AI-curation GO suggestions against the independent, curated GO
annotations already in dictyBase.

The AI curation layer (assets/ai_curation.json) proposes GO terms per gene. We
never trained or tuned it on dictyBase's curated GO. So the curated GO
annotations (assets/go_annotations.json) are an independent reference we can
score the suggestions against, with no human re-labeling:

  precision = fraction of AI-suggested GO terms that exactly match a curated
              annotation on the same gene (a term the community already assigned)
  recall    = fraction of curated GO terms the AI recovered

Matching is by exact GO id. This is a LOWER BOUND on semantic agreement: an AI
suggestion that is a parent or child of a curated term (e.g. "lysosome" vs its
parent "lytic vacuole") scores as a miss, because no is-a graph is bundled.

Entries are split by the AI layer's own confidence tier:
  core    - hand-authored/checked entries (no `basis` field)
  family  - domain/family-level automatic predictions (basis == "family"),
            explicitly the weaker tier

Run:  python3 scripts/validate_ai_go.py
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
A = os.path.join(ROOT, "assets")

# Evidence codes that denote experimental / author-stated support (everything
# except IEA, the purely electronic inference).
EXPERIMENTAL = {"IDA", "IMP", "IGI", "IPI", "IEP", "IGC", "IBA", "EXP", "ISS",
                "ISO", "ISA", "ISM", "TAS", "NAS", "IC", "RCA"}


def load(name):
    with open(os.path.join(A, name)) as fh:
        return json.load(fh)


def main():
    ai = load("ai_curation.json")
    go = load("go_annotations.json")
    gene_index = load("gene_index.json")

    # symbol (and synonyms), lowercased -> DDB_G id
    sym2ddb = {}
    for row in gene_index:
        ddb, symbol, synonyms = row[0], row[1], (row[5] or [])
        if symbol:
            sym2ddb.setdefault(symbol.lower(), ddb)
        for syn in synonyms:
            sym2ddb.setdefault(syn.lower(), ddb)

    # curated GO per gene: all terms, and the experimental-evidence subset
    cur_all, cur_exp = {}, {}
    for ddb, anns in go.items():
        if ddb.startswith("_"):
            continue
        cur_all[ddb] = {r[0] for r in anns}
        cur_exp[ddb] = {r[0] for r in anns if len(r) > 2 and r[2] in EXPERIMENTAL}

    # AI GO suggestions per gene, tagged with confidence tier
    ai_go = {}   # ddb -> (tier, set_of_go_ids)
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
        """Micro precision/recall of AI terms vs a curated reference map."""
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
        return dict(genes=genes, genes_hit=genes_hit, tp=tp,
                    ai_tot=ai_tot, cur_tot=cur_tot)

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

    print("AI GO-suggestion validation (exact GO-id match; a conservative lower bound)\n")
    print("Coverage")
    print(f"    AI entries                {tiers['core'] + tiers['family']} "
          f"(core {tiers['core']}, family {tiers['family']})")
    print(f"    entries with GO           {n_with_go}")
    print(f"    genes with curated GO     {len(cur_all)}\n")

    line("All AI suggestions vs any curated GO", score(cur_all))
    print()
    line("  core tier vs any curated GO", score(cur_all, "core"))
    print()
    line("  family tier vs any curated GO", score(cur_all, "family"))
    print()
    line("All AI suggestions vs EXPERIMENTAL curated GO only", score(cur_exp))


if __name__ == "__main__":
    main()
