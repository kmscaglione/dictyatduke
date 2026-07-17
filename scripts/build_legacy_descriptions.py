#!/usr/bin/env python3
"""Build assets/legacy_descriptions.json — a badged fallback layer of dictyBase
legacy gene-product descriptions, imported (strictly) from the live dictyBase.

Source: assets/dictybase_live_curation.json (produced by sync_dictybase_curation.py).
We keep a live description ONLY when BOTH hold:
  (a) the local curated summary is empty or a bare curator note (nothing real to lose), and
  (b) the live description is an actual description, not itself a curator note.

Output: { ddb: {"symbol": ..., "description": ...} }  — consumed by serve.py as a
fallback summary, displayed with a "dictyBase legacy description" badge so it is
never confused with the curated or AI layers.

Run:  python3 scripts/build_legacy_descriptions.py            # write the file + report
      python3 scripts/build_legacy_descriptions.py --dry      # report only, write nothing
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
LIVE = ASSETS / "dictybase_live_curation.json"
CORPUS = ASSETS / "dictybase_corpus.json"
OUT = ASSETS / "legacy_descriptions.json"

# --- (a) is the LOCAL summary safe to fill over? ---
_NOTE = ("basic annotations have been added", "comprehensively annotated",
         "annotations have been added", "gene model has been")


def local_is_fillable(summary):
    s = (summary or "").strip()
    if not s:
        return True
    low = s.lower()
    # a real narrative — never touch it
    if "pubmed" in low or "[http" in low or "]" in s or len(s) >= 120:
        return False
    if low.startswith("gene has been") or any(p in low for p in _NOTE):
        return True
    if len(s) < 40:            # a stray fragment, not a real summary
        return True
    return False               # conservative: anything else, keep yours


# --- (b) is the LIVE text an actual description, not a note? ---
_LIVE_NOTE = re.compile(
    r"^\s*(there is a second copy|highly similar to (neighboring|ddb_g|the neighboring)"
    r"|identical to ddb_g|similar to neighboring|this gene (is|was)|see ddb_g"
    r"|duplicate of|redundant with)", re.I)


def live_is_description(desc):
    d = (desc or "").strip()
    if len(d) < 15:
        return False
    if _LIVE_NOTE.match(d):
        return False
    if re.match(r"^\s*DDB_G\d+\s*$", d):   # bare id
        return False
    return True


def main():
    dry = "--dry" in sys.argv
    live = json.loads(LIVE.read_text())
    corpus = json.loads(CORPUS.read_text())

    def local_summary(ddb):
        v = corpus.get(ddb, {})
        return (v.get("summary") if isinstance(v, dict) else str(v)) or ""

    kept, drop_local, drop_live, borderline = {}, [], [], []
    for ddb, rec in live.get("genes", {}).items():
        desc = (rec.get("description") or "").strip()
        if not desc:
            continue
        if not local_is_fillable(local_summary(ddb)):
            drop_local.append(ddb)
            continue
        if not live_is_description(desc):
            drop_live.append((rec.get("symbol", ddb), desc))
            continue
        kept[ddb] = {"symbol": rec.get("symbol", ""), "description": desc}
        if len(desc) < 25 or desc.lower().startswith("ortholog of"):
            borderline.append((rec.get("symbol", ddb), desc))

    print("=" * 66)
    print("STRICT IMPORT — dictyBase legacy descriptions")
    print("=" * 66)
    print(f"live genes with a description:     {sum(1 for g in live['genes'].values() if (g.get('description') or '').strip()):>6}")
    print(f"  dropped — local not fillable:    {len(drop_local):>6}  (you already have real content)")
    print(f"  dropped — live text is a note:   {len(drop_live):>6}")
    print(f"  KEPT to import:                  {len(kept):>6}")
    print(f"  (of those, {len(borderline)} are short/'ortholog of…' — borderline)")
    if drop_live[:6]:
        print("\n  examples dropped as live-notes:")
        for s, d in drop_live[:6]:
            print(f"    {s:12} {d[:60]}")
    if borderline[:8]:
        print("\n  borderline KEPT (eyeball these):")
        for s, d in borderline[:8]:
            print(f"    {s:12} {d[:60]}")

    if dry:
        print("\n(--dry: nothing written)")
        return
    OUT.write_text(json.dumps(kept, separators=(",", ":")))
    print(f"\nwrote {OUT.relative_to(ROOT)}  ({len(kept)} genes, {OUT.stat().st_size//1024} KB)")


if __name__ == "__main__":
    main()
