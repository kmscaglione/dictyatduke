"""Offline NumPy analysis. Skipped where NumPy is not installed."""
import unittest

from _util import B, FIXTURES, fixture
from spatialprot import summary, validate as V

try:
    import numpy as np
    from spatialprot import analysis
except ImportError:  # pragma: no cover
    np = None


@unittest.skipUnless(np, "NumPy not installed")
class AnalysisTest(unittest.TestCase):
    def test_no_profiles_means_no_analysis(self):
        b = fixture("alpha.assignments-only")
        for fn in (analysis.pca_embedding, lambda x: analysis.centroid_layer(x, "markers"), analysis.derive):
            with self.assertRaises(analysis.NoProfiles):
                fn(b)

    def test_incomplete_profiles_are_left_out_not_imputed(self):
        b = fixture("alpha")
        ids, m = analysis.profile_matrix(b)
        self.assertEqual(len(ids), 79)
        self.assertFalse(np.isnan(m).any())
        emb = analysis.pca_embedding(b)
        self.assertEqual(len(emb["coordinates"]), 79)

    def test_pca_is_deterministic_and_marked_computed(self):
        a, b = analysis.pca_embedding(fixture("beta")), analysis.pca_embedding(fixture("beta"))
        self.assertEqual(a, b)
        self.assertEqual((a["source"], a["derived_from"]), ("computed", "profiles"))
        xy = np.array(list(a["coordinates"].values()))
        self.assertTrue(np.allclose(xy.mean(axis=0), 0, atol=1e-5))
        self.assertGreaterEqual(xy[:, 0].var(), xy[:, 1].var())
        ev = a["method"]["parameters"]["explained_variance"]
        self.assertTrue(0 < ev[1] <= ev[0] <= 1)

    def test_pca_matches_eigendecomposition(self):
        b = fixture("beta")
        _, m = analysis.profile_matrix(b)
        x = analysis.normalize_rows(m)
        x = x - x.mean(axis=0)
        w = np.sort(np.linalg.eigvalsh(x.T @ x))[::-1]
        ev = analysis.pca_embedding(b)["method"]["parameters"]["explained_variance"]
        self.assertTrue(np.allclose(ev, (w / w.sum())[:2], atol=1e-4))

    def test_centroid_layer_recovers_markers_and_declares_similarity(self):
        b = fixture("beta")
        layer = analysis.centroid_layer(b, "reference-set")
        self.assertEqual((layer["evidence_type"], layer["source"]), ("computational_assignment", "computed"))
        self.assertEqual(layer["score"]["interpretation"], "similarity")
        self.assertNotIn("threshold", layer["score"])
        self.assertTrue(all(-1 <= a["score"] <= 1 for a in layer["assignments"]))
        b["layers"].append(layer)
        c = summary.concordance(b, "nearest-centroid", "reference-set")
        self.assertEqual(c["n_both_assigned"], 18)
        self.assertGreaterEqual(c["n_agree"], 17)

    def test_derive_adds_and_never_alters(self):
        b = fixture("alpha")
        out = analysis.derive(b, "markers")
        self.assertEqual(V.errors(V.validate(out)), [])
        self.assertEqual([e["id"] for e in out["embeddings"]], ["author-map", "pca"])
        self.assertEqual(out["embeddings"][0], b["embeddings"][0])
        self.assertEqual(out["layers"][:3], b["layers"])
        self.assertEqual(out["profiles"], b["profiles"])
        self.assertEqual(analysis.derive(out, "markers"), out)       # idempotent

    def test_committed_derived_fixture_is_current(self):
        fresh = analysis.derive(fixture("beta"), "reference-set")
        committed = B.load(FIXTURES / "beta.derived.bundle.json")
        self.assertEqual(fresh["layers"][-1]["method"], committed["layers"][-1]["method"])
        for eid, xy in committed["embeddings"][0]["coordinates"].items():
            self.assertTrue(np.allclose(xy, fresh["embeddings"][0]["coordinates"][eid], atol=1e-5))
        for a, c in zip(fresh["layers"][-1]["assignments"], committed["layers"][-1]["assignments"]):
            self.assertEqual((a["entity"], a["compartment"]), (c["entity"], c["compartment"]))
            self.assertAlmostEqual(a["score"], c["score"], places=5)


if __name__ == "__main__":
    unittest.main()
