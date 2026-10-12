#!/usr/bin/env python3
"""Build the local, assignments-only bundle for Tinker et al. 2026.

    spatial/.venv/bin/python spatial/adapters/dictybase/build_bundle.py \
        --xlsx ~/Downloads/media-1.xlsx --fasta ~/Downloads/media-2.txt

Inputs are the preprint's supplementary tables (S1 markers, S2 SVM scores, S3
mitochondrial compendium) and the RefSeq GFF used to map protein accessions to
dictyBase gene ids. The supplement carries no fraction profiles and no map
coordinates, so the bundle carries none either.

The output goes to spatial/adapters/dictybase/local/, which is gitignored. The
source is CC BY-NC-ND 4.0 and the authors ask to be contacted before reuse, so
the bundle is stamped distribution "local-only" and must not be committed,
deployed or shared until that is settled.
"""
import argparse
import datetime
import json
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
REPO = HERE.parents[2]
sys.path.insert(0, str(HERE.parents[1] / "py"))
from spatialprot import bundle as B, validate as V  # noqa: E402

DEFAULT_GFF = REPO / "assets" / "genomes" / "D_discoideum_AX4.gff"
DEFAULT_OUT = HERE / "local" / "tinker2026-vegetative.bundle.json"

SHEETS = {"markers": "Table S1 Marker Set", "svm": "Table S2 SVM Scores",
          "mito": "Table S3 MitoCompendium"}
HEADERS = {"markers": ("Accession", "markers", "Used to train SVM?"),
           "svm": ("Accession", "svm", "svm.scores", "svm.pred"),
           "mito": ("Accession", "Mitochondrial evidence")}

# The reviewed label-to-GO mapping, with the rationale for each decision.
MAPPING_PATH = HERE / "compartment_go.json"


def load_mapping(path=MAPPING_PATH):
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))["labels"]


def slug(label):
    return re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")


def protein_gene_map(gff_path):
    """RefSeq protein accession -> (DDB_G gene id, product) from CDS rows."""
    out = {}
    with open(gff_path, encoding="utf-8") as fh:
        for line in fh:
            if "\tCDS\t" not in line:
                continue
            attrs = line.rstrip("\n").split("\t")[8]
            pid = re.search(r"protein_id=([^;]+)", attrs)
            gene = re.search(r"dictyBase:(DDB_G\d+)", attrs) or re.search(r"locus_tag=(DDB_G\d+)", attrs)
            if pid and gene and pid.group(1) not in out:
                prod = re.search(r"product=([^;]+)", attrs)
                out[pid.group(1)] = (gene.group(1), prod.group(1).replace("%2C", ",").replace("%3B", ";") if prod else None)
    return out


def fasta_descriptions(path):
    out = {}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            if line.startswith(">"):
                acc, _, desc = line[1:].strip().partition(" ")
                out[acc] = desc
    return out


def read_tables(xlsx_path):
    import openpyxl
    wb = openpyxl.load_workbook(xlsx_path, read_only=True, data_only=True)
    tables = {}
    for key, sheet in SHEETS.items():
        rows = list(wb[sheet].iter_rows(values_only=True))
        header = tuple(rows[0][:len(HEADERS[key])])
        if header != HEADERS[key]:
            raise SystemExit(f"{sheet}: unexpected header {header}")
        tables[key] = [tuple(r[:len(header)]) for r in rows[1:] if r and r[0] is not None]
    return tables


