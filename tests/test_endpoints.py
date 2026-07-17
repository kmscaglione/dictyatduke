"""End-to-end endpoint tests: boot serve.py in-process and assert the real API
returns correct, populated records for a set of golden genes.

test_assets.py validates the static data files; this validates that the running
SERVER assembles and returns them correctly — catching serving regressions
(routing, override-merge, empty responses) that a file-only check can't see.
Stdlib only; discovered by the existing Validate CI workflow.
"""
import json
import os
import pathlib
import sys
import threading
import unittest
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")  # before importing serve
import serve  # noqa: E402

# (symbol, DDB_G id) — verified against assets/gene_index.json. Well-studied
# genes that must always resolve, with GO terms and sequence links.
GOLDEN = [
    ("rasG", "DDB_G0293434"),
    ("cln5", "DDB_G0275299"),
    ("mhcA", "DDB_G0286355"),
    ("acaA", "DDB_G0281545"),
    ("gbpC", "DDB_G0291079"),
    ("pkaC", "DDB_G0283907"),
]


class EndpointTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        serve.apply_gene_overrides()   # mirror main(): merge any curation overrides
        serve.apply_stock_overrides()
        cls.srv = serve.Server(("127.0.0.1", 0), serve.Handler)  # port 0 = ephemeral
        cls.port = cls.srv.server_address[1]
        cls.thread = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def get(self, path):
        url = "http://127.0.0.1:%d%s" % (self.port, path)
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                return r.status, json.load(r)
        except urllib.error.HTTPError as e:
            return e.code, json.load(e)

    # the site is up and the core index loaded
    def test_health(self):
        code, body = self.get("/api/health")
        self.assertEqual(code, 200)
        self.assertEqual(body.get("status"), "ok")

    # golden gene records come back correct via the real API, by symbol AND id
    def test_golden_gene_records(self):
        for sym, ddb in GOLDEN:
            for token in (sym, ddb):
                code, g = self.get("/api/gene/%s" % token)
                self.assertEqual(code, 200, "%s -> HTTP %s" % (token, code))
                self.assertEqual((g.get("symbol") or "").lower(), sym.lower(),
                                 "%s returned wrong symbol %r" % (token, g.get("symbol")))
                self.assertTrue(g.get("name"), "%s empty name" % token)
                self.assertIsInstance(g.get("go"), list)
                self.assertGreater(len(g["go"]), 0, "%s has no GO terms" % sym)
                for t in g["go"][:20]:
                    self.assertRegex(t["id"], r"^GO:\d{7}$")
                    self.assertIn(t["aspect"], ("P", "F", "C"))
                self.assertEqual(set(g.get("sequences") or {}),
                                 {"genomic", "cdna", "protein"}, "%s sequences" % sym)

    # search finds each golden gene
    def test_search_finds_golden(self):
        for sym, ddb in GOLDEN:
            code, body = self.get("/api/search?q=%s" % sym)
            self.assertEqual(code, 200)
            ddbs = {r["ddb"] for r in body.get("results", [])}
            self.assertIn(ddb, ddbs, "search '%s' did not return %s" % (sym, ddb))

    # the rich per-gene annotation endpoint returns GO data
    def test_gene_annotations(self):
        for sym, ddb in GOLDEN:
            code, body = self.get("/api/gene-annotations?ddb=%s" % ddb)
            self.assertEqual(code, 200)
            self.assertTrue(body, "%s annotations empty" % sym)
            self.assertIn("go", body)

    # unknown gene is a clean 404, not a crash
    def test_unknown_gene_404(self):
        code, _ = self.get("/api/gene/NOT_A_REAL_GENE_ZZZ")
        self.assertEqual(code, 404)

    # catalog size sanity through the loaded data
    def test_catalog_size(self):
        rows, _ = serve.api_gene_rows()
        self.assertGreater(len(rows), 13000)


if __name__ == "__main__":
    unittest.main()
