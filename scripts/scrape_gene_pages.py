#!/usr/bin/env python3
"""Preserve the per-gene CURATED JSON layer from the legacy dictybase.org before
it goes dark. For every DDB_G gene, capture the gene-page sub-endpoints that carry
dictyBase-unique curation not fully present in the bulk downloads:

  gene/info.json         name etymology, alternate names, general info
  gene/genomic_info.json coordinates / chromosome / strand
  gene/product.json      gene product, DDB0 feature id, protein length, model evidence
  gene/summary.json      curated long description + any "Alert" warnings
  gene/links.json        external cross-reference accessions (GenBank/ENA/Ensembl/Inparanoid/STKE/dictyExpress)
  gene/references.json   per-paper topic tags, DOI, publication id, associated genes
  orthologs.json         orthologs with UniProt accession + product name

Stored as one gzipped JSON per gene under assets/dictybase-downloads/gene-json/<DDB>.json.gz
(resumable: an existing file is skipped). GO and phenotypes are omitted (already held).

  python3 scripts/scrape_gene_pages.py             # all genes, one worker
  python3 scripts/scrape_gene_pages.py 500         # cap this run to 500 new genes (testing)
  python3 scripts/scrape_gene_pages.py --shard i/N # only genes where index%N==i (parallel workers)

Run N shards concurrently to finish faster; they never collide because each writes
a distinct set of genes and an existing <DDB>.json.gz is always skipped.
"""
import gzip
import json
import os
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
DEST = os.path.join(ASSETS, "dictybase-downloads", "gene-json")
BASE = "http://dictybase.org/gene"
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE

# The four endpoints carrying dictyBase-unique curation not recoverable from the
# bulk downloads or external DBs. (genomic_info dropped — we already hold coords;
# info/product dropped — name etymology is partly in dictybase_live_curation.json
# and DDB0 ids / protein length are derivable. Kept lean so the scrape finishes
# before the legacy server, which throttles to ~1-2 req/s, goes dark.)
ENDPOINTS = {
    "summary": "{b}/{g}/gene/summary.json",       # curated description + Alerts
    "links": "{b}/{g}/gene/links.json",           # external xref accessions
    "references": "{b}/{g}/references.json",       # per-paper topics, DOI, pub id, assoc genes
    "orthologs": "{b}/{g}/orthologs.json",         # orthologs w/ UniProt accession + product
    "product": "{b}/{g}/gene/product.json",        # authoritative current DDB0 feature id + protein length
    "info": "{b}/{g}/gene/info.json",             # name etymology + alternate protein names
    "genomic_info": "{b}/{g}/gene/genomic_info.json",  # coordinates + curated sequence Notes
    "sequences": "{b}/{g}/gene/sequences.json",   # EST / cDNA evidence (GenBank + EST feature ids)
    "promoters": "{b}/{g}/gene/promoters.json",   # computationally inferred regulatory motifs
}


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=40, context=_CTX) as r:
        return r.read().decode("utf-8", "replace")


def all_gene_ids():
    with open(os.path.join(ASSETS, "gene_index.json")) as fh:
        return [r[0] for r in json.load(fh) if r and str(r[0]).startswith("DDB_G")]


def main():
    cap = None
    shard_i = shard_n = None
    for arg in sys.argv[1:]:
        if arg.startswith("--shard"):
            spec = arg.split("=", 1)[1] if "=" in arg else sys.argv[sys.argv.index(arg) + 1]
            shard_i, shard_n = (int(x) for x in spec.split("/"))
        elif arg.isdigit():
            cap = int(arg)
    os.makedirs(DEST, exist_ok=True)
    ids = all_gene_ids()
    if shard_n:
        ids = [g for k, g in enumerate(ids) if k % shard_n == shard_i]

    def load(g):
        p = os.path.join(DEST, f"{g}.json.gz")
        if not os.path.exists(p):
            return None
        try:
            with gzip.open(p, "rt", encoding="utf-8") as fh:
                return json.load(fh)
        except Exception:  # noqa: BLE001 — corrupt/partial file: re-fetch it
            return None

    # A gene is "done" only once every endpoint key is present. This makes the
    # scrape backfill new endpoints onto files captured with an earlier, smaller
    # set (only the missing endpoints are fetched).
    def is_done(g):
        r = load(g)
        return r is not None and all(k in r for k in ENDPOINTS)
    todo = [g for g in ids if not is_done(g)]
    print(f"{len(ids)} genes in shard; {len(ids) - len(todo)} complete; {len(todo)} to fetch/backfill"
          + (f" (capping at {cap})" if cap else ""), file=sys.stderr)
    n = 0
    for g in todo:
        if cap and n >= cap:
            break
        rec = load(g) or {"ddb": g}
        rec["ddb"] = g
        got = False
        for key, tmpl in ENDPOINTS.items():
            if key in rec:
                continue
            try:
                rec[key] = json.loads(fetch(tmpl.format(b=BASE, g=g)))
                got = True
            except json.JSONDecodeError:
                rec[key] = None
            except Exception:
                rec[key] = None
            time.sleep(0.05)
        if got or load(g) is None:
            with gzip.open(os.path.join(DEST, f"{g}.json.gz"), "wt", encoding="utf-8") as fh:
                json.dump(rec, fh, ensure_ascii=False)
        n += 1
        if n % 200 == 0:
            print(f"  ...{n} genes done", file=sys.stderr)
    print(f"\ndone: {n} genes processed this run; "
          f"{len(os.listdir(DEST))} total on disk", file=sys.stderr)


if __name__ == "__main__":
    main()