def build(tables, p2g, descriptions=None, sources=(), built=None, mapping_source="RefSeq GFF", go_mapping=None):
    """Pure assembly of the bundle from parsed tables. No I/O beyond the mapping file."""
    descriptions = descriptions or {}
    go_mapping = load_mapping() if go_mapping is None else go_mapping
    svm, markers, mito = tables["svm"], tables["markers"], tables["mito"]
    detected = {r[0] for r in svm}
    if len(detected) != len(svm):
        raise SystemExit("Table S2 lists a protein group twice")

    labels = []
    for r in svm:
        for lab in (r[1], r[3]):
            if lab != "unknown" and lab not in labels:
                labels.append(lab)
    for r in markers:
        if r[1] not in labels:
            labels.append(r[1])
    labels.sort()
    mito_label = "Mitochondria"
    if mito_label not in labels:
        raise SystemExit("no Mitochondria compartment to attach Table S3 to")
    comp_id = {lab: slug(lab) for lab in labels}
    compartments = []
    for lab in labels:
        c = {"id": comp_id[lab], "label": lab}
        m = go_mapping.get(lab)
        if m is None:
            c["ontology_note"] = "Label not reviewed for an ontology mapping; left out of GO comparisons."
        elif m["status"] == "accepted":
            c["ontology_id"] = m["go_id"]
            c["ontology_note"] = f"{m['go_name']}. {m['rationale']} Mapping by dictyBase, not by the authors."
        else:
            c["ontology_note"] = f"Mapping {m['status']}: {m['rationale']} Left out of GO comparisons."
        compartments.append(c)

    def entity(group, is_detected):
        members = []
        for acc in B.parse_group(group):
            gene, product = p2g.get(acc, (None, None))
            m = {"id": acc, "gene": gene}
            desc = product or descriptions.get(acc)
            if desc:
                m["description"] = desc
            members.append(m)
        e = {"id": group, "members": members}
        if not is_detected:
            e["detected"] = False
        if all(m["gene"] is None for m in members):
            e["mapping_note"] = f"Accession not present in the mapping source ({mapping_source})."
        return e

    entities = [entity(r[0], True) for r in svm]
    extra = [r[0] for r in mito if r[0] not in detected]
    entities += [entity(g, False) for g in extra]
    for g, _, _ in markers:
        if g not in detected:
            raise SystemExit(f"marker {g} is not in Table S2")

    training = {g for g, _, used in markers if used == "Yes"}
    fixed = [r for r in svm if r[0] in training]
    training_fact = ""
    if fixed and all(r[2] == 1 for r in fixed) and not any(r[2] == 1 for r in svm if r[0] not in training):
        training_fact = (f" All {len(fixed)} training markers carry svm.scores exactly 1 and their marker class, and no other"
                         " protein group does: for them the table records the supplied class, not a prediction.")
    svm_layer = {
        "id": "svm", "label": "SVM classification (Tinker et al. 2026)", "short_label": "SVM",
        "evidence_type": "computational_assignment", "source": "author",
        "method": {"name": "support vector machine", "software": "pRoloc 1.34.0 (R/Bioconductor)",
                   "description": "Classifier trained by the authors on marker fractionation profiles and applied to every detected protein group.",
                   "parameters": {"training_markers": sum(1 for r in markers if r[2] == "Yes")}},
        "description": "Columns svm, svm.scores and svm.pred of Table S2, unchanged. The final call is svm.pred. Where svm.pred is 'unknown' the class in column svm is kept as the compartment the method named, and is not an assignment. The authors describe applying a median cutoff; no cutoff is recomputed or applied here." + training_fact,
        "score": {"name": "svm.scores", "interpretation": "unspecified",
                  "description": "Reported numerical score from column svm.scores, reproduced exactly. Its scale and calibration have not been confirmed, so it is not presented as a probability or a confidence."},
        "status_labels": {"assigned": "assigned (svm.pred)", "below_threshold": "unknown"},
        "trained_on": ["markers-training"],
        "assignments": [],
    }
    for group, klass, score, pred in svm:
        if pred != "unknown" and pred != klass:
            raise SystemExit(f"{group}: svm.pred {pred!r} differs from svm {klass!r}")
        svm_layer["assignments"].append({
            "entity": group, "compartment": comp_id[klass],
            "status": "below_threshold" if pred == "unknown" else "assigned", "score": score})

    def marker_layer(layer_id, label, short, used, note):
        return {
            "id": layer_id, "label": label, "short_label": short, "role": "marker",
            "evidence_type": "curated_annotation", "source": "author",
            "method": {"name": "curated marker set",
                       "description": "Markers compiled by the authors from direct experimental evidence in Dictyostelium or from homology to validated markers in other eukaryotes. Table S1 does not say which basis applies to which marker. " + note},
            "assignments": [{"entity": g, "compartment": comp_id[lab], "status": "assigned"}
                            for g, lab, u in markers if u == used],
        }

    training_layer = marker_layer(
        "markers-training", "Markers used to train the SVM (Tinker et al. 2026)", "Training marker", "Yes",
        "These rows have 'Used to train SVM?' = Yes. Agreement between them and the SVM is expected and is not validation.")
    heldout_layer = marker_layer(
        "markers-heldout", "Markers not used to train the SVM (Tinker et al. 2026)", "Marker", "No",
        "These rows have 'Used to train SVM?' = No. The preprint does not state how they were chosen or whether they were selected independently of the SVM result, so agreement with the SVM is reported but is not labelled independent validation here.")
    mito_layer = {
        "id": "mito-compendium", "label": "Mitochondrial compendium (Tinker et al. 2026)", "short_label": "Mito compendium",
        "evidence_type": "curated_annotation", "source": "author",
        "method": {"name": "author-curated compendium",
                   "description": "Mitochondrial inventory assembled by the authors from the SVM result, cluster membership, targeting predictions and prior evidence. The evidence category for each entry is kept verbatim; some categories rest on sequence prediction or are listed without detection in this experiment."},
        "attribute_labels": {"evidence": "Mitochondrial evidence"},
        "assignments": [{"entity": g, "compartment": comp_id[mito_label], "status": "assigned",
                         "attributes": {"evidence": ev}} for g, ev in mito],
    }

    n_undetected = len(extra)
    seen = B.mapping_stats(entities[:len(svm)], "detected groups only")
    dataset = {
        "id": "tinker2026-vegetative",
        "title": "Subcellular spatial proteomics of vegetative Dictyostelium discoideum",
        "description": "Published compartment assignments only. The fraction abundance profiles and map coordinates are not in the supplement and are not reconstructed here.",
        "organism": {"name": "Dictyostelium discoideum", "taxon_id": 44689,
                     "condition": "vegetative cells, axenic growth"},
        "citation": {
            "text": "Tinker S, Poh Y-P, Dabrowska K, Sharma R, Pirrotte P, Wideman JG. Global mapping of protein localization in vegetative Dictyostelium discoideum by subcellular spatial proteomics. bioRxiv 2026.",
            "doi": "10.64898/2026.09.28.755154",
            "url": "https://www.biorxiv.org/content/10.64898/2026.09.28.755154v1",
            "peer_reviewed": False, "repository_accession": "PXD084378"},
        "license": {
            "id": "CC-BY-NC-ND-4.0",
            "name": "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0 International",
            "url": "https://creativecommons.org/licenses/by-nc-nd/4.0/",
            "redistribution": "restricted",
            "terms_note": "The source tables are public supplementary material of the preprint, licensed CC BY-NC-ND 4.0. This is a reformatted copy with every published value unchanged. Development of this resource was requested by the study's corresponding author, as reported by the dictyBase project lead. Written confirmation that this reformatted copy may be redistributed is still outstanding."},
        "attribution": "Data from Tinker et al. 2026 (bioRxiv, doi:10.64898/2026.09.28.755154), Wideman laboratory. Reformatted without changing any published value.",
        "provenance": {
            "builder": "spatial/adapters/dictybase/build_bundle.py",
            "built": built or datetime.date.today().isoformat(),
            "sources": list(sources),
            "steps": [
                "Read Tables S1, S2 and S3 from the supplementary workbook.",
                "Split each Accession cell on ';' into the members of one protein group.",
                "Map each RefSeq protein accession to a dictyBase gene id through CDS rows of the RefSeq GFF.",
                "Keep every group, including unmapped and multi-gene groups.",
                "Copy classes, scores and evidence categories verbatim into separate layers.",
            ]},
        "id_namespaces": {"entity": "protein group (Accession cell)", "member": "refseq_protein",
                          "gene": "dictybase_gene"},
        "mapping": B.mapping_stats(
            entities, "RefSeq protein accession to dictyBase gene id via GFF CDS attributes (protein_id, Dbxref).",
            source=mapping_source,
            notes=f"{len(svm)} detected protein groups from Table S2, plus {n_undetected} groups that appear only in Table S3 and are flagged detected=false. Among the detected groups, {seen['entities_unmapped']} have no gene mapping and {seen['entities_multi_gene']} span more than one gene; all are kept and listed in unmapped_entities and multi_gene_entities."),
        "notices": [
            "Preview, under development",
            "This is an unlisted preview under development for dictyBase. It is not a public release.",
            "Fractionation profiles and spatial maps are awaiting the full experimental matrix from the authors. Those views will appear here when the matrix is supplied; nothing has been reconstructed in the meantime.",
        ],
        "distribution": {"status": "local-only",
                         "reason": "Unlisted preview. Redistribution of this reformatted copy under the preprint's licence has not been confirmed in writing."},
    }
    return B.new_bundle(dataset, compartments, entities, [svm_layer, training_layer, heldout_layer, mito_layer])


