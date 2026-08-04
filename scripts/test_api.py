#!/usr/bin/env python3
"""Smoke-test the public API against a running server.

The site has no build step and no test suite, so a broken endpoint or a data
regression only shows up when a user hits it. This hits the key endpoints and
asserts status, shape, and a few values cross-checked against the asset files
(so e.g. a gene's served location must still equal gene_index.json — the exact
class of bug the accuracy audit found).

    python3 scripts/test_api.py                       # tests http://localhost:8774
    python3 scripts/test_api.py https://dicty.labs.duke.edu

Start serve.py first. Exit 0 = all passed, 1 = at least one failed. Stdlib only.
"""
import json
import os
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8774").rstrip("/")

_passed = _failed = 0


def check(name, cond, detail=""):
    global _passed, _failed
    if cond:
        _passed += 1
        print(f"  ok   {name}")
    else:
        _failed += 1
        print(f"  FAIL {name}{'  — ' + detail if detail else ''}")


def get(path):
    """Return (status, body_text). Never raises for HTTP errors."""
    try:
        with urllib.request.urlopen(BASE + path, timeout=20) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception as e:  # noqa: BLE001 — connection refused etc.
        return 0, str(e)


def get_json(path):
    st, body = get(path)
    try:
        return st, json.loads(body)
    except ValueError:
        return st, None


def get_headers(path):
    """(status, {lowercased header: value}) — never raises."""
    try:
        with urllib.request.urlopen(BASE + path, timeout=20) as r:
            return r.status, {k.lower(): v for k, v in r.headers.items()}
    except urllib.error.HTTPError as e:
        return e.code, {k.lower(): v for k, v in e.headers.items()}
    except Exception:
        return 0, {}


def head_status(path):
    """Status of a HEAD request (never raises)."""
    try:
        req = urllib.request.Request(BASE + path, method="HEAD")
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status
    except urllib.error.HTTPError as e:
        return e.code
    except Exception:
        return 0


def load_asset(name):
    with open(os.path.join(ROOT, "assets", name)) as fh:
        return json.load(fh)


def main():
    print(f"=== API smoke test against {BASE} ===")
    st, _ = get("/")
    check("GET / (SPA shell)", st == 200, f"status {st}")
    if st == 0:
        print("\nServer not reachable — start serve.py first.")
        return 1

    check("GET /api/health", get("/api/health")[0] == 200)

    st, v = get_json("/api/version")
    check("GET /api/version has a version", st == 200 and isinstance(v, dict) and "version" in v)

    st, ds = get_json("/api/data-status")
    labels = [d.get("label", "") for d in (ds.get("datasets") if isinstance(ds, dict) else [])]
    check("GET /api/data-status lists datasets", st == 200 and len(labels) > 8)
    check("data-status surfaces KEGG map count", any("KEGG maps" in l for l in labels),
          "expected a 'Pathways — N KEGG maps' row")

    # Gene records: served location must equal gene_index.json (audit invariant).
    idx = {r[0]: (r[1], r[3]) for r in load_asset("gene_index.json")}
    for ddb, sym in (("DDB_G0286355", "mhcA"), ("DDB_G0293434", "rasG")):
        st, g = get_json(f"/api/gene/{sym}")
        want = idx[ddb][1]
        check(f"GET /api/gene/{sym} status", st == 200 and isinstance(g, dict))
        check(f"/api/gene/{sym} location == gene_index",
              isinstance(g, dict) and g.get("location") == want,
              f"served {g.get('location') if isinstance(g, dict) else g!r} != {want}")

    check("rasG is on chromosome 6 (NC_007092)",
          "NC_007092" in (get_json("/api/gene/rasG")[1] or {}).get("location", ""))

    st, s = get_json("/api/search?q=myosin")
    n = len(s) if isinstance(s, list) else len(s.get("results", []) if isinstance(s, dict) else [])
    check("GET /api/search?q=myosin returns hits", st == 200 and n > 0)

    # /api/domains?ddb= only serves genes in the precomputed cache, so pick one
    # from domains.json rather than assuming a specific gene is cached.
    try:
        dj = load_asset("domains.json")
        pool = [k for k in dj if str(k).startswith("DDB_G")]
        if not pool:  # unwrap a {_meta, <wrapper>: {...}} container
            inner = next((dj[k] for k in dj if not str(k).startswith("_") and isinstance(dj[k], dict)), {})
            pool = [k for k in inner if str(k).startswith("DDB_G")]
        cached = pool[0] if pool else None
    except (OSError, ValueError):
        cached = None
    if cached:
        st, dom = get_json(f"/api/domains?ddb={cached}")
        check(f"GET /api/domains?ddb={cached}", st == 200 and isinstance(dom, (dict, list)))
    else:
        check("GET /api/domains (cached gene available)", False, "no DDB_G key in domains.json")

    st, strain = get_json("/api/strain/DBS0236546")
    gene = strain.get("gene") if isinstance(strain, dict) else None
    check("GET /api/strain maps to its gene (mhcA)",
          isinstance(gene, dict) and (gene.get("symbol") == "mhcA"))

    for path, needle in (("/rss.xml", "<rss"), ("/news.xml", "<feed"),
                         ("/sitemap.xml", "/gene/"), ("/robots.txt", "Sitemap")):
        st, body = get(path)
        check(f"GET {path}", st == 200 and needle in body, f"status {st}")

    # Security regression: the curator-state tree must never be web-served, and
    # must not be reachable via percent-encoding or HEAD (the 2026 bypass). A
    # served file returns 200; a blocked one returns 404. Assert != 200.
    for path in ("/uploads/curator_state/curators.json",
                 "/%75ploads/curator_state/curators.json",
                 "/uploads%2fcurator_state/curators.json"):
        st, _ = get(path)
        check(f"blocked (GET) {path}", st != 200, f"status {st}")
    check("blocked (HEAD) /uploads/curator_state/",
          head_status("/uploads/curator_state/curators.json") != 200)

    # Security response headers present (CSP is the key XSS defense).
    _, h = get_headers("/")
    csp = h.get("content-security-policy", "")
    check("header: Content-Security-Policy", bool(csp))
    check("CSP script-src has no 'unsafe-inline'",
          "script-src" in csp and "'unsafe-inline'" not in csp.split("script-src", 1)[1].split(";", 1)[0])
    check("header: X-Content-Type-Options nosniff", h.get("x-content-type-options", "").lower() == "nosniff")
    check("header: X-Frame-Options", bool(h.get("x-frame-options")))
    check("header: Strict-Transport-Security", "max-age" in h.get("strict-transport-security", ""))
    check("Server header doesn't leak Python version", "python" not in h.get("server", "").lower())

    print(f"\n{_passed}/{_passed + _failed} passed"
          + (f" — {_failed} FAILED" if _failed else " — all good"))
    return 1 if _failed else 0


if __name__ == "__main__":
    sys.exit(main())
