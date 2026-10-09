"""Reading, writing and assembling bundles. Stdlib only."""
import hashlib
import json
import pathlib

from . import SCHEMA_NAME, SCHEMA_VERSION

SCHEMA_PATH = pathlib.Path(__file__).resolve().parents[2] / "schema" / "spatial-proteomics-1.0.schema.json"


def load(path):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))


def dumps(bundle):
    """Deterministic compact JSON. Floats use repr, which round-trips exactly."""
    return json.dumps(bundle, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n"


def dump(bundle, path):
    path = pathlib.Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(dumps(bundle), encoding="utf-8")


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def parse_group(text, sep=";"):
    """Split a protein-group string into member ids, order preserved."""
    return [m.strip() for m in str(text).split(sep) if m.strip()]


def entity_genes(entity):
    """Distinct genes of a protein group, in member order. Never collapsed to one."""
    seen = []
    for m in entity["members"]:
        g = m.get("gene")
        if g is not None and g not in seen:
            seen.append(g)
    return seen


def entity_mapping_status(entity):
    mapped = sum(1 for m in entity["members"] if m.get("gene") is not None)
    if mapped == 0:
        return "unmapped"
    return "mapped" if mapped == len(entity["members"]) else "partial"


def mapping_stats(entities, method, source=None, notes=None):
    """Recompute the mapping block from the entities themselves."""
    status = [entity_mapping_status(e) for e in entities]
    genes = set()
    for e in entities:
        genes.update(entity_genes(e))
    members = [m for e in entities for m in e["members"]]
    out = {
        "method": method,
        "entities_total": len(entities),
        "entities_mapped": status.count("mapped"),
        "entities_partial": status.count("partial"),
        "entities_unmapped": status.count("unmapped"),
        "entities_multi_gene": sum(1 for e in entities if len(entity_genes(e)) > 1),
        "members_total": len(members),
        "members_mapped": sum(1 for m in members if m.get("gene") is not None),
        "genes_total": len(genes),
        "unmapped_entities": [e["id"] for e, s in zip(entities, status) if s == "unmapped"],
        "multi_gene_entities": [e["id"] for e in entities if len(entity_genes(e)) > 1],
    }
    if source:
        out["source"] = source
    if notes:
        out["notes"] = notes
    return out


def gene_index(bundle):
    """gene id -> list of entity ids. A gene may sit in several protein groups."""
    idx = {}
    for e in bundle["entities"]:
        for g in entity_genes(e):
            idx.setdefault(g, []).append(e["id"])
    return idx


def new_bundle(dataset, compartments, entities, layers, fractions=None,
               profiles=None, embeddings=None):
    """Assemble a bundle dict in canonical key order."""
    b = {"schema": SCHEMA_NAME, "schema_version": SCHEMA_VERSION,
         "dataset": dataset, "compartments": compartments}
    if fractions:
        b["fractions"] = fractions
    b["entities"] = entities
    if profiles:
        b["profiles"] = profiles
    if embeddings:
        b["embeddings"] = embeddings
    b["layers"] = layers
    return b
