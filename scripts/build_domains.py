#!/usr/bin/env python3
"""Build assets/domains.json — precomputed InterPro domain architecture per gene.

The Structures tab currently fetches protein domains *live* from InterPro on
every gene view (serve.py:/api/domains). That's a per-view network call and
keeps the data un-indexable. This script precomputes the same domain set into a
stored file so the front-end can render instantly and only fall back to the live
proxy for genes not in the cache.

It is deliberately polite to EBI and resumable:
  * on-disk per-accession cache under /tmp (re-runs are free for cached genes),
  * a throttle between live calls,
  * incremental merge with any existing assets/domains.json (top-up, not rebuild),
  * a bounded default subset (characterized genes) + --limit, so a scheduled run
    fills in a slice rather than hammering ~12k proteins at once.

Output (assets/domains.json):
    {
      "_meta": { built, source, counts },
      "genes": { "DDB_G0267374": {"uniprot": "Q8I7P3", "length": 286,
                                  "domains": [{db,accession,name,type,start,end}, ...]}, ... }
    }
Genes that resolve but have no InterPro hits are stored with an empty domain
list, so re-runs skip them instead of re-querying.

Extraction matches serve.py `_handle_domains` exactly, so the front-end renders
stored and live results identically.

Standard library only. Examples:
    python3 scripts/build_domains.py --dry-run        # report subset sizes, fetch nothing
    python3 scripts/build_domains.py --limit 200      # top up 200 not-yet-cached genes
    python3 scripts/build_domains.py --all            # include hypothetical proteins too
    python3 scripts/build_domains.py --refresh        # re-fetch even cached genes
"""
import argparse
import datetime
import json
import os
import pathlib
import ssl
import sys
import time
import urllib.error
import urllib.request

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
OUT = ASSETS / "domains.json"
CACHE = pathlib.Path(os.environ.get("DICTY_CACHE", "/tmp/dicty-domains"))
CACHE.mkdir(parents=True, exist_ok=True)

INTERPRO = "https://www.ebi.ac.uk/interpro/api"
UA = {"User-Agent": "dictyBase domain-cache build (research)"}
THROTTLE = float(os.environ.get("DICTY_THROTTLE", "0.34"))  # ~3 req/s default


def _get_json(url, attempts=4):
    """GET JSON with retry/backoff. Returns None on a clean 404 (no such protein).
    An empty/non-JSON body is treated as a transient hiccup and retried."""
    last = None
    for i in range(attempts):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=40, context=SSL_CTX) as r:
                return json.loads(r.read())
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            last = e
            if e.code < 500 and e.code != 429:
                raise
            time.sleep(2 * (i + 1))
        except (urllib.error.URLError, TimeoutError, ValueError) as e:
            last = e  # ValueError covers json.JSONDecodeError (empty/garbled body)
            time.sleep(2 * (i + 1))
    raise last


def fetch_domains(acc):
    """Return {"length": int|None, "domains": [...]} for a UniProt accession, or
    None if InterPro has no record. Cached on disk by accession."""
    cache_file = CACHE / f"{acc}.json"
    if cache_file.exists():
        return json.loads(cache_file.read_text())

    meta = _get_json(f"{INTERPRO}/protein/uniprot/{acc}")
    if meta is None:
        result = None
    else:
        length = meta.get("metadata", {}).get("length")
        time.sleep(THROTTLE)
        entries = _get_json(f"{INTERPRO}/entry/all/protein/uniprot/{acc}/?page_size=100") or {}
        domains = []
        for res in entries.get("results", []):
            md = res.get("metadata", {})
            for prot in res.get("proteins", []):
                for loc in prot.get("entry_protein_locations", []):
                    for fr in loc.get("fragments", []):
                        if fr.get("start") is None or fr.get("end") is None:
                            continue
                        domains.append({
                            "db": md.get("source_database"),
                            "accession": md.get("accession"),
                            "name": md.get("name"),
                            "type": md.get("type"),
                            "start": fr["start"], "end": fr["end"],
                        })
        result = {"length": length, "domains": domains}
    cache_file.write_text(json.dumps(result))
    return result


def load_existing():
    if OUT.exists():
        try:
            return json.loads(OUT.read_text()).get("genes", {})
        except (ValueError, OSError):
            pass
    return {}


def select_genes(include_hypothetical):
    """[(ddb, acc)] for genes with a UniProt accession, default = characterized only."""
    idx = json.loads((ASSETS / "gene_index.json").read_text())
    umap = json.loads((ASSETS / "uniprot_map.json").read_text()).get("map", {})
    out = []
    for rec in idx:
        ddb, _sym, desc = rec[0], rec[1], (rec[2] if len(rec) > 2 else "")
        if not include_hypothetical and "hypothetical" in (desc or "").lower():
            continue
        hit = umap.get(ddb)
        if hit and hit.get("acc"):
            out.append((ddb, hit["acc"]))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="max genes to fetch this run (0 = all selected)")
    ap.add_argument("--all", action="store_true", help="include hypothetical proteins")
    ap.add_argument("--refresh", action="store_true", help="re-fetch even genes already in domains.json")
    ap.add_argument("--dry-run", action="store_true", help="report subset sizes, fetch nothing")
    args = ap.parse_args()

    genes = load_existing()
    selected = select_genes(args.all)
    todo = [(d, a) for d, a in selected if args.refresh or d not in genes]
    print(f"selected {len(selected)} genes with accession; "
          f"{len(genes)} already cached; {len(todo)} to fetch"
          + (f"; limiting to {args.limit}" if args.limit else ""), file=sys.stderr)
    if args.dry_run:
        return
    if args.limit:
        todo = todo[:args.limit]

    fetched = with_domains = 0
    for i, (ddb, acc) in enumerate(todo, 1):
        try:
            res = fetch_domains(acc)
        except Exception as e:
            print(f"  ! {ddb} ({acc}): {e}", file=sys.stderr)
            continue
        if res is None:
            genes[ddb] = {"uniprot": acc, "length": None, "domains": []}
        else:
            genes[ddb] = {"uniprot": acc, "length": res["length"], "domains": res["domains"]}
            if res["domains"]:
                with_domains += 1
        fetched += 1
        if i % 100 == 0:
            print(f"  {i}/{len(todo)} fetched...", file=sys.stderr)
        time.sleep(THROTTLE)

    total_with_domains = sum(1 for g in genes.values() if g.get("domains"))
    data = {
        "_meta": {
            "description": "Precomputed InterPro/Pfam domain architecture per gene, keyed by DDB_G id.",
            "built": datetime.date.today().isoformat(),
            "source": {"name": "InterPro", "license": "CC0 1.0", "url": "https://www.ebi.ac.uk/interpro/"},
            "counts": {"genes": len(genes), "genes_with_domains": total_with_domains},
        },
        "genes": dict(sorted(genes.items())),
    }
    tmp = OUT.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    tmp.replace(OUT)
    print(f"wrote {OUT}: {len(genes)} genes ({total_with_domains} with domains), "
          f"fetched {fetched} this run ({with_domains} new with domains), "
          f"{OUT.stat().st_size/1024:.0f} KB", file=sys.stderr)


if __name__ == "__main__":
    main()
