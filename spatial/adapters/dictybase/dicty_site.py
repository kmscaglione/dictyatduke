"""Server-side dictyBase adapter for the spatial proteomics module.

Loads one bundle, answers per-gene questions, and turns dictyBase GO cellular
component annotations into layers the explorer can show next to the published
result. Standard library only; imported by serve.py.

Which bundle:  DICTY_SPATIAL_BUNDLE, else adapters/dictybase/local/<default>.
Who may see it: a bundle marked "public" is always served. Any other bundle is
served only when DICTY_SPATIAL_PREVIEW=1. That switch is the site owner's
decision to show a dataset that is not cleared for redistribution, for local
review or as an unlisted preview. It is not access control: with it on, anyone
who has the address can read the data. Turning it off removes every
/api/spatial/ response except status.
"""
import json
import os
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parents[1] / "py"))
from spatialprot import bundle as B, validate as V  # noqa: E402

DEFAULT_BUNDLE = HERE / "local" / "tinker2026-vegetative.bundle.json"
CLOSURE = HERE / "go_cc_closure.json"
ASSETS = REPO / "assets"

# GO evidence codes. Experimental codes are direct observations; the second
# group is inferred from similarity, phylogeny or automated pipelines. Author
# and curator statements (TAS, NAS, IC) and ND are in neither layer.
EXPERIMENTAL = {"EXP", "IDA", "IPI", "IMP", "IGI", "IEP", "HTP", "HDA", "HMP", "HGI", "HEP"}
INFERRED = {"ISS", "ISO", "ISA", "ISM", "IGC", "IBA", "IBD", "IKR", "IRD", "RCA", "IEA"}

_cache = {}


def bundle_path():
    return pathlib.Path(os.environ.get("DICTY_SPATIAL_BUNDLE") or DEFAULT_BUNDLE)


def preview_enabled():
    return os.environ.get("DICTY_SPATIAL_PREVIEW") == "1"


def _state():
    """Bundle and indexes, reloaded when the file changes."""
    path = bundle_path()
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {"error": "No spatial proteomics dataset is installed on this server."}
    key = (str(path), mtime)
    if _cache.get("key") == key:
        return _cache["state"]
    try:
        raw = path.read_bytes()
        bundle = json.loads(raw)
        bad = V.errors(V.validate(bundle))
    except (OSError, ValueError) as e:
        bad, bundle, raw = [str(e)], None, b""
    if bad:
        state = {"error": "The installed spatial proteomics bundle failed validation.", "details": [repr(i) for i in bad[:5]]}
    else:
        layers = {l["id"]: l for l in bundle["layers"]}
        state = {
            "bundle": bundle, "raw": raw,
            "public": bundle["dataset"]["distribution"]["status"] == "public",
            "entities": {e["id"]: e for e in bundle["entities"]},
            "genes": B.gene_index(bundle),
            "compartments": {c["id"]: c for c in bundle["compartments"]},
            "by_layer": {l["id"]: {a["entity"]: a for a in l["assignments"]} for l in bundle["layers"]},
            "training": {l["id"]: {e: t for t in l.get("trained_on", []) for e in
                                   (a["entity"] for a in layers[t]["assignments"])} for l in bundle["layers"]},
        }
    _cache.update(key=key, state=state)
    _cache.pop("go", None)
    return state


def allowed():
    st = _state()
    return "bundle" in st and (st["public"] or preview_enabled())


def status():
    st = _state()
    if "bundle" not in st:
        return {"available": False, "reason": st["error"]}
    if not (st["public"] or preview_enabled()):
        return {"available": False, "reason": "This dataset is not cleared for distribution and local preview is off."}
    ds = st["bundle"]["dataset"]
    detected = [e for e in st["bundle"]["entities"] if e.get("detected", True)]
    return {
        "available": True, "preview": not st["public"],
        "dataset": {k: ds[k] for k in ("id", "title", "citation", "license", "attribution", "distribution") if k in ds},
        "notices": ds.get("notices", []),
        "counts": {"protein_groups": len(st["bundle"]["entities"]), "detected": len(detected),
                   "genes": ds["mapping"]["genes_total"], "layers": len(st["bundle"]["layers"])},
    }


def bundle_bytes():
    return _state()["raw"]


def _label(st, comp_id):
    return st["compartments"][comp_id]["label"] if comp_id is not None else None


def gene(gene_id):
    """Everything the bundle holds about one gene, group by group, layer by layer."""
    st = _state()
    ds = st["bundle"]["dataset"]
    groups = []
    for eid in st["genes"].get(gene_id, []):
        e = st["entities"][eid]
        rows = []
        for layer in st["bundle"]["layers"]:
            a = st["by_layer"][layer["id"]].get(eid)
            if not a:
                continue
            labels = layer.get("status_labels", {})
            fed = st["training"][layer["id"]].get(eid)
            rows.append({
                "layer": layer["id"], "label": layer["label"], "evidence_type": layer["evidence_type"],
                "source": layer["source"], "status": a["status"],
                "status_label": labels.get(a["status"], a["status"].replace("_", " ")),
                "compartment": _label(st, a["compartment"]),
                "others": [_label(st, c) for c in a.get("others", [])],
                "score": a.get("score"), "score_name": layer["score"]["name"] if layer.get("score") else None,
                "training_input": next(l["label"] for l in st["bundle"]["layers"] if l["id"] == fed) if fed else None,
                "attributes": {layer.get("attribute_labels", {}).get(k, k): v for k, v in a.get("attributes", {}).items()},
            })
        groups.append({
            "entity": eid, "detected": e.get("detected", True), "members": e["members"],
            "other_genes": [g for g in B.entity_genes(e) if g != gene_id], "assignments": rows,
        })
    return {
        "gene": gene_id, "groups": groups,
        "dataset": {"title": ds["title"], "citation": ds["citation"], "attribution": ds["attribution"],
                    "public": st["public"], "notices": ds.get("notices", [])},
        "has_profiles": bool(st["bundle"].get("profiles")),
    }


