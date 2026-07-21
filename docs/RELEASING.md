# Cutting a release (versioning & citable snapshots)

The site is continuously version-controlled in git (every change is a commit on
both remotes). A **release** is a named, frozen point you can cite and reproduce.
Cut one whenever the data or features change enough to be worth a citable version
(and definitely for the versions referenced in a paper).

## What a release is made of

- **`assets/data_release.json`** — the human-facing version shown on `/cite` and
  `/api/version` (`version`, `released`, `title`, `authors`, `publisher`, `doi`,
  `url`). Bump this by hand; it is deliberately curated, not auto-generated.
- **A git tag** — an immutable snapshot of the exact code + data at release time.
- **A DOI** (via Zenodo) — the citable identifier the paper points at.

Version scheme: `YYYY.MM` (e.g. `2026.07`). Tags are `vYYYY.MM`.

## Steps to cut a release

```bash
# 1. Bump the version + date (and doi/url once you have them) in the metadata.
#    Edit assets/data_release.json:  "version", "released" (today, YYYY-MM-DD).

# 2. Commit and push to both remotes.
git add assets/data_release.json
git commit -m "release: 2026.07"
git push origin master && git push gitlab master

# 3. Tag the release and push the tag to both remotes.
git tag -a v2026.07 -m "dictyBase data release 2026.07"
git push origin v2026.07 && git push gitlab v2026.07

# 4. Deploy the release to the server (bumping data_release.json is data-only,
#    so no restart is needed unless serve.py also changed):
#    on the server: git fetch origin master && git reset --hard origin/master
```

To reproduce or roll back to a release later: `git checkout v2026.07`.

## Getting a DOI (Zenodo) — do this once, then per release

Zenodo mints a DOI for a GitHub *Release* and archives a snapshot. It also gives a
version-independent **concept DOI** that always resolves to the latest — cite that
one in the paper's main text, and the specific version DOI in the methods.

1. Sign in to **https://zenodo.org** with GitHub.
2. Zenodo → **Settings → GitHub**, find `kmscaglione/dictyatduke`, flip the switch **On**.
   - Zenodo only sees **public** repos. Either make the GitHub repo public, or (if it
     must stay private) skip the automatic hook and instead upload a snapshot ZIP to a
     new Zenodo record manually — same DOI result, just not automatic.
3. On GitHub, **Releases → Draft a new release**, choose the tag `v2026.07`, add a
   short description, **Publish**.
4. Zenodo automatically creates a record and issues a DOI (usually within a minute).
5. Copy the DOI into `assets/data_release.json` (`"doi": "10.5281/zenodo.XXXXX"`),
   commit, push, deploy. `/cite` will then show and link it.

For each later release: bump the version, tag, push the tag, publish a GitHub release
on that tag — Zenodo issues a fresh version DOI automatically, and the concept DOI keeps
pointing at the newest.

## Notes

- The **per-dataset freshness dates** on `/data` update automatically from file
  timestamps — you do not manage those. This file is only for the overall citable
  release version.
- Keep `authors` in sync with the manuscript author list when it is finalized
  (student first author, Scaglione last/corresponding).
