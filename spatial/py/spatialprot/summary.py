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


def calls(assignment):
    """Every compartment a layer stands behind for this entity. Most layers
    give one; annotation layers may give several ('others')."""
    if assignment["status"] != "assigned":
        return []
    return [assignment["compartment"]] + list(assignment.get("others", []))


def layer_counts(bundle, layer_id):
    """Per compartment: how many entities were assigned, and how many were named
    by the method but fell below its threshold."""
    out = {c["id"]: {"assigned": 0, "below_threshold": 0} for c in bundle["compartments"]}
    none = 0
    for a in layer(bundle, layer_id)["assignments"]:
        if a["compartment"] is None or a["status"] == "unassigned":
            none += 1
        elif a["status"] == "assigned":
            for c in calls(a):
                out[c]["assigned"] += 1
        else:
            out[a["compartment"]]["below_threshold"] += 1
    return {"compartments": out, "unassigned": none}


def shared_scope(bundle, layer_a, layer_b):
    """Compartments both layers are able to name, or None when neither is limited."""
    scopes = [set(l["compartment_scope"]) for l in (layer(bundle, layer_a), layer(bundle, layer_b))
              if l.get("compartment_scope")]
    if not scopes:
        return None
    out = scopes[0]
    for s in scopes[1:]:
        out &= s
    return out


def concordance(bundle, layer_a, layer_b, only=None, compartments=None):
    """Cross-tabulate the final calls of two layers over the entities both cover.

    Returns {n_shared, n_both_assigned, n_agree, table:{a_comp:{b_comp:count}}}.
    Agreement is only counted where both layers made a call, and means the two
    sets of compartments share at least one member. `only` restricts the
    comparison to the given entity ids; `compartments` to calls within that set
    (calls outside it are ignored, as if not made). By default the set is the
    overlap of the two layers' declared compartment_scope, so a layer is never
    marked wrong about a compartment the other layer cannot name.
    """
    if compartments is None:
        compartments = shared_scope(bundle, layer_a, layer_b)
    keep = (lambda c: True) if compartments is None else (lambda c: c in compartments)
    a = {x["entity"]: [c for c in calls(x) if keep(c)] for x in layer(bundle, layer_a)["assignments"]}
    b = {x["entity"]: [c for c in calls(x) if keep(c)] for x in layer(bundle, layer_b)["assignments"]}
    shared = [e for e in a if e in b and (only is None or e in only)]
    table, both, agree = {}, 0, 0
    for e in shared:
        if not a[e] or not b[e]:
            continue
        both += 1
        agree += bool(set(a[e]) & set(b[e]))
        for ca in a[e]:
            row = table.setdefault(ca, {})
            for cb in b[e]:
                row[cb] = row.get(cb, 0) + 1
    return {"layer_a": layer_a, "layer_b": layer_b, "n_shared": len(shared),
            "n_both_assigned": both, "n_agree": agree, "table": table}


def detected_genes(bundle, single_gene_only=False):
    """Every gene with at least one detected protein group: the right enrichment
    background for gene sets drawn from this experiment.

    single_gene_only: count only groups that resolve to exactly one gene. Use it
    together with study_genes(), so study and background follow the same rule.
    """
    genes = set()
    for e in bundle["entities"]:
        if e.get("detected", True):
            g = _bundle.entity_genes(e)
            if not single_gene_only or len(g) == 1:
                genes.update(g)
    return sorted(genes)


def study_genes(bundle, entity_ids):
    """Genes for an enrichment test of the given protein groups.

    Only detected groups that resolve to exactly one gene contribute, because a
    multi-gene group's measurement cannot be attributed to any one of its genes.
    Returns {genes, used, multi_gene, unmapped, undetected}: nothing is dropped
    without being counted.
    """
    wanted = set(entity_ids)
    out = {"genes": set(), "used": 0, "multi_gene": 0, "unmapped": 0, "undetected": 0}
    for e in bundle["entities"]:
        if e["id"] not in wanted:
            continue
        g = _bundle.entity_genes(e)
        if not e.get("detected", True):
            out["undetected"] += 1
        elif not g:
            out["unmapped"] += 1
        elif len(g) > 1:
            out["multi_gene"] += 1
        else:
            out["used"] += 1
            out["genes"].add(g[0])
    out["genes"] = sorted(out["genes"])
    return out


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
