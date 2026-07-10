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
import re
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


_TAG_RE = re.compile(r"<[^>]+>")


def _u(s):
    # API text has HTML entities (&#947; -> γ) and inline tags (<u>, <sub>, <i>);
    # decode the entities and strip the tags to plain text.
    return _TAG_RE.sub("", html.unescape(s)) if s else s


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


PLASMID_FIELDS = "id name summary in_stock genbank_accession depositor{ first_name last_name }"


def _depositor(dep):
    if not dep:
        return ""
    fn = _u((dep.get("first_name") or "").strip())
    ln = _u((dep.get("last_name") or "").strip())
    if " " in ln:                       # last_name often holds the full display name
        return ln
    return (fn + " " + ln).strip()


def _map_plasmid(p):
    obj = {"id": p["id"], "name": _u(p.get("name")) or p["id"], "in_stock": bool(p.get("in_stock"))}
    desc = " ".join(_u(p.get("summary") or "").split())
    dep = _depositor(p.get("depositor"))
    gb = (p.get("genbank_accession") or "").strip()
    if desc:
        obj["description"] = desc
    if dep:
        obj["depositor"] = dep
    if gb:
        obj["genbank"] = gb
    return obj


def fetch_plasmids(page=500):
    out, cursor, pages = [], 0, 0
    while True:
        q = "{ listPlasmids(cursor:%d, limit:%d){ nextCursor plasmids{ %s } } }" % (cursor, page, PLASMID_FIELDS)
        d = _post(q)
        if "errors" in d and not d.get("data"):
            raise SystemExit("API error for plasmids: %s" % d["errors"])
        ls = d["data"]["listPlasmids"]
        out.extend(_map_plasmid(p) for p in ls["plasmids"])
        pages += 1
        nc = ls.get("nextCursor")
        sys.stdout.write("\r  plasmids: %d (%d pages)" % (len(out), pages))
        sys.stdout.flush()
        if not nc or not ls["plasmids"]:
            break
        cursor = nc
        time.sleep(0.3)
    print()
    return out


def main():
    # mode: all (default) = everything; main/strains/plasmids = parts of
    # stock_center.json; gwdi = stock_gwdi.json only.
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    print("Fetching from %s (mode: %s)" % (EP, mode))
    sc_path = os.path.join(ASSETS, "stock_center.json")
    existing = json.load(open(sc_path)) if os.path.exists(sc_path) else {}
    strains = existing.get("strains", [])
    plasmids = existing.get("plasmids", [])
    regular = bacterial = None

    # Curator hand-edits (made via /tools/curate → write_stock) carry an
    # `edited_date`. A re-fetch must NOT clobber them: the curator's version wins
    # by id, and curator-added entries not in the fetch are kept. Without this,
    # re-running build_stock_center.py would silently wipe every stock edit.
    def _preserve(fetched, existing_list):
        edited = {e["id"]: e for e in existing_list
                  if isinstance(e, dict) and e.get("edited_date") and e.get("id")}
        if not edited:
            return fetched
        by_id = {e["id"]: e for e in fetched if isinstance(e, dict) and e.get("id")}
        by_id.update(edited)      # curator versions win; curator-only ids added
        print("  preserved %d hand-edited stock entr%s (edited_date set)"
              % (len(edited), "y" if len(edited) == 1 else "ies"))
        return list(by_id.values())

    if mode in ("all", "main", "strains"):
        regular = fetch_type("REGULAR")
        bacterial = fetch_type("BACTERIAL")
        merged = _preserve(regular + bacterial, existing.get("strains", []))
        strains = sorted(merged, key=lambda s: (s.get("label") or s.get("id") or "").lower())
    if mode in ("all", "main", "plasmids"):
        merged = _preserve(fetch_plasmids(), existing.get("plasmids", []))
        plasmids = sorted(merged, key=lambda p: (p.get("name") or p.get("id") or "").lower())

    if mode in ("all", "main", "strains", "plasmids"):
        counts = {"strains": len(strains), "plasmids": len(plasmids)}
        if regular is not None:
            counts.update(regular=len(regular), bacterial=len(bacterial))
        main = {
            "_meta": {
                "description": "Dicty Stock Center catalog: browseable strains (regular + "
                               "bacterial) and plasmids. GWDI insertion-bank strains are in "
                               "stock_gwdi.json, searched via /api/stock-gwdi.",
                "source": {"name": "dictyBase / Dicty Stock Center",
                           "api": EP, "license": "CC BY 4.0"},
                "counts": counts,
            },
            "strains": strains,
            "plasmids": plasmids,
        }
        json.dump(main, open(sc_path, "w"), ensure_ascii=False, separators=(",", ":"))
        print("Wrote stock_center.json (%d strains + %d plasmids) %.2f MB"
              % (len(strains), len(plasmids), os.path.getsize(sc_path) / 1e6))

    if mode in ("all", "gwdi"):
        gwdi = sorted(fetch_type("GWDI"), key=lambda s: s["label"].lower())
        g_path = os.path.join(ASSETS, "stock_gwdi.json")
        json.dump({
            "_meta": {"description": "Dicty Stock Center GWDI (Genome-Wide Dictyostelium "
                                     "Insertion) bank — hosted locally, searched via "
                                     "/api/stock-gwdi.",
                      "source": {"name": "dictyBase / Dicty Stock Center", "api": EP,
                                 "license": "CC BY 4.0"},
                      "counts": {"strains": len(gwdi)}},
            "strains": gwdi,
        }, open(g_path, "w"), ensure_ascii=False, separators=(",", ":"))
        print("Wrote stock_gwdi.json (%d GWDI strains) %.2f MB"
              % (len(gwdi), os.path.getsize(g_path) / 1e6))


if __name__ == "__main__":
    main()
