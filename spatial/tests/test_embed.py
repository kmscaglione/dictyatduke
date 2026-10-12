"""Computed maps: reproducible, traceable to their input, and never altering it.
Skipped where scikit-learn or umap-learn is not installed."""
import copy
import unittest

from _util import fixture
from spatialprot import bundle as B, validate as V

try:
    import numpy as np
    import sklearn  # noqa: F401
    import umap as _umap  # noqa: F401
    from spatialprot import analysis, embed
except ImportError:  # pragma: no cover
    np = None


@unittest.skipUnless(np, "NumPy, scikit-learn and umap-learn are needed")
class EmbedTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.b = fixture("beta")
        cls.before = B.dumps(cls.b)
        cls.maps = {"pca": embed.pca(cls.b), "tsne": embed.tsne(cls.b), "umap": embed.umap(cls.b)}

    def test_input_is_never_altered(self):
        self.assertEqual(B.dumps(self.b), self.before)

    def test_each_map_is_reproducible(self):
        self.assertEqual(embed.pca(self.b), self.maps["pca"])
        self.assertEqual(embed.tsne(self.b)["coordinates"], self.maps["tsne"]["coordinates"])
        self.assertEqual(embed.umap(self.b)["coordinates"], self.maps["umap"]["coordinates"])

    def test_the_seed_is_recorded_and_used(self):
        # t-SNE starts from the PCA layout, so on a small matrix the seed barely matters;
        # UMAP's optimisation is stochastic, so there it must.
        other = embed.umap(self.b, seed=7)
        self.assertNotEqual(other["coordinates"], self.maps["umap"]["coordinates"])
        self.assertEqual(other["method"]["parameters"]["random_state"], 7)
        self.assertEqual(embed.tsne(self.b, seed=7)["method"]["parameters"]["random_state"], 7)
        for name in ("tsne", "umap"):
            self.assertEqual(self.maps[name]["method"]["parameters"]["random_state"], 20261012)

    def test_every_point_is_a_protein_group_with_a_complete_profile(self):
        ids, _ = analysis.profile_matrix(self.b)
        for name, m in self.maps.items():
            self.assertEqual(list(m["coordinates"]), ids, name)             # same rows, same order as the matrix
            xy = np.array(list(m["coordinates"].values()))
            self.assertEqual(xy.shape, (len(ids), 2))
            self.assertTrue(np.isfinite(xy).all())

    def test_method_and_versions_are_recorded(self):
        for name, key in (("tsne", "scikit-learn"), ("umap", "umap-learn"), ("pca", "numpy")):
            p = self.maps[name]["method"]["parameters"]
            self.assertIn(key, p, name)
            self.assertEqual(p["dimensions"], 10)
            self.assertIn("no scaling, normalization or imputation", p["input"])
            self.assertEqual((self.maps[name]["source"], self.maps[name]["derived_from"]), ("computed", "profiles"))
            self.assertIn("not evidence of physical interaction", self.maps[name]["note"])
        self.assertEqual(self.maps["tsne"]["method"]["parameters"]["metric"], "euclidean")
        self.assertEqual(self.maps["umap"]["method"]["parameters"]["metric"], "euclidean")
        self.assertEqual(self.maps["pca"]["method"]["parameters"]["scale"], "none")
        ev = self.maps["pca"]["method"]["parameters"]["explained_variance"]
        self.assertTrue(0 < ev[1] <= ev[0] < 1)

    def test_pca_uses_the_values_as_supplied(self):
        _, m = analysis.profile_matrix(self.b)
        x = m - m.mean(axis=0)
        w = np.sort(np.linalg.eigvalsh(x.T @ x))[::-1]
        self.assertTrue(np.allclose(self.maps["pca"]["method"]["parameters"]["explained_variance"], (w / w.sum())[:2], atol=1e-4))
        scaled = analysis.pca_embedding(self.b, scale="row_sum")
        self.assertNotEqual(scaled["coordinates"], self.maps["pca"]["coordinates"])
        with self.assertRaises(ValueError):
            analysis.pca_embedding(self.b, scale="zscore")

    def test_maps_are_valid_bundle_content_and_keep_layers_apart(self):
        b = copy.deepcopy(self.b)
        b["embeddings"] = list(self.maps.values())
        self.assertEqual(V.errors(V.validate(b)), [])
        self.assertEqual(b["layers"], self.b["layers"])

    def test_maps_keep_neighbours(self):
        for name, m in self.maps.items():
            t = embed.trustworthiness(self.b, m, n_neighbors=10)
            self.assertTrue(0.7 < t <= 1.0, (name, t))

    def test_no_profiles_no_map(self):
        for fn in (embed.pca, embed.tsne, embed.umap):
            with self.assertRaises(analysis.NoProfiles):
                fn(fixture("alpha.assignments-only"))


if __name__ == "__main__":
    unittest.main()
