#!/usr/bin/env python3
"""Rebuild the site's derived data in dependency order, then self-check.

The 2026 accuracy audit found bugs caused by rebuilding one source file (e.g.
ortholog_disease.json) without rebuilding the files derived from it (e.g.
gene_facets.json), which then drifted silently. This orchestrator removes that
whole class of bug: it runs the builders in the right order and finishes by
running scripts/check_data.py, which fails loudly if anything is still out of
sync.

Steps are grouped so you only run what you mean to:
  derive  — pure recompute from committed assets. Safe, deterministic, default.
  genome  — needs assets/genomes/*.gff (gitignored). Included with --with-genome.
  fetch   — hits the network (NCBI, KEGG, UniProt, ...). Included with --fetch.

Usage:
  python3 scripts/build_all.py                 # derive steps + self-check
  python3 scripts/build_all.py --with-genome   # also gene_loci / gene_models
  python3 scripts/build_all.py --fetch         # also the network refreshers
  python3 scripts/build_all.py --dry-run       # print the plan, run nothing

Order matters: sources first, then everything derived from them, then
check_data. Add a step next to the file it produces so the order stays honest.
Standard library only.
"""
import argparse
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
PY = sys.executable or "python3"

# (label, argv, category, required_inputs) — required_inputs are asset filenames
# that must exist for the step to run; a step whose inputs are missing is skipped
# with a note rather than failing the whole run.
STEPS = [
    # --- sources (network) ---
    ("gene catalog (gene_index, phenotypes, GO, corpus)", ["build_data.py"], "fetch", []),
    ("human orthologs & disease", ["build_ortholog_disease.py"], "fetch", []),
    ("KEGG pathways", ["build_kegg_pathways.py"], "fetch", []),
    ("UniProt cross-references", ["build_uniprot_map.py"], "fetch", []),
    ("InterPro/Pfam domains", ["build_domains.py"], "fetch", []),
    # --- derived from the sources above (local recompute) ---
    ("merge curation -> gene_annotations", ["merge_curation.py"], "derive", ["go_annotations.json"]),
    ("orthogroups", ["build_orthogroups.py"], "derive", ["gene_index.json"]),
    ("featured-gene locations (app.js)", ["sync_featured_loci.py"], "derive", ["gene_index.json"]),
    ("advanced-finder facets", ["build_gene_facets.py"], "derive",
     ["gene_index.json", "phenotypes.json", "ortholog_disease.json", "rnaseq_rosengarten.json"]),
    ("news feed", ["build_news.py"], "derive", ["news_manual.json"]),
    ("changelog", ["build_changelog.py"], "derive", []),
    # --- genome-file dependent (assets/genomes/*.gff, gitignored) ---
    ("gene loci", ["build_gene_loci.py"], "genome", []),
    ("gene models", ["build_gene_models.py"], "genome", []),
]


def have(inputs):
    return all(os.path.exists(os.path.join(ASSETS, f)) for f in inputs)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--fetch", action="store_true", help="include network refresh steps")
    ap.add_argument("--with-genome", action="store_true", help="include genome-GFF steps")
    ap.add_argument("--dry-run", action="store_true", help="print the plan, run nothing")
    ap.add_argument("--no-check", action="store_true", help="skip the final self-check")
    args = ap.parse_args()

    active = {"derive"}
    if args.fetch:
        active.add("fetch")
    if args.with_genome:
        active.add("genome")

    genomes_present = os.path.isdir(os.path.join(ASSETS, "genomes"))
    ran, skipped, failed = [], [], []

    print("=== build_all: rebuilding derived data ===")
    for label, argv, cat, inputs in STEPS:
        script = os.path.join("scripts", argv[0])
        why = None
        if cat not in active:
            why = f"category '{cat}' not selected"
        elif cat == "genome" and not genomes_present:
            why = "assets/genomes/ absent"
        elif not have(inputs):
            missing = [f for f in inputs if not os.path.exists(os.path.join(ASSETS, f))]
            why = f"missing input(s): {', '.join(missing)}"
        if why:
            skipped.append((label, why))
            print(f"  SKIP  {label}  ({why})")
            continue
        if args.dry_run:
            print(f"  PLAN  {label}  ->  {PY} {script} {' '.join(argv[1:])}")
            ran.append(label)
            continue
        print(f"  RUN   {label}  ->  {argv[0]}")
        r = subprocess.run([PY, os.path.join(ROOT, script), *argv[1:]], cwd=ROOT)
        (ran if r.returncode == 0 else failed).append(label)
        if r.returncode != 0:
            print(f"        ^ FAILED (exit {r.returncode})")

    print(f"\n{'planned' if args.dry_run else 'ran'}: {len(ran)} · skipped: {len(skipped)} · failed: {len(failed)}")
    if failed:
        print("FAILED steps:", ", ".join(failed))
        return 1
    if args.dry_run or args.no_check:
        return 0

    print("\n=== self-check ===")
    return subprocess.run([PY, os.path.join(ROOT, "scripts", "check_data.py")], cwd=ROOT).returncode


if __name__ == "__main__":
    sys.exit(main())
