# Data versioning, citation, and DOI

Dicty@Duke is citable as a versioned data release.

## Where the version lives

`assets/data_release.json` is the single source of truth for the release
metadata (version, date, authors, publisher, DOI, license). It is served at
`GET /api/version` (which also adds `data_updated`, the newest `assets/*.json`
mtime as an ISO date) and rendered on the **/cite** page (also linked in the
footer and findable via ⌘K → "How to cite").

To cut a new release, bump `version` and `released` in `assets/data_release.json`
and commit. The number scheme is calendar-based (`YYYY.MM`) to match the monthly
data refresh.

## Minting a DOI with Zenodo

`.zenodo.json` (repo root) holds the metadata Zenodo reads. To mint a DOI:

1. Sign in to https://zenodo.org with the GitHub account that owns the repo.
2. Under **Settings → GitHub**, flip the repository switch **on**.
3. On GitHub, publish a tagged release (e.g. `git tag v2026.06 && git push --tags`,
   then "Draft a new release" for that tag). Zenodo archives the tarball and
   mints a DOI automatically, using `.zenodo.json` for the metadata.
4. Zenodo issues a **concept DOI** (always points at the latest release) and a
   per-version DOI. Put the concept DOI into `assets/data_release.json`'s `doi`
   field and commit — the /cite page and `GET /api/version` pick it up, and the
   "pending" note disappears.

Until a DOI is minted, the /cite page shows the citation with the site URL and a
"DOI pending" note — nothing breaks.

## Citing data sources

The site aggregates dictyBase (Basu et al. 2015), UniProt, NCBI, EBI, OMA, RCSB,
and KEGG. The /cite page asks users to also cite the primary source for the data
they used; each gene record links those sources.
