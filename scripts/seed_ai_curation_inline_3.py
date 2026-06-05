#!/usr/bin/env python3
"""Third hand-vetted, model-authored AI-curation batch (well-studied core, cont).

Same mechanism and guardrails as seed_ai_curation_inline.py / _2.py: authored
inline by Claude from training knowledge (no ANTHROPIC_API_KEY here), then every
gene symbol is checked against assets/gene_index.json and every GO id against
the real Dictyostelium GAF before writing. Merges into assets/ai_curation.json.

This batch rounds out the well-characterised core: cytokinesis RasGAPs,
membrane-actin linkers, the V-ATPase, presenilins, autophagy machinery, the
AprA/CfaD density-sensing axis, ammonium transporters, a mitotic cyclin,
phospholipases, recycling/secretory Rabs, annexin, and PakC.

Run:  python3 scripts/seed_ai_curation_inline_3.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ai_curation.json"
MODEL = "claude-opus-4-8"

# symbol -> (summary, [(GO id, aspect P|F|C, term name), ...])
BATCH = {
    # --- cytokinesis RasGAP / IQGAP complex ---
    "gapA": (
        "A Ras GTPase-activating protein (GAP) required for cytokinesis. GAPA "
        "helps recruit the cortexillins to the cleavage furrow; gapA mutants fail "
        "to divide and become large and multinucleate.",
        [("GO:0005096", "F", "GTPase activator activity"),
         ("GO:0000281", "P", "mitotic cytokinesis")],
    ),
    "rgaA": (
        "An IQGAP-related RasGAP-domain protein (DGAP1). With GAPA and the "
        "cortexillins it forms a cortical complex that controls cleavage-furrow "
        "formation and cell shape during cytokinesis.",
        [("GO:0005096", "F", "GTPase activator activity"),
         ("GO:0000281", "P", "mitotic cytokinesis"),
         ("GO:0030036", "P", "actin cytoskeleton organization")],
    ),
    # --- membrane-actin linkers ---
    "ponA": (
        "Ponticulin, an integral membrane glycoprotein that is a major link "
        "between the plasma membrane and the cortical actin network, nucleating "
        "and binding actin filaments at the membrane.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0016020", "C", "membrane")],
    ),
    "comA": (
        "Comitin, a membrane-associated, actin-binding protein found on Golgi and "
        "vesicle membranes that links them to the actin cytoskeleton and "
        "contributes to membrane trafficking and the response to stress.",
        [("GO:0003779", "F", "actin binding"),
         ("GO:0016020", "C", "membrane")],
    ),
    # --- vacuolar (V-type) H+-ATPase ---
    "vatA": (
        "The catalytic A subunit of the vacuolar (V-type) H+-ATPase. The V-ATPase "
        "pumps protons to acidify endosomes, lysosomes, and the contractile "
        "vacuole, driving osmoregulation and digestion of engulfed material.",
        [("GO:0046961", "F", "proton-transporting ATPase activity, rotational mechanism"),
         ("GO:1902600", "P", "proton transmembrane transport"),
         ("GO:0033180", "C", "proton-transporting V-type ATPase complex")],
    ),
    "vatB": (
        "The B subunit of the vacuolar (V-type) H+-ATPase, part of the catalytic "
        "V1 sector. The V-ATPase acidifies endo-lysosomal compartments and the "
        "contractile vacuole for osmoregulation and digestion.",
        [("GO:1902600", "P", "proton transmembrane transport"),
         ("GO:0033180", "C", "proton-transporting V-type ATPase complex")],
    ),
    "vatM": (
        "The 100-kDa membrane subunit (subunit a) of the vacuolar (V-type) "
        "H+-ATPase membrane sector. It anchors the proton-pumping V0 domain in "
        "the membrane of the contractile vacuole and endo-lysosomal system.",
        [("GO:1902600", "P", "proton transmembrane transport"),
         ("GO:0033180", "C", "proton-transporting V-type ATPase complex"),
         ("GO:0016020", "C", "membrane")],
    ),
    # --- presenilins (gamma-secretase) ---
    "psenA": (
        "A presenilin-family aspartyl protease, the catalytic core of "
        "gamma-secretase. Dictyostelium presenilins make it a model for "
        "presenilin function; they contribute to development, phagocytosis, and "
        "intramembrane proteolysis.",
        [("GO:0004190", "F", "aspartic-type endopeptidase activity"),
         ("GO:0016020", "C", "membrane")],
    ),
    "psenB": (
        "A presenilin-family aspartyl protease that, with PsenA, provides the "
        "catalytic activity of gamma-secretase. Presenilin function in this "
        "model organism affects cell-fate determination and phagocytosis.",
        [("GO:0004190", "F", "aspartic-type endopeptidase activity"),
         ("GO:0016020", "C", "membrane")],
    ),
    # --- autophagy machinery ---
    "atg5": (
        "Autophagy protein 5 (Atg5), part of the Atg12-Atg5/Atg16 conjugation "
        "system that drives autophagosome membrane expansion. Autophagy is "
        "required in Dictyostelium for surviving starvation and for development.",
        [("GO:0006914", "P", "autophagy")],
    ),
    "atg7": (
        "Autophagy protein 7 (Atg7), an E1-like activating enzyme for the two "
        "ubiquitin-like conjugation systems (Atg8 and Atg12) that build "
        "autophagosomes. atg7 mutants are autophagy-deficient and impaired in "
        "development.",
        [("GO:0006914", "P", "autophagy"),
         ("GO:0005524", "F", "ATP binding")],
    ),
    "atg9": (
        "Autophagy protein 9 (Atg9), the only multi-spanning transmembrane core "
        "autophagy protein. It delivers membrane to the forming autophagosome "
        "during the autophagic response to starvation.",
        [("GO:0006914", "P", "autophagy"),
         ("GO:0016020", "C", "membrane")],
    ),
    "tipD": (
        "Atg16 (the 'tipD' tipped-aggregate mutant). With the Atg12-Atg5 "
        "conjugate it forms the complex that specifies the site of "
        "autophagosome membrane expansion; tipD mutants are autophagy-defective "
        "and arrest with a tipped-aggregate phenotype.",
        [("GO:0006914", "P", "autophagy")],
    ),
    # --- AprA / CfaD density-sensing (secreted proliferation control) ---
    "aprA": (
        "AprA (Autocrine Proliferation Repressor A), a secreted protein that "
        "accumulates with cell density and slows proliferation, so cells divide "
        "more slowly as the population grows. It acts together with CfaD and "
        "signals through a G-protein/GPCR pathway.",
        [("GO:0008285", "P", "negative regulation of cell population proliferation"),
         ("GO:0007154", "P", "cell communication")],
    ),
    "cfaD": (
        "CfaD, a secreted cathepsin-like protein required for the activity of the "
        "chalone AprA. Together AprA and CfaD form an autocrine signal that "
        "represses proliferation as cell density rises.",
        [("GO:0008285", "P", "negative regulation of cell population proliferation"),
         ("GO:0007154", "P", "cell communication")],
    ),
    "cfaA": (
        "A counting-factor-associated protein, part of the secreted Counting "
        "Factor complex (with countin) that regulates aggregate size by breaking "
        "large cell streams into appropriately sized groups.",
        [("GO:0007154", "P", "cell communication")],
    ),
    # --- ammonium transporters (ammonia signaling in development) ---
    "amtA": (
        "An ammonium transporter. Ammonia produced by the cells is a "
        "developmental signal, and Amt transporters modulate its distribution to "
        "influence slug phototaxis and the timing of culmination.",
        [("GO:0008519", "F", "ammonium transmembrane transporter activity"),
         ("GO:0072488", "P", "ammonium transmembrane transport"),
         ("GO:0016020", "C", "membrane")],
    ),
    "amtB": (
        "An ammonium transporter contributing to the ammonia signaling that "
        "regulates the slug-migration-versus-culmination decision during "
        "multicellular development.",
        [("GO:0008519", "F", "ammonium transmembrane transporter activity"),
         ("GO:0072488", "P", "ammonium transmembrane transport"),
         ("GO:0016020", "C", "membrane")],
    ),
    "amtC": (
        "An ammonium transporter implicated in slug phototaxis and thermotaxis "
        "and in the control of culmination, through its effect on intracellular "
        "ammonium and the ammonia developmental signal.",
        [("GO:0008519", "F", "ammonium transmembrane transporter activity"),
         ("GO:0072488", "P", "ammonium transmembrane transport"),
         ("GO:0016020", "C", "membrane")],
    ),
    # --- cell cycle ---
    "cycB": (
        "Cyclin B, the mitotic cyclin that activates the cyclin-dependent kinase "
        "to drive entry into mitosis. Its periodic accumulation and destruction "
        "help time cell division.",
        [("GO:0051301", "P", "cell division"),
         ("GO:0051726", "P", "regulation of cell cycle"),
         ("GO:0005634", "C", "nucleus")],
    ),
    # --- phospholipases ---
    "pldB": (
        "A phospholipase D that hydrolyzes membrane phospholipids to generate "
        "phosphatidic acid, a lipid second messenger; PLD signaling influences "
        "membrane trafficking and the cytoskeleton.",
        [("GO:0004630", "F", "phospholipase D activity"),
         ("GO:0016042", "P", "lipid catabolic process")],
    ),
    "plaA": (
        "A patatin-family phospholipase A that releases fatty acids from "
        "membrane phospholipids, contributing to lipid signaling and membrane "
        "remodeling.",
        [("GO:0004620", "F", "phospholipase activity"),
         ("GO:0016042", "P", "lipid catabolic process")],
    ),
    # --- PAK kinase ---
    "pakC": (
        "A p21-activated kinase (PAK) acting downstream of Rac GTPases to "
        "regulate the actin and myosin cytoskeleton during motility and "
        "chemotaxis.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0035556", "P", "intracellular signal transduction")],
    ),
    # --- adhesion/phagocytosis kinase ---
    "phg2": (
        "Phg2, a ROCO-family Ser/Thr protein kinase required for cell-substrate "
        "adhesion and phagocytosis. It regulates actin distribution at the cell "
        "cortex and the contact site with particles.",
        [("GO:0004674", "F", "protein serine/threonine kinase activity"),
         ("GO:0005524", "F", "ATP binding"),
         ("GO:0006909", "P", "phagocytosis")],
    ),
    # --- trafficking Rabs ---
    "rab8A": (
        "A Rab8 small GTPase that regulates exocytic and post-Golgi vesicle "
        "traffic to the plasma membrane and the contractile vacuole, supporting "
        "secretion and membrane delivery.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0016192", "P", "vesicle-mediated transport")],
    ),
    "rab11A": (
        "A Rab11 small GTPase that controls recycling-endosome traffic and "
        "delivery of membrane to the cell surface, the phagosome, and the "
        "contractile vacuole.",
        [("GO:0005525", "F", "GTP binding"),
         ("GO:0003924", "F", "GTPase activity"),
         ("GO:0016192", "P", "vesicle-mediated transport")],
    ),
    # --- annexin ---
    "nxnA": (
        "Annexin VII (synexin), a calcium- and phospholipid-binding protein "
        "associated with membranes. It binds membranes in a calcium-dependent way "
        "and is implicated in membrane organization and calcium homeostasis.",
        [("GO:0005544", "F", "calcium-dependent phospholipid binding"),
         ("GO:0005509", "F", "calcium ion binding")],
    ),
    # --- cell-fate (beta-catenin homolog) ---
    "aarA": (
        "Aardvark, a beta-catenin/armadillo-family protein. It functions in the "
        "GSK-3 pathway controlling the stalk-versus-spore cell-fate decision and "
        "also contributes to cell-cell junctions in the tip epithelium.",
        [("GO:0006355", "P", "regulation of DNA-templated transcription"),
         ("GO:0007155", "P", "cell adhesion")],
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
