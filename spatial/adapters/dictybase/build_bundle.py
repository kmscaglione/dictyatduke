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
        "id": "svm", "label": "SVM classification (Tinker et al. 2026)",
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

    def marker_layer(layer_id, label, used, note):
        return {
            "id": layer_id, "label": label,
            "evidence_type": "curated_annotation", "source": "author",
            "method": {"name": "curated marker set",
                       "description": "Markers compiled by the authors from direct experimental evidence in Dictyostelium or from homology to validated markers in other eukaryotes. Table S1 does not say which basis applies to which marker. " + note},
            "assignments": [{"entity": g, "compartment": comp_id[lab], "status": "assigned"}
                            for g, lab, u in markers if u == used],
        }

    training_layer = marker_layer(
        "markers-training", "Markers used to train the SVM (Tinker et al. 2026)", "Yes",
        "These rows have 'Used to train SVM?' = Yes. Agreement between them and the SVM is expected and is not validation.")
    heldout_layer = marker_layer(
        "markers-heldout", "Markers not used to train the SVM (Tinker et al. 2026)", "No",
        "These rows have 'Used to train SVM?' = No. The preprint does not state how they were chosen or whether they were selected independently of the SVM result, so agreement with the SVM is reported but is not labelled independent validation here.")
    mito_layer = {
        "id": "mito-compendium", "label": "Mitochondrial compendium (Tinker et al. 2026)",
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
            "terms_note": "The preprint asks investigators to contact the authors before using these data. This reformatted copy may count as a derivative. Do not distribute until the authors have agreed."},
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
            "This dataset is being evaluated for integration into dictyBase. This is a local preview and is not public.",
            "Fractionation profiles and spatial maps are awaiting the full experimental matrix from the authors. Those views will appear here when the matrix is supplied; nothing has been reconstructed in the meantime.",
        ],
        "distribution": {"status": "local-only",
                         "reason": "Reuse terms not yet clarified with the authors."},
    }
    return B.new_bundle(dataset, compartments, entities, [svm_layer, training_layer, heldout_layer, mito_layer])


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
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
    tables = read_tables(args.xlsx)
    bundle = build(tables, protein_gene_map(args.gff), desc, sources,
                   mapping_source=pathlib.Path(args.gff).name)

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
    print(f"wrote {args.out}")
    print({k: v for k, v in m.items() if not isinstance(v, list)})
    return bundle


if __name__ == "__main__":
    main()
