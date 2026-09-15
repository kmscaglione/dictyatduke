#!/usr/bin/env python3
"""Recover per-annotation references (and notes) for genes whose phenotypes came
only from dictyBase's term-only "Mutant Phenotypes" bulk download.

Those genes (about four dozen) show a phenotype and a strain but no PMID,
because the bulk download has no reference column. dictyBase does hold the
reference and the curator note on each strain's phenotype-detail page. This
scraper visits, per gene:

  1. /gene/<DDB>/phenotypes.json   -> the genotype_id(s) of the gene's strains
  2. strain_and_phenotype_details.pl?genotype_id=N
       -> the phenotype table: term, note, assay condition, and PMID

and writes assets/dictybase-corpus/phenotypes_recovered.json
  { DDB_G...: [[term, condition, pmid, note], ...] }
which build_data.build_phenotypes() merges (references win over the term-only
rows). Re-run only when the gap list changes; the output is committed so the
build stays reproducible and offline.

  python3 scripts/recover_phenotype_refs.py            # only the genes still missing refs
  python3 scripts/recover_phenotype_refs.py --all-gap  # same; explicit
"""
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
OUT = os.path.join(ASSETS, "dictybase-corpus", "phenotypes_recovered.json")
BASE = "http://dictybase.org"
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45, context=_CTX) as r:
        return r.read().decode("utf-8", "replace")


def genes_missing_refs():
    """DDB ids that have phenotypes but not one PMID among them."""
    with open(os.path.join(ASSETS, "phenotypes.json")) as fh:
        d = json.load(fh)
    return [ddb for ddb, rows in d.items()
            if rows and not any((r[2] if len(r) > 2 else "").strip() for r in rows)]


def genotype_ids_for(ddb):
    """The genotype_id(s) of a gene's phenotyped strains, from the gene JSON."""
    try:
        raw = fetch(f"{BASE}/gene/{ddb}/phenotypes.json")
        data = json.loads(raw)
    except Exception as e:  # noqa: BLE001
        print(f"    ! {ddb}: gene JSON failed ({e})", file=sys.stderr)
        return []
    ids = []
    for block in data if isinstance(data, list) else []:
        for item in block.get("items", []) if isinstance(block, dict) else []:
            for rec in item.get("records", []) if isinstance(item, dict) else []:
                for s in rec.get("strain", []):
                    m = re.search(r"genotype_id=(\d+)", s.get("url", "") or "")
                    if m and m.group(1) not in ids:
                        ids.append(m.group(1))
    return ids


_CELL = re.compile(r"<td[^>]*>(.*?)</td>", re.S | re.I)
_ROW = re.compile(r"<tr[^>]*>(.*?)</tr>", re.S | re.I)


def _text(fragment):
    """HTML fragment -> plain text; <BR>/<b> dropped, entities decoded."""
    s = re.sub(r"<br\s*/?>", " ", fragment, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    return re.sub(r"\s+", " ", html.unescape(s)).strip()


def parse_genotype_page(page):
    """The phenotype table on a strain-detail page -> [(term, condition, pmid, note)].

    Each row: [phenotype term] [notes, with an optional '<b>Environment:</b> …'
    assay condition appended] [citation] [reference links, carrying the PMID]."""
    # Isolate the phenotype table (header row: Phenotype / Notes / Reference).
    tbls = re.findall(r'<table class="download">(.*?)</table>', page, re.S | re.I)
    rows = []
    for tbl in tbls:
        if "<th>Phenotype</th>" not in tbl.replace(" ", "") and "Phenotype" not in tbl:
            continue
        if "Notes" not in tbl or "Reference" not in tbl:
            continue
        for r in _ROW.findall(tbl):
            if "<th" in r.lower():
                continue
            cells = _CELL.findall(r)
            if len(cells) < 3:
                continue
            term = _text(cells[0])
            note_raw = cells[1]
            pmid_cell = " ".join(cells[2:])
            # Split "note <b>Environment:</b> condition" into note + condition.
            cond = ""
            m = re.search(r"<b>\s*Environment:\s*</b>(.*)", note_raw, re.S | re.I)
            if m:
                cond = _text(m.group(1))
                note_raw = note_raw[:m.start()]
            note = _text(note_raw)
            pm = re.search(r"pubmed/(\d+)", pmid_cell) or re.search(r"term=(\d+)", pmid_cell)
            pmid = pm.group(1) if pm else ""
            if term:
                rows.append((term, cond, pmid, note))
    return rows


def main():
    targets = genes_missing_refs()
    print(f"genes still missing references: {len(targets)}", file=sys.stderr)
    recovered = {}
    geno_cache = {}
    for i, ddb in enumerate(targets, 1):
        gids = genotype_ids_for(ddb)
        time.sleep(0.3)
        rows = []
        seen = set()
        for gid in gids:
            if gid not in geno_cache:
                try:
                    geno_cache[gid] = parse_genotype_page(
                        fetch(f"{BASE}/db/cgi-bin/dictyBase/phenotype/"
                              f"strain_and_phenotype_details.pl?genotype_id={gid}"))
                except Exception as e:  # noqa: BLE001
                    print(f"    ! genotype {gid}: {e}", file=sys.stderr)
                    geno_cache[gid] = []
                time.sleep(0.3)
            for term, cond, pmid, note in geno_cache[gid]:
                key = (term.lower(), pmid, note.lower())
                if key not in seen:
                    seen.add(key)
                    rows.append([term, cond, pmid, note])
        withref = sum(1 for r in rows if r[2])
        if rows:
            recovered[ddb] = rows
        print(f"  [{i}/{len(targets)}] {ddb}: {len(rows)} rows, {withref} with PMID",
              file=sys.stderr)
    with open(OUT, "w") as fh:
        json.dump(recovered, fh, ensure_ascii=False, indent=0)
    total = sum(len(v) for v in recovered.values())
    withref = sum(1 for v in recovered.values() for r in v if r[2])
    print(f"\nwrote {os.path.relpath(OUT)}: {len(recovered)} genes, {total} rows, "
          f"{withref} with a PMID", file=sys.stderr)


if __name__ == "__main__":
    main()