# ---- measured fractionation profiles and maps ------------------------------

FRACTION_LABELS = ["1K", "3K", "5K", "9K", "12K", "15K", "30K", "79K", "120K", "SUP"]
LYSIS_CONDITIONS = 3
AUTHORS_MAP_LABEL = "Authors' t-SNE \u2014 coordinates reconstructed from published figure"


def read_matrix(path):
    """The authors' abundance matrix, exactly as supplied.
    -> (column names, row ids in file order, {row id: [float, ...]}, {row id: [text, ...]})"""
    import csv
    with open(path, newline="", encoding="utf-8-sig") as fh:
        rows = list(csv.reader(fh))
    header = rows[0]
    # R prefixes column names that start with a digit with "X"; "SUP" needs none
    want = ["Accession"] + [("" if f == "SUP" else "X") + f"{f}.{k}" for k in range(1, LYSIS_CONDITIONS + 1) for f in FRACTION_LABELS]
    if header != want:
        raise SystemExit(f"matrix header is not the expected 30 fraction columns: {header[:6]} ...")
    ids, values, text = [], {}, {}
    for r in rows[1:]:
        if len(r) != len(header) or any(c.strip() == "" for c in r):
            raise SystemExit(f"matrix row {r[:1]} is incomplete")
        if r[0] in values:
            raise SystemExit(f"matrix lists {r[0]} twice")
        ids.append(r[0])
        text[r[0]] = r[1:]
        values[r[0]] = [float(c) for c in r[1:]]
    return header[1:], ids, values, text


