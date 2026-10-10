#!/usr/bin/env python3
"""Check a running site's spatial proteomics preview from the outside.

    python3 scripts/verify_spatial_preview.py https://dicty.labs.duke.edu           # preview should be on
    python3 scripts/verify_spatial_preview.py https://dicty.labs.duke.edu --expect off

Read-only. Standard library only. Exit 0 when every check passes.
"""
import argparse
import json
import ssl
import sys
import urllib.error
import urllib.request

results = []


def check(name, ok, detail=""):
    results.append(ok)
    print(("  ok   " if ok else "  FAIL ") + name + (("  [" + str(detail)[:110] + "]") if detail and not ok else ""))


def fetch(base, path, data=None, ctx=None):
    req = urllib.request.Request(base + path, data=json.dumps(data).encode() if data is not None else None,
                                 headers={"Content-Type": "application/json", "User-Agent": "dictybase-preview-check"})
    try:
        with urllib.request.urlopen(req, timeout=60, context=ctx) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("base")
    ap.add_argument("--expect", choices=["on", "off"], default="on")
    ap.add_argument("--insecure", action="store_true", help="skip TLS verification (only for a machine whose Python cannot verify)")
    args = ap.parse_args()
    base = args.base.rstrip("/")
    ctx = ssl._create_unverified_context() if args.insecure else None
    get = lambda p, d=None: fetch(base, p, d, ctx)

    print("Unlisted, not indexed")
    code, headers, body = get("/tools/spatial")
    html = body.decode("utf-8", "replace")
    check("/tools/spatial answers 200", code == 200, code)
    check("X-Robots-Tag: noindex, nofollow on the page", headers.get("X-Robots-Tag") == "noindex, nofollow", headers.get("X-Robots-Tag"))
    check("robots meta tag on the page", '<meta name="robots" content="noindex, nofollow">' in html)
    check("no canonical link on the page", 'rel="canonical"' not in html)
    check("no menu entry in the page source", 'href="/tools/spatial"' not in html and "data-spatial-nav" not in html)
    for path in ("/sitemap.xml", "/robots.txt", "/api/data-status", "/", "/tools"):
        text = get(path)[2].decode("utf-8", "replace").lower()
        check("no mention in " + path, "tools/spatial" not in text and "spatial proteomics" not in text)
    check("home page is not marked noindex", "noindex" not in get("/")[2].decode("utf-8", "replace"))

    print("Dataset API")
    code, headers, body = get("/api/spatial/status")
    status = json.loads(body) if code == 200 else {}
    if args.expect == "off":
        check("status reports the preview as unavailable", status.get("available") is False, status)
        for path in ("/api/spatial/bundle", "/api/spatial/layers", "/api/spatial/gene?ddb=DDB_G0271848", "/api/spatial/go-names?ids=GO:0005739"):
            check(path + " is refused", get(path)[0] == 404)
    else:
        check("status reports the preview as available", status.get("available") is True, status)
        check("status marks it as not a public release", status.get("preview") is True)
        code, headers, body = get("/api/spatial/bundle")
        check("bundle answers 200 with noindex and without CORS", code == 200 and headers.get("X-Robots-Tag") == "noindex, nofollow" and "Access-Control-Allow-Origin" not in headers)
        b = json.loads(body) if code == 200 else {"entities": [], "layers": [{"assignments": []}], "dataset": {"citation": {}, "license": {}}}
        detected = [e for e in b["entities"] if e.get("detected", True)]
        svm = b["layers"][0]["assignments"]
        check("6,337 detected protein groups", len(detected) == 6337, len(detected))
        check("3,169 assigned and 3,168 unknown", (sum(a["status"] == "assigned" for a in svm), sum(a["status"] != "assigned" for a in svm)) == (3169, 3168))
        check("no threshold, profiles or map in the data", "threshold" not in b["layers"][0].get("score", {}) and not any(k in b for k in ("profiles", "embeddings", "fractions")))
        check("citation, licence and attribution present", bool(b["dataset"]["citation"].get("doi")) and b["dataset"]["license"].get("id") == "CC-BY-NC-ND-4.0" and bool(b["dataset"].get("attribution")))
        code, _, body = get("/api/spatial/gene?ddb=DDB_G0271848")
        g = json.loads(body) if code == 200 else {"groups": []}
        row = next((a for grp in g["groups"] for a in grp["assignments"] if a["layer"] == "svm"), {})
        check("protein details: porA is assigned to Mitochondria with its published score", row.get("compartment") == "Mitochondria" and row.get("score") == 0.77483481679008, row)
        code, _, body = get("/api/spatial/gene?ddb=DDB_G0295715")
        check("a gene in two protein groups returns both", code == 200 and len(json.loads(body)["groups"]) == 2)
        code, _, body = get("/api/spatial/layers")
        layers = json.loads(body).get("layers", []) if code == 200 else []
        check("GO layers load", [l["id"] for l in layers] == ["go-cc-experimental", "go-cc-inferred"])
        perox = [a["entity"] for a in svm if a["status"] == "assigned" and a["compartment"] == "peroxisome"]
        ent = {e["id"]: e for e in b["entities"]}
        single = lambda e: len({m["gene"] for m in e["members"] if m["gene"]}) == 1
        study = sorted({m["gene"] for i in perox if single(ent[i]) for m in ent[i]["members"] if m["gene"]})
        background = sorted({m["gene"] for e in detected if single(e) for m in e["members"] if m["gene"]})
        check("compartment browsing: 75 protein groups assigned to Peroxisome", len(perox) == 75, len(perox))
        code, _, body = get("/api/enrichment", {"genes": study, "background_genes": background, "min_study": 2})
        r = json.loads(body) if code == 200 else {"results": []}
        top = [t["id"] for t in r["results"][:5]]
        check("enrichment against the detected proteome puts peroxisome first", code == 200 and r.get("background_custom") is True and "GO:0005777" in top, top)

    print("Viewer files and private files")
    for path in ("/spatial/js/spatial-explorer.js", "/spatial/js/spatial-explorer.css", "/spatial/adapters/dictybase/adapter.js"):
        check(path + " loads", get(path)[0] == 200)
    for path in ("/spatial/adapters/dictybase/local/tinker2026-vegetative.bundle.json", "/spatial/tests/fixtures/alpha.bundle.json",
                 "/spatial/adapters/dictybase/dicty_site.py", "/cache/pageviews.json", "/cache/recent_papers.json",
                 "/assets/curators.json", "/assets/dictybase-corpus/colleagues.json", "/serve.py", "/docs/nar-paper.docx"):
        code, _, body = get(path)
        check(path + " is not served as a file", code == 404 or body[:15].lower().startswith(b"<!doctype html"), code)

    print("Rest of the site")
    check("/api/health", get("/api/health")[0] == 200)
    code, _, body = get("/api/gene/catA")
    check("/api/gene/catA is catalase A", code == 200 and json.loads(body).get("ddb") == "DDB_G0274595")
    code, _, body = get("/api/enrichment", {"genes": ["abpA", "abpC", "corA", "ctxA", "ctxB", "fimA", "myoB", "racE", "limE", "forH"]})
    r = json.loads(body) if code == 200 else {}
    check("default enrichment is unchanged in shape", code == 200 and "background_custom" not in r and r.get("results"))
    for path in ("/", "/gene/mhcA", "/tools/enrichment", "/tools/proteomics", "/app.js", "/styles.css", "/assets/gene_index.json", "/sitemap.xml"):
        check(path + " answers 200", get(path)[0] == 200)

    bad = results.count(False)
    print("\n%d/%d checks passed" % (len(results) - bad, len(results)) + (" — all good" if not bad else ""))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
