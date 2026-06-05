# Curation pipeline

Two layers of gene annotation feed the site, combined into one file the front
end reads: **`assets/gene_annotations.json`** (keyed by `DDB_G` id).

```
   GO Consortium GAF ──► build_annotations.py ──► assets/annotations_imported.json
                                                          │
   curation/curation.tsv  (your own curation) ──► merge_curation.py
                                                          │
                                                          ▼
                                          assets/gene_annotations.json  ← the site reads this
```

## 1. Refresh community curation (automated)

`build_annotations.py` turns the official dictyBase GAF into a rich per-gene
record: GO terms grouped by aspect (P/F/C) with evidence code, qualifier,
citing **PMID**, date and who assigned it — plus a distinct **literature** list
(papers a curator actually read), per-gene **counts** (total / manual /
automated / papers), `last_curated` date, and the list of `sources`.

```bash
python3 scripts/build_annotations.py            # downloads the latest GAF
# or, against a local file you already have:
python3 scripts/build_annotations.py --gaf path/to/dictybase.gaf
python3 scripts/merge_curation.py               # always run this after
```

This is safe to run on a schedule — it keeps you in sync with both dictyBase's
ongoing curation and the automated UniProt/InterPro layer. A GitHub Action
(`.github/workflows/refresh-curation.yml`) does it monthly and commits any
changes.

## 2. Add your own curation

Edit **`curation/curation.tsv`** — easiest in Google Sheets / Excel, exported as
`.tsv`. One annotation per row, 10 columns:

| column | meaning |
|--------|---------|
| `ddb_id` | `DDB_G…` gene id (stable key) |
| `symbol` | gene symbol (display only) |
| `type` | `go` \| `literature` \| `summary` |
| `value` | GO id / PMID / summary text |
| `aspect` | `go` only: `P` process, `F` function, `C` component |
| `evidence` | `go` only: `IDA IMP IPI IGI IEP` (experimental), `IC TAS` (curator) |
| `reference` | the paper, e.g. `PMID:38562996` |
| `date` | `YYYY-MM-DD` |
| `curator` | your name / initials |
| `note` | optional GO label / paper title / comment |

Then:

```bash
python3 scripts/merge_curation.py
```

Your entries are tagged source **`curated-here`** so the site can show a
provenance badge and never confuses them with imported annotations. Each gene
you touch gets a `curated_here` block (`count`, `last`, `curators`).

Use real GO ids, standard evidence codes, and PMIDs — that keeps your curation
interoperable, and means you could later register as a GO Consortium
contributor and submit it upstream.

## Provenance in the data

Every GO entry is `[go_id, evidence, qualifier, reference, date, assigned_by]`.
`assigned_by` is `dictyBase`, `UniProt`, `InterPro`, `GO_Central`, or
`curated-here`. Show it as a badge so users always see where a fact came from.

## Files

| file | committed? | notes |
|------|-----------|-------|
| `scripts/build_annotations.py` | yes | GAF → imported annotations |
| `scripts/merge_curation.py` | yes | imported + your curation → final |
| `curation/curation.tsv` | yes | your curation source (edit this) |
| `assets/annotations_imported.json` | no (git-ignored) | regenerable from the GAF |
| `assets/gene_annotations.json` | yes | final file the site serves |
