#!/usr/bin/env python3
"""Data self-check — cross-validate the site's derived data against its sources.

Run before every deploy:  python3 scripts/check_data.py
Exit code 0 = all good; 1 = at least one check failed.

This exists because the two worst bugs the 2026 accuracy audit found were both
"derived file drifted out of sync with its source, silently":
  * gene_facets.json (the advanced finder) was built from an older
    ortholog_disease.json and under-counted orthologs/disease/phenotypes;
  * the featured genes carried hand-typed genomic coordinates that were wrong.
Each check below is an invariant that, had it been enforced, would have caught
one of those before it shipped. Add a check whenever you add a derived file.

Standard library only. Reads assets/ and parses the featured-gene block of
app.js. Prints one line per check; a FAIL never aborts the run so you see every
problem at once.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

_fail = 0
_checks = 0


def load(name):
    with open(os.path.join(ASSETS, name)) as fh:
        return json.load(fh)


def ok(msg):
    global _checks
    _checks += 1
    print(f"  ok   {msg}")


def fail(msg):
    global _checks, _fail
    _checks += 1
    _fail += 1
    print(f"  FAIL {msg}")


def check(cond, msg):
    ok(msg) if cond else fail(msg)


# ---------------------------------------------------------------------------
def check_facets():
    """gene_facets.json must match ortholog_disease/phenotypes, restricted to the
    genes that exist in gene_index (the finder can only show indexed genes)."""
    print("gene_facets.json vs sources")
    try:
        facets = load("gene_facets.json")
        idx = {r[0] for r in load("gene_index.json")}
        od = load("ortholog_disease.json")
        ph = load("phenotypes.json")
    except (OSError, ValueError) as e:
        return fail(f"could not load inputs ({e})")

    f_orth = sum(1 for v in facets.values() if len(v) > 1 and v[1] == 1)
    f_dis = sum(1 for v in facets.values() if len(v) > 2 and v[2] == 1)
    f_phe = sum(1 for v in facets.values() if len(v) > 0 and v[0] == 1)

    exp_orth = sum(1 for k, v in od.items() if k in idx and (v.get("orthologs") or []))
    exp_dis = sum(1 for k, v in od.items() if k in idx
                  and any(x.get("diseases") for x in (v.get("orthologs") or [])))
    exp_phe = sum(1 for k in ph if k in idx)

    check(f_orth == exp_orth, f"ortholog facet count {f_orth} == indexed source {exp_orth}")
    check(f_dis == exp_dis, f"disease facet count {f_dis} == indexed source {exp_dis}")
    check(f_phe == exp_phe, f"phenotype facet count {f_phe} == indexed source {exp_phe}")


# ---------------------------------------------------------------------------
def featured_locations():
    """Parse the featured-gene block at the top of app.js -> {ddb: location}."""
    with open(os.path.join(ROOT, "app.js")) as fh:
        head = "".join(fh.readlines()[:400])
    out = {}
    for m in re.finditer(r'symbol:\s*"([^"]+)"', head):
        seg = head[m.start():m.start() + 900]
        loc = re.search(r'location:\s*"([^"]+)"', seg)
        ddb = re.search(r'(DDB_G\d+)', seg)
        if loc and ddb:
            out[ddb.group(1)] = loc.group(1)
    return out


def check_featured_loci():
    """Every featured gene's hardcoded location must equal gene_index.json."""
    print("featured-gene locations vs gene_index.json")
    try:
        idx = {r[0]: r[3] for r in load("gene_index.json")}
        feat = featured_locations()
    except (OSError, ValueError) as e:
        return fail(f"could not load inputs ({e})")
    if not feat:
        return fail("no featured genes parsed from app.js (regex drift?)")
    norm = lambda s: s.replace(" ", "")
    bad = [(d, feat[d], idx.get(d)) for d in feat
           if d not in idx or norm(feat[d]) != norm(idx[d])]
    if bad:
        for d, got, want in bad[:8]:
            fail(f"{d}: app.js {got!r} != gene_index {want!r}")
    else:
        ok(f"all {len(feat)} featured-gene locations match gene_index")


# ---------------------------------------------------------------------------
def check_gaf_fresh():
    """gene_annotations.json must be the current GAF, not the stale 2013 copy
    (which had ~57.6k annotations and no dates past 2013)."""
    print("GO annotation freshness")
    try:
        a = load("gene_annotations.json")
    except (OSError, ValueError) as e:
        return fail(f"could not load gene_annotations.json ({e})")
    total = 0
    years = []
    for ddb, rec in a.items():
        if str(ddb).startswith("_") or not isinstance(rec, dict):
            continue
        go = rec.get("go") or {}
        for rows in (go.values() if isinstance(go, dict) else []):
            for r in rows:
                total += 1
                if isinstance(r, list) and len(r) > 4 and r[4]:
                    years.append(str(r[4])[:4])
    check(total > 60000, f"GO annotation total {total} looks current (> 60,000)")
    if years:
        check(max(years) >= "2020", f"newest GO annotation year {max(years)} >= 2020")


