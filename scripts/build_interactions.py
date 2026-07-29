#!/usr/bin/env python3
"""Curated protein and genetic interactions for the gene pages, from BioGRID.

BioGRID-grade means curated, evidence-coded interactions (experimental system,
physical vs genetic, throughput, PMID), as opposed to the predicted associations
we already surface live from STRING. The Dictyostelium corpus is small (dozens),
because that is the state of the published field, so we bundle it as one static
JSON rather than a pipeline.

Input: the BioGRID per-organism tab3 file for Dictyostelium discoideum AX4
(inside BIOGRID-ORGANISM-<version>.tab3.zip from downloads.thebiogrid.org).
BioGRID data is redistributable with attribution (MIT license). NB: the AX4
file uses the STRAIN taxid 352472, not the species taxid 44689.

Output: assets/interactions.json (committed; small and static), keyed by DDB_G:
  { "_meta": {...}, "genes": { "DDB_G...": [ {partner, type, method, ...}, ... ] } }

Each dicty interactor gets the interaction recorded under its DDB_G, with the
OTHER interactor as the partner (linked when it is also a dicty gene, otherwise
shown with its organism). Intra-dicty interactions appear on both genes' pages.

    python3 scripts/build_interactions.py --biogrid <path-to-dicty.tab3.txt>

Standard library only.
"""
import argparse, csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DICTY_TAXIDS = {"44689", "352472"}  # species + AX4 strain
_PMID = re.compile(r"(\d+)")


def _side(row, s):
    """Normalize one interactor (A or B) into (ddb, symbol, organism, is_dicty)."""
    taxid = row.get(f"Organism ID Interactor {s}", "")
    is_dicty = taxid in DICTY_TAXIDS
    sysname = (row.get(f"Systematic Name Interactor {s}") or "").strip()
    ddb = sysname if sysname.startswith("DDB_G") else None
    symbol = (row.get(f"Official Symbol Interactor {s}") or "").strip()
    if not symbol or symbol == "-":
        symbol = ddb or sysname or "?"
    org = (row.get(f"Organism Name Interactor {s}") or "").strip()
    return {"ddb": ddb, "symbol": symbol, "organism": org, "is_dicty": is_dicty}


def build(biogrid_path):
    genes = {}
    n_rows = phys = gen = 0
    version = "BioGRID"
    m = re.search(r"-(\d+\.\d+\.\d+)\.tab3", os.path.basename(biogrid_path))
    if m:
        version = f"BioGRID {m.group(1)}"
    seen = set()  # (gene, partner_key, type, method, pmid) -> dedupe identical evidence

    with open(biogrid_path, encoding="utf-8", errors="replace") as fh:
        for row in csv.DictReader(fh, delimiter="\t"):
            a, b = _side(row, "A"), _side(row, "B")
            if not (a["is_dicty"] or b["is_dicty"]):
                continue
            n_rows += 1
            typ = (row.get("Experimental System Type") or "").strip().lower()
            if typ == "genetic":
                gen += 1
            elif typ == "physical":
                phys += 1
            method = (row.get("Experimental System") or "").strip()
            through = (row.get("Throughput") or "").strip().replace(" Throughput", "")
            pm = _PMID.search(row.get("Publication Source") or "")
            pmid = pm.group(1) if pm else ""
            # Record the interaction under each dicty interactor, partner = the other side.
            for me, other in ((a, b), (b, a)):
                if not (me["is_dicty"] and me["ddb"]):
                    continue
                key = (me["ddb"], other["ddb"] or other["symbol"], typ, method, pmid)
                if key in seen:
                    continue
                seen.add(key)
                genes.setdefault(me["ddb"], []).append({
                    "partner_ddb": other["ddb"] if other["is_dicty"] else None,
                    "partner_symbol": other["symbol"],
                    "partner_organism": None if other["is_dicty"] else (other["organism"] or None),
                    "type": typ or "physical",
                    "method": method,
                    "throughput": through,
                    "pmid": pmid,
                    "source": "BioGRID",
                })

    # Stable order per gene: genetic first is arbitrary; sort by partner then method.
    for lst in genes.values():
        lst.sort(key=lambda e: (e["type"] != "physical", e["partner_symbol"].lower(), e["method"]))

    out = {
        "_meta": {
            "sources": [version],
            "counts": {"interactions": n_rows, "genes": len(genes),
                       "physical": phys, "genetic": gen},
            "attribution": ("Curated interactions from BioGRID (thebiogrid.org), "
                            "Oughtred et al.; distributed under the MIT license."),
        },
        "genes": genes,
    }
    dst = os.path.join(ROOT, "assets", "interactions.json")
    with open(dst, "w") as f:
        json.dump(out, f, separators=(",", ":"), ensure_ascii=False)
    print(f"wrote {dst}: {n_rows} interactions ({phys} physical, {gen} genetic) "
          f"across {len(genes)} genes, from {version}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--biogrid", required=True,
                    help="BioGRID Dictyostelium AX4 tab3 file (from BIOGRID-ORGANISM-*.tab3.zip)")
    build(ap.parse_args().biogrid)


if __name__ == "__main__":
    main()
