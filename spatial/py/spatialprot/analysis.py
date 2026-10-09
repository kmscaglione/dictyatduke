"""Offline numerical analysis of measured profiles. Requires NumPy.

Everything here reads `profiles` and writes objects marked source="computed".
Nothing here can run on a bundle without measured profiles, and nothing here
alters an author-supplied layer.
"""
import numpy as np

from . import __version__, summary

_SOFTWARE = f"spatialprot {__version__}"


class NoProfiles(ValueError):
    pass


def profile_matrix(bundle):
    """(entity ids, float matrix) for entities with a complete profile."""
    profiles = bundle.get("profiles")
    if not profiles or not profiles.get("values"):
        raise NoProfiles("bundle has no measured profiles; nothing to analyse")
    ids, rows = [], []
    for e in bundle["entities"]:
        vec = profiles["values"].get(e["id"])
        if vec is None or any(v is None for v in vec):
            continue
        ids.append(e["id"])
        rows.append(vec)
    if not rows:
        raise NoProfiles("no entity has a complete profile")
    return ids, np.asarray(rows, dtype=float)


def normalize_rows(matrix):
    """Scale each profile to sum 1 so shape, not abundance, is compared."""
    total = matrix.sum(axis=1, keepdims=True)
    total[total == 0] = 1.0
    return matrix / total


def pca_embedding(bundle, embedding_id="pca", decimals=6):
    """Two-component PCA of row-normalised profiles. Deterministic: the sign of
    each component is fixed so its largest loading is positive."""
    ids, m = profile_matrix(bundle)
    x = normalize_rows(m)
    x = x - x.mean(axis=0, keepdims=True)
    u, s, vt = np.linalg.svd(x, full_matrices=False)
    for k in range(2):
        if vt[k, np.argmax(np.abs(vt[k]))] < 0:
            vt[k] *= -1
            u[:, k] *= -1
    coords = u[:, :2] * s[:2]
    var = (s ** 2) / (s ** 2).sum()
    return {
        "id": embedding_id,
        "label": "PCA of measured profiles (computed)",
        "method": {
            "name": "PCA",
            "software": _SOFTWARE,
            "description": "Principal component analysis of profiles scaled to sum 1 and centred per fraction.",
            "parameters": {"components": 2, "entities": len(ids),
                           "explained_variance": [round(float(v), 4) for v in var[:2]]},
        },
        "source": "computed",
        "derived_from": "profiles",
        "axes": [f"PC1 ({var[0]:.0%})", f"PC2 ({var[1]:.0%})"],
        "coordinates": {i: [round(float(a), decimals), round(float(b), decimals)]
                        for i, (a, b) in zip(ids, coords)},
    }


def centroid_layer(bundle, marker_layer_id, layer_id="nearest-centroid", decimals=6):
    """Assign each profiled entity to the marker centroid it correlates with best.

    The score is a Pearson correlation, declared as a similarity. It is not a
    probability and no threshold is applied.
    """
    ids, m = profile_matrix(bundle)
    x = normalize_rows(m)
    row = {e: i for i, e in enumerate(ids)}
    groups = {}
    for a in summary.layer(bundle, marker_layer_id)["assignments"]:
        c = summary.call(a)
        if c is not None and a["entity"] in row:
            groups.setdefault(c, []).append(row[a["entity"]])
    comps = [c["id"] for c in bundle["compartments"] if c["id"] in groups]
    if len(comps) < 2:
        raise ValueError("need markers with profiles in at least two compartments")
    cent = np.vstack([x[groups[c]].mean(axis=0) for c in comps])

    def z(a):
        a = a - a.mean(axis=1, keepdims=True)
        n = np.linalg.norm(a, axis=1, keepdims=True)
        n[n == 0] = 1.0
        return a / n

    corr = z(x) @ z(cent).T
    order = np.argsort(-corr, axis=1, kind="stable")
    assignments = []
    for i, eid in enumerate(ids):
        best, second = order[i, 0], order[i, 1]
        assignments.append({
            "entity": eid, "compartment": comps[best], "status": "assigned",
            "score": round(float(corr[i, best]), decimals),
            "attributes": {"runner_up": comps[second],
                           "margin": round(float(corr[i, best] - corr[i, second]), decimals)},
        })
    return {
        "id": layer_id,
        "label": "Nearest marker centroid (computed)",
        "evidence_type": "computational_assignment",
        "source": "computed",
        "method": {
            "name": "nearest centroid",
            "software": _SOFTWARE,
            "description": "Each profile is assigned to the compartment whose mean marker profile it correlates with most strongly.",
            "parameters": {"marker_layer": marker_layer_id,
                           "markers_per_compartment": {c: len(groups[c]) for c in comps}},
        },
        "score": {"name": "pearson_r", "interpretation": "similarity",
                  "description": "Pearson correlation between the profile and the assigned compartment's marker centroid."},
        "attribute_labels": {"runner_up": "Second closest compartment",
                             "margin": "Correlation margin over the runner up"},
        "assignments": assignments,
    }


def derive(bundle, marker_layer_id=None):
    """Return a copy of the bundle with a computed PCA embedding and, when a
    marker layer is named, a computed nearest-centroid layer."""
    out = dict(bundle)
    emb = [e for e in bundle.get("embeddings", []) if e["id"] != "pca"]
    out["embeddings"] = emb + [pca_embedding(bundle)]
    if marker_layer_id:
        layers = [l for l in bundle["layers"] if l["id"] != "nearest-centroid"]
        out["layers"] = layers + [centroid_layer(bundle, marker_layer_id)]
    # keep canonical key order
    ordered = {k: out[k] for k in ("schema", "schema_version", "dataset", "compartments",
                                   "fractions", "entities", "profiles", "embeddings", "layers")
               if k in out}
    return ordered
