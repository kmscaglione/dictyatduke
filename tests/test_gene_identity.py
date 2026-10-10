"""A gene address must show that gene's record, or an explicit error. Never
another gene's record.

The defect this guards against: the page router resolved /gene/<token> with a
fuzzy search as a last resort, so /gene/catA (catalase A) opened pkaC, whose
description contains "catalytic". The server was always right; the browser
chose the wrong record. These tests check both sides, the browser part in
headless Chrome when one is installed.
"""
import importlib.util
import json
import os
import pathlib
import re
import sys
import threading
import unittest
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")
import serve  # noqa: E402

# catalog symbol -> the featured gene the old router substituted for it
SUBSTITUTED = {"catA": "pkaC", "act1": "act15", "dynA": "rasG", "gtpA": "rasG", "cycL": "acaA",
               "repE": "tgrB1", "sma": "rasG", "staG": "carA", "trafF": "cln5"}


def _browser():
    sys.path.insert(0, str(ROOT / "spatial" / "tests"))
    spec = importlib.util.spec_from_file_location("sx_browser", ROOT / "spatial" / "tests" / "test_browser.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def record_heading(dom):
    """The gene symbol heading inside the record section, or None."""
    m = re.search(r'<section[^>]*id="record"[^>]*>(.*?)</section>', dom, re.S)
    if not m or re.search(r'<section[^>]*id="record"[^>]*\shidden', dom):
        return None
    h = re.search(r"<h2[^>]*>(.*?)</h2>", m.group(1), re.S)
    return re.sub(r"<[^>]+>", "", h.group(1)).strip() if h else None


class GeneIdentityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve.apply_gene_overrides()
        cls.srv = serve.Server(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        cls.index = {r[1]: r for r in json.loads((ROOT / "assets" / "gene_index.json").read_text()) if len(r) > 1}

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def text(self, path):
        with urllib.request.urlopen("http://127.0.0.1:%d%s" % (self.port, path), timeout=30) as r:
            return r.read().decode()

    def test_api_returns_the_gene_that_was_asked_for(self):
        for sym, other in SUBSTITUTED.items():
            want = self.index[sym][0]
            for token in (sym, want):
                g = json.loads(self.text("/api/gene/%s" % token))
                self.assertEqual((g["ddb"], g["symbol"]), (want, sym), token)
            self.assertNotEqual(json.loads(self.text("/api/gene/%s" % other))["ddb"], want)

    def test_page_title_names_the_requested_gene(self):
        for sym in SUBSTITUTED:
            title = re.search(r"<title>(.*?)</title>", self.text("/gene/%s" % sym)).group(1)
            self.assertTrue(title.startswith("%s (%s)" % (sym, self.index[sym][0])), title)

    def test_router_resolves_gene_tokens_exactly(self):
        src = (ROOT / "app.js").read_text()
        body = re.search(r"\nfunction findGeneByToken\(token\) \{(.*?)\n\}\n", src, re.S).group(1)
        self.assertNotIn("rankedGenes", body)
        self.assertNotIn("searchIndex", body)
        nav = re.search(r"\nfunction navigateToGene\(entry\) \{(.*?)\n\}\n", src, re.S).group(1)
        self.assertIn("showNotFound", nav)

    def test_browser_never_shows_another_genes_record(self):
        br = _browser()
        chrome = br.find_chrome()
        if not chrome:
            self.skipTest("no Chrome or Chromium binary found")
        for sym in ("catA", "dynA", "act1"):
            dom = br.dump_dom(chrome, "http://127.0.0.1:%d/gene/%s" % (self.port, sym))
            shown = record_heading(dom)
            # the gene itself, or no record at all (an explicit load error when
            # the upstream source is unreachable); never the old substitute
            self.assertIn(shown, (sym, None), "/gene/%s displayed the record of %r" % (sym, shown))
            self.assertNotEqual(shown, SUBSTITUTED[sym])
            if shown is None:
                self.assertRegex(dom, r"Couldn(&#39;|')t load gene|not found|No gene", sym)
        dom = br.dump_dom(chrome, "http://127.0.0.1:%d/gene/pkaC" % self.port)
        self.assertEqual(record_heading(dom), "pkaC")                  # featured genes still open
        dom = br.dump_dom(chrome, "http://127.0.0.1:%d/gene/zzzznotagene" % self.port)
        self.assertIsNone(record_heading(dom))                         # unknown token: no record at all


if __name__ == "__main__":
    unittest.main()
