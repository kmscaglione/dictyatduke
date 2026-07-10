# dictyBase v2

A modern, single-page reimplementation of the [dictyBase](https://dictybase.dev)
*Dictyostelium* model-organism database: gene search and richly curated gene
records, 17 sequenced dictyostelid genomes (incl. wild *D. discoideum* isolates
and two new species from Ahmed et al. 2025), a genome browser, local BLAST,
proteome viewers, GO/phenotype enrichment, the Dicty Stock Center catalog,
community-curation forms, an optional AI analysis assistant, and genome
downloads.

> **Status: beta.** Data and features are still being validated. This is a
> research prototype, not the canonical resource. See [Roadmap](#roadmap) and
> [Known issues](#known-issues--gotchas).

---

## Quick start

No build step. You need Python 3 (standard library only) and the data files
(see [Data files](#data-files--formats)).

```bash
python3 serve.py
# serves http://127.0.0.1:8774
```

Then open <http://127.0.0.1:8774>. The port (`8774`) is hard-coded at the bottom
of `serve.py`.

To expose the beta externally we use a Cloudflare quick tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:8774
```

---

## Architecture at a glance

- **Frontend:** a vanilla-JS single-page app. No framework, no bundler, no
  transpile. `index.html` is the shell; `app.js` is the whole application;
  `styles.css` is all styling. Large content blobs live in separate
  `*-content.js` files loaded as globals.
- **Backend:** `serve.py` — a ~3,000-line subclass of Python's
  `http.server` handler (standard library only, no dependencies). It serves
  static files, falls back to the SPA shell for client routes, exposes the
  JSON/proxy/compute API endpoints (search, gene records, local BLAST,
  enrichment, sequence tools, allowlisted third-party proxy, curator/community
  submission, and an optional AI proxy), and adds cache-control + asset
  cache-busting.
- **Data:** static JSON files in `assets/`, generated from source files in
  `assets/dictybase-corpus/` and `assets/genomes/` plus one external download
  (the GO annotation file). See [Data pipeline](#data-pipeline).
- **Runtime enrichment:** gene records are progressively enriched by calling
  public APIs from the browser (NCBI, UniProt, QuickGO, STRING, OMA, AlphaFold,
  RCSB PDB). The app needs internet for full record detail.

```
Browser ──HTTP──> serve.py ──> static files (index.html, app.js, assets/*.json, genomes)
   │                      └──> /api/* (AlphaFold proxy, curator/community endpoints)
   └──fetch──> NCBI E-utilities · UniProt · QuickGO · STRING · OMA · RCSB PDB
   └──CDN────> Chart.js · IGV.js · 3Dmol.js
```

---

## Project layout

```
index.html            SPA shell: top nav, hero + gene search, content sections, footer
app.js                The entire app (~500 KB / ~9,900 lines): routing, gene records +
                      tabs, all tools, organisms, community forms, the curated-summary
                      markup parser
styles.css            All styles. Theme via CSS custom properties in :root
serve.py              Python HTTP server (~3,000 lines: static + SPA fallback + API +
                      cache-busting), standard library only

technique-content.js  window.techniqueContent  — protocols/methods content (large)
teaching-content.js   window.teachingLabsContent — classroom resources
meetings-content.js   window.meetingsContent — meetings/events
labs-content.js       window.dictyLabs — research-lab directory

assets/
  dictybase_corpus.json     curated gene summaries (+ curator, note, legacy phenotypes)
  gene_index.json           full D. discoideum gene catalog (typeahead)
  phenotypes.json           mutant-strain phenotypes per gene
  go_annotations.json       dictyBase-curated GO annotations (from the GO Consortium GAF)
  downloads_manifest.json   per-species genome/annotation download list
  rnaseq_parikh.json        RNA-seq developmental time course (expression chart)
  proteomics_data.json      developmental proteome viewer dataset
  heatstress_data.json      insoluble/heat-stress proteome viewer dataset
  dicty-hero.jpg            homepage hero image
  dicty-mascot.png          brand logo (Blue Devil sorus)
  favicon.svg               favicon

  dictybase-corpus/         SOURCE data used to generate the JSON above
    genesummary.csv         curator + summary (with wiki markup) per gene  [TSV despite .csv]
    public.csv              curator inspection notes
    strain_genes.tsv        strain (DBS…) -> gene (DDB_G…)
    strain_phenotype.tsv    strain -> phenotype rows (term, condition, PMID, note)

  genomes/                  FASTA + GFF + .fai per species (GITIGNORED — see below)
  teaching-labs/, teaching/ PDFs / docx referenced by content pages

scripts/
  build_data.py             regenerate gene_index, phenotypes, downloads_manifest,
                            go_annotations, and the corpus summary merge

uploads/                    runtime user submissions (mostly GITIGNORED)
  files/  submissions/      community uploads (gitignored)
  curations/               community gene curations awaiting review (tracked)
```

> **Gitignored, so absent from a fresh clone:** `assets/genomes/` (large
> genome FASTA/GFF — re-download from NCBI, see below) and `uploads/files`,
> `uploads/submissions`. The genome browser and the Downloads page will 404
> until `assets/genomes/` is populated.

---

## How the app works

### Client-side routing
`serve.py` returns the SPA shell (`index.html`) for any path that isn't a real
static file. On load and on `popstate`, `app.js` reads `location.pathname` and
renders the matching view. Routes:

| Route | View |
|---|---|
| `/` | home (hero + gene search) |
| `/gene/:symbol` | gene record |
| `/tools` | all-tools index |
| `/tools/:tool` | `genome-browser`, `blast`, `sequence`, `convert`, `expression`, `enrichment`, `geneset`, `lab`, `proteomics`, `heatstress`, `downloads`, `basket`, `api`, `ai` (AI assistant), `stats` |
| `/stock-center` | Dicty Stock Center catalog + order cart |
| `/search/advanced` | advanced gene finder (facet filters) |
| `/news`, `/news/archive` | news feed |
| `/organisms/:id` | organism page |
| `/community/:slug` | community forms (annotations, upload-data, corrections, suggestions, meetings, labs, disease-models) |
| `/research/:slug`, `/research/techniques/:slug` | research/technique content |

### Gene search
The search box autocompletes against `gene_index.json` (13,892 genes, loaded
lazily). Selecting a result opens the record via `openRemoteGene(ncbiGeneId)`,
which builds a base record from NCBI, then enriches from UniProt and the local
corpus. The 15 hand-curated genes in the `genes` array at the top of `app.js`
are richer seeds; everything else is index + live enrichment.

### Gene record tabs
Each tab lazy-loads its data when opened (see the effects at the end of
`renderRecord`):

| Tab | Source |
|---|---|
| Summary | `dictybase_corpus.json` summary, rendered through `renderCuratedText()` (markup → links) + RNA-seq chart |
| GO | `go_annotations.json` (curated GAF); names resolved via QuickGO; falls back to live QuickGO/UniProt |
| Phenotypes | `phenotypes.json` |
| Literature | curated references (PMIDs parsed from the summary, titles via NCBI esummary) + live PubMed search |
| Structures | AlphaFold (via `/api/alphafold` proxy + 3Dmol.js) + RCSB PDB search |
| Interactions | STRING |
| Orthologs | OMA Browser |
| PTMs | UniProt sequence features (modified residue, glycosylation, lipidation, disulfide, cross-link) |

### The curated-summary markup parser
`renderCuratedText()` in `app.js` converts dictyBase wiki markup into safe HTML:
`[/gene/DDB_G… symbol]` → in-app gene link, `[/ontology/go/… name]` → QuickGO
link, `[…pubmed/12345 label]` → PubMed link, `''text''` → italics, `<br />` →
line break. All other text is HTML-escaped.

---

## Data files & formats

All are minified JSON in `assets/`, served with `Cache-Control: no-cache` so
updates are picked up on the next load.

- **`gene_index.json`** — array of `[ddbId, symbol, name, location, ncbiGeneId]`
  for every D. discoideum gene. Drives the typeahead.
- **`dictybase_corpus.json`** — `{ "DDB_G…": { summary, curator, note,
  phenotypes? } }`. `summary` contains dictyBase wiki markup (see parser above).
- **`phenotypes.json`** — `{ "DDB_G…": [[term, condition, pmid, note], …] }`.
- **`go_annotations.json`** — `{ "DDB_G…": [[goId, aspect, evidenceCode, pmid], …] }`,
  `aspect` ∈ `F|P|C`. Term names are resolved at render time via QuickGO.
- **`downloads_manifest.json`** — `[{ id, label, assembly, files: [{ type, name,
  url, size }] }]`.

---

## Data pipeline

The JSON data files are **generated**, not hand-authored. Regenerate with:

```bash
python3 scripts/build_data.py            # gene_index, phenotypes, downloads_manifest, corpus merge
python3 scripts/build_data.py --go       # also (re)download the GO GAF and build go_annotations.json
```

Sources and steps:

| Output | Source | Notes |
|---|---|---|
| `gene_index.json` | `assets/genomes/D_discoideum_AX4.gff` | gene features → symbol/id/name/location/ncbi |
| `phenotypes.json` | `dictybase-corpus/strain_phenotype.tsv` + `strain_genes.tsv` | join strain→gene; HTML entities decoded |
| `dictybase_corpus.json` summaries | `dictybase-corpus/genesummary.csv` | merged into the corpus, entities decoded |
| `go_annotations.json` | `current.geneontology.org/annotations/dictybase.gaf.gz` | **external download** (~2 MB) |
| `downloads_manifest.json` | `assets/genomes/*` | scans the genome files actually present |

**Genome files** (`assets/genomes/`) are gitignored. They come from the NCBI
assemblies listed in `downloads_manifest.json` / the `browserOrganisms` array in
`app.js` (e.g. `GCF_000004695.1` for D. discoideum AX4). Re-download from NCBI
Datasets and place the FASTA (`*_genome.fna.gz`, `*_browser.fna`), index
(`*.fna.fai`), and GFF (`*_browser.gff`) files there.

---

## serve.py — endpoints & behaviors

**API**
- `GET  /api/alphafold/{uniprot}` — proxies the AlphaFold PDB for a UniProt ID
  (adds CORS so 3Dmol.js can load it).
- `GET  /api/curator/queue` — list pending community curations *(auth)*.
- `POST /api/upload` — multipart file/data submission → `uploads/`.
- `POST /api/curator/login` — password → bearer token.
- `POST /api/curator/submit` — community gene-curation submission.
- `POST /api/curator/approve` — approve a curation; **merges it into
  `dictybase_corpus.json`** *(auth)*.
- `POST /api/curator/reject` — reject a curation *(auth)*.
- `GET  /api/sequence?ddb=DDB_G…&type=genomic|cdna|protein&symbol=…` — returns a
  gene's sequence as a FASTA download, extracted on the fly from the D. discoideum
  genome + GFF (cDNA = spliced exons, protein = translated CDS). Powers the
  "Sequences" box on the gene record.
- `POST /api/blast` — local blastn/tblastn against the bundled genomes (see
  [Local BLAST](#local-blast-p6)). Returns JSON hits; D. discoideum hits include
  the mapped gene. Program + database come from server allowlists; the query is
  written to a temp file and passed via `-query` (never a shell), size-capped and
  timed out.
- `POST /api/enrichment`, `/api/geneset-report`, `/api/align`, `/api/idmap`,
  `/api/codon-optimize`, `/api/restriction`, `/api/orf` — the analysis/bench
  tools (GO/phenotype enrichment, gene-set report, MSA, ID mapping, codon
  optimization, restriction/ORF finding).
- `POST /api/analyze` — **optional AI assistant** ("Ask AI", `/tools/ai`).
  Proxies one bounded prompt to a provider (Google Gemini free tier by default;
  `_analyze_generate` is the only provider-specific code). **Disabled unless a
  key is set** (`GEMINI_API_KEY` env, or a gitignored `.gemini_key` file);
  `/api/version` exposes an `ai_assistant` flag so the UI hides the tool when
  off. Heavily gated against public-proxy abuse: input-size caps, per-IP
  rate limits (min + day), and global daily request + output-token ceilings
  that reset at UTC midnight. Model via `ANALYZE_MODEL`.

Everything else is a static file, or the SPA shell for client routes.

**Cache strategy** (in `end_headers` + `_serve_index`)
- The SPA shell is served with `Cache-Control: no-cache` and its `<link>`/`<script>`
  asset URLs are rewritten to `?v=<mtime>` so a changed file always re-downloads.
- Versioned (`?v=…`) css/js → `immutable, max-age=1y`.
- Unversioned css/js and all `.json` → `no-cache, must-revalidate` (cheap 304s).
- **Transition caveat:** a browser that cached an asset *before* these headers
  existed may serve it stale until its heuristic freshness expires — one hard
  refresh (Cmd/Ctrl+Shift+R) fixes it. New visitors are unaffected.

**Curator auth**
- The curator password comes from the `CURATOR_PASSWORD` env var (no secret in
  source); if unset, a random dev password is generated per run and printed to
  the log. Set it in any real deployment: `CURATOR_PASSWORD=… python3 serve.py`.
- `POST /api/curator/login` compares the password in constant time
  (`hmac.compare_digest`), rate-limited to 5 attempts / 5 min / IP. On success it
  issues a **random, expiring session token** (8 h), held server-side; protected
  endpoints validate the `Authorization: Bearer …` token against that session
  store. `POST /api/curator/logout` invalidates a token.
- `POST /api/upload` (public submission) is capped at 50 MB, restricted to a
  file-type allowlist, and rate-limited (10/h/IP); filenames are sanitized.
  Note: the session store and rate-limit counters are in-memory (single
  process) — move to shared storage if running multiple workers.

---

## Public API

A read-only JSON API over the local curated data (CORS-enabled, `Access-Control-Allow-Origin: *`):

- `GET /api/gene/{symbol|DDB_G…}` — assembled gene record: identifiers, plain-text
  summary, curated GO, phenotypes, cited references (PMIDs), and sequence URLs.
- `GET /api/search?q=…&limit=25` — gene search (symbol/id/name), ranked.
- `GET /api/go/{GO:0003674}` — all genes annotated to a GO term (with evidence).
- `GET /api/strain/{DBS…}` — a mutant strain's gene + phenotypes.
- `GET /api/data-status` — per-dataset source, record count, and last-updated
  date (powers the `/data` provenance page).
- `GET /api/sequence?ddb=…&type=genomic|cdna|protein` — FASTA (see above).

Backed by the same JSON data files; lazily loaded and cached in-process.

---

## External services (runtime)

The app fetches from these at runtime (browser-side), so full functionality
needs internet:

- **NCBI E-utilities** — gene search/esummary, PubMed.
- **UniProt REST** — protein record enrichment.
- **EBI QuickGO** — GO term names + the GO-tab fallback.
- **STRING** — protein interactions. **OMA** — orthologs. **RCSB PDB** — structures.
- **AlphaFold** (via the local proxy).
- CDNs: **Chart.js** (jsdelivr), **IGV.js** (jsdelivr), **3Dmol.js**
  (`3Dmol.csb.pitt.edu`, loaded on demand).

---

## Local BLAST (P6)

The BLAST tool (`/tools/blast`) searches the bundled dictyostelid genomes
locally; D. discoideum hits link straight to their gene page. It needs NCBI
BLAST+ installed and the databases built.

```bash
# 1. Install BLAST+ (Apple Silicon shown; pick the build for your platform)
curl -LO https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/ncbi-blast-2.17.0+-aarch64-macosx.tar.gz
tar xzf ncbi-blast-2.17.0+-aarch64-macosx.tar.gz
mkdir -p ~/.local/blast && cp ncbi-blast-2.17.0+/bin/{makeblastdb,blastn,tblastn} ~/.local/blast/

# 2. Build the per-species databases (-> assets/genomes/blastdb/, gitignored)
python3 scripts/build_blastdb.py
```

`serve.py` finds the binaries in `~/.local/blast/` (or on `PATH`) and the DBs in
`assets/genomes/blastdb/`. If either is missing, the endpoint returns a clear
503 and the UI shows the message — the rest of the site is unaffected. Supported
programs: **blastn** (nucleotide) and **tblastn** (protein query); both run
against the nucleotide genome DBs. Protein-DB searches (blastp/blastx) stay on
the NCBI hand-off.

---

## Known issues & gotchas

1. **Curator auth** (hardened 2026-06-06): password is read from the
   `CURATOR_PASSWORD` env var (random dev fallback, printed to the log),
   constant-time compared, login rate-limited, and login issues random expiring
   session tokens (no longer the password hash). Uploads are size/type/rate
   limited. Remaining for scale: the session + rate-limit stores are in-memory
   (single process); HTTPS/stable hosting is still needed before public launch.
2. **Genomes are gitignored.** A fresh clone has no `assets/genomes/`, so the
   genome browser and Downloads page 404 until you re-download (see Data pipeline).
3. **Cache transition.** See the cache caveat above — existing testers may need
   one hard refresh after a deploy; new visitors are fine.
4. **`app.js` is one ~500 KB / ~9,900-line file.** No modules/build. Readable
   and sectioned, but large; a future refactor could split it. Some large
   `*-content.js` blobs load on every page — candidates for lazy-loading.
5. **No tests, no CI.** Verification has been manual (run the server, drive the
   UI). Worth adding before multi-developer work.
6. **Port is hard-coded** to 8774 in `serve.py` (no longer reads `argv`).
7. **`uploads/curations/` is tracked** (community submissions get committed);
   `uploads/files` and `uploads/submissions` are gitignored.
8. **Local BLAST needs setup** — BLAST+ binaries + built databases (see
   [Local BLAST](#local-blast-p6)); the genomes and DBs are gitignored.

---

## Roadmap

Data-depth parity with dictybase.dev was the initial focus. Shipped since:

- **Gene records** — linked curated summaries (gene/GO/PubMed cross-links),
  phenotypes, curated references, GO annotations (GO Consortium GAF), protein
  structures (AlphaFold + PDB), interactions (STRING), orthologs (OMA), PTMs,
  and human-disease orthologs.
- **Genome tools** — 17 dictyostelid genomes with a genome browser, local
  BLAST, per-gene sequence retrieval, cross-species comparison, synteny, and
  natural-variation panels; whole-genome + whole-database downloads.
- **Analysis tools** — GO/phenotype enrichment, gene-set analysis, expression
  comparison, developmental/insoluble proteome viewers, a gene ID converter,
  sequence tools (region retrieval, in-silico PCR, MSA), and lab tools (CRISPR
  guides, qPCR primers, codon optimizer, restriction/ORF).
- **Dicty Stock Center** — a browseable strain/plasmid catalog (~8,300 entries)
  plus the GWDI insertion bank (~21,500), with a cart that emails an order
  request. *Data is scraped from the legacy catalog pages (interim); a proper
  export/feed would replace it.*
- **Community curation** — a guided gene-annotation form with curator review.
- **AI analysis assistant** — an optional, key-gated "Ask AI" tool (`/tools/ai`),
  clearly badged AI-generated. Off unless a provider key is set.
- **Public REST API** (see above) and a command palette / advanced finder.

Not done / candidates:

- Automated tests + CI (currently manual verification).
- A proper Stock Center data export (replacing the interim scrape).
- Splitting `app.js` into modules.

---

## Deployment notes

**Live at <https://dicty.labs.duke.edu>** — a Duke AlmaLinux 9 VM running
Apache (TLS) as a reverse proxy in front of `serve.py` (bound to
`127.0.0.1:8774`) under a systemd unit (`dicty.service`). Deploys are a git
pull: push to the Duke GitLab remote, then on the server
`git fetch origin master && git reset --hard origin/master` (+ `systemctl
restart dicty` only when `serve.py` changes — `app.js`/`styles.css`/JSON are
read live). Secrets come from `/etc/dicty.env` (or, where that file isn't
writable, a gitignored `.gemini_key` in the site dir for the AI key).

**See [`deploy/DEPLOY-DUKE.md`](deploy/DEPLOY-DUKE.md)** for the exact
server recipe (Apache vhost, systemd unit, SELinux, genome-data install, and
the update/rollback flow), [`docs/deployment.md`](docs/deployment.md) for the
general public-host checklist, and [`docs/cdn-setup.md`](docs/cdn-setup.md) for
the optional CDN layer (the app already emits immutable/edge-cacheable headers).
