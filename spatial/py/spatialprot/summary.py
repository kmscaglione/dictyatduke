"""Read-only summaries of a bundle. Stdlib only."""
from . import bundle as _bundle


def layer(bundle, layer_id):
    for l in bundle["layers"]:
        if l["id"] == layer_id:
            return l
    raise KeyError(layer_id)


def call(assignment):
    """The compartment a layer finally stands behind, or None."""
    return assignment["compartment"] if assignment["status"] == "assigned" else None


def layer_counts(bundle, layer_id):
    """Per compartment: how many entities were assigned, and how many were named
    by the method but fell below its threshold."""
    out = {c["id"]: {"assigned": 0, "below_threshold": 0} for c in bundle["compartments"]}
    none = 0
    for a in layer(bundle, layer_id)["assignments"]:
        if a["compartment"] is None:
            none += 1
        elif a["status"] in ("assigned", "below_threshold"):
            out[a["compartment"]][a["status"]] += 1
        else:
            none += 1
    return {"compartments": out, "unassigned": none}


def concordance(bundle, layer_a, layer_b):
    """Cross-tabulate the final calls of two layers over the entities both cover.

    Returns {n_shared, n_both_assigned, n_agree, table:{a_comp:{b_comp:count}}}.
    Agreement is only counted where both layers made a call.
    """
    a = {x["entity"]: call(x) for x in layer(bundle, layer_a)["assignments"]}
    b = {x["entity"]: call(x) for x in layer(bundle, layer_b)["assignments"]}
    shared = [e for e in a if e in b]
    table, both, agree = {}, 0, 0
    for e in shared:
        if a[e] is None or b[e] is None:
            continue
        both += 1
        agree += a[e] == b[e]
        row = table.setdefault(a[e], {})
        row[b[e]] = row.get(b[e], 0) + 1
    return {"layer_a": layer_a, "layer_b": layer_b, "n_shared": len(shared),
            "n_both_assigned": both, "n_agree": agree, "table": table}


def detected_genes(bundle):
    """Every gene with at least one detected protein group: the right enrichment
    background for gene sets drawn from this experiment."""
    genes = set()
    for e in bundle["entities"]:
        if e.get("detected", True):
            genes.update(_bundle.entity_genes(e))
    return sorted(genes)


def gene_summary(bundle, gene):
    """All protein groups containing a gene, each with every layer's assignment."""
    by_entity = {e["id"]: e for e in bundle["entities"]}
    out = []
    for eid in _bundle.gene_index(bundle).get(gene, []):
        e = by_entity[eid]
        rows = []
        for l in bundle["layers"]:
            for a in l["assignments"]:
                if a["entity"] == eid:
                    rows.append({"layer": l["id"], "evidence_type": l["evidence_type"],
                                 "source": l["source"], **a})
        out.append({"entity": eid, "members": e["members"],
                    "shared_with_genes": [g for g in _bundle.entity_genes(e) if g != gene],
                    "assignments": rows})
    return out