def fraction_list():
    out = []
    for k in range(1, LYSIS_CONDITIONS + 1):
        for f in FRACTION_LABELS:
            out.append({"id": f"L{k}-{f}", "label": f, "condition": f"Lysis condition {k}",
                        "description": ("Soluble fraction remaining after the final spin." if f == "SUP"
                                        else f"Pellet labelled {f} by the authors (differential centrifugation step).")})
    return out


def add_measurements(bundle, tables, matrix_path, figure_path, received):
    """Add the measured profiles, three computed maps and the map reconstructed
    from the authors' figure. Returns a validation report. Published layers are
    not touched."""
    import collections
    import numpy as np
    from spatialprot import embed, summary
    report = {"received": received}
    layers_before = B.dumps({"layers": bundle["layers"]})

    # 1. the matrix, exactly as supplied, and its identity with Table S2
    columns, ids, values, text = read_matrix(matrix_path)
    s2 = {r[0]: r for r in tables["svm"]}
    if set(ids) != set(s2):
        raise SystemExit("matrix rows are not exactly the protein groups of Table S2")
    M = np.array([values[i] for i in ids])
    sums = np.array([M[:, k * 10:(k + 1) * 10].sum(axis=1) for k in range(LYSIS_CONDITIONS)])
    report["matrix"] = {
        "rows": len(ids), "columns": len(columns), "rows_identical_to_table_s2": True,
        "row_order": "sorted by accession" if ids == sorted(ids) else "as supplied",
        "values_parsed_equal_supplied_text": all(repr(float(t)) == repr(v) for i in ids for t, v in zip(text[i], values[i])),
        "min": float(M.min()), "max": float(M.max()), "negative_values": int((M < 0).sum()),
        "exact_zeros": int((M == 0).sum()), "exact_zero_share": round(float((M == 0).mean()), 4),
        "per_condition_row_sum": [{"condition": f"Lysis condition {k + 1}", "min": float(sums[k].min()), "max": float(sums[k].max()),
                                   "max_deviation_from_1": float(np.abs(sums[k] - 1).max())} for k in range(LYSIS_CONDITIONS)],
    }
    if np.abs(sums - 1).max() > 1e-6:
        raise SystemExit("a lysis-condition profile does not sum to 1")
    bundle["fractions"] = fraction_list()
    bundle["profiles"] = {
        "evidence_type": "measured_profile", "source": "author",
        "unit": "share of the protein's summed abundance within one lysis condition",
        "processing": ("Values exactly as supplied by the authors (file " + pathlib.Path(matrix_path).name + "). According to the file name and "
                       "the preprint's Figure S2, missing values were imputed by nearest-neighbour averaging followed by zero-value "
                       "imputation, and within each lysis condition a protein's ten fractions were scaled to sum to 1. "
                       "No further normalization or imputation is applied here. The three lysis methods in the preprint are nitrogen "
                       "cavitation, filtration, and nitrogen cavitation followed by Dounce homogenization; which is condition 1, 2 or 3 "
                       "in this file has not been confirmed."),
        "values": {i: values[i] for i in ids},
    }

    # 2. does each class sit where biology says it should?
    final = collections.defaultdict(list)
    for i in ids:
        if s2[i][3] != "unknown":
            final[s2[i][3]].append(values[i])
    peaks = {}
    for label, rows in sorted(final.items()):
        mean = np.mean(rows, axis=0)
        peaks[label] = {"n": len(rows), "peak_fraction_per_condition": [FRACTION_LABELS[int(mean[k * 10:(k + 1) * 10].argmax())] for k in range(LYSIS_CONDITIONS)]}
    report["class_mean_profiles"] = peaks

    # 3. three computed maps, each from the matrix as supplied
    maps = [embed.tsne(bundle), embed.pca(bundle), embed.umap(bundle)]
    report["computed_maps"] = {m["id"]: dict(m["method"]["parameters"], software=m["method"]["software"],
                                             trustworthiness_k15=round(embed.trustworthiness(bundle, m), 4)) for m in maps}

    # 4. the authors' map, reconstructed from their figure
    if figure_path:
        from figure_coordinates import recover
        coords, groups, facts = recover(pathlib.Path(figure_path).read_bytes(), ids)
        rec = {"id": "authors-tsne", "label": AUTHORS_MAP_LABEL, "short_label": "Authors' t-SNE",
               "method": {"name": "t-SNE (authors' figure)", "software": "R 4.3.3 (figure); positions read by figure_coordinates.py",
                          "description": "Positions read from the circles drawn in the authors' vector figure and converted with the figure's axis ticks. "
                                         "The figure carries no protein names: each position is tied to a protein group by the drawing order, "
                                         "which was tested against the published classes and the measured profiles.",
                          "parameters": {"source_file": pathlib.Path(figure_path).name, "position_resolution": facts["position_resolution"],
                                         "axis_calibration_worst_residual": facts["axis_calibration_worst_residual"]}},
               "source": "author", "derived_from": "profiles", "axes": ["Dimension 1", "Dimension 2"], "coordinates": coords}
        order_s2 = [r[0] for r in tables["svm"]]

        def purity(order):
            alt = dict(zip(ids, order))            # the protein each row would be under another row order
            ok = total = 0
            for members in groups.values():
                c = collections.Counter(s2[alt[i]][1] for i in members)
                ok += c.most_common(1)[0][1]
                total += len(members)
            return round(ok / total, 4)

        xy = np.array([coords[i] for i in ids])
        from sklearn.neighbors import NearestNeighbors
        nn = NearestNeighbors(n_neighbors=2).fit(xy).kneighbors(xy, return_distance=False)[:, 1]
        z = M - M.mean(axis=1, keepdims=True)
        z /= np.linalg.norm(z, axis=1, keepdims=True)
        observed = float(np.mean(np.sum(z * z[nn], axis=1)))
        perm = np.random.default_rng(20261012).permutation(len(ids))
        shuffled = float(np.mean(np.sum(z[perm] * z[perm][nn], axis=1)))
        tw = embed.trustworthiness(bundle, rec)
        mismatched = sum(1 for members in groups.values()
                         for i in members if s2[i][1] != collections.Counter(s2[j][1] for j in members).most_common(1)[0][0])
        facts.update({
            "row_order_tested": "matrix file order (sorted by accession)",
            "coloured_points_whose_group_matches_column_svm": purity(ids),
            "same_test_under_table_s2_row_order": purity(order_s2),
            "coloured_points_not_matching_their_group_class": mismatched,
            "mean_profile_correlation_with_nearest_map_neighbour": round(observed, 4),
            "same_with_rows_shuffled": round(shuffled, 4),
            "trustworthiness_k15_against_supplied_matrix": round(tw, 4),
        })
        identical = [g for g in facts["positions_shared_by_several_rows"] if all(values[g[0]] == values[i] for i in g)]
        facts["shared_positions_with_identical_profiles"] = len(identical)
        reliable = (facts["overlay_points_unmatched"] == 0 and facts["coloured_points_whose_group_matches_column_svm"] >= 0.99
                    and observed - shuffled > 0.5 and tw >= 0.9)
        facts["judged_reliable_for_viewing"] = bool(reliable)
        rec["note"] = ("Reconstructed from the authors' figure, not their original numbers. Each point's protein was inferred from the drawing "
                       "order and checked against the published classes. For viewing only; it is not used in any calculation here."
                       + ("" if reliable else " The row mapping did not pass every check, so treat this map as an experimental preview.")
                       + " " + embed.CAVEAT)

        # which published column does the figure colour by?
        coloured = {i: c for c, members in groups.items() for i in members}
        per_class = {}
        for label in sorted({r[1] for r in tables["svm"]}):
            rows = [r for r in tables["svm"] if r[1] == label]
            fig = [r for r in rows if r[0] in coloured]
            not_fig = [r for r in rows if r[0] not in coloured]
            pred = [r for r in rows if r[3] != "unknown"]
            lo = min((r[2] for r in fig), default=None)
            hi = max((r[2] for r in not_fig), default=None)
            per_class[label] = {
                "svm_class_total": len(rows), "final_calls_svm_pred": len(pred), "coloured_in_figure": len(fig),
                "final_calls_also_coloured": sum(1 for r in pred if r[0] in coloured),
                "coloured_without_final_call": sum(1 for r in fig if r[3] == "unknown"),
                "lowest_score_coloured": lo, "highest_score_not_coloured": hi,
                "clean_score_cutoff_within_class": bool(lo is not None and (hi is None or lo > hi)),
                "class_median_score": float(np.median([r[2] for r in rows])),
            }
        clean = [k for k, v in per_class.items() if v["clean_score_cutoff_within_class"]]
        near_median = [k for k in clean if per_class[k]["highest_score_not_coloured"] is not None
                       and per_class[k]["highest_score_not_coloured"] < per_class[k]["class_median_score"] <= per_class[k]["lowest_score_coloured"]]
        report["figure_versus_table_s2"] = {
            "coloured_points": len(coloured), "final_calls_in_table": sum(1 for r in tables["svm"] if r[3] != "unknown"),
            "coloured_points_with_a_final_call": sum(1 for i in coloured if s2[i][3] != "unknown"),
            "final_calls_not_coloured": sum(1 for r in tables["svm"] if r[3] != "unknown" and r[0] not in coloured),
            "classes_with_a_clean_score_cutoff": len(clean), "classes_where_that_cutoff_is_the_class_median": len(near_median),
            "classes": per_class,
        }
        bundle["embeddings"] = maps + [rec]
        report["authors_map_reconstruction"] = facts
    else:
        bundle["embeddings"] = maps

    ds = bundle["dataset"]
    ds["description"] = ("Published compartment assignments (Tables S1 to S3), with the measured fractionation profiles supplied by the authors. "
                         "Maps are computed here from those profiles, except the authors' own map, which is reconstructed from their figure.")
    ds["notices"] = [ds["notices"][0], "This is an unlisted preview under development for dictyBase. It is not a public release.",
                     f"Fractionation profiles were supplied by the authors on {received} and are unpublished."]
    if B.dumps({"layers": bundle["layers"]}) != layers_before:
        raise SystemExit("published layers changed while adding measurements")
    report["published_layers_unchanged"] = True
    return report


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--matrix", help="the authors' protein-by-fraction CSV; adds measured profiles and computed maps")
    ap.add_argument("--figure", help="the authors' t-SNE figure (vector PDF); adds the reconstructed map")
    ap.add_argument("--received", default="2026-10-12", help="date the matrix and figure were received")
    ap.add_argument("--xlsx", required=True)
    ap.add_argument("--gff", default=str(DEFAULT_GFF))
    ap.add_argument("--fasta", help="optional FASTA whose headers describe accessions the GFF lacks")
    ap.add_argument("--out", default=str(DEFAULT_OUT))
    args = ap.parse_args(argv)

    sources = [
        {"name": pathlib.Path(args.xlsx).name, "sha256": B.sha256_file(args.xlsx),
         "description": "Supplementary Tables S1 to S3 of the preprint.",
         "url": "https://www.biorxiv.org/content/10.64898/2026.09.28.755154v1.supplementary-material"},
        {"name": pathlib.Path(args.gff).name, "sha256": B.sha256_file(args.gff),
         "description": "RefSeq GFF3 for D. discoideum AX4, used only to map protein accessions to gene ids."},
    ]
    desc = {}
    if args.fasta:
        desc = fasta_descriptions(args.fasta)
        sources.append({"name": pathlib.Path(args.fasta).name, "sha256": B.sha256_file(args.fasta),
                        "description": "Supplementary FASTA; headers used as descriptions for accessions absent from the GFF."})
    report = None
    for path, what in ((args.matrix, "Protein-by-fraction abundance matrix supplied by the authors. Unpublished."),
                       (args.figure, "t-SNE figure (vector PDF) supplied by the authors. Positions are reconstructed from it.")):
        if path:
            sources.append({"name": pathlib.Path(path).name, "sha256": B.sha256_file(path), "description": what})
    tables = read_tables(args.xlsx)
    bundle = build(tables, protein_gene_map(args.gff), desc, sources,
                   mapping_source=pathlib.Path(args.gff).name)
    if args.matrix:
        bundle["dataset"]["provenance"]["steps"] += [
            "Read the authors' abundance matrix and check that its rows are exactly the protein groups of Table S2.",
            "Store all 30 values per protein group unchanged, as three lysis conditions of ten fractions.",
            "Compute PCA, t-SNE and UMAP from the matrix as supplied, with fixed seeds and recorded parameters.",
            "Read point positions from the authors' t-SNE figure and test the row mapping.",
        ]
        report = add_measurements(bundle, tables, args.matrix, args.figure, args.received)
        report["sources"] = sources

    issues = V.validate(bundle)
    for i in issues:
        print(i)
    if V.errors(issues):
        raise SystemExit("bundle failed validation; nothing written")
    # the published scores must survive the round trip bit for bit
    B.dump(bundle, args.out)
    back = {a["entity"]: a["score"] for a in B.load(args.out)["layers"][0]["assignments"]}
    assert all(back[g] == s for g, _, s, _ in tables["svm"]), "score changed on write"
    m = bundle["dataset"]["mapping"]
    if report is not None:
        out = pathlib.Path(args.out).with_name("validation_report.json")
        out.write_text(json.dumps(report, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
        print(f"wrote {out}")
    print(f"wrote {args.out}")
    print({k: v for k, v in m.items() if not isinstance(v, list)})
    return bundle


if __name__ == "__main__":
    main()
