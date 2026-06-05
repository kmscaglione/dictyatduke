#!/usr/bin/env python3
"""Second hand-vetted, model-authored AI-curation batch (well-studied core).

Same mechanism and guardrails as seed_ai_curation_inline.py: authored inline by
Claude from training knowledge (no ANTHROPIC_API_KEY here), then every gene
symbol is checked against assets/gene_index.json and every GO id against the
real Dictyostelium GAF (assets/go_annotations.json) before writing -- so no GO
id is invented. Merges into assets/ai_curation.json.

This batch covers the next tier of genuinely well-characterised genes: cAMP
receptors, guanylyl cyclases / cGMP, MAP-kinase pathway, actin
crosslinkers/severers/nucleators, myosin II regulation, membrane traffic, more
Ras/Rho GTPases, STATs, DIF-1 synthesis, cell adhesion, and the cell cycle.

Run:  python3 scripts/seed_ai_curation_inline_2.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ai_curation.json"
MODEL = "claude-opus-4-8"

# symbol -> (summary, [(GO id, aspect P|F|C, term name), ...])
BATCH = {
    # --- cAMP receptors / G proteins ---
    "carB": (
        "cAMP receptor 2 (cAR2), a serpentine G-protein-coupled receptor for "
        "extracellular cAMP. cAR2 has lower cAMP affinity than cAR1 and is "
        "expressed at the mound stage in prestalk cells, where it helps transduce "
        "cAMP signals that pattern the multicellular structure.",
        [("GO:0004930", "F", "G protein-coupled receptor activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "carC": (
        "cAMP receptor 3 (cAR3), a G-protein-coupled cAMP receptor expressed "
        "during early multicellular development. It contributes to cAMP relay and "
        "cell-type patterning, partly overlapping in function with the other cAMP "
        "receptors.",
        [("GO:0004930", "F", "G protein-coupled receptor activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "carD": (
        "cAMP receptor 4 (cAR4), the latest-expressed of the four cAMP receptors, "
        "present in prestalk and prespore cells during culmination. It fine-tunes "
        "the cAMP responses required for terminal differentiation and normal "
        "spore/stalk patterning.",
        [("GO:0004930", "F", "G protein-coupled receptor activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "gpaA": (
        "Galpha1, a heterotrimeric G-protein alpha subunit. It is one of several "
        "Galpha subunits that couple cell-surface receptors to intracellular "
        "effectors; gpaA mutants show altered growth and development.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway")],
    ),
    "crlA": (
        "A cAMP-receptor-like (family-3 / GABA-B-type) G-protein-coupled "
        "receptor that broadens the GPCR repertoire beyond the four cAR receptors "
        "and contributes to developmental signaling.",
        [("GO:0004930", "F", "G protein-coupled receptor activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    # --- guanylyl cyclases / cGMP ---
    "gcA": (
        "A membrane-bound (12-transmembrane) guanylyl cyclase that produces cGMP "
        "in response to chemoattractant. With the soluble cyclase sGC it generates "
        "the cGMP burst that regulates myosin II assembly in the cell rear during "
        "chemotaxis.",
        [("GO:0004383", "F", "guanylate cyclase activity"),
         ("GO:0006182", "P", "cGMP biosynthetic process"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "sgcA": (
        "The soluble guanylyl cyclase (sGC), the major source of "
        "chemoattractant-stimulated cGMP. It localizes dynamically to the leading "
        "edge, and the cGMP it produces controls myosin II filament formation and "
        "suppression of lateral pseudopods during chemotaxis.",
        [("GO:0004383", "F", "guanylate cyclase activity"),
         ("GO:0006182", "P", "cGMP biosynthetic process"),
         ("GO:0006935", "P", "chemotaxis")],
    ),
    # --- MAP-kinase pathway ---
    "erkB": (
        "A mitogen-activated protein kinase (Dd-ERK2). ERK2 is rapidly and "
        "transiently activated by cAMP and is required for the cAMP relay that "
        "drives aggregation; erkB-null cells are aggregation-deficient.",
        [("GO:0004707", "F", "MAP kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0000165", "P", "MAPK cascade")],
    ),
    "erkA": (
        "A mitogen-activated protein kinase (Dd-ERK1) acting in MAP-kinase "
        "signaling during growth and development, with roles distinct from the "
        "aggregation-essential ERK2.",
        [("GO:0004707", "F", "MAP kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0000165", "P", "MAPK cascade")],
    ),
    "mekA": (
        "A MAP kinase kinase (MEK) that phosphorylates and activates downstream "
        "MAP kinases, functioning in the signaling cascades that control "
        "aggregation and chemotaxis.",
        [("GO:0004708", "F", "MAP kinase kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0000165", "P", "MAPK cascade")],
    ),
    "pakA": (
        "A p21-activated kinase (PAKa) acting downstream of Rac GTPases. PAKa "
        "localizes to the rear of chemotaxing cells and the cleavage furrow, where "
        "it promotes myosin II assembly and is required for normal cytokinesis and "
        "cell polarity.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    # --- actin crosslinkers / severers / nucleators ---
    "ctxA": (
        "Cortexillin I, an actin-bundling protein of the alpha-actinin/spectrin "
        "superfamily that concentrates in the cleavage furrow during cytokinesis. "
        "With cortexillin II it is essential for normal cell shape and division; "
        "double mutants fail cytokinesis.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0051017", "P", "actin filament bundle assembly"),
         ("GO:0000281", "P", "mitotic cytokinesis")],
    ),
    "ctxB": (
        "Cortexillin II, an actin-bundling protein that partners with cortexillin "
        "I at the cleavage furrow to drive cytokinesis and maintain cortical "
        "mechanics and cell shape.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0051017", "P", "actin filament bundle assembly"),
         ("GO:0000281", "P", "mitotic cytokinesis")],
    ),
    "fimA": (
        "Fimbrin (plastin), a calcium-regulated actin-bundling protein. It "
        "crosslinks actin filaments in the cell cortex, filopodia, and phagocytic "
        "structures, contributing to cortical organization.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0051017", "P", "actin filament bundle assembly"),
         ("GO:0005509", "F", "calcium ion binding")],
    ),
    "sevA": (
        "Severin, a calcium-activated, gelsolin-related protein that severs and "
        "caps actin filaments, promoting actin-filament turnover and remodeling "
        "during motility and other actin-dependent processes.",
        [("GO:0051014", "P", "actin filament severing"),
         ("GO:0003779", "F", "actin binding"),
         ("GO:0005509", "F", "calcium ion binding")],
    ),
    "proA": (
        "Profilin I, a small actin-monomer-binding protein that regulates the "
        "pool of polymerization-competent actin. Profilins I and II are partly "
        "redundant; loss of both severely disrupts the cytoskeleton and "
        "cytokinesis.",
        [("GO:0003785", "F", "actin monomer binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "proB": (
        "Profilin II, an actin-monomer-binding protein that, with profilin I, "
        "controls actin polymerization dynamics. The two profilins act "
        "redundantly to maintain cytoskeletal organization and normal cell "
        "division.",
        [("GO:0003785", "F", "actin monomer binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "scrA": (
        "SCAR (WAVE), an activator of the Arp2/3 complex that nucleates branched "
        "actin filaments to build pseudopods and other protrusions; scrA mutants "
        "have abnormal cell shape and reduced motility. SCAR was originally "
        "identified in Dictyostelium.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0034314", "P", "Arp2/3 complex-mediated actin nucleation"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "wasA": (
        "Wiskott-Aldrich Syndrome protein (WASP), an activator of the Arp2/3 "
        "complex. WASP nucleates branched actin at sites of clathrin-mediated "
        "endocytosis, phagocytosis, and the leading edge, and is essential for "
        "viability.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0034314", "P", "Arp2/3 complex-mediated actin nucleation")],
    ),
    "vasP": (
        "Ena/VASP, an actin-regulatory protein that localizes to filopodial tips "
        "and promotes actin-filament elongation. VasP is important for filopodia "
        "formation and contributes to chemotaxis and adhesion.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "gmfA": (
        "Glia maturation factor (GMF), an ADF-H-family protein that promotes "
        "debranching and disassembly of Arp2/3-nucleated actin networks, helping "
        "turn over branched actin during motility.",
        [("GO:0008092", "F", "cytoskeletal protein binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    # --- myosin II regulation / unconventional myosin ---
    "mlcE": (
        "The essential light chain of myosin II, which binds the myosin II "
        "heavy-chain neck and is required for motor function, supporting the "
        "myosin II activity needed for cytokinesis and cortical tension.",
        [("GO:0017022", "F", "myosin binding"),
         ("GO:0016459", "C", "myosin complex")],
    ),
    "mlcR": (
        "The regulatory light chain of myosin II. Its phosphorylation modulates "
        "myosin II motor activity and filament function during cytokinesis and "
        "cortical contraction.",
        [("GO:0017022", "F", "myosin binding"),
         ("GO:0016459", "C", "myosin complex")],
    ),
    "mhkA": (
        "Myosin heavy-chain kinase A (MHCK A), an alpha-kinase that "
        "phosphorylates threonines in the myosin II tail to drive filament "
        "disassembly. It is a key regulator of myosin II localization and turnover "
        "during motility and cytokinesis.",
        [("GO:0016301", "F", "kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0017022", "F", "myosin binding")],
    ),
    "myoI": (
        "A class VII unconventional myosin required for cell-substratum adhesion "
        "and phagocytosis. Myosin VII works with talin to link the actin "
        "cytoskeleton to adhesion receptors and is needed for filopodia and "
        "particle uptake.",
        [("GO:0003774", "F", "cytoskeletal motor activity"),
         ("GO:0003779", "F", "actin binding"),
         ("GO:0007155", "P", "cell adhesion")],
    ),
    # --- membrane traffic / microtubules ---
    "dymA": (
        "Dynamin A, a large GTPase involved in membrane scission. DymA functions "
        "in endocytosis, organelle (including mitochondrial and contractile-"
        "vacuole) dynamics, and cytokinesis.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0016192", "P", "vesicle-mediated transport")],
    ),
    "chcA": (
        "Clathrin heavy chain, the structural backbone of clathrin coats, "
        "required for clathrin-mediated endocytosis and vesicle traffic; chcA "
        "mutants have defects in endocytosis, osmoregulation, and development.",
        [("GO:0006897", "P", "endocytosis"),
         ("GO:0030136", "C", "clathrin-coated vesicle")],
    ),
    "rab7A": (
        "A Rab7 small GTPase that regulates late-endosomal and phagosomal "
        "maturation, controlling trafficking and acidification of phagosomes -- "
        "important for digestion of ingested bacteria.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0005770", "C", "late endosome")],
    ),
    "tubA": (
        "Alpha-tubulin, which heterodimerizes with beta-tubulin to form "
        "microtubules. Microtubules radiating from the centrosome organize the "
        "mitotic spindle and intracellular transport.",
        [("GO:0005200", "F", "structural constituent of cytoskeleton"),
         ("GO:0005874", "C", "microtubule"),
         ("GO:0005525", "F", "GTP binding")],
    ),
    # --- more Ras/Rho GTPases and a RasGEF ---
    "rasD": (
        "A Ras-family small GTPase expressed strongly in prestalk cells during "
        "development. Constitutively active rasD disrupts pattern formation, "
        "indicating a role in developmental cell-fate signaling.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0007165", "P", "signal transduction")],
    ),
    "rasS": (
        "A Ras-family small GTPase that regulates fluid-phase endocytosis and "
        "motility. rasS mutants take up nutrients poorly and move abnormally, "
        "linking Ras signaling to macropinocytosis and growth.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "gbpD": (
        "A RasGEF-domain protein (cyclic-nucleotide-binding GEF family) that "
        "activates the small GTPase Rap1. GbpD signaling promotes cell spreading, "
        "substrate adhesion, and flattening; its loss reduces adhesion.",
        [("GO:0005085", "F", "guanyl-nucleotide exchange factor activity"),
         ("GO:0035556", "P", "intracellular signal transduction"),
         ("GO:0007155", "P", "cell adhesion")],
    ),
    # --- signaling kinases / Ca channel ---
    "gskA": (
        "Glycogen synthase kinase-3 (GSK-3), a Ser/Thr kinase that regulates the "
        "stalk-versus-spore cell-fate choice. Activated downstream of cAMP via the "
        "tyrosine kinase ZAK1, GSK-3 promotes prespore over prestalk fate.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "sgkA": (
        "A sphingosine kinase that phosphorylates sphingosine to "
        "sphingosine-1-phosphate, a bioactive sphingolipid. This lipid-kinase "
        "activity contributes to sphingolipid signaling affecting growth and "
        "stress responses.",
        [("GO:0016301", "F", "kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "iplA": (
        "An inositol-1,4,5-trisphosphate-receptor-like protein, the principal "
        "intracellular calcium-release channel in Dictyostelium. iplA is required "
        "for calcium responses to chemoattractants and other agonists.",
        [("GO:0005220", "F", "inositol 1,4,5-trisphosphate-sensitive calcium-release channel activity"),
         ("GO:0006816", "P", "calcium ion transport")],
    ),
    # --- STAT transcription factors ---
    "dstA": (
        "Dd-STATa, a STAT-family transcription factor activated by extracellular "
        "cAMP via the receptor cAR1. It translocates to the nucleus and is "
        "required for proper culmination and stalk-cell differentiation; dstA "
        "mutants arrest as slugs.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "dstC": (
        "Dd-STATc, a STAT-family transcription factor activated by the morphogen "
        "DIF-1 and by stress (e.g. hyperosmotic). It accumulates in the nucleus to "
        "regulate prestalk and stress-response gene expression.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    # --- DIF-1 morphogen synthesis ---
    "dmtA": (
        "Des-methyl-DIF-1 methyltransferase (DmtA), which catalyzes the final "
        "methylation step in synthesis of the stalk-inducing morphogen DIF-1. "
        "dmtA mutants lack DIF-1 and are impaired in prestalk/stalk "
        "differentiation.",
        [("GO:0008168", "F", "methyltransferase activity"),
         ("GO:0032259", "P", "methylation")],
    ),
    "stlB": (
        "Steely2 (StlB), a hybrid polyketide-synthase/fatty-acid-synthase enzyme "
        "that produces the polyketide precursor of the morphogen DIF-1. stlB "
        "mutants lack DIF-1, linking this enzyme to stalk-cell induction.",
        [("GO:0004312", "F", "fatty acid synthase activity")],
    ),
    # --- prestalk peptide-signal processing (ABC transporter/protease) ---
    "tagB": (
        "A prestalk-specific protein combining an ABC-transporter and a "
        "serine-protease domain. TagB processes and exports peptide signals (the "
        "SDF family) needed for prestalk-cell differentiation and culmination.",
        [("GO:0005524", "F", "ATP binding"),
         ("GO:0004252", "F", "serine-type endopeptidase activity"),
         ("GO:0055085", "P", "transmembrane transport")],
    ),
    "tagC": (
        "A prestalk ABC-transporter/serine-protease that processes and releases "
        "the peptide signal SDF-2 to trigger rapid spore encapsulation during "
        "culmination.",
        [("GO:0005524", "F", "ATP binding"),
         ("GO:0004252", "F", "serine-type endopeptidase activity"),
         ("GO:0055085", "P", "transmembrane transport")],
    ),
    # --- density sensing / adhesion / cell cycle / ubiquitin ---
    "cmfA": (
        "Conditioned Medium Factor (CMF), a secreted glycoprotein that reports "
        "cell density. Starving cells release CMF, and only once enough "
        "accumulates (high density) can cells respond to cAMP and aggregate, "
        "coupling population density to development.",
        [("GO:0007154", "P", "cell communication")],
    ),
    "cadA": (
        "DdCAD-1 (gp24), a calcium-dependent cell-adhesion molecule that mediates "
        "the EDTA-sensitive cell contacts formed early in aggregation. It is "
        "secreted and transported to the cell surface to bind cells together at "
        "the onset of development.",
        [("GO:0007155", "P", "cell adhesion"),
         ("GO:0098609", "P", "cell-cell adhesion"),
         ("GO:0005509", "F", "calcium ion binding")],
    ),
    "rblA": (
        "A retinoblastoma (Rb)-family protein that regulates the cell cycle and "
        "development, helping couple proliferation to the developmental program "
        "and influencing spore differentiation.",
        [("GO:0005634", "C", "nucleus"),
         ("GO:0051726", "P", "regulation of cell cycle")],
    ),
    "culB": (
        "Cullin B, a scaffold subunit of a Cullin-RING E3 ubiquitin-ligase "
        "complex that targets proteins for ubiquitin-dependent degradation, "
        "contributing to developmental regulation.",
        [("GO:0016567", "P", "protein ubiquitination"),
         ("GO:0031461", "C", "cullin-RING ubiquitin ligase complex")],
    ),
    "dhkD": (
        "A two-component histidine kinase that feeds into the phosphorelay "
        "controlling intracellular cAMP via RegA, contributing to the regulation "
        "of developmental timing.",
        [("GO:0004673", "F", "protein histidine kinase activity"),
         ("GO:0000160", "P", "phosphorelay signal transduction system")],
    ),
}


def main() -> int:
    index = json.loads((ROOT / "assets" / "gene_index.json").read_text())
    symbols = {row[1] for row in index if len(row) > 1 and row[1]}
    go = json.loads((ROOT / "assets" / "go_annotations.json").read_text())
    real_go = {r[0] for v in go.values() for r in v}

    errors = []
    for sym, (summary, terms) in BATCH.items():
        if sym not in symbols:
            errors.append(f"unknown gene symbol: {sym}")
        for gid, aspect, name in terms:
            if gid not in real_go:
                errors.append(f"{sym}: GO id not in Dicty GAF: {gid}")
            if aspect not in ("P", "F", "C"):
                errors.append(f"{sym}: bad aspect {aspect} on {gid}")
    if errors:
        print("VALIDATION FAILED:", file=sys.stderr)
        for e in errors:
            print("  -", e, file=sys.stderr)
        return 1

    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    added, updated = 0, 0
    for sym, (summary, terms) in BATCH.items():
        key = sym.lower()
        (updated := updated + 1) if key in data else (added := added + 1)
        data[key] = {
            "summary": summary.strip(),
            "go": [[gid, aspect, name] for gid, aspect, name in terms],
        }

    data["_meta"] = {
        "layer": "AI curation",
        "model": MODEL,
        "disclaimer": "Machine-generated by an LLM. Suggestions only -- unreviewed, "
        "may be incomplete or wrong. Verify against curated evidence.",
        "schema": "keyed by lowercase gene symbol -> { summary, go: [[GO id, P|F|C, name], ...] }",
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    n = len([k for k in data if not k.startswith("_")])
    print(f"wrote {OUT} (+{added} new, {updated} updated; {n} genes total)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
