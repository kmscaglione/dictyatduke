#!/usr/bin/env python3
"""Sync curated gene descriptions from the live dictyBase GraphQL API.

Your gene summaries come from the 2015 Basu export; dictyBase has curated since.
This pulls `geneGeneralInformation` (gene_product, name_description, description)
for each gene from https://graphql.dictybase.dev/graphql, records anything the
local corpus is missing, and prints a census of the gap.

Output:
  assets/dictybase_live_curation.json
    { "_fetched": [ddb, ...],                # every gene queried (for resume)
      "genes": { ddb: {symbol, gene_product, name_description, description} } }
  Only genes that returned some curated content are stored under "genes".

Design mirrors build_stock_center.py: stdlib only, polite, retrying, resumable
(re-run to continue after an interruption). The dictyBase API 502s often.

Usage:
  python3 scripts/sync_dictybase_curation.py                # characterized genes
  python3 scripts/sync_dictybase_curation.py --all          # every gene incl. hypothetical
  python3 scripts/sync_dictybase_curation.py --limit 50     # quick sample / test
  python3 scripts/sync_dictybase_curation.py --report       # just re-print the census, no fetching
"""
import json
import pathlib
import ssl
import sys
import time
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "dictybase_live_curation.json"
API = "https://graphql.dictybase.dev/graphql"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

SLEEP = 0.15          # politeness between requests (s)
RETRIES = 4           # per gene, on 502/timeout
CHECKPOINT = 100      # save progress every N genes

QUERY = ('{ geneGeneralInformation(gene:"%s"){ '
         'id name_description gene_product description } }')


def load_json(p, default):
    try:
        return json.loads(p.read_text())
    except Exception:
        return default


def local_summaries():
    """ddb -> local curated narrative summary (may be empty or a curator note)."""
    corpus = load_json(ASSETS / "dictybase_corpus.json", {})
    out = {}
    for ddb, v in corpus.items():
        out[ddb] = (v.get("summary") if isinstance(v, dict) else str(v)) or ""
    return out


def local_is_weak(summary):
    """True if the local curated summary is missing or a bare curator note."""
    s = (summary or "").strip()
    if len(s) < 60:
        return True
    low = s.lower()
    return "comprehensively annotated" in low or low.startswith("gene has been")


def fetch(ddb):
    body = json.dumps({"query": QUERY % ddb}).encode()
    for attempt in range(RETRIES):
        try:
            req = urllib.request.Request(
                API, data=body,
                headers={"Content-Type": "application/json", "Accept": "application/json"})
            with urllib.request.urlopen(req, context=CTX, timeout=30) as r:
                j = json.load(r)
            if j.get("errors") and not j.get("data"):
                return None  # genuine validation error, don't retry
            return (j.get("data") or {}).get("geneGeneralInformation")
        except Exception:
            time.sleep(0.6 * (attempt + 1))  # backoff on 502/timeout
    return "_ERR"  # exhausted retries — leave unfetched so a re-run retries it


def has_content(rec):
    if not rec:
        return False
    return bool((rec.get("description") or "").strip()) or bool(rec.get("name_description")) \
        or bool((rec.get("gene_product") or "").strip())


def report(state, local, index_by_ddb):
    genes = state["genes"]
    fetched = set(state["_fetched"])
    weak = {d for d, s in local.items() if local_is_weak(s)}
    live_desc = {d for d, r in genes.items() if (r.get("description") or "").strip()}
    fillable = [d for d in live_desc if d in weak]      # live description, local weak
    new_product = [d for d, r in genes.items()
                   if (r.get("gene_product") or "").strip()
                   and d in weak and not (r.get("description") or "").strip()]
    print("\n" + "=" * 64)
    print("CENSUS — live dictyBase curation vs your local corpus")
    print("=" * 64)
    print(f"genes queried:                    {len(fetched):>6}")
    print(f"  with any live curation:         {len(genes):>6}")
    print(f"  with a live gene description:   {len(live_desc):>6}")
    print(f"local summaries that are weak/empty: {len(weak):>6}")
    print(f"\n>>> FILLABLE: genes where the live site has a description")
    print(f"    and your local summary is weak/empty: {len(fillable):>6}")
    print(f"    (+ {len(new_product)} more have only a live gene_product to add)")
    if fillable:
        print("\n    examples:")
        for d in fillable[:12]:
            sym = index_by_ddb.get(d, d)
            desc = (genes[d].get("description") or "").replace("\n", " ")
            print(f"      {sym:12} {desc[:66]}")
    print("=" * 64)


def main():
    args = sys.argv[1:]
    limit = None
    if "--limit" in args:
        limit = int(args[args.index("--limit") + 1])
    include_all = "--all" in args
    report_only = "--report" in args

    index = load_json(ASSETS / "gene_index.json", [])
    index_by_ddb = {row[0]: row[1] for row in index}
    local = local_summaries()

    state = load_json(OUT, {"_fetched": [], "genes": {}})
    fetched = set(state["_fetched"])

    if report_only:
        report(state, local, index_by_ddb)
        return

    # Which genes to query: characterized (named) by default; --all for everything.
    targets = []
    for row in index:
        ddb, symbol, name = row[0], row[1], row[2]
        if ddb in fetched:
            continue
        if not include_all and (name or "").strip().lower() == "hypothetical protein":
            continue
        targets.append(ddb)
    if limit:
        targets = targets[:limit]

    print(f"to fetch: {len(targets)} genes"
          f"{' (characterized only; --all for every gene)' if not include_all else ''}"
          f"{f' [--limit {limit}]' if limit else ''}; already have {len(fetched)}")
    t0 = time.time()
    for i, ddb in enumerate(targets, 1):
        rec = fetch(ddb)
        if rec == "_ERR":
            continue  # don't mark fetched → retried next run
        state["_fetched"].append(ddb)
        if has_content(rec):
            state["genes"][ddb] = {
                "symbol": index_by_ddb.get(ddb, ""),
                "gene_product": (rec.get("gene_product") or "").strip(),
                "name_description": rec.get("name_description"),
                "description": (rec.get("description") or "").strip(),
            }
        if i % CHECKPOINT == 0:
            OUT.write_text(json.dumps(state))
            rate = i / max(time.time() - t0, 1)
            print(f"  {i}/{len(targets)}  ({len(state['genes'])} with content)  "
                  f"~{rate:.1f}/s  eta {int((len(targets)-i)/max(rate,0.01))}s")
        time.sleep(SLEEP)

    OUT.write_text(json.dumps(state))
    print(f"\nwrote {OUT.relative_to(ROOT)}  ({OUT.stat().st_size//1024} KB)")
    report(state, local, index_by_ddb)


if __name__ == "__main__":
    main()
