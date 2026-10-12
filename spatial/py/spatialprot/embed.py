"""Nonlinear maps of measured profiles: t-SNE and UMAP. Offline only.

Needs scikit-learn (t-SNE) and umap-learn (UMAP) on top of NumPy. Each function
takes the profile matrix exactly as it is in the bundle, with no scaling,
normalization or imputation, and returns an embedding marked source="computed"
that records every parameter and software version.

A map is a picture of how similar profiles are. Two proteins that sit close
together fractionate alike. That is not evidence that they bind each other.
"""
import platform

import numpy as np

from . import __version__, analysis

CAVEAT = ("Distance on the map reflects similarity of fractionation profiles. "
          "It is not evidence of physical interaction.")


def _input(bundle):
    ids, m = analysis.profile_matrix(bundle)
    return ids, np.ascontiguousarray(m, dtype=np.float64)


def _embedding(embedding_id, label, short, name, software, description, params, ids, coords, decimals):
    params = dict(params, entities=len(ids), input="profiles as supplied; no scaling, normalization or imputation applied",
                  spatialprot=__version__, numpy=np.__version__, python=platform.python_version())
    return {
        "id": embedding_id, "label": label, "short_label": short,
        "note": CAVEAT,
        "method": {"name": name, "software": software, "description": description, "parameters": params},
        "source": "computed", "derived_from": "profiles",
        "axes": [short + " 1", short + " 2"],
        "coordinates": {i: [round(float(a), decimals), round(float(b), decimals)] for i, (a, b) in zip(ids, coords)},
    }


def pca(bundle, embedding_id="pca", decimals=6):
    """PCA of the profiles as supplied (centred per fraction, no scaling)."""
    emb = analysis.pca_embedding(bundle, embedding_id=embedding_id, decimals=decimals, scale="none")
    ev = emb["method"]["parameters"]["explained_variance"]
    emb.update(label="PCA of the measured profiles (computed)", short_label="PCA", note=CAVEAT,
               axes=[f"PC1 ({ev[0]:.1%} of variance)", f"PC2 ({ev[1]:.1%} of variance)"])
    emb["method"]["parameters"].update(input="profiles as supplied; no scaling, normalization or imputation applied",
                                       python=platform.python_version())
    return emb


def tsne(bundle, embedding_id="tsne", seed=20261012, perplexity=30.0, decimals=4):
    """t-SNE (scikit-learn, Barnes-Hut, Euclidean distance, PCA initialisation)."""
    import sklearn
    from sklearn.manifold import TSNE
    ids, m = _input(bundle)
    model = TSNE(n_components=2, perplexity=perplexity, init="pca", learning_rate="auto", max_iter=1000,
                 metric="euclidean", method="barnes_hut", angle=0.5, early_exaggeration=12.0,
                 random_state=seed, n_jobs=1)
    coords = model.fit_transform(m)
    params = {"n_components": 2, "perplexity": perplexity, "init": "pca", "learning_rate": "auto", "max_iter": 1000,
              "metric": "euclidean", "method": "barnes_hut", "angle": 0.5, "early_exaggeration": 12.0,
              "random_state": seed, "n_jobs": 1, "dimensions": int(m.shape[1]),
              "kl_divergence": round(float(model.kl_divergence_), 5), "scikit-learn": sklearn.__version__}
    return _embedding(embedding_id, "t-SNE of the measured profiles (computed)", "t-SNE", "t-SNE",
                      f"scikit-learn {sklearn.__version__}",
                      "t-distributed stochastic neighbour embedding of the profiles as supplied, with a fixed random seed.",
                      params, ids, coords, decimals)


def umap(bundle, embedding_id="umap", seed=20261012, n_neighbors=15, min_dist=0.1, decimals=4):
    """UMAP (umap-learn, Euclidean distance, spectral initialisation, fixed seed)."""
    import warnings
    import umap as umap_learn
    import numba
    import pynndescent
    ids, m = _input(bundle)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")          # "n_jobs overridden by random_state": expected, wanted
        model = umap_learn.UMAP(n_components=2, n_neighbors=n_neighbors, min_dist=min_dist, metric="euclidean",
                                init="spectral", n_epochs=None, random_state=seed, n_jobs=1)
        coords = model.fit_transform(m)
    params = {"n_components": 2, "n_neighbors": n_neighbors, "min_dist": min_dist, "metric": "euclidean",
              "init": "spectral", "random_state": seed, "n_jobs": 1, "dimensions": int(m.shape[1]),
              "umap-learn": umap_learn.__version__, "numba": numba.__version__, "pynndescent": pynndescent.__version__}
    return _embedding(embedding_id, "UMAP of the measured profiles (computed)", "UMAP", "UMAP",
                      f"umap-learn {umap_learn.__version__}",
                      "Uniform manifold approximation and projection of the profiles as supplied, with a fixed random seed.",
                      params, ids, coords, decimals)


def trustworthiness(bundle, embedding, n_neighbors=15):
    """How well a map keeps each profile's nearest neighbours (1 = perfectly).
    Used to judge a map against the matrix, including a reconstructed one."""
    from sklearn.manifold import trustworthiness as tw
    ids, m = _input(bundle)
    keep = [k for k, i in enumerate(ids) if i in embedding["coordinates"]]
    xy = np.array([embedding["coordinates"][ids[k]] for k in keep], dtype=float)
    return float(tw(m[keep], xy, n_neighbors=n_neighbors))
