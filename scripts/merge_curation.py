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
import csv, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
IMPORTED = os.path.join(ASSETS, "annotations_imported.json")
CURATION = os.path.join(ROOT, "curation", "curation.tsv")
OUT = os.path.join(ASSETS, "gene_annotations.json")
GO_INDEX = os.path.join(ASSETS, "go_annotations.json")
ASPECTS = {"P", "F", "C"}
_PMID_RE = re.compile(r"^\d+$")
# experimental evidence first, then IEA last (matches the old build_data ordering)
_EXP = {"IDA", "IPI", "IMP", "IGI", "IEP", "HTP", "HDA", "HMP", "HGI", "HEP"}


def _write_go_index(genes):
    """Derive the flat GO index (go_annotations.json) from the canonical
    gene_annotations map, so the two can never drift. Format per gene:
    [[go_id, aspect, evidence, pmid], ...], deduped by (go, aspect, ev, pmid).
    This is the file the GO-term pages and the inverse index read; the canonical
    per-annotation total lives in gene_annotations.json (every GAF row)."""
    out = {}
    for ddb, rec in genes.items():
        seen, lst = set(), []
        go = rec.get("go", {})
        for aspect in ("P", "F", "C"):
            for e in go.get(aspect, []):
                go_id, ev, ref = e[0], e[1], (e[3] if len(e) > 3 else "")
                pmid = ""
                for r in str(ref).split("|"):
                    if r.startswith("PMID:"):
                        cand = r.split(":", 1)[1]
                        pmid = cand if _PMID_RE.match(cand) else ""
                        break
                key = (go_id, aspect, ev, pmid)
                if key in seen:
                    continue
                seen.add(key)
                lst.append([go_id, aspect, ev, pmid])
        if lst:
            lst.sort(key=lambda a: (0 if a[2] in _EXP else (2 if a[2] == "IEA" else 1), a[1]))
            out[ddb] = lst
    with open(GO_INDEX, "w", encoding="utf-8") as fh:
        json.dump(out, fh, separators=(",", ":"), ensure_ascii=False)
    total = sum(len(v) for v in out.values())
    print(f"  wrote go_annotations.json (derived index): {len(out)} genes, "
          f"{total} distinct GO annotations")


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
    total_go = sum(len(rec.get("go", {}).get(a, [])) for rec in genes.values() for a in ("P", "F", "C"))
    print(f"  wrote gene_annotations.json: {len(genes)} genes, {total_go} GO annotations "
          f"({os.path.getsize(OUT)/1024:.0f} KB)")
    _write_go_index(genes)
    print(f"  your curation: {sum(added.values())} entries across {len(touched)} genes "
          f"(go={added['go']}, literature={added['literature']}, summary={added['summary']})")


if __name__ == "__main__":
    merge()
