#!/usr/bin/env python3
"""Build assets/function_summaries.json — a short, badged "what does this protein
do?" line for every gene that lacks a real curated dictyBase description.

Most dictyBase "summaries" are curator log notes ("Basic annotations have been
added ... 22-OCT-2004 PG"), not function statements. For those genes (and the
explicitly un-annotated ones) we synthesize a one-line function statement from
the gene's Gene Ontology annotations — molecular function + biological process —
using go_terms.json for readable names. It is clearly labelled as inferred so it
is never confused with the curated layer.

Priority per gene:
  1. real curated prose  -> not emitted here (the corpus summary already shows)
  2. GO molecular-function / biological-process terms -> inferred function line
  3. an informative gene-product name -> use it
  4. nothing -> "Uncharacterized protein"

Output: { ddb: {"text": ..., "source": "go"|"product"|"none", "evidence": ...} }
Run:  python3 scripts/build_function_summaries.py         # write + report
      python3 scripts/build_function_summaries.py --dry   # report only
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
A = ROOT / "assets"
OUT = A / "function_summaries.json"

# --- classify: does a corpus summary contain real function prose? ---
_STATUS_START = re.compile(
    r"^(this gene has not been manually annotated|basic annotations have been added|"
    r"a curated model has been added|automated annotation|gene has been|the gene model|"
    r"a curated gene model|gene model has been|comprehensively annotated)", re.I)
_DATE = re.compile(r"\b\d{1,2}-[A-Z]{3}-\d{4}\b")


def has_real_prose(summary):
    s = (summary or "").strip()
    if not s:
        return False
    low = s.lower()
    if "has not been manually annotated" in low and len(s) < 200:
        return False
    # Drop only *short* curator-log clauses (a DD-MMM-YYYY stamp in a brief
    # sentence). A long clause that happens to carry a date is real prose, so it
    # is kept — we bias toward never hiding a genuine curated description.
    kept = [c for c in re.split(r"(?<=[.;])\s+", s)
            if not (_DATE.search(c) and len(c) < 140)]
    core = ". ".join(kept).strip()
    if _STATUS_START.match(s) and len(core) < 60:
        return False
    return len(core) >= 60


# --- generic GO terms that add no information; skip in the readable line ---
_GENERIC = {
    "molecular_function", "biological_process", "cellular_component",
    "protein binding", "binding", "cytoplasm", "membrane", "nucleus",
    "cytosol", "metal ion binding", "identical protein binding",
    "ATP binding", "cellular process", "biological process",
}


def _names(go_rows, aspect, go_terms, cap=3):
    seen, out = set(), []
    for row in go_rows:
        gid, asp = row[0], row[1]
        if asp != aspect:
            continue
        t = go_terms.get(gid)
        nm = (t[0] if t else gid)
        low = nm.lower()
        if low in _GENERIC or low in seen:
            continue
        seen.add(low)
        out.append(nm)
        if len(out) >= cap:
            break
    return out


def _join(names):
    if not names:
        return ""
    if len(names) == 1:
        return names[0]
    return ", ".join(names[:-1]) + " and " + names[-1]


def build_line(go_rows, go_terms):
    """One readable sentence from a gene's GO rows, or '' if nothing usable."""
    mf = _names(go_rows, "F", go_terms)
    bp = _names(go_rows, "P", go_terms)
    cc = _names(go_rows, "C", go_terms, cap=1)
    parts = []
    if mf:
        parts.append(_join(mf))
    if bp:
        parts.append(("involved in " if not mf else "involved in ") + _join(bp))
    if not parts and cc:
        parts.append("localizes to " + _join(cc))
    if not parts:
        return ""
    sent = "; ".join(parts)
    return sent[0].upper() + sent[1:] + "."


def main():
    dry = "--dry" in sys.argv
    corpus = json.loads((A / "dictybase_corpus.json").read_text())
    go_ann = json.loads((A / "go_annotations.json").read_text())
    go_terms = json.loads((A / "go_terms.json").read_text())
    index = {r[0]: (r[2] or "") for r in json.loads((A / "gene_index.json").read_text())}

    UNINF = re.compile(r"^(hypothetical|unknown|uncharacterized|putative uncharacterized|conserved unknown)", re.I)

    out = {}
    n_go = n_prod = n_none = n_skip_real = 0
    for ddb, prod in index.items():
        summ = (corpus.get(ddb, {}) or {}).get("summary", "")
        if has_real_prose(summ):
            n_skip_real += 1
            continue
        rows = go_ann.get(ddb) or []
        line = build_line(rows, go_terms) if rows else ""
        if line:
            evs = {r[2] for r in rows}
            electronic = evs <= {"IEA"}
            out[ddb] = {"text": line, "source": "go",
                        "evidence": "electronic" if electronic else "curated"}
            n_go += 1
        elif prod.strip() and not UNINF.match(prod.strip()) and prod.strip().lower() != "hypothetical protein":
            out[ddb] = {"text": prod.strip(), "source": "product"}
            n_prod += 1
        else:
            out[ddb] = {"text": "Uncharacterized protein.", "source": "none"}
            n_none += 1

    out["_meta"] = {
        "description": "Short inferred function line for genes lacking a real curated "
                       "dictyBase description. Synthesized from Gene Ontology "
                       "(molecular function + biological process); labelled as inferred.",
        "source": {"name": "Gene Ontology / InterPro", "license": "CC BY 4.0",
                   "url": "http://geneontology.org/"},
        "counts": {"go_derived": n_go, "product_name": n_prod,
                   "uncharacterized": n_none, "have_curated_prose": n_skip_real},
    }
    print("=" * 60)
    print(f"genes with real curated prose (left to corpus): {n_skip_real}")
    print(f"inferred from GO:        {n_go}")
    print(f"from gene-product name:  {n_prod}")
    print(f"uncharacterized:         {n_none}")
    print("=" * 60)
    for ddb in ("DDB_G0267178", "DDB_G0275299", "DDB_G0281385", "DDB_G0284331"):
        if ddb in out:
            print(f"  {ddb}: [{out[ddb]['source']}] {out[ddb]['text'][:120]}")
        else:
            print(f"  {ddb}: (has curated prose — not overridden)")
    if not dry:
        OUT.write_text(json.dumps(out, separators=(",", ":")))
        print(f"\nwrote {OUT} ({len(out)-1} genes)")


if __name__ == "__main__":
    main()
