"""Unit tests for the GO-enrichment engine (stdlib unittest, no deps)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import enrichment


class HypergeomTest(unittest.TestCase):
    def test_known_values(self):
        # X ~ Hypergeometric(M=10, n=5, N=5)
        self.assertAlmostEqual(enrichment.hypergeom_sf(5, 10, 5, 5), 1 / 252, places=6)
        self.assertAlmostEqual(enrichment.hypergeom_sf(3, 10, 5, 5), 0.5, places=6)

    def test_edges(self):
        self.assertEqual(enrichment.hypergeom_sf(0, 100, 10, 10), 1.0)   # P(X>=0)
        self.assertEqual(enrichment.hypergeom_sf(11, 100, 10, 10), 0.0)  # impossible
        # survival function is non-increasing in k
        vals = [enrichment.hypergeom_sf(k, 200, 40, 30) for k in range(0, 20)]
        self.assertTrue(all(a >= b - 1e-12 for a, b in zip(vals, vals[1:])))

    def test_bh_monotone_and_bounded(self):
        q = enrichment._bh([0.001, 0.01, 0.5, 0.9])
        self.assertTrue(all(0 <= x <= 1 for x in q))
        self.assertGreaterEqual(q[0], 0.001)  # q >= p for the smallest


class ResolveGenesTest(unittest.TestCase):
    def test_symbol_and_unknown(self):
        matched, unmatched = enrichment.resolve_genes(["mhcA", "__nope__"])
        self.assertEqual(len(matched), 1)
        self.assertTrue(next(iter(matched)).startswith("DDB"))
        self.assertEqual(unmatched, ["__nope__"])

    def test_case_insensitive_and_dedup(self):
        matched, _ = enrichment.resolve_genes(["mhcA", "MHCA", "mhca"])
        self.assertEqual(len(matched), 1)


class EnrichTest(unittest.TestCase):
    def test_cytoskeleton_set(self):
        genes = ["abpA", "abpC", "corA", "ctxA", "ctxB", "fimA",
                 "myoB", "racE", "limE", "forH", "arpB", "cofA"]
        r = enrichment.enrich(genes, min_study=3)
        self.assertGreater(r["study_n"], 8)
        self.assertEqual(r["unmatched"], [])
        # an actin term should top the list and clear FDR
        top = r["results"][0]
        self.assertLess(top["q_value"], 0.05)
        ids = {t["id"] for t in r["results"]}
        self.assertIn("GO:0015629", ids)  # actin cytoskeleton
        # results sorted by ascending p-value
        ps = [t["p_value"] for t in r["results"]]
        self.assertEqual(ps, sorted(ps))

    def test_empty_input(self):
        r = enrichment.enrich([], min_study=2)
        self.assertEqual(r["study_n"], 0)
        self.assertEqual(r["results"], [])


if __name__ == "__main__":
    unittest.main()
