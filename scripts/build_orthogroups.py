#!/usr/bin/env python3
"""Turn Tera Levin's OrthoFinder orthogroups (Holland*, Ahmed* et al. 2025) into a
per-gene lookup keyed by AX4 DDB_G id: assets/orthogroups.json

Source: data/orthofinder/Orthogroups.tsv — one row per orthogroup, one column per
genome. AX4 genes are keyed by DDB_G (e.g. "DDB0191444|DDB_G0286355"); every other
genome uses the submitters' gene IDs (DC_GS_00004190-RA ...), the same IDs our
relabel_paper_genomes.py surfaces on the gene models. This is curated orthology
(OrthoFinder), so it supersedes the site's tblastn best-hit heuristic.

Output:
    {
      "_meta": {"source", "n_groups", "species": [{"col","id","label","hosted"}...]},
      "genes": {
        "DDB_G0286355": {
          "og": "OG0008192",
          "ax4_paralogs": [],                 # other AX4 genes in the same group
          "orthologs": {"dd-ax2-214": ["DD_AX2_00002714"], "d-citrinum": [...], ...}
        }, ...
      }
    }

Standard library only. Run: python3 scripts/build_orthogroups.py
"""
import csv, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data", "orthofinder", "Orthogroups.tsv")
OUT = os.path.join(ROOT, "assets", "orthogroups.json")

# OrthoFinder column header -> (site genome id, display label, hosted on the site?)
# KGL29A and PJ11 are sequenced but still stuck in GenBank, so not hosted yet.
SPECIES = {
    "dicty_primary_protein": ("d-discoideum-ax4", "D. discoideum AX4", True),
    "Ax2_prot":              ("dd-ax2-214", "D. discoideum AX2-214", True),
    "CRII6C_prot":           ("dd-cr116c", "D. discoideum CR116C", True),
    "OT3A_prot":             ("dd-ot3a", "D. discoideum OT3A", True),
    "M4B_prot":              ("dd-m4b", "D. cf. discoideum M4B", True),
    "S6B_prot":              ("dd-s6b", "D. cf. discoideum S6B", True),
    "GS8b_prot":             ("d-citrinum", "D. citrinum GS8b", True),
    "Cf3b_prot":             ("dc-cf3b", "D. citrinum Cf3b", True),
    "KGL29A_prot":           ("dc-kgl29a", "D. citrinum KGL29A", True),
    "Ar5b_prot":             ("d-dimigraforme", "D. dimigraforme Ar5b", True),
    "PJ11_prot":             ("di-pj11", "D. intermedium PJ11", True),
    "tnsc14_firmibasis":     ("d-firmibasis", "D. firmibasis", True),
}
_DDBG = re.compile(r"DDB_G\d+")
_TX = re.compile(r"-R[A-Z0-9]+$")   # strip the transcript suffix -> gene id


def _gene_ids(cell):
    """Submitter gene ids from a cell (comma-separated, transcript suffix stripped)."""
    out, seen = [], set()
    for tok in cell.split(","):
        t = tok.strip()
        if not t:
            continue
        g = _TX.sub("", t)
        if g and g not in seen:
            seen.add(g)
            out.append(g)
    return out


def build():
    with open(SRC, newline="", encoding="utf-8") as fh:
        rows = list(csv.reader(fh, delimiter="\t"))
    hdr, data = rows[0], rows[1:]
    idx = {name: i for i, name in enumerate(hdr)}
    ax4_col = idx["dicty_primary_protein"]
    # genome columns in a stable display order (AX4 first)
    cols = [(name, ax4_col if name == "dicty_primary_protein" else idx[name])
            for name in SPECIES if name in idx]

    genes = {}
    for r in data:
        og = r[0]
        ax4_cell = r[ax4_col] if len(r) > ax4_col else ""
        ax4 = [m.group(0) for tok in ax4_cell.split(",") for m in [_DDBG.search(tok)] if m]
        if not ax4:
            continue  # groups with no AX4 member aren't reachable from a gene page
        # per-genome ortholog gene ids (skip the AX4 column itself)
        orthologs = {}
        for name, ci in cols:
            if name == "dicty_primary_protein":
                continue
            cell = r[ci] if len(r) > ci else ""
            ids = _gene_ids(cell)
            if ids:
                orthologs[SPECIES[name][0]] = ids
        for ddb in ax4:
            genes[ddb] = {"og": og,
                          "ax4_paralogs": [g for g in ax4 if g != ddb],
                          "orthologs": orthologs}

    species_meta = [{"col": name, "id": SPECIES[name][0], "label": SPECIES[name][1],
                     "hosted": SPECIES[name][2]} for name, _ in cols]
    payload = {"_meta": {"source": "OrthoFinder — Holland*, Ahmed* et al. 2025 (Ddis_to_Dint set)",
                         "n_groups": len(data), "n_genes": len(genes),
                         "species": species_meta},
               "genes": genes}
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, separators=(",", ":"), ensure_ascii=False)
    print(f"  wrote orthogroups.json: {len(genes)} AX4 genes across {len(data)} groups "
          f"({os.path.getsize(OUT)/1024:.0f} KB)")


if __name__ == "__main__":
    build()
