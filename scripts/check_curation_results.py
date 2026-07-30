#!/usr/bin/env python3
"""Validate a Claude Code curation results file before importing it.

Checks the shape the curator portal's "Import results" button expects (see
import_curation_results in serve.py) and, when given the batch it came from,
that every pmid lines up.

    python3 scripts/check_curation_results.py curation/papers/results/20260730-results.json
    python3 scripts/check_curation_results.py RESULTS.json --batch curation/papers/batches/BATCH.json

Exits 1 on anything that would break or silently drop on import.
"""
import argparse
import json
import re
import sys

ASPECTS = {"P", "F", "C"}
INTERACTION_TYPES = {"physical", "genetic"}
LISTS = {
    "gene_summaries": ["gene", "sentence"],
    "go": ["gene", "term", "aspect"],
    "phenotypes": ["gene", "phenotype"],
    "interactions": ["gene_a", "gene_b", "type"],
}
# Fields that may appear but are not required. `negative` marks a phenotype the
# paper tested and found unchanged; it is imported and shown separately from the
# mutant's real phenotypes.
OPTIONAL = {"phenotypes": {"negative"}}
MAX_FIELD = 500
MAX_SUMMARY = 800
MAX_ITEMS = 100


def load(path):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except (OSError, json.JSONDecodeError) as exc:
        sys.exit(f"error: cannot read {path}: {exc}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("results", help="the JSON file you plan to import")
    ap.add_argument("--batch", help="the exported batch it was curated from")
    args = ap.parse_args()

    doc = load(args.results)
    errors, warnings = [], []

    if not isinstance(doc, dict) or not isinstance(doc.get("results"), list):
        sys.exit('error: expected a JSON object with a "results" list.')
    results = doc["results"]
    if not results:
        sys.exit("error: results is empty, there is nothing to import.")

    batch_pmids, batch_titles = None, {}
    if args.batch:
        batch = load(args.batch)
        papers = batch.get("papers") if isinstance(batch, dict) else None
        if not isinstance(papers, list):
            sys.exit(f"error: {args.batch} does not look like an exported batch.")
        batch_pmids = set()
        for p in papers:
            pmid = re.sub(r"\D", "", str(p.get("pmid", "")))
            batch_pmids.add(pmid)
            batch_titles[pmid] = p.get("title", "")

    seen = set()
    for i, r in enumerate(results):
        tag = f"results[{i}]"
        if not isinstance(r, dict):
            errors.append(f"{tag}: not an object, import will skip it.")
            continue

        pmid = re.sub(r"\D", "", str(r.get("pmid", "")))
        if not pmid:
            errors.append(f"{tag}: missing pmid, import will skip it.")
        elif pmid in seen:
            errors.append(f"{tag}: pmid {pmid} appears twice, the later one wins.")
        else:
            seen.add(pmid)
        if batch_pmids is not None and pmid and pmid not in batch_pmids:
            errors.append(f"{tag}: pmid {pmid} is not in the batch, import will "
                          "silently skip it.")

        summary = str(r.get("summary", ""))
        if not summary.strip():
            warnings.append(f"{tag} (pmid {pmid or '?'}): empty summary.")
        elif len(summary) > MAX_SUMMARY:
            warnings.append(f"{tag}: summary is {len(summary)} chars and will be "
                            f"cut at {MAX_SUMMARY}.")

        filled = 0
        for key, fields in LISTS.items():
            val = r.get(key, [])
            if val in (None, []):
                continue
            if not isinstance(val, list):
                errors.append(f"{tag}.{key}: expected a list.")
                continue
            filled += len(val)
            if len(val) > MAX_ITEMS:
                warnings.append(f"{tag}.{key}: {len(val)} entries, only the first "
                                f"{MAX_ITEMS} are imported.")
            for j, item in enumerate(val[:MAX_ITEMS]):
                where = f"{tag}.{key}[{j}]"
                if not isinstance(item, dict):
                    errors.append(f"{where}: expected an object.")
                    continue
                for f in fields:
                    text = str(item.get(f, "")).strip()
                    if not text:
                        errors.append(f"{where}: missing {f}.")
                    elif len(text) > MAX_FIELD:
                        warnings.append(f"{where}.{f}: {len(text)} chars, cut at "
                                        f"{MAX_FIELD}.")
                for extra in set(item) - set(fields) - OPTIONAL.get(key, set()):
                    warnings.append(f"{where}: field {extra!r} is dropped on import.")
                if "negative" in item and not isinstance(item["negative"], bool):
                    errors.append(f"{where}: negative must be true or false, got "
                                  f"{item['negative']!r}.")
                if key == "go" and str(item.get("aspect", "")).strip() not in ASPECTS:
                    errors.append(f"{where}: aspect must be P, F or C, got "
                                  f"{item.get('aspect')!r}.")
                if key == "interactions":
                    kind = str(item.get("type", "")).strip().lower()
                    if kind and kind not in INTERACTION_TYPES:
                        errors.append(f"{where}: type must be physical or genetic, "
                                      f"got {item.get('type')!r}.")

        if not summary.strip() and not filled:
            warnings.append(f"{tag} (pmid {pmid or '?'}): nothing curated, this "
                            "blanks the draft's AI content.")

    if batch_pmids is not None:
        missing = sorted(batch_pmids - seen)
        for pmid in missing:
            warnings.append(f"batch pmid {pmid} has no result: "
                            f"{batch_titles.get(pmid, '')[:70]}")

    for w in warnings:
        print(f"warn:  {w}")
    for e in errors:
        print(f"ERROR: {e}")

    counts = {k: sum(len(r.get(k) or []) for r in results if isinstance(r, dict))
              for k in LISTS}
    print(f"\n{len(results)} result(s), {len(seen)} distinct pmid(s): "
          + ", ".join(f"{k}={v}" for k, v in counts.items()))
    if errors:
        print(f"\n{len(errors)} error(s). Fix these before importing.")
        return 1
    print("Shape is good. Safe to import." + (f" {len(warnings)} warning(s)."
                                              if warnings else ""))
    return 0


if __name__ == "__main__":
    sys.exit(main())
