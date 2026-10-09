"""Structural and semantic validation of a bundle. Stdlib only."""
import json
import math

from . import SCHEMA_NAME, bundle as _bundle, jsonschema_lite

_RULES = {
    "score >= value": lambda s, v: s >= v,
    "score > value": lambda s, v: s > v,
    "score <= value": lambda s, v: s <= v,
    "score < value": lambda s, v: s < v,
}
_MAPPING_KEYS = (
    "entities_total", "entities_mapped", "entities_partial", "entities_unmapped",
    "entities_multi_gene", "members_total", "members_mapped", "genes_total",
    "unmapped_entities", "multi_gene_entities",
)


class Issue:
    def __init__(self, level, path, message):
        self.level, self.path, self.message = level, path, message

    def __repr__(self):
        return f"{self.level.upper()} {self.path}: {self.message}"


def _dupes(ids):
    seen, dup = set(), []
    for i in ids:
        if i in seen and i not in dup:
            dup.append(i)
        seen.add(i)
    return dup


def _finite(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(x)


def validate(bundle, require_public=False, schema=None):
    """Return a list of Issue. No 'error' issues means the bundle is valid.

    require_public: also fail unless the bundle is cleared for distribution.
    Use it as the gate in front of anything that publishes a bundle.
    """
    issues = []
    err = lambda p, m: issues.append(Issue("error", p, m))
    warn = lambda p, m: issues.append(Issue("warning", p, m))

    if schema is None:
        schema = json.loads(_bundle.SCHEMA_PATH.read_text(encoding="utf-8"))
    structural = jsonschema_lite.check(bundle, schema)
    for path, msg in structural:
        err(path, msg)
    if structural:
        return issues  # semantic checks assume the shape is right
    if bundle["schema"] != SCHEMA_NAME:
        err("$.schema", "unknown schema")

    ds = bundle["dataset"]
    comp_ids = [c["id"] for c in bundle["compartments"]]
    frac_ids = [f["id"] for f in bundle.get("fractions", [])]
    ent_ids = [e["id"] for e in bundle["entities"]]
    for name, ids in (("compartments", comp_ids), ("fractions", frac_ids),
                      ("entities", ent_ids),
                      ("layers", [l["id"] for l in bundle["layers"]]),
                      ("embeddings", [e["id"] for e in bundle.get("embeddings", [])])):
        for d in _dupes(ids):
            err(f"$.{name}", f"duplicate id {d!r}")
    comp_set, ent_set = set(comp_ids), set(ent_ids)
    layer_ids = {l["id"] for l in bundle["layers"]}

    # protein groups
    member_home = {}
    for i, e in enumerate(bundle["entities"]):
        for d in _dupes([m["id"] for m in e["members"]]):
            err(f"$.entities[{i}]", f"member {d!r} listed twice in one group")
        for m in e["members"]:
            member_home.setdefault(m["id"], []).append(e["id"])
    shared = sum(1 for v in member_home.values() if len(v) > 1)
    if shared:
        warn("$.entities", f"{shared} member id(s) belong to more than one protein group")

    # mapping statistics must be derived from the entities, not typed in
    want = _bundle.mapping_stats(bundle["entities"], ds["mapping"]["method"])
    for key in _MAPPING_KEYS:
        if ds["mapping"][key] != want[key]:
            err(f"$.dataset.mapping.{key}", "does not match the entities in this bundle")

    # licensing and distribution
    if ds["license"]["redistribution"] != "permitted" and ds["distribution"]["status"] == "public":
        err("$.dataset.distribution.status",
            "cannot be 'public' unless license.redistribution is 'permitted'")
    if require_public and ds["distribution"]["status"] != "public":
        err("$.dataset.distribution.status", "bundle is not cleared for distribution")

    # measured profiles
    profiles = bundle.get("profiles")
    if profiles:
        if not frac_ids:
            err("$.profiles", "profiles need a non-empty 'fractions' list")
        for eid, vec in profiles["values"].items():
            if eid not in ent_set:
                err(f"$.profiles.values[{eid!r}]", "unknown entity")
            if len(vec) != len(frac_ids):
                err(f"$.profiles.values[{eid!r}]", f"expected {len(frac_ids)} values, found {len(vec)}")
            if any(v is not None and not _finite(v) for v in vec):
                err(f"$.profiles.values[{eid!r}]", "values must be finite numbers or null")
    elif frac_ids:
        warn("$.fractions", "fractions are declared but no profiles are supplied")

    for i, emb in enumerate(bundle.get("embeddings", [])):
        p = f"$.embeddings[{i}]"
        if emb["source"] == "computed" and not profiles:
            err(p, "a computed embedding needs the measured profiles in the same bundle")
        for eid, xy in emb["coordinates"].items():
            if eid not in ent_set:
                err(f"{p}.coordinates[{eid!r}]", "unknown entity")
            if not all(_finite(v) for v in xy):
                err(f"{p}.coordinates[{eid!r}]", "coordinates must be finite")

    # assignment layers
    covered = set(profiles["values"]) if profiles else set()
    for i, layer in enumerate(bundle["layers"]):
        p = f"$.layers[{i}]"
        score = layer.get("score")
        if score and score["interpretation"] == "probability" and not score.get("interpretation_basis"):
            err(f"{p}.score", "interpretation 'probability' requires 'interpretation_basis' citing the method")
        if layer["source"] == "computed" and layer["evidence_type"] == "curated_annotation":
            err(p, "a computed layer cannot be a curated annotation")
        thr = score.get("threshold") if score else None
        for ref in layer.get("trained_on", []):
            if ref == layer["id"] or ref not in layer_ids:
                err(f"{p}.trained_on", f"unknown layer {ref!r}")
        scope = layer.get("compartment_scope")
        if scope is not None and any(c not in comp_set for c in scope):
            err(f"{p}.compartment_scope", "unknown compartment")
        seen = set()
        for j, a in enumerate(layer["assignments"]):
            q = f"{p}.assignments[{j}]"
            if a["entity"] not in ent_set:
                err(q, f"unknown entity {a['entity']!r}")
            if a["entity"] in seen:
                err(q, f"entity {a['entity']!r} assigned twice in one layer")
            seen.add(a["entity"])
            if a["compartment"] is not None and a["compartment"] not in comp_set:
                err(q, f"unknown compartment {a['compartment']!r}")
            if a["status"] == "assigned" and a["compartment"] is None:
                err(q, "status 'assigned' needs a compartment")
            others = a.get("others", [])
            if scope is not None and any(c is not None and c not in scope for c in [a["compartment"]] + others):
                err(q, "compartment outside the layer's compartment_scope")
            if others:
                if a["status"] != "assigned":
                    err(q, "'others' is only allowed on an assigned entry")
                if any(o not in comp_set for o in others):
                    err(q, "unknown compartment in 'others'")
                if len(set(others)) != len(others) or a["compartment"] in others:
                    err(q, "'others' repeats a compartment")
            s = a.get("score")
            if s is not None:
                if not score:
                    err(q, "has a score but the layer declares no 'score' block")
                if not _finite(s):
                    err(q, "score must be finite")
                elif thr and a["compartment"] is not None:
                    passes = _RULES[thr["rule"]](s, thr["value"])
                    if passes != (a["status"] == "assigned"):
                        err(q, "status disagrees with the declared threshold")
            elif a["status"] == "below_threshold":
                err(q, "status 'below_threshold' needs a score")
        covered |= seen

    orphans = len(ent_set - covered)
    if orphans:
        warn("$.entities", f"{orphans} entities have neither a profile nor any assignment")
    return issues


def errors(issues):
    return [i for i in issues if i.level == "error"]