# ---------------------------------------------------------------------------
def check_headline():
    """Sanity floors on the headline datasets so a truncated rebuild is obvious."""
    print("headline dataset sizes")
    try:
        genes = len(load("gene_index.json"))
        od = load("ortholog_disease.json")
        sc = load("stock_center.json")
        kegg = load("kegg_pathways.json")
    except (OSError, ValueError) as e:
        return fail(f"could not load inputs ({e})")
    orth = sum(1 for v in od.values() if v.get("orthologs"))
    dis = sum(1 for v in od.values() if any(x.get("diseases") for x in (v.get("orthologs") or [])))
    strains = len(sc.get("strains", [])) if isinstance(sc, dict) else 0
    maps = len({p.get("id") for lst in kegg.values() for p in (lst or []) if isinstance(p, dict)})
    check(genes > 13000, f"gene catalog {genes} (> 13,000)")
    check(orth > 3000, f"human orthologs {orth} (> 3,000)")
    check(dis > 1400, f"disease-linked genes {dis} (> 1,400)")
    check(strains > 6000, f"stock strains {strains} (> 6,000)")
    check(maps > 100, f"KEGG pathway maps {maps} (> 100)")


# ---------------------------------------------------------------------------
def check_gomer():
    """gomer_annotations.json (optional layer): if present, must be keyed by
    DDB_G ids and the annotator field must be a name, not a leaked data line."""
    print("Gomer Lab annotations")
    path = os.path.join(ASSETS, "gomer_annotations.json")
    if not os.path.exists(path):
        return ok("gomer_annotations.json absent (layer not installed) — skipped")
    try:
        g = load("gomer_annotations.json")
    except (OSError, ValueError) as e:
        return fail(f"could not load gomer_annotations.json ({e})")
    prots = {k: v for k, v in g.items() if not str(k).startswith("_")}
    check(len(prots) > 100, f"annotated proteins {len(prots)} (> 100)")
    bad = [k for k in prots if not re.match(r"^DDB_G\d+$", k)]
    check(not bad, "all keys are DDB_G ids" if not bad else f"{len(bad)} non-DDB_G keys")
    # A leaked data line (a STRING/analog row misread as a header) carries an
    # e-value or a comma-separated score; a real annotator name/note never does.
    leaked = [k for k, v in prots.items() if isinstance(v, dict)
              and re.search(r"e-?\d|,\s*\d+\.\d|\d,\s*\d", str(v.get("annotator", "")))]
    check(not leaked, "annotator fields are clean" if not leaked
          else f"{len(leaked)} annotator fields look like leaked data")


def check_function_summaries():
    """function_summaries.json (inferred 'what does this protein do?' layer):
    keyed by DDB_G, every entry has text + a known source, and it must NOT
    contain a gene that carries a real curated dictyBase description — those keep
    their curation. cln5/rasC/regA are the canary against a classifier regression
    that would hide real curation behind an inferred line."""
    print("inferred function summaries")
    path = os.path.join(ASSETS, "function_summaries.json")
    if not os.path.exists(path):
        return ok("function_summaries.json absent (layer not built) — skipped")
    try:
        fs = load("function_summaries.json")
    except (OSError, ValueError) as e:
        return fail(f"could not load function_summaries.json ({e})")
    ent = {k: v for k, v in fs.items() if not str(k).startswith("_")}
    check(len(ent) > 5000, f"genes covered {len(ent)} (> 5000)")
    bad = [k for k in ent if not re.match(r"^DDB_G\d+$", k)]
    check(not bad, "all keys are DDB_G ids" if not bad else f"{len(bad)} non-DDB_G keys")
    src_ok = {"go", "product", "none"}
    badv = [k for k, v in ent.items() if not isinstance(v, dict)
            or not str(v.get("text", "")).strip() or v.get("source") not in src_ok]
    check(not badv, "every entry has text + a known source"
          if not badv else f"{len(badv)} malformed entries")
    canary = ["DDB_G0275299", "DDB_G0281385", "DDB_G0284331"]  # cln5, rasC, regA
    leaked = [g for g in canary if g in ent]
    check(not leaked, "curated genes (cln5/rasC/regA) not overridden by inferred lines"
          if not leaked else f"curated genes wrongly in inferred layer: {leaked}")


def main():
    print("=== dictyBase data self-check ===")
    for fn in (check_facets, check_featured_loci, check_gaf_fresh, check_headline,
               check_gomer, check_function_summaries):
        fn()
    print(f"\n{_checks - _fail}/{_checks} checks passed"
          + (f" — {_fail} FAILED" if _fail else " — all good"))
    sys.exit(1 if _fail else 0)


if __name__ == "__main__":
    main()
