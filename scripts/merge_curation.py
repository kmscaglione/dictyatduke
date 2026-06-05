#!/usr/bin/env python3
"""Merge your own curation (curation/curation.tsv) on top of the imported GAF
annotations (assets/annotations_imported.json) -> assets/gene_annotations.json

Idempotent: always rebuilds the final file from the two inputs, so re-running is
safe. Your curated entries are tagged source "curated-here" so the site can show
a provenance badge and never confuses them with imported community annotations.

Usage:
    python3 scripts/build_annotations.py --gaf <file|download>   # step 1
    python3 scripts/merge_curation.py                            # step 2

Standard library only.
"""
import csv, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
IMPORTED = os.path.join(ASSETS, "annotations_imported.json")
CURATION = os.path.join(ROOT, "curation", "curation.tsv")
OUT = os.path.join(ASSETS, "gene_annotations.json")
ASPECTS = {"P", "F", "C"}


def _blank_gene(symbol=""):
    return {"symbol": symbol, "go": {"P": [], "F": [], "C": []}, "literature": [],
            "lit_titles": {}, "counts": {"total": 0, "manual": 0, "automated": 0, "papers": 0},
            "last_curated": "", "sources": []}


def merge():
    if not os.path.exists(IMPORTED):
        sys.exit("  ERROR: run scripts/build_annotations.py first (annotations_imported.json missing)")
    with open(IMPORTED, encoding="utf-8") as fh:
        genes = json.load(fh)

    added = {"go": 0, "literature": 0, "summary": 0}
    touched = set()
    if os.path.exists(CURATION):
        with open(CURATION, encoding="utf-8") as fh:
            reader = csv.reader((l for l in fh if l.strip() and not l.startswith("#")), delimiter="\t")
            header = next(reader, None)
            for row in reader:
                if len(row) < 4:
                    continue
                row += [""] * (10 - len(row))
                ddb, sym, typ, value, aspect, ev, ref, date, curator, note = row[:10]
                ddb = ddb.strip()
                if not ddb:
                    continue
                g = genes.setdefault(ddb, _blank_gene(sym.strip()))
                if sym.strip():
                    g["symbol"] = sym.strip()
                ch = g.setdefault("curated_here", {"count": 0, "last": "", "curators": []})
                typ = typ.strip().lower()
                if typ == "go":
                    asp = aspect.strip().upper()
                    if asp not in ASPECTS:
                        print(f"  WARN: bad aspect '{aspect}' for {ddb} {value} (use P/F/C) — skipped")
                        continue
                    g["go"][asp].append([value.strip(), ev.strip() or "IC", "", ref.strip(),
                                         date.strip(), "curated-here"])
                    g["counts"]["total"] += 1
                    g["counts"]["manual"] += 1
                    if ref.startswith("PMID:") and ref not in g["literature"]:
                        g["literature"].append(ref.strip())
                        g["counts"]["papers"] += 1
                    added["go"] += 1
                elif typ == "literature":
                    pmid = value.strip()
                    if pmid and pmid not in g["literature"]:
                        g["literature"].append(pmid)
                        g["counts"]["papers"] += 1
                    if note.strip():
                        g.setdefault("lit_titles", {})[pmid] = note.strip()
                    added["literature"] += 1
                elif typ == "summary":
                    g["summary"] = value.strip()
                    g["summary_by"] = curator.strip()
                    added["summary"] += 1
                else:
                    print(f"  WARN: unknown type '{typ}' for {ddb} — skipped")
                    continue
                if "curated-here" not in g["sources"]:
                    g["sources"].append("curated-here")
                ch["count"] += 1
                ch["last"] = max(ch["last"], date.strip())
                if curator.strip() and curator.strip() not in ch["curators"]:
                    ch["curators"].append(curator.strip())
                touched.add(ddb)

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(genes, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote gene_annotations.json: {len(genes)} genes "
          f"({os.path.getsize(OUT)/1024:.0f} KB)")
    print(f"  your curation: {sum(added.values())} entries across {len(touched)} genes "
          f"(go={added['go']}, literature={added['literature']}, summary={added['summary']})")


if __name__ == "__main__":
    merge()
