#!/usr/bin/env python3
"""Build the stock-center strain catalog from the live dictyBase GraphQL API.

Pulls the full Dicty Stock Center strain collection (REGULAR + BACTERIAL into the
main catalog, the large GWDI insertion bank into a separate lazy-loaded file) and
maps each strain into the compact shape the site's stock page expects.

  REGULAR + BACTERIAL -> assets/stock_center.json  (key: "strains"; plasmids kept as-is)
  GWDI                -> assets/stock_gwdi.json

Re-run any time to refresh. Source: https://graphql.dictybase.dev/graphql (CC BY;
this is dictyBase's own Stock Center data).
"""
import html
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

EP = "https://graphql.dictybase.dev/graphql"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")

# The API's TLS cert is valid; some Python installs just lack a CA bundle. Try a
# verified context first, fall back to unverified for this public read-only pull.
try:
    import certifi  # type: ignore
    _CTX = ssl.create_default_context(cafile=certifi.where())
except Exception:
    try:
        _CTX = ssl.create_default_context()
        _CTX.check_hostname = True
    except Exception:
        _CTX = ssl._create_unverified_context()


def _post(query, tries=5):
    global _CTX
    body = json.dumps({"query": query}).encode()
    for attempt in range(tries):
        req = urllib.request.Request(EP, body, {"Content-Type": "application/json"})
        try:
            return json.load(urllib.request.urlopen(req, timeout=120, context=_CTX))
        except ssl.SSLCertVerificationError:
            _CTX = ssl._create_unverified_context()          # retry with unverified
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt == tries - 1:
                raise
            wait = 3 * (attempt + 1)
            sys.stdout.write("  [retry in %ds after %s]\n" % (wait, e))
            sys.stdout.flush()
            time.sleep(wait)


STRAIN_FIELDS = ("id label summary in_stock names genotypes "
                 "phenotypes{ phenotype } characteristics")


def _u(s):
    # The API returns HTML-entity-encoded text (e.g. "&#947;S13" for "γS13").
    return html.unescape(s) if s else s


def _map_strain(s):
    # Always keep id/label/in_stock; add the rest only when non-empty to keep
    # the catalog compact (28k+ strains).
    obj = {"id": s["id"],                            # DBS id — canonical for ordering
           "label": _u(s.get("label")) or s["id"],   # human-readable strain name
           "in_stock": bool(s.get("in_stock"))}
    pheno = [_u(p.get("phenotype")) for p in (s.get("phenotypes") or []) if p.get("phenotype")]
    pheno += [_u(c) for c in (s.get("characteristics") or []) if c]
    summary = " ".join(_u(s.get("summary") or "").split())
    genotype = "; ".join(_u(g) for g in (s.get("genotypes") or []) if g)
    phenotype = " · ".join(dict.fromkeys(pheno))
    names = [_u(n) for n in (s.get("names") or []) if n and _u(n) != obj["label"]]
    if summary:
        obj["summary"] = summary
    if genotype:
        obj["genotype"] = genotype
    if phenotype:
        obj["phenotype"] = phenotype
    if names:
        obj["names"] = names
    return obj


def fetch_type(strain_type, page=300):
    out, cursor, pages = [], 0, 0
    while True:
        q = ("{ listStrains(cursor:%d, limit:%d, filter:{strain_type:%s}){ nextCursor "
             "strains{ %s } } }" % (cursor, page, strain_type, STRAIN_FIELDS))
        d = _post(q)
        if "errors" in d and not d.get("data"):
            raise SystemExit("API error for %s: %s" % (strain_type, d["errors"]))
        ls = d["data"]["listStrains"]
        out.extend(_map_strain(s) for s in ls["strains"])
        pages += 1
        nc = ls.get("nextCursor")
        sys.stdout.write("\r  %s: %d strains (%d pages)" % (strain_type, len(out), pages))
        sys.stdout.flush()
        if not nc or not ls["strains"]:
            break
        cursor = nc
        time.sleep(0.3)          # be gentle on the API gateway (fewer 502s)
    print()
    return out


def main():
    # Bundle the browseable strains (regular + bacterial). The GWDI insertion bank
    # (~21.5k strains) is intentionally NOT bundled — it's queried live from the API
    # via the /api/stock-gwdi proxy, since it's found by gene, not by browsing.
    print("Fetching from", EP)
    regular = fetch_type("REGULAR")
    bacterial = fetch_type("BACTERIAL")

    sc_path = os.path.join(ASSETS, "stock_center.json")
    existing = json.load(open(sc_path)) if os.path.exists(sc_path) else {}
    plasmids = existing.get("plasmids", [])
    main_strains = sorted(regular + bacterial, key=lambda s: s["label"].lower())
    main = {
        "_meta": {
            "description": "Dicty Stock Center catalog: browseable strains (regular + "
                           "bacterial) and plasmids. The GWDI insertion bank is searched "
                           "live via /api/stock-gwdi.",
            "source": {"name": "dictyBase / Dicty Stock Center",
                       "api": EP, "license": "CC BY 4.0"},
            "counts": {"strains": len(main_strains), "plasmids": len(plasmids),
                       "regular": len(regular), "bacterial": len(bacterial)},
        },
        "strains": main_strains,
        "plasmids": plasmids,
    }
    json.dump(main, open(sc_path, "w"), ensure_ascii=False, separators=(",", ":"))
    print("Wrote stock_center.json (%d strains + %d plasmids) %.2f MB"
          % (len(main_strains), len(plasmids), os.path.getsize(sc_path) / 1e6))


if __name__ == "__main__":
    main()
