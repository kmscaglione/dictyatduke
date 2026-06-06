#!/usr/bin/env python3
"""Build KEGG pathway membership for D. discoideum genes -> assets/kegg_pathways.json.

KEGG's Dictyostelium organism (ddi) keys genes by their DDB_G id, so the join to
our gene records is direct. Fetches pathway names + gene->pathway links from the
KEGG REST API.

Output (keyed by DDB_G id):
  { "DDB_G...": [ {"id": "ddi00010", "name": "Glycolysis / Gluconeogenesis"}, ... ] }
Run:  python3 scripts/build_kegg_pathways.py
"""
import json
import pathlib
import re
import ssl
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "kegg_pathways.json"

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE
BASE = "https://rest.kegg.jp"


def fetch(url):
    with urllib.request.urlopen(url, timeout=60, context=SSL_CTX) as r:
        return r.read().decode("utf-8", "replace")


def main():
    # pathway id -> clean name (drop the " - Dictyostelium discoideum …" suffix)
    names = {}
    for line in fetch(f"{BASE}/list/pathway/ddi").splitlines():
        if "\t" not in line:
            continue
        pid, desc = line.split("\t", 1)
        names[pid] = re.sub(r"\s*-\s*Dictyostelium discoideum.*$", "", desc).strip()

    # gene (DDB) -> [pathway ids]
    gene_paths = {}
    for line in fetch(f"{BASE}/link/pathway/ddi").splitlines():
        if "\t" not in line:
            continue
        gene, path = line.split("\t", 1)
        ddb = gene.split(":", 1)[-1]
        pid = path.split(":", 1)[-1]
        if ddb.startswith("DDB_G"):
            gene_paths.setdefault(ddb, set()).add(pid)

    out = {ddb: [{"id": p, "name": names.get(p, p)} for p in sorted(pids)]
           for ddb, pids in gene_paths.items()}
    OUT.write_text(json.dumps(out, separators=(",", ":")) + "\n")
    print(f"{len(out)} genes mapped to {len(names)} KEGG pathways -> {OUT}")


if __name__ == "__main__":
    main()
