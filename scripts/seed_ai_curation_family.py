#!/usr/bin/env python3
"""Family-level AI-curation pass over the remaining *named* genes.

The 141 hand-authored entries (seed_ai_curation_inline*.py) cover the
well-studied core. This pass covers the long tail of genes that have a real
functional/domain DESCRIPTION but no gene-specific literature -- e.g. one of 24
"ABC transporter G family protein"s. For those, a per-FAMILY template grounded
in the gene's own description is more accurate and consistent than free-writing
a sentence per gene, and -- being deterministic -- it cannot hallucinate. It
also lets us encode nuance a generic pass would get wrong (e.g. ABCA/B/C/D/G are
membrane transporters but ABCE/ABCF are soluble, non-transport ATPases).

Each gene's description is matched against an ordered rule table; the first
match supplies a family blurb + family-conserved GO terms. Genes with a
description but no matching rule get a grounded, clearly-hedged fallback summary
and no GO terms. Genes with an EMPTY description are SKIPPED -- there is no basis
to predict anything, and inventing one would be fabrication.

Guardrails (same as the inline seeds): every GO id is checked against the real
Dictyostelium GAF before writing. Entries are tagged with a "basis" field
("family" or "annotation") so they stay distinguishable from the hand-authored
core. Merges into assets/ai_curation.json; never overwrites genes already
present. Run:  python3 scripts/seed_ai_curation_family.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "ai_curation.json"

# GO id -> standard term name (every id pre-checked against the Dicty GAF)
N = {
    "GO:0005525": "GTP binding", "GO:0003924": "GTPase activity",
    "GO:0016192": "vesicle-mediated transport", "GO:0007165": "signal transduction",
    "GO:0035556": "intracellular signal transduction",
    "GO:0005096": "GTPase activator activity",
    "GO:0005085": "guanyl-nucleotide exchange factor activity",
    "GO:0004930": "G protein-coupled receptor activity",
    "GO:0007186": "G protein-coupled receptor signaling pathway",
    "GO:0005886": "plasma membrane", "GO:0016020": "membrane",
    "GO:0004674": "protein serine/threonine kinase activity",
    "GO:0016301": "kinase activity", "GO:0005524": "ATP binding",
    "GO:0006468": "protein phosphorylation",
    "GO:0004673": "protein histidine kinase activity",
    "GO:0000160": "phosphorelay signal transduction system",
    "GO:0004497": "monooxygenase activity", "GO:0020037": "heme binding",
    "GO:0005506": "iron ion binding", "GO:0016491": "oxidoreductase activity",
    "GO:0003677": "DNA binding",
    "GO:0006355": "regulation of DNA-templated transcription",
    "GO:0005634": "nucleus", "GO:0004386": "helicase activity",
    "GO:0003723": "RNA binding", "GO:0003676": "nucleic acid binding",
    "GO:0008270": "zinc ion binding", "GO:0016887": "ATP hydrolysis activity",
    "GO:0030248": "cellulose binding", "GO:0055085": "transmembrane transport",
    "GO:0022857": "transmembrane transporter activity",
    "GO:0005743": "mitochondrial inner membrane",
    "GO:0016758": "hexosyltransferase activity", "GO:0005509": "calcium ion binding",
    "GO:0003779": "actin binding", "GO:0005515": "protein binding",
    "GO:0016740": "transferase activity", "GO:0006811": "ion transport",
    "GO:0004112": "cyclic-nucleotide phosphodiesterase activity",
    "GO:0004016": "adenylate cyclase activity", "GO:0006171": "cAMP biosynthetic process",
    "GO:0005543": "phospholipid binding", "GO:0004784": "superoxide dismutase activity",
    "GO:0005254": "chloride channel activity", "GO:0008168": "methyltransferase activity",
    "GO:0032259": "methylation", "GO:0003899": "DNA-directed RNA polymerase activity",
    "GO:0003678": "DNA helicase activity", "GO:0006260": "DNA replication",
    "GO:0046872": "metal ion binding", "GO:0004620": "phospholipase activity",
    "GO:0006351": "DNA-templated transcription", "GO:0005216": "ion channel activity",
    "GO:0003774": "cytoskeletal motor activity", "GO:0016459": "myosin complex",
    "GO:0003777": "microtubule motor activity", "GO:0007018": "microtubule-based movement",
    "GO:0005874": "microtubule", "GO:0005200": "structural constituent of cytoskeleton",
    "GO:0004842": "ubiquitin-protein transferase activity",
    "GO:0016567": "protein ubiquitination",
    "GO:0031461": "cullin-RING ubiquitin ligase complex",
}


def go(*ids):
    # ids like ("GO:0005525","F") -> [GO id, aspect, name]
    return [[gid, asp, N[gid]] for gid, asp in ids]


# Ordered rules. Each: (match-spec, summary, go-terms).
# match-spec: {"all":[...]} every substring present, {"any":[...]} any present,
# optional "not":[...] none present. Tested against the lowercased description.
# FIRST match wins -- specific families before generic ones.
RULES = [
    ({"all": ["abc transporter"], "any": [" a family", " b family", " c family",
        " d family", " g family"]},
     "An ATP-binding cassette (ABC) transporter. ABC transporters couple ATP "
     "hydrolysis to the movement of substrates across membranes.",
     go(("GO:0005524", "F"), ("GO:0055085", "P"), ("GO:0016020", "C"))),
    ({"any": ["abc transporter-related", "abc transporter f", "rnasel inhibitor"]},
     "An ABC-ATPase-domain protein of the ABCE/ABCF type. Unlike membrane ABC "
     "transporters, these are soluble proteins whose ATPase cassettes act in "
     "processes such as translation rather than membrane transport.",
     go(("GO:0005524", "F"))),
    ({"all": ["rab gtpase"]},
     "A Rab-family small GTPase. Rab GTPases cycle between GDP- and GTP-bound "
     "states to direct the budding, transport, docking, and fusion of "
     "intracellular vesicles.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"), ("GO:0016192", "P"))),
    ({"any": ["adp-ribosylation factor", "arf gtpase", "sar1"]},
     "An ADP-ribosylation factor (Arf/Sar)-family small GTPase that regulates "
     "membrane traffic and vesicle-coat assembly in the secretory pathway.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"), ("GO:0016192", "P"))),
    ({"any": ["rhogap", "rho gtpase-activating", "rho gtpase activating"]},
     "A RhoGAP-domain protein. RhoGAPs stimulate the intrinsic GTP hydrolysis of "
     "Rho-family GTPases, switching their signaling off.",
     go(("GO:0005096", "F"))),
    ({"any": ["rasgtpase-activating", "ras gtpase-activating", "rasgap"]},
     "A Ras GTPase-activating protein (RasGAP) that accelerates GTP hydrolysis "
     "by Ras-family GTPases to terminate their signaling.",
     go(("GO:0005096", "F"))),
    ({"all": ["rho gtpase"]},
     "A Rho-family small GTPase. Rho GTPases act as molecular switches that "
     "regulate the actin cytoskeleton and associated signaling.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"), ("GO:0035556", "P"))),
    ({"all": ["ras gtpase"]},
     "A Ras-family small GTPase. Ras proteins are GTP/GDP-regulated molecular "
     "switches that transduce signals controlling growth, motility, and "
     "development.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"), ("GO:0007165", "P"))),
    ({"any": ["ras guanine nucleotide exchange", "rasgef", "guanine nucleotide exchange"]},
     "A guanine-nucleotide exchange factor (GEF) that activates a small GTPase "
     "by promoting GDP-to-GTP exchange.",
     go(("GO:0005085", "F"), ("GO:0035556", "P"))),
    ({"any": ["g-protein subunit alpha", "g protein subunit alpha",
        "g-protein alpha", "guanine nucleotide-binding protein alpha"]},
     "A heterotrimeric G-protein alpha subunit that binds and hydrolyzes GTP to "
     "relay signals from G-protein-coupled receptors to intracellular effectors.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"), ("GO:0007186", "P"))),
    ({"all": ["small gtpase"]},
     "A small GTPase of the Ras superfamily, acting as a GTP/GDP-regulated "
     "molecular switch in intracellular signaling or membrane trafficking.",
     go(("GO:0005525", "F"), ("GO:0003924", "F"))),
    ({"any": ["g-protein-coupled receptor", "gpcr"]},
     "A G-protein-coupled (seven-transmembrane) receptor that transduces "
     "extracellular signals to intracellular heterotrimeric G proteins.",
     go(("GO:0004930", "F"), ("GO:0007186", "P"), ("GO:0005886", "C"))),
    ({"all": ["histidine kinase"]},
     "A two-component sensor histidine kinase that autophosphorylates and "
     "transfers phosphate through a phosphorelay to regulate responses such as "
     "development and stress adaptation.",
     go(("GO:0004673", "F"), ("GO:0000160", "P"), ("GO:0005524", "F"))),
    ({"all": ["serine/threonine"], "any": ["kinase"]},
     "A protein serine/threonine kinase that phosphorylates substrate proteins "
     "on serine and threonine residues to regulate cellular signaling.",
     go(("GO:0004674", "F"), ("GO:0005524", "F"), ("GO:0006468", "P"))),
    ({"any": ["tyrosine kinase"]},
     "A protein-tyrosine kinase that phosphorylates substrate proteins on "
     "tyrosine residues as part of signal transduction.",
     go(("GO:0016301", "F"), ("GO:0005524", "F"), ("GO:0006468", "P"))),
    ({"any": ["protein kinase"]},
     "A protein kinase that transfers phosphate from ATP to substrate proteins, "
     "a core mechanism of signal regulation.",
     go(("GO:0016301", "F"), ("GO:0005524", "F"), ("GO:0006468", "P"))),
    ({"any": ["cytochrome p450"]},
     "A cytochrome P450, a heme-thiolate monooxygenase that oxidizes lipophilic "
     "substrates in biosynthetic and detoxification reactions.",
     go(("GO:0004497", "F"), ("GO:0020037", "F"), ("GO:0005506", "F"))),
    ({"any": ["mitochondrial substrate carrier", "mitochondrial carrier"]},
     "A mitochondrial carrier-family protein that transports metabolites and "
     "cofactors across the inner mitochondrial membrane.",
     go(("GO:0055085", "P"), ("GO:0005743", "C"))),
    ({"any": ["dead/deah", "deah box", "dead box", "helicase"]},
     "An ATP-dependent helicase that uses ATP hydrolysis to unwind or remodel "
     "nucleic acids.",
     go(("GO:0004386", "F"), ("GO:0005524", "F"), ("GO:0003676", "F"))),
    ({"any": ["rna-binding", "rna binding", "rrm", "rnp-1", "rna recognition"]},
     "An RNA-binding protein, predicted from its RNA-recognition domain to bind "
     "RNA and function in RNA metabolism.",
     go(("GO:0003723", "F"))),
    ({"any": ["myb domain", "myb transcription", "myb-like"]},
     "A Myb-domain protein, predicted to bind DNA and regulate transcription.",
     go(("GO:0003677", "F"), ("GO:0006355", "P"), ("GO:0005634", "C"))),
    ({"any": ["gata", "bzip", "basic leucine zipper", "transcription factor",
        "homeobox", "forkhead", "winged helix"]},
     "A predicted sequence-specific DNA-binding transcription factor that "
     "regulates gene expression.",
     go(("GO:0003677", "F"), ("GO:0006355", "P"), ("GO:0005634", "C"))),
    ({"any": ["adenylyl cyclase", "adenylate cyclase"]},
     "A predicted adenylyl cyclase that synthesizes the second messenger cAMP "
     "from ATP.",
     go(("GO:0004016", "F"), ("GO:0006171", "P"))),
    ({"any": ["phosphodiesterase"]},
     "A predicted cyclic-nucleotide phosphodiesterase that hydrolyzes cyclic "
     "nucleotides such as cAMP or cGMP.",
     go(("GO:0004112", "F"))),
    ({"any": ["ring zinc finger", "ring-type", "ring finger"]},
     "A RING-type zinc-finger protein. RING domains bind zinc and commonly "
     "function within ubiquitin-ligase complexes.",
     go(("GO:0008270", "F"))),
    ({"any": ["lim-type zinc finger", "lim domain"]},
     "A LIM-domain zinc-finger protein; LIM domains are zinc-binding modules "
     "that mediate protein-protein interactions.",
     go(("GO:0008270", "F"))),
    ({"any": ["zinc finger", "zinc-finger"]},
     "A zinc-finger protein; zinc-finger domains bind zinc and commonly mediate "
     "nucleic-acid or protein interactions.",
     go(("GO:0008270", "F"))),
    ({"any": ["aaa atpase", "aaa+ atpase", "aaa-atpase", "aaa family atpase"]},
     "A AAA+ ATPase that couples ATP binding and hydrolysis to mechanical action "
     "on its substrates.",
     go(("GO:0005524", "F"), ("GO:0016887", "F"))),
    ({"any": ["cellulose-binding", "cellulose binding"]},
     "A protein with a cellulose-binding domain. Cellulose is a major component "
     "of the Dictyostelium stalk tube and spore coat.",
     go(("GO:0030248", "F"))),
    ({"any": ["calcium-binding", "ef-hand", "ef hand"]},
     "A calcium-binding protein, predicted (e.g. via EF-hand motifs) to bind "
     "calcium ions and act in calcium signaling or buffering.",
     go(("GO:0005509", "F"))),
    ({"any": ["actin binding", "actin-binding", "actin bundling"]},
     "An actin-associated protein predicted to bind the actin cytoskeleton.",
     go(("GO:0003779", "F"))),
    ({"any": ["glcnac transferase", "glycosyltransferase", "glucosyltransferase",
        "galactosyltransferase", "mannosyltransferase"]},
     "A glycosyltransferase predicted to transfer sugar residues onto acceptor "
     "molecules.",
     go(("GO:0016758", "F"))),
    ({"any": ["wd40 repeat", "wd-40 repeat", "wd repeat"]},
     "A WD40-repeat protein. WD40 repeats fold into a beta-propeller scaffold "
     "that mediates protein-protein interactions.",
     go(("GO:0005515", "F"))),
    ({"any": ["ankyrin repeat"]},
     "An ankyrin-repeat protein; stacked ankyrin repeats mediate "
     "protein-protein interactions.",
     go(("GO:0005515", "F"))),
    ({"any": ["leucine-rich repeat", "leucine rich repeat"]},
     "A leucine-rich-repeat protein; LRR domains form a curved scaffold for "
     "protein-protein interactions.",
     go(("GO:0005515", "F"))),
    ({"any": ["tetratricopeptide", "tpr repeat", "tpr domain"]},
     "A tetratricopeptide-repeat (TPR) protein; TPR motifs mediate "
     "protein-protein interactions and complex assembly.",
     go(("GO:0005515", "F"))),
    ({"any": ["heat shock protein", "hsp20", "hsp70", "hsp90", "chaperone"]},
     "A predicted molecular chaperone / heat-shock protein that assists protein "
     "folding and the response to stress.",
     go(("GO:0005515", "F"))),
    ({"any": ["rhogef", "rho guanine nucleotide exchange", "dock family",
        "dbl homology"]},
     "A Rho guanine-nucleotide exchange factor (RhoGEF/DOCK) that activates "
     "Rho-family GTPases by promoting GDP-to-GTP exchange.",
     go(("GO:0005085", "F"), ("GO:0035556", "P"))),
    ({"any": ["superoxide dismutase"]},
     "A superoxide dismutase that detoxifies superoxide radicals, part of the "
     "cellular defense against oxidative stress.",
     go(("GO:0004784", "F"), ("GO:0046872", "F"))),
    ({"any": ["methyltransferase"]},
     "A predicted methyltransferase that transfers methyl groups from "
     "S-adenosylmethionine to its substrate.",
     go(("GO:0008168", "F"), ("GO:0032259", "P"))),
    ({"any": ["phospholipase"]},
     "A predicted phospholipase that hydrolyzes membrane phospholipids, "
     "contributing to lipid signaling and membrane remodeling.",
     go(("GO:0004620", "F"))),
    ({"any": ["phospholipid-binding", "phospholipid binding"]},
     "A predicted phospholipid-binding protein that associates with membranes "
     "through its lipid-binding module.",
     go(("GO:0005543", "F"))),
    ({"any": ["chloride channel", "ion channel", "cation channel",
        "potassium channel", "calcium channel"]},
     "A predicted ion channel that conducts ions across a membrane.",
     go(("GO:0005216", "F"), ("GO:0006811", "P"), ("GO:0016020", "C"))),
    ({"any": ["dna-directed rna polymerase", "rna polymerase ii",
        "rna polymerase iii", "rna polymerase i"]},
     "A DNA-directed RNA polymerase subunit, part of the machinery that "
     "transcribes DNA into RNA.",
     go(("GO:0003899", "F"), ("GO:0006351", "P"), ("GO:0005634", "C"))),
    ({"any": ["mcm family", "minichromosome maintenance"]},
     "A minichromosome-maintenance (MCM) protein, part of the replicative "
     "helicase that unwinds DNA at replication origins.",
     go(("GO:0003678", "F"), ("GO:0005524", "F"), ("GO:0006260", "P"))),
    ({"any": ["argonaut", "piwi", "argonaute"]},
     "An Argonaute/PIWI-family protein that binds small RNAs to direct "
     "RNA-silencing of complementary transcripts.",
     go(("GO:0003723", "F"))),
    ({"any": ["oxidase", "reductase", "dehydrogenase", "oxidoreductase",
        "peroxidase", "monooxygenase", "dioxygenase"]},
     "A predicted oxidoreductase that catalyzes electron-transfer (redox) "
     "reactions.",
     go(("GO:0016491", "F"))),
    ({"any": ["glycosyltransferase", "glycotransferase", "oligosaccharyltransferase",
        "glucosyltransferase", "fucosyltransferase", "xylosyltransferase"]},
     "A glycosyltransferase predicted to transfer sugar residues onto acceptor "
     "molecules.",
     go(("GO:0016758", "F"))),
    ({"any": ["sh2 domain", "sh3 domain", "sam domain", "egf-like",
        "egf domain", "von willebrand factor", "pa14 domain", "ipt/tig",
        "armadillo", "pdz domain", "pleckstrin", "ph domain",
        "e-set domain", "fnip repeat", "kelch"]},
     "A protein bearing a recognized protein-interaction domain, predicted to "
     "mediate protein-protein interactions within a larger complex or pathway.",
     go(("GO:0005515", "F"))),
    ({"any": ["myosin"]},
     "A myosin, an actin-based motor protein that uses ATP hydrolysis to move "
     "along or exert force on actin filaments.",
     go(("GO:0003774", "F"), ("GO:0003779", "F"), ("GO:0005524", "F"))),
    ({"any": ["kinesin", "dynein"]},
     "A microtubule-based motor protein that uses ATP hydrolysis to move along "
     "microtubules, driving intracellular transport and mitosis.",
     go(("GO:0003777", "F"), ("GO:0005524", "F"), ("GO:0007018", "P"))),
    ({"any": ["alpha tubulin", "beta tubulin", "gamma tubulin", "tubulin"]},
     "A tubulin subunit that polymerizes into microtubules, the cytoskeletal "
     "filaments that build the spindle and tracks for intracellular transport.",
     go(("GO:0005200", "F"), ("GO:0005874", "C"), ("GO:0005525", "F"))),
    ({"any": ["cullin"]},
     "A cullin, the scaffold subunit of a Cullin-RING E3 ubiquitin-ligase "
     "complex that targets substrate proteins for ubiquitin-dependent "
     "degradation.",
     go(("GO:0016567", "P"), ("GO:0031461", "C"))),
    ({"any": ["ubiquitin-conjugating", "ubiquitin conjugating",
        "ubiquitin-protein ligase", "e3 ubiquitin", "ubiquitin ligase",
        "hect", "u-box"]},
     "A component of the ubiquitin-conjugation machinery, predicted to transfer "
     "ubiquitin onto substrate proteins to mark them for degradation or "
     "regulation.",
     go(("GO:0004842", "F"), ("GO:0016567", "P"))),
    ({"any": ["transmembrane protein", "membrane protein"]},
     "A predicted membrane protein of currently uncharacterized function.",
     go(("GO:0016020", "C"))),
]


def matches(desc, spec):
    if "all" in spec and not all(s in desc for s in spec["all"]):
        return False
    if "any" in spec and not any(s in desc for s in spec["any"]):
        return False
    if "not" in spec and any(s in desc for s in spec["not"]):
        return False
    return True


def curate(desc):
    """Return (summary, go_terms, basis) for a non-empty description."""
    low = desc.lower()
    for spec, summary, terms in RULES:
        if matches(low, spec):
            return summary, terms, "family"
    # grounded fallback -- restate the annotation, clearly hedged, no GO guesses
    s = desc.strip()
    s = s[0].upper() + s[1:] if s else s
    return (f"{s}. This gene is annotated from sequence and domain features and "
            "has not been experimentally characterized in Dictyostelium.",
            [], "annotation")


def main() -> int:
    index = json.loads((ROOT / "assets" / "gene_index.json").read_text())
    go_ann = json.loads((ROOT / "assets" / "go_annotations.json").read_text())
    real_go = {r[0] for v in go_ann.values() for r in v}

    data = json.loads(OUT.read_text()) if OUT.exists() else {}
    # Only the hand-authored core is off-limits (no "basis" field). Prior
    # family/annotation entries are regenerated, so this script is idempotent
    # and rule edits take effect on re-run.
    core = {k for k in data
            if not k.startswith("_") and "basis" not in data[k]}

    # remaining NAMED genes (real symbol, not hypothetical, not in the core)
    remaining = [(r[1], r[2]) for r in index
                 if r[1] and not r[1].startswith("DDB")
                 and "hypothetical" not in r[2].lower()
                 and r[1].lower() not in core]

    # validate every GO id a rule could emit, up front
    bad = sorted({gid for _, _, terms in RULES for gid, _, _ in terms} - real_go)
    if bad:
        print("VALIDATION FAILED: GO ids not in Dicty GAF:", bad, file=sys.stderr)
        return 1

    added = skipped_empty = fam = anno = gorows = 0
    for sym, desc in remaining:
        if not desc.strip():
            skipped_empty += 1
            continue
        summary, terms, basis = curate(desc)
        data[sym.lower()] = {
            "summary": summary,
            "go": [list(t) for t in terms],
            "basis": basis,
        }
        added += 1
        gorows += len(terms)
        fam += basis == "family"
        anno += basis == "annotation"

    data["_meta"] = {
        "layer": "AI curation",
        "model": "claude-opus-4-8",
        "disclaimer": "Machine-generated. Suggestions only -- unreviewed, may be "
        "incomplete or wrong. Verify against curated evidence. Entries with "
        "basis='family'/'annotation' are domain/family-level predictions, weaker "
        "than the hand-authored core (no basis field).",
        "schema": "lowercase symbol -> { summary, go: [[GO id, P|F|C, name], ...], "
        "basis? }",
    }
    OUT.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    total = len([k for k in data if not k.startswith("_")])
    print(f"family pass: +{added} genes ({fam} family-matched, {anno} fallback), "
          f"{gorows} GO rows; skipped {skipped_empty} empty-description genes; "
          f"{total} genes total", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
