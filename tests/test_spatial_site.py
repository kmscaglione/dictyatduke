"""Spatial proteomics integration: gated endpoints, path blocking, the gene
lookup, GO layers, and the page itself in headless Chrome when available.

The always-on classes use the synthetic fixture, so CI needs no restricted
data. LocalBundleTest checks the real dataset and skips where it is absent
(it is never committed).
"""
import importlib.util
import json
import os
import pathlib
import re
import sys
import tempfile
import threading
import unittest
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "spatial" / "py"))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")
import serve  # noqa: E402
from spatialprot import bundle as B, summary, validate as V  # noqa: E402

site = serve.spatial_site
FIXTURE = ROOT / "spatial" / "tests" / "fixtures" / "alpha.bundle.json"
LOCAL = ROOT / "spatial" / "adapters" / "dictybase" / "local" / "tinker2026-vegetative.bundle.json"

_spec = importlib.util.spec_from_file_location("sx_browser", ROOT / "spatial" / "tests" / "test_browser.py")


def _browser():
    sys.path.insert(0, str(ROOT / "spatial" / "tests"))
    mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(mod)
    return mod


class _Server(unittest.TestCase):
    ENV = {}

    @classmethod
    def setUpClass(cls):
        cls._saved = {k: os.environ.get(k) for k in ("DICTY_SPATIAL_BUNDLE", "DICTY_SPATIAL_PREVIEW")}
        cls.setenv(**cls.ENV)
        cls.srv = serve.Server(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()
        cls.setenv(**cls._saved)

    @staticmethod
    def setenv(**kw):
        for k, v in kw.items():
            if v is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = str(v)

    def fetch(self, path):
        try:
            with urllib.request.urlopen("http://127.0.0.1:%d%s" % (self.port, path), timeout=30) as r:
                return r.status, dict(r.headers), r.read()
        except urllib.error.HTTPError as e:
            return e.code, dict(e.headers), e.read()

    def get(self, path):
        code, headers, body = self.fetch(path)
        return code, json.loads(body)


@unittest.skipUnless(site, "spatial module not importable")
class PublicFixtureTest(_Server):
    """A bundle cleared for distribution is served with no preview switch."""
    ENV = {"DICTY_SPATIAL_BUNDLE": FIXTURE, "DICTY_SPATIAL_PREVIEW": None}

    def test_status_and_bundle(self):
        code, st = self.get("/api/spatial/status")
        self.assertEqual((code, st["available"], st["preview"]), (200, True, False))
        self.assertEqual(st["counts"]["protein_groups"], 80)
        for key in ("citation", "license", "attribution"):
            self.assertTrue(st["dataset"][key])
        code, headers, body = self.fetch("/api/spatial/bundle")
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(body), B.load(FIXTURE))
        self.assertNotIn("public", headers.get("Cache-Control", ""))

    def test_gene_lookup_keeps_groups_and_layers_apart(self):
        b = B.load(FIXTURE)
        gene, ids = next((g, v) for g, v in B.gene_index(b).items() if len(v) > 1)
        got = site.gene(gene)
        self.assertEqual([g["entity"] for g in got["groups"]], ids)
        for g in got["groups"]:
            layers = [a["layer"] for a in g["assignments"]]
            self.assertEqual(len(layers), len(set(layers)))
            self.assertTrue(all(a["evidence_type"] for a in g["assignments"]))
        multi = b["dataset"]["mapping"]["multi_gene_entities"][0]
        first = B.entity_genes(next(e for e in b["entities"] if e["id"] == multi))[0]
        self.assertEqual(len(site.gene(first)["groups"][0]["other_genes"]), 1)
        clf = [a for g in site.gene(first)["groups"] for a in g["assignments"] if a["layer"] == "classifier"][0]
        self.assertEqual(clf["score_name"], "classifier.score")
        self.assertEqual(site.gene("nope")["groups"], [])
        code, _ = self.get("/api/spatial/gene?ddb=nope")
        self.assertEqual(code, 400)

    def test_unknown_calls_keep_their_label_and_exact_score(self):
        b = B.load(FIXTURE)
        a = next(x for x in summary.layer(b, "classifier")["assignments"]
                 if x["status"] == "below_threshold" and B.entity_genes(next(e for e in b["entities"] if e["id"] == x["entity"])))
        gene = B.entity_genes(next(e for e in b["entities"] if e["id"] == a["entity"]))[0]
        row = [r for g in site.gene(gene)["groups"] if g["entity"] == a["entity"] for r in g["assignments"] if r["layer"] == "classifier"][0]
        self.assertEqual((row["status"], row["status_label"]), ("below_threshold", "unknown"))
        self.assertEqual(row["score"], a["score"])
        self.assertTrue(row["compartment"])

    def test_only_viewer_assets_are_web_served(self):
        for path in ("/spatial/js/spatial-explorer.js", "/spatial/js/spatial-explorer.css",
                     "/spatial/adapters/dictybase/adapter.js"):
            self.assertFalse(serve._is_blocked_path(path), path)
            self.assertEqual(self.fetch(path)[0], 200, path)
        for path in ("/spatial", "/spatial/README.md", "/spatial/tests/fixtures/alpha.bundle.json",
                     "/spatial/adapters/dictybase/local/tinker2026-vegetative.bundle.json",
                     "/spatial/adapters/dictybase/%6cocal/tinker2026-vegetative.bundle.json",
                     "/spatial/js/../adapters/dictybase/local/tinker2026-vegetative.bundle.json",
                     "/spatial/adapters/dictybase/go_cc_closure.json", "/spatial/adapters/dictybase/dicty_site.py",
                     "/spatial/py/spatialprot/bundle.py", "/spatial/.venv/pyvenv.cfg"):
            self.assertTrue(serve._is_blocked_path(path), path)
            self.assertEqual(self.fetch(path)[0], 404, path)

    def test_route_is_described_but_not_advertised(self):
        title, desc, _, _ = serve.route_meta("/tools/spatial")
        self.assertIn("spatial proteomics", title.lower())
        self.assertIn("under evaluation", desc.lower())
        self.assertNotIn("/tools/spatial", self.fetch("/sitemap.xml")[2].decode())
        html = (ROOT / "index.html").read_text()
        links = re.findall(r'<a[^>]*href="/tools/spatial"[^>]*>', html)
        self.assertEqual(len(links), 2)
        self.assertTrue(all("hidden" in a and "data-spatial-nav" in a for a in links))

    def test_site_styles_theme_the_explorer_with_site_tokens(self):
        css = (ROOT / "styles.css").read_text()
        block = css[css.index("/* ---- Spatial proteomics explorer (/tools/spatial) ----"):]
        for token in ("--sx-accent: var(--teal)", "--sx-ink: var(--ink)", "--sx-line: var(--line)", "--sx-surface: var(--panel)", "--sx-muted: var(--muted)"):
            self.assertIn(token, block)
        self.assertNotIn(".topbar", block)                      # the site header is not restyled or hidden
        self.assertNotIn("display: none", block)
        adapter = (ROOT / "spatial" / "adapters" / "dictybase" / "adapter.js").read_text()
        self.assertNotIn("dsx-", adapter)
        self.assertIn('header: false', adapter)

    def test_page_renders_in_a_real_browser(self):
        br = _browser()
        chrome = br.find_chrome()
        if not chrome:
            self.skipTest("no Chrome or Chromium binary found")
        dom = br.dump_dom(chrome, "http://127.0.0.1:%d/tools/spatial" % self.port)
        self.assertIn("Synthetic demonstration data", dom)
        # a native dictyBase tool page: the site's own header, navigation and
        # footer, the standard tool page header, and no second navigation system
        self.assertRegex(dom, r'<header class="topbar"')
        self.assertRegex(dom, r'<footer class="site-footer"')
        self.assertRegex(dom, r'<nav class="nav-links"')
        self.assertNotIn("dsx-header", dom)
        self.assertNotIn("spatial-dashboard", dom)
        self.assertIn('class="spatial-wide"', dom)             # only the reading column widens
        self.assertRegex(dom, r'<article class="record-card research-card spatial-page">\s*<header class="record-header">')
        self.assertRegex(dom, r'<p class="eyebrow">Tools · Proteomics · Dataset under evaluation</p>')
        self.assertIn("<h2>Spatial Proteomics Explorer</h2>", dom)
        self.assertEqual(re.findall(r'data-spatial-action="(\w+)"', dom), ["about", "export", "cite"])
        self.assertNotIn('class="sx-titlebar"', dom)            # the module's own title bar is not used here
        for panel in ("central", "details", "compartments", "scores", "enrichment"):
            self.assertIn('data-sx="%s"' % panel, dom)
        self.assertIn("Spatial proteome map", dom)
        self.assertIn("Unknown (40)", dom)                      # real count in the legend
        self.assertIn('data-sx="map-canvas"', dom)              # the fixture carries coordinates
        self.assertIn('data-sx="histogram"', dom)
        self.assertNotIn('role="alert"', dom)
        self.assertRegex(dom, r'href="/tools/spatial" data-spatial-nav="">')   # nav revealed once available