def _go_sources():
    paths = (ASSETS / "gene_annotations.json", ASSETS / "go_terms.json", CLOSURE)
    key = tuple(p.stat().st_mtime for p in paths)
    hit = _cache.get("go_sources")
    if hit and hit[0] == key:
        return hit[1]
    data = tuple(json.loads(p.read_text(encoding="utf-8")) for p in paths)
    _cache["go_sources"] = (key, data)
    return data


def go_names(ids):
    """GO id -> term name, for ids the enrichment engine returned without one."""
    try:
        names = _go_sources()[1]
    except (OSError, ValueError):
        return {}
    return {i: names[i][0] for i in ids if i in names}


def go_layers():
    """Two layers built from dictyBase GO cellular component annotations: one
    from experimental evidence, one from inferred evidence. Only compartments
    with an accepted GO mapping take part. Nothing is merged into the bundle."""
    st = _state()
    if "go" in _cache:
        return _cache["go"]
    try:
        annotations, names, closure = _go_sources()
    except (OSError, ValueError):
        return []
    order = [c["id"] for c in st["bundle"]["compartments"]]
    term_comps = {}
    for c in st["bundle"]["compartments"]:
        for term in closure["terms"].get(c.get("ontology_id"), []):
            term_comps.setdefault(term, []).append(c["id"])
    scope = [c["id"] for c in st["bundle"]["compartments"] if c.get("ontology_id") in closure["terms"]]
    if not scope:
        return []

    def per_gene(codes):
        out = {}
        for gid, rec in annotations.items():
            if gid.startswith("_") or gid not in st["genes"]:
                continue
            for row in rec.get("go", {}).get("C", []):
                term, code, qualifier = row[0], row[1], (row[2] or "")
                if code not in codes or "NOT" in qualifier or "colocalizes_with" in qualifier:
                    continue
                for comp in term_comps.get(term, ()):
                    out.setdefault(gid, {}).setdefault(comp, set()).add((term, code))
        return out

    def layer(layer_id, label, short, evidence_type, codes, blurb):
        by_gene = per_gene(codes)
        assignments = []
        for e in st["bundle"]["entities"]:
            comps, terms, used, annotated = {}, set(), set(), 0
            for g in B.entity_genes(e):
                if g in by_gene:
                    annotated += 1
                    for comp, pairs in by_gene[g].items():
                        comps.setdefault(comp, set()).update(t for t, _ in pairs)
                        terms |= {t for t, _ in pairs}
                        used |= {c for _, c in pairs}
            if not comps:
                continue
            ranked = [c for c in order if c in comps]
            a = {"entity": e["id"], "compartment": ranked[0], "status": "assigned",
                 "attributes": {"terms": "; ".join(f"{(names.get(t) or ['?'])[0]} ({t})" for t in sorted(terms)),
                                "codes": ", ".join(sorted(used))}}
            if len(B.entity_genes(e)) > 1:      # only worth saying when the group pools several genes
                a["attributes"]["genes"] = annotated
            if len(ranked) > 1:
                a["others"] = ranked[1:]
            assignments.append(a)
        return {
            "id": layer_id, "label": label, "short_label": short, "evidence_type": evidence_type, "source": "external",
            "compartment_scope": scope,
            "method": {"name": "GO annotation lookup", "software": f"Gene Ontology {closure['_meta'].get('data_version')}",
                       "description": blurb + " A GO term counts for a compartment when it is the mapped term, a kind of it, or a part of it. "
                                      "For a protein group with several genes, the annotations of all its genes are pooled. "
                                      "Where several compartments apply they are listed in the source's order, which implies no ranking.",
                       "parameters": {"evidence_codes": sorted(codes), "excluded_qualifiers": ["NOT", "colocalizes_with"]}},
            "attribute_labels": {"terms": "GO terms", "codes": "Evidence codes", "genes": "Genes in this group with such an annotation"},
            "assignments": assignments,
        }

    layers = [
        layer("go-cc-experimental", "GO cellular component, experimental evidence (dictyBase)", "GO", "curated_annotation",
              EXPERIMENTAL, "dictyBase GO cellular component annotations with an experimental evidence code."),
        layer("go-cc-inferred", "GO cellular component, inferred (dictyBase)", "GO inferred", "sequence_prediction",
              INFERRED, "dictyBase GO cellular component annotations inferred from sequence similarity, phylogeny or automated pipelines. Not experimental evidence in this organism."),
    ]
    _cache["go"] = layers
    return layers
