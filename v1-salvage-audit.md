# v1 Salvage Audit

This is the working rule for rescuing useful pieces from `outputs/dictybase-app` without bringing back the complexity that made v1 hard to use.

## Salvaged Into v2

- Broader NCBI/UniProt/VEuPathDB gene seed coverage:
  - `gbpC`, `sadA`, `tgrB1`, `tgrC1`, `pdsA`, `csaA`, `regA`, `act15`, `ecmA`
- Better seeded PubMed fallback rows for:
  - `cln5`
  - `acaA`
  - `mhcA`
- Confirmed reusable external link pattern:
  - NCBI Gene
  - UniProt
  - AlphaFold
  - VEuPathDB
  - PubMed

## Good Parts To Keep Mining Later

- `gene-seeds.js`: real source-derived identifiers, aliases, locations, GO rows, and structures.
- `literature-seeds.js`: useful curated PubMed fallback records.
- `source-adapters.js`: source-fetching logic may be useful later, after v2 has a cleaner data module.
- `visual-qa-checklist.md` and screenshots: useful as a checklist, not as design direction.
- Search ranking ideas from `mock-api.js`: useful later, but only after v2 search gets separated from DOM rendering.

## Parked For Now

- Stocks and stock-related relationships.
- Downloads.
- Workspace pages.
- Save/export queues.
- Broad tools dashboard.
- Curation workflow UI.
- Large route surface outside gene search and gene records.

## Rule For Future Salvage

Port data and proven link logic first. Only port UI when it solves a real user action in the current v2 experience.
