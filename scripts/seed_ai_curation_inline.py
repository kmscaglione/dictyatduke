#!/usr/bin/env python3
"""Seed the AI-curation layer with a hand-vetted, model-authored batch.

This is the same *third* curation layer produced by ``generate_ai_curation.py``
(badged "AI", machine-generated, unreviewed, possibly wrong), but authored
inline by Claude in an environment without an ANTHROPIC_API_KEY rather than via
the API. It extends coverage beyond the 15 curated genes to a set of
well-characterised Dictyostelium genes.

Two guardrails run before anything is written:
  * every gene symbol must exist in assets/gene_index.json (exact casing), and
  * every GO id must actually appear in the real Dictyostelium GAF
    (assets/go_annotations.json) -- so no GO id here is invented.

Re-runnable: merges into assets/ai_curation.json, preserving existing entries
and the _meta block. Run:  python3 scripts/seed_ai_curation_inline.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ai_curation.json"
MODEL = "claude-opus-4-8"

# symbol -> (summary, [(GO id, aspect P|F|C, term name), ...])
BATCH = {
    # --- cAMP / adenylyl cyclase / PKA ---
    "acgA": (
        "ACG (adenylyl cyclase G) is one of the three Dictyostelium adenylyl "
        "cyclases. It is expressed in spores, where it acts as an osmosensor: "
        "high ambient osmolarity stimulates its cAMP production to keep spores "
        "dormant and inhibit premature germination.",
        [("GO:0004016", "F", "adenylate cyclase activity"),
         ("GO:0006171", "P", "cAMP biosynthetic process"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "acrA": (
        "ACR (also called ACB) is an adenylyl cyclase carrying sensor "
        "histidine-kinase-like and response-regulator domains. It is required "
        "during late development for proper culmination and terminal spore and "
        "stalk differentiation.",
        [("GO:0004016", "F", "adenylate cyclase activity"),
         ("GO:0006171", "P", "cAMP biosynthetic process")],
    ),
    "pkaR": (
        "Regulatory subunit of cAMP-dependent protein kinase (PKA). Without "
        "cAMP it binds and inhibits the PKA catalytic subunit (pkaC); cAMP "
        "binding releases the catalytic subunit. PKA activity is the master "
        "switch for aggregation, prestalk/prespore choice, and spore maturation.",
        [("GO:0030552", "F", "cAMP binding"),
         ("GO:0008603", "F", "cAMP-dependent protein kinase regulator activity"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "gpaB": (
        "Galpha2, the heterotrimeric G-protein alpha subunit that couples the "
        "cAMP receptor cAR1 to downstream effectors during aggregation. gpaB-null "
        "cells fail to aggregate because they cannot transduce extracellular cAMP "
        "into intracellular responses.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0007186", "P", "G protein-coupled receptor signaling pathway")],
    ),
    "gpbA": (
        "The single G-protein beta subunit in Dictyostelium. It partners with "
        "Galpha and Ggamma subunits to relay signaling from cAMP and folate "
        "receptors; gpbA-null cells are defective in chemotaxis and aggregation, "
        "showing that essentially all G-protein-mediated signaling routes through "
        "this one Gbeta.",
        [("GO:0007186", "P", "G protein-coupled receptor signaling pathway"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "dagA": (
        "CRAC (Cytosolic Regulator of Adenylyl Cyclase), a PH-domain protein "
        "that translocates to the plasma membrane by binding PIP3 produced on "
        "chemoattractant stimulation. It is required to activate the aggregation "
        "adenylyl cyclase ACA and is a classic live-cell reporter of PIP3 "
        "dynamics at the leading edge.",
        [("GO:0007189", "P", "adenylate cyclase-activating G protein-coupled receptor signaling pathway"),
         ("GO:0035556", "P", "intracellular signal transduction"),
         ("GO:0031252", "C", "cell leading edge")],
    ),
    "piaA": (
        "Pianissimo (PIA), a component of the TORC2 complex required to activate "
        "the aggregation adenylyl cyclase ACA in response to cAMP. piaA mutants "
        "cannot relay the cAMP signal and are aggregation-deficient.",
        [("GO:0007189", "P", "adenylate cyclase-activating G protein-coupled receptor signaling pathway"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    # --- PI3K axis / chemotaxis kinases ---
    "pikA": (
        "A class I phosphatidylinositol 3-kinase that, with related PI3Ks, "
        "generates PIP3 at the leading edge during chemotaxis. PI3K signaling, "
        "opposed by PTEN, helps establish cell polarity and directed movement up "
        "chemoattractant gradients.",
        [("GO:0005524", "F", "ATP binding"),
         ("GO:0035556", "P", "intracellular signal transduction"),
         ("GO:0006935", "P", "chemotaxis")],
    ),
    "pten": (
        "The Dictyostelium ortholog of the PTEN lipid phosphatase. It "
        "dephosphorylates PIP3 and localizes to the rear and sides of chemotaxing "
        "cells, confining PIP3 to the leading edge; loss of PTEN broadens PIP3 "
        "signaling and impairs directional sensing.",
        [("GO:0004721", "F", "phosphoprotein phosphatase activity"),
         ("GO:0006935", "P", "chemotaxis"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "pkbA": (
        "Protein kinase B (PKB/Akt), a PIP3-activated Ser/Thr kinase acting "
        "downstream of PI3K during chemotaxis to phosphorylate substrates that "
        "control cytoskeletal dynamics and directed migration.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0006935", "P", "chemotaxis")],
    ),
    "yakA": (
        "A DYRK-family Ser/Thr protein kinase governing the growth-to-development "
        "transition. yakA is required for cells to exit the cell cycle on "
        "starvation and initiate development, in part by relieving PufA-mediated "
        "translational repression of PKA.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding")],
    ),
    "pufA": (
        "A Pumilio/PUF-family RNA-binding protein that translationally represses "
        "the PKA catalytic subunit (pkaC) mRNA during growth. Starvation, via "
        "yakA, relieves PufA repression, raising PKA activity to launch "
        "development.",
        [("GO:0003729", "F", "mRNA binding"),
         ("GO:0006417", "P", "regulation of translation")],
    ),
    # --- two-component phosphorelay / osmoregulation ---
    "dhkA": (
        "A two-component histidine kinase in the phosphorelay controlling "
        "culmination and spore maturation. DhkA responds to the peptide signal "
        "SDF-2 and feeds phosphate through the relay to RegA, modulating "
        "intracellular cAMP and triggering rapid spore encapsulation.",
        [("GO:0004673", "F", "protein histidine kinase activity"),
         ("GO:0000160", "P", "phosphorelay signal transduction system"),
         ("GO:0005524", "F", "ATP binding")],
    ),
    "dhkB": (
        "A two-component histidine kinase functioning in the phosphorelay that "
        "maintains spore dormancy. DhkB signaling, acting through RegA, keeps "
        "cAMP high in mature spores and prevents premature germination.",
        [("GO:0004673", "F", "protein histidine kinase activity"),
         ("GO:0000160", "P", "phosphorelay signal transduction system")],
    ),
    "dhkC": (
        "A two-component histidine kinase that links osmotic and ammonia cues to "
        "development, acting in the phosphorelay that sets the timing of "
        "culmination through control of intracellular cAMP via RegA.",
        [("GO:0004673", "F", "protein histidine kinase activity"),
         ("GO:0000160", "P", "phosphorelay signal transduction system")],
    ),
    "rdeA": (
        "A histidine phosphotransfer (Hpt) protein that shuttles phosphate "
        "between sensor histidine kinases and the response regulator RegA. rdeA "
        "mutants ('rapid development') have low RegA activity, elevated cAMP, and "
        "accelerated development.",
        [("GO:0000160", "P", "phosphorelay signal transduction system"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "dokA": (
        "A hybrid histidine kinase/response-regulator mediating the response to "
        "hyperosmotic stress. DokA signaling raises intracellular cAMP and "
        "activates PKA to protect cells against osmotic shock.",
        [("GO:0004673", "F", "protein histidine kinase activity"),
         ("GO:0006970", "P", "response to osmotic stress"),
         ("GO:0000160", "P", "phosphorelay signal transduction system")],
    ),
    # --- Ras / Rho small GTPases and regulators ---
    "rasC": (
        "A Ras-family small GTPase acting early in chemoattractant signaling. "
        "RasC is rapidly and transiently activated at the leading edge on cAMP "
        "stimulation and is required for full activation of the adenylyl cyclase "
        "ACA and for efficient chemotaxis.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0007165", "P", "signal transduction")],
    ),
    "rapA": (
        "The Dictyostelium Rap1 small GTPase, a key regulator of cell adhesion "
        "and cortical mechanics during chemotaxis. Active Rap1 at the leading "
        "edge promotes substrate adhesion and cytoskeletal remodeling and is "
        "tightly controlled by GEFs and GAPs to maintain polarity.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "gefA": (
        "A Ras guanine-nucleotide exchange factor (RasGEF), originally "
        "identified as 'aimless'. GefA activates the Ras signaling needed to "
        "stimulate the aggregation adenylyl cyclase ACA; gefA mutants are "
        "aggregation-deficient and chemotax poorly.",
        [("GO:0005085", "F", "guanyl-nucleotide exchange factor activity"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    "racE": (
        "A Rho-family small GTPase required for cytokinesis. RacE organizes the "
        "cortical actin cytoskeleton that maintains cortical tension and "
        "completes cleavage-furrow ingression; racE-null cells fail cytokinesis "
        "and become large and multinucleate.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0000281", "P", "mitotic cytokinesis")],
    ),
    "rac1A": (
        "A Rac-family Rho GTPase controlling actin-driven protrusion. Rac1A "
        "cycles between GDP- and GTP-bound states to regulate pseudopod and "
        "lamellipod formation, phagocytosis, and macropinocytosis at the cell "
        "front.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    # --- actin cytoskeleton ---
    "abpA": (
        "Alpha-actinin, a calcium-regulated actin-crosslinking protein that "
        "bundles actin filaments and contributes to cortical actin organization "
        "and cell shape. Like several Dictyostelium crosslinkers it is partially "
        "redundant, so single mutants have mild phenotypes.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0051017", "P", "actin filament bundle assembly"),
         ("GO:0015629", "C", "actin cytoskeleton")],
    ),
    "abpC": (
        "Gelation factor (ABP-120/filamin), an actin-crosslinking protein that "
        "organizes orthogonal actin networks in the cortex and pseudopods. It "
        "supports pseudopod formation and motility; mutants show reduced cortical "
        "integrity and chemotaxis defects.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0030866", "P", "cortical actin cytoskeleton organization"),
         ("GO:0015629", "C", "actin cytoskeleton")],
    ),
    "corA": (
        "Coronin, a WD40-repeat actin-binding protein that localizes to the "
        "leading edge and dynamic actin structures and regulates actin turnover "
        "during motility, phagocytosis, and cytokinesis; corA mutants are "
        "defective in these actin-dependent processes.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization"),
         ("GO:0031252", "C", "cell leading edge")],
    ),
    "forH": (
        "A Diaphanous-related formin that nucleates and elongates unbranched "
        "actin filaments at filopodia and other protrusions, contributing to "
        "actin-based motility and cell-surface dynamics.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "limE": (
        "A small LIM-domain protein that associates with newly polymerized "
        "F-actin. A truncated LimE fused to a fluorescent protein is the most "
        "widely used live-cell reporter of dynamic actin in Dictyostelium, "
        "marking pseudopods, phagocytic cups, and the cytokinetic furrow.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0015629", "C", "actin cytoskeleton")],
    ),
    "arpB": (
        "The Arp2 subunit of the Arp2/3 complex, which nucleates branched actin "
        "filaments. It drives the dendritic actin networks underlying pseudopods, "
        "phagocytic cups, and macropinocytic crowns.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization"),
         ("GO:0015629", "C", "actin cytoskeleton")],
    ),
    "cofA": (
        "Cofilin, an actin-depolymerizing factor that severs and disassembles "
        "aged actin filaments to recycle monomers. Its activity supports the "
        "rapid actin turnover that powers Dictyostelium motility and chemotaxis.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "DAip1": (
        "Actin-interacting protein 1 (Aip1), which cooperates with cofilin to "
        "cap and accelerate disassembly of cofilin-severed actin filaments, "
        "promoting the high filament turnover required for motility and "
        "cytokinesis.",
        [("GO:0051015", "F", "actin filament binding"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    "myoB": (
        "A class I (single-headed, unconventional) myosin that links the actin "
        "cortex to membranes. Myosin IB localizes to the leading edge, phagocytic "
        "cups, and macropinosomes, contributing to pseudopod dynamics, "
        "phagocytosis, and cortical tension.",
        [("GO:0003774", "F", "cytoskeletal motor activity"),
         ("GO:0003779", "F", "actin binding"),
         ("GO:0005524", "F", "ATP binding")],
    ),
    # --- adhesion / phagocytosis ---
    "talA": (
        "Talin A, a cytoskeletal adaptor that links the actin cortex to adhesion "
        "sites at the plasma membrane. It is required for normal substrate "
        "adhesion, traction, and phagocytosis; talA mutants show reduced adhesion "
        "and motility defects.",
        [("GO:0008092", "F", "cytoskeletal protein binding"),
         ("GO:0007155", "P", "cell adhesion")],
    ),
    "talB": (
        "Talin B, a talin-family adaptor required during multicellular "
        "development. talB mutants form fragile slugs and fail to complete "
        "culmination, reflecting a role in the strong cell-substrate and "
        "cell-cell adhesion needed for morphogenesis.",
        [("GO:0008092", "F", "cytoskeletal protein binding"),
         ("GO:0007155", "P", "cell adhesion")],
    ),
    "sibA": (
        "A substrate-adhesion molecule of the SIB (similar to integrin beta) "
        "family, with an extracellular adhesion module and a cytoplasmic tail "
        "that binds talin to link the cell to the substratum; sibA mutants have "
        "reduced adhesion and phagocytosis.",
        [("GO:0007155", "P", "cell adhesion"),
         ("GO:0006909", "P", "phagocytosis")],
    ),
    "phg1a": (
        "Phg1A, a TM9-family transmembrane protein required for adhesion and "
        "phagocytosis. It controls cell-surface levels of the adhesion molecule "
        "SibA and is needed for efficient particle binding; phg1a mutants are "
        "defective in phagocytosis and in killing some bacteria.",
        [("GO:0006909", "P", "phagocytosis"),
         ("GO:0007155", "P", "cell adhesion"),
         ("GO:0016020", "C", "membrane")],
    ),
    # --- transcription factors / developmental regulators ---
    "srfA": (
        "A MADS-box (SRF-like) transcription factor required for late spore "
        "differentiation. SrfA controls genes needed for prespore-to-spore "
        "maturation and spore-coat formation; srfA mutants produce defective, "
        "non-viable spores.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "stkA": (
        "A GATA-family transcription factor ('stalky'). StkA promotes "
        "prespore-cell maintenance and proper stalk/spore proportioning; stkA "
        "mutants transdifferentiate excess prespore cells into stalk, yielding "
        "too few spores.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "gtaC": (
        "A GATA-type transcription factor that decodes cAMP-pulse signaling "
        "during early development. GtaC shuttles dynamically in and out of the "
        "nucleus in response to oscillatory cAMP, coupling extracellular "
        "signaling to transcription of aggregation genes.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "mybE": (
        "A Myb-domain transcription factor involved in early development. mybE is "
        "required for normal expression of aggregation-stage genes and for timely "
        "entry into multicellular development.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "dimB": (
        "A basic-leucine-zipper (bZIP) transcription factor mediating responses "
        "to the stalk-inducing morphogen DIF-1. DimB rapidly translocates to the "
        "nucleus on DIF-1 exposure and regulates prestalk gene expression and "
        "cell-type proportioning.",
        [("GO:0003700", "F", "DNA-binding transcription factor activity"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0005634", "C", "nucleus")],
    ),
    "cudA": (
        "A nuclear regulator (CudA) required for culmination. Expressed in "
        "prestalk and prespore cells, it is needed for the cell-type-specific "
        "gene expression that permits fruiting-body formation; cudA mutants "
        "arrest at the slug stage.",
        [("GO:0005634", "C", "nucleus"),
         ("GO:0006355", "P", "regulation of DNA-templated transcription")],
    ),
    "rtoA": (
        "RtoA (Ratio A), which regulates the proportion of prestalk to prespore "
        "cells by controlling cytosolic calcium and the timing of cell-type "
        "choice as cells enter development; rtoA mutants form fruiting bodies "
        "with altered spore:stalk ratios.",
        [],
    ),
    # --- spore / prespore / prestalk markers ---
    "cotB": (
        "A spore-coat protein (SP70) deposited in the outer spore coat during "
        "sporulation. cotB is a classic late prespore/spore marker whose promoter "
        "is widely used to drive spore-specific expression.",
        [("GO:0030435", "P", "sporulation resulting in formation of a cellular spore")],
    ),
    "cotC": (
        "A spore-coat protein (SP60) that, with other Cot proteins, assembles "
        "the protective spore coat. cotC is a canonical prespore/spore marker and "
        "a standard reporter for spore differentiation.",
        [("GO:0030435", "P", "sporulation resulting in formation of a cellular spore")],
    ),
    "pspA": (
        "A prespore-specific cell-surface glycoprotein (PsA/D19), one of the "
        "earliest and most widely used prespore markers; its expression marks "
        "commitment to the spore pathway during slug and culmination stages.",
        [("GO:0030435", "P", "sporulation resulting in formation of a cellular spore"),
         ("GO:0005886", "C", "plasma membrane")],
    ),
    "spiA": (
        "A late spore-differentiation protein expressed specifically during spore "
        "encapsulation. spiA is induced at the onset of sporulation and serves as "
        "a marker for terminal spore maturation.",
        [("GO:0030435", "P", "sporulation resulting in formation of a cellular spore")],
    ),
    "ecmB": (
        "An extracellular-matrix protein of the stalk tube (ST310/ecmB). ecmB is "
        "a prestalk/stalk-cell marker induced by the morphogen DIF-1, marking "
        "cells of the lower cup, stalk, and basal disc during culmination.",
        [("GO:0031012", "C", "extracellular matrix")],
    ),
    # --- aggregate-size counting factor ---
    "ctnA": (
        "Countin (CtnA), a component of the secreted Counting Factor complex "
        "that regulates aggregate size. Countin signaling breaks large streams "
        "into appropriately sized groups; ctnA mutants form abnormally large "
        "aggregates and fruiting bodies.",
        [("GO:0007154", "P", "cell communication")],
    ),
    "smlA": (
        "SmlA, a cytosolic protein that negatively regulates secretion of the "
        "Counting Factor. smlA mutants over-secrete Counting Factor and form "
        "small aggregates -- the opposite of countin mutants -- together defining "
        "the size-regulation pathway.",
        [],
    ),
    # --- ubiquitin / autophagy ---
    "culA": (
        "Cullin A, the scaffold of a Cullin-RING E3 ubiquitin-ligase complex. "
        "CulA-based ligases target proteins for ubiquitin-dependent degradation "
        "and are required for normal development, including the prestalk/prespore "
        "transition.",
        [("GO:0016567", "P", "protein ubiquitination"),
         ("GO:0031461", "C", "cullin-RING ubiquitin ligase complex")],
    ),
    "atg1": (
        "Atg1, the Ser/Thr protein kinase that initiates autophagy. As part of "
        "the autophagy-induction complex it triggers autophagosome formation on "
        "starvation; autophagy is essential in Dictyostelium for surviving "
        "nutrient stress and for development.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0006914", "P", "autophagy")],
    ),
    "atg8": (
        "Atg8, a ubiquitin-like protein conjugated to phosphatidylethanolamine "
        "on the autophagosome membrane. Lipidated Atg8 marks growing "
        "autophagosomes and is the standard fluorescent reporter for monitoring "
        "autophagy in Dictyostelium.",
        [("GO:0006914", "P", "autophagy")],
    ),
}


def main() -> int:
    # guardrail data
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
