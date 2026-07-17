#!/usr/bin/env python3
"""Production canary: probe the LIVE dictyBase site and verify it is returning
the data it should. Exits non-zero if any check fails, so a scheduled runner
(.github/workflows/canary.yml) turns a red run into an alert.

Checks, against $CANARY_BASE (default https://dicty.labs.duke.edu):
  - /api/health is ok
  - each golden gene resolves via /api/gene/<symbol> with GO terms + sequence links
  - /api/search finds a golden gene
  - the stock catalog is served with a sane number of strains/plasmids

Stdlib only. Run:
    python3 scripts/canary.py
    CANARY_BASE=http://127.0.0.1:8774 python3 scripts/canary.py   # against a local server
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request

BASE = os.environ.get("CANARY_BASE", "https://dicty.labs.duke.edu").rstrip("/")
UA = "dictyBase-canary/1.0 (+https://dicty.labs.duke.edu)"
# Verify TLS by default (GitHub runners have a CA bundle, so this also catches a
# real cert expiry). Set CANARY_INSECURE=1 to skip it on a machine whose local CA
# store is broken (e.g. a fresh python.org install that never ran Install
# Certificates), so a local run isn't blocked by an environment quirk.
CTX = ssl.create_default_context()
if os.environ.get("CANARY_INSECURE") == "1":
    CTX.check_hostname = False
    CTX.verify_mode = ssl.CERT_NONE

# (symbol, DDB_G id) — stable, well-studied golden records.
GOLDEN = [
    ("rasG", "DDB_G0293434"),
    ("cln5", "DDB_G0275299"),
    ("mhcA", "DDB_G0286355"),
    ("pkaC", "DDB_G0283907"),
]

_failures = []


def get(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30, context=CTX) as r:
        return getattr(r, "status", 200) or 200, json.load(r)


def check(name, fn):
    try:
        fn()
        print("  PASS  %s" % name)
    except Exception as exc:  # noqa: BLE001 — any failure is a failed check
        print("  FAIL  %s  --  %s" % (name, exc))
        _failures.append(name)


def check_health():
    code, body = get("/api/health")
    assert code == 200, "HTTP %s" % code
    assert body.get("status") == "ok", body


def check_gene(sym):
    code, g = get("/api/gene/%s" % sym)
    assert code == 200, "HTTP %s" % code
    assert (g.get("symbol") or "").lower() == sym.lower(), "wrong symbol %r" % g.get("symbol")
    assert g.get("go"), "no GO terms"
    assert set(g.get("sequences") or {}) == {"genomic", "cdna", "protein"}, \
        "sequences %s" % list(g.get("sequences") or {})


def check_search():
    code, body = get("/api/search?q=rasG")
    assert code == 200, "HTTP %s" % code
    ddbs = {r["ddb"] for r in body.get("results", [])}
    assert "DDB_G0293434" in ddbs, "rasG (DDB_G0293434) not in search results"


def check_stock():
    code, sc = get("/assets/stock_center.json")
    assert code == 200, "HTTP %s" % code
    ns, npl = len(sc.get("strains", [])), len(sc.get("plasmids", []))
    assert ns > 5000, "only %d strains" % ns
    assert npl > 500, "only %d plasmids" % npl


def main():
    print("dictyBase canary -> %s" % BASE)
    check("health", check_health)
    for sym, _ddb in GOLDEN:
        check("gene:%s" % sym, lambda s=sym: check_gene(s))
    check("search", check_search)
    check("stock-catalog", check_stock)
    if _failures:
        print("\nCANARY FAILED: %d check(s): %s" % (len(_failures), ", ".join(_failures)))
        sys.exit(1)
    print("\nAll checks passed.")


if __name__ == "__main__":
    main()