@unittest.skipUnless(site, "spatial module not importable")
class RestrictedBundleTest(_Server):
    """A bundle not cleared for distribution stays dark unless preview is on."""

    @classmethod
    def setUpClass(cls):
        b = B.load(FIXTURE)
        b["dataset"]["license"]["redistribution"] = "restricted"
        b["dataset"]["distribution"] = {"status": "local-only", "reason": "test"}
        cls.tmp = tempfile.TemporaryDirectory()
        cls.path = pathlib.Path(cls.tmp.name) / "restricted.bundle.json"
        B.dump(b, cls.path)
        cls.ENV = {"DICTY_SPATIAL_BUNDLE": cls.path, "DICTY_SPATIAL_PREVIEW": None}
        super().setUpClass()

    @classmethod
    def tearDownClass(cls):
        super().tearDownClass()
        cls.tmp.cleanup()

    def test_dark_by_default_then_visible_in_preview(self):
        self.setenv(DICTY_SPATIAL_PREVIEW=None)
        code, st = self.get("/api/spatial/status")
        self.assertEqual((code, st["available"]), (200, False))
        self.assertNotIn("dataset", st)
        for path in ("/api/spatial/bundle", "/api/spatial/layers", "/api/spatial/gene?ddb=DDB_G0000001"):
            self.assertEqual(self.fetch(path)[0], 404, path)
        self.setenv(DICTY_SPATIAL_PREVIEW="yes")            # only the exact value 1 switches it on
        self.assertEqual(self.fetch("/api/spatial/bundle")[0], 404)
        self.setenv(DICTY_SPATIAL_PREVIEW="1")
        try:
            code, st = self.get("/api/spatial/status")
            self.assertEqual((st["available"], st["preview"]), (True, True))
            code, headers, _ = self.fetch("/api/spatial/bundle")
            self.assertEqual(code, 200)
            self.assertNotIn("Access-Control-Allow-Origin", headers)
        finally:
            self.setenv(DICTY_SPATIAL_PREVIEW=None)

    def test_missing_or_broken_bundle_is_reported_not_served(self):
        self.setenv(DICTY_SPATIAL_BUNDLE=self.path.with_name("absent.json"), DICTY_SPATIAL_PREVIEW="1")
        try:
            self.assertFalse(self.get("/api/spatial/status")[1]["available"])
            broken = self.path.with_name("broken.bundle.json")
            broken.write_text('{"schema": "spatial-proteomics-bundle"}')
            self.setenv(DICTY_SPATIAL_BUNDLE=broken)
            st = self.get("/api/spatial/status")[1]
            self.assertFalse(st["available"])
            self.assertIn("failed validation", st["reason"])
            self.assertEqual(self.fetch("/api/spatial/bundle")[0], 404)
        finally:
            self.setenv(DICTY_SPATIAL_BUNDLE=self.path, DICTY_SPATIAL_PREVIEW=None)


