"""SEO metadata regression tests (per-route <head>, sitemap, robots)."""
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")
import serve


class RouteMetaTest(unittest.TestCase):
    def test_gene_route_is_distinct_and_structured(self):
        gm = serve._load_gene_meta()
        self.assertTrue(gm["records"], "gene_index.json should load")
        # pick a real, named gene from the index
        rec = next(r for r in gm["records"]
                   if len(r) > 1 and r[1] and r[1].upper() != r[0].upper())
        ddb, sym = rec[0], rec[1]
        title, desc, canon, jsonld = serve.route_meta(f"/gene/{sym}")
        self.assertIn(sym, title)
        self.assertIn(ddb, title)
        self.assertIn("Dicty@Duke", title)
        self.assertEqual(canon, f"/gene/{sym}")
        self.assertEqual(jsonld["@type"], "Gene")
        self.assertEqual(jsonld["identifier"], ddb)

    def test_gene_lookup_works_by_ddb_too(self):
        gm = serve._load_gene_meta()
        rec = next(r for r in gm["records"] if r and r[0])
        title, *_ = serve.route_meta(f"/gene/{rec[0]}")
        self.assertIn(rec[0], title)

    def test_static_route_has_custom_title(self):
        title, desc, canon, jsonld = serve.route_meta("/tools/blast")
        self.assertTrue(title.startswith("BLAST search"))
        self.assertTrue(desc)
        self.assertIsNone(jsonld)

    def test_unknown_route_uses_defaults(self):
        title, desc, canon, jsonld = serve.route_meta("/some/unmapped/page")
        self.assertIsNone(title)   # None -> index.html defaults are kept

    def test_clip_truncates(self):
        self.assertLessEqual(len(serve._clip("x" * 500)), 158)
        self.assertEqual(serve._clip("short"), "short")


if __name__ == "__main__":
    unittest.main()