@unittest.skipUnless(site and LOCAL.exists(), "local dataset not built (it is never committed)")
class LocalBundleTest(_Server):
    """The real dataset, as the local preview serves it."""
    ENV = {"DICTY_SPATIAL_BUNDLE": None, "DICTY_SPATIAL_PREVIEW": "1"}

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.b = B.load(LOCAL)
        cls.ent = {e["id"]: e for e in cls.b["entities"]}
        cls.svm = {a["entity"]: a for a in summary.layer(cls.b, "svm")["assignments"]}

    def test_every_detected_protein_group_is_served(self):
        code, st = self.get("/api/spatial/status")
        self.assertEqual((st["available"], st["preview"], st["counts"]["detected"]), (True, True, 6337))
        served = json.loads(self.fetch("/api/spatial/bundle")[2])
        detected = [e["id"] for e in served["entities"] if e.get("detected", True)]
        self.assertEqual(len(detected), 6337)
        self.assertEqual(set(detected), set(self.svm))                  # each one carries its published row
        self.assertEqual(sum(a["status"] == "assigned" for a in self.svm.values()), 3169)
        self.assertEqual(sum(a["status"] == "below_threshold" for a in self.svm.values()), 3168)
        self.assertTrue(all(a["compartment"] and a["score"] is not None for a in self.svm.values()))

    def test_gene_in_several_groups_and_group_with_several_genes(self):
        shared = [g for g, ids in B.gene_index(self.b).items() if len(ids) > 1]
        self.assertTrue(shared)
        code, got = self.get("/api/spatial/gene?ddb=" + shared[0])
        self.assertEqual(code, 200)
        self.assertEqual(len(got["groups"]), len(B.gene_index(self.b)[shared[0]]))
        multi = self.b["dataset"]["mapping"]["multi_gene_entities"]
        self.assertEqual(len([m for m in multi if self.ent[m].get("detected", True)]), 179)
        genes = B.entity_genes(self.ent[multi[0]])
        code, got = self.get("/api/spatial/gene?ddb=" + genes[0])
        group = next(g for g in got["groups"] if g["entity"] == multi[0])
        self.assertEqual(sorted(group["other_genes"]), sorted(genes[1:]))
        self.assertEqual(len(group["members"]), len(self.ent[multi[0]]["members"]))

    def test_unknown_calls_and_unmapped_mitochondrial_accessions(self):
        unmapped = [e for e in self.b["entities"] if e.get("detected", True) and not B.entity_genes(e)]
        self.assertEqual(len(unmapped), 29)
        for e in unmapped:
            self.assertRegex(e["members"][0]["id"], r"^(NP|YP)_")
            self.assertIn(e["id"], self.svm)                            # still carries its SVM row
            self.assertIn("mapping_note", e)
        unknown = next(a for a in self.svm.values() if a["status"] == "below_threshold" and B.entity_genes(self.ent[a["entity"]]))
        gene = B.entity_genes(self.ent[unknown["entity"]])[0]
        row = next(r for g in self.get("/api/spatial/gene?ddb=" + gene)[1]["groups"] if g["entity"] == unknown["entity"]
                   for r in g["assignments"] if r["layer"] == "svm")
        self.assertEqual((row["status_label"], row["score"], row["score_name"]), ("unknown", unknown["score"], "svm.scores"))
        self.assertTrue(row["compartment"])

    def test_go_layers_use_only_accepted_mappings_and_stay_separate(self):
        layers = self.get("/api/spatial/layers")[1]["layers"]
        self.assertEqual([l["id"] for l in layers], ["go-cc-experimental", "go-cc-inferred"])
        self.assertEqual([l["evidence_type"] for l in layers], ["curated_annotation", "sequence_prediction"])
        uncertain = {c["id"] for c in self.b["compartments"] if "ontology_id" not in c}
        self.assertEqual({c["label"] for c in self.b["compartments"] if c["id"] in uncertain},
                         {"Actin", "Microtubule", "Vesicular Compartment"})
        for l in layers:
            self.assertFalse(set(l["compartment_scope"]) & uncertain)
            self.assertTrue(l["assignments"])
            self.assertTrue(all(l["source"] == "external" for _ in [0]))
        merged = dict(self.b, layers=self.b["layers"] + layers)
        self.assertEqual(V.errors(V.validate(merged)), [])
        self.assertEqual(len(self.b["layers"]), 4)                       # the bundle itself is unchanged
        codes = {c for x in layers[0]["assignments"] for c in x["attributes"]["codes"].split(", ")}
        self.assertTrue(codes and codes <= set(layers[0]["method"]["parameters"]["evidence_codes"]))
        exp = set(layers[0]["method"]["parameters"]["evidence_codes"])
        self.assertTrue({"IDA", "HDA"} <= exp and not exp & {"IEA", "IBA", "ISS"})
        c = summary.concordance(merged, "svm", "go-cc-experimental")
        self.assertEqual(set(c["table"]) & uncertain, set())             # uncertain labels never enter the comparison

    def test_restricted_file_is_not_reachable_by_path(self):
        self.assertEqual(self.fetch("/spatial/adapters/dictybase/local/" + LOCAL.name)[0], 404)


if __name__ == "__main__":
    unittest.main()
