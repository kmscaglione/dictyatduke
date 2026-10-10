# Spatial proteomics explorer

A self-contained module for subcellular spatial proteomics data. It was built
inside this repository and is written to be lifted out unchanged.

```
schema/      versioned bundle schema and its semantics
py/          spatialprot: validation, summaries, offline analysis
js/          the viewer (one script, one stylesheet, no dependencies)
demo/        a standalone host page and a small local server
tests/       synthetic fixtures, Python tests, browser tests
adapters/    host-specific code. Nothing outside this folder knows any host
```

## Interface

The viewer is a dashboard: a title bar, a sidebar (sections, quick search,
compartment filter, display options), a central panel that holds the map or a
list, a protein details panel, and a bottom row with the compartment table,
the score distribution and functional enrichment. The dictyBase layout follows
a reference design supplied by the project lead. Panels whose data are absent
keep their place and show a labelled empty state.

## Rules the module keeps

1. Reusable code names no organism and no host. `tests/test_independence.py` fails if it does.
2. Protein groups are kept whole. Unmapped and multi-gene groups are recorded, never dropped.
3. Published scores are stored and shown exactly. They are not called probabilities unless the method says so.
4. Measured profiles, computational assignments, sequence predictions and curated annotations stay separate.
5. Map and profile views appear only when a bundle carries valid data for them. Nothing is synthesised for a real dataset.
6. Every bundle carries license, citation, attribution, provenance and mapping statistics.
7. A bundle that is not cleared for distribution cannot be committed. A test checks every tracked bundle.

## Python

The core is standard library only. `analysis.py` needs NumPy and is for offline builds.

```
python3 -m venv spatial/.venv && spatial/.venv/bin/pip install numpy==2.3.3 openpyxl==3.1.5
PYTHONPATH=spatial/py python3 -m spatialprot validate FILE [--require-public]
PYTHONPATH=spatial/py python3 -m spatialprot summarize FILE
PYTHONPATH=spatial/py spatial/.venv/bin/python -m spatialprot derive IN OUT --markers LAYER_ID
```

`derive` adds a PCA map and a nearest-centroid layer, both marked `computed`.
It refuses to run on a bundle without measured profiles.

## JavaScript

```html
<link rel="stylesheet" href="spatial-explorer.css">
<script src="spatial-explorer.js"></script>
```
```js
SpatialExplorer.mount(element, { bundleUrl: "...", adapter: { ... }, theme: "light" })
```

The adapter is how a host plugs in: `geneUrl`, `geneLabel`, `memberUrl`,
`searchText`, `extraLayers` and `actions`. All are optional. The header of
`js/spatial-explorer.js` documents each one. `SpatialExplorer.core.geneSummary`
gives a host gene page everything known about one gene.

The script uses no inline script or style attributes, so it runs under a strict
content security policy.

## Tests

```
python3 -m unittest discover -s spatial/tests                      # core, stdlib only
spatial/.venv/bin/python -m unittest discover -s spatial/tests     # adds the NumPy analysis tests
python3 -m unittest discover -s spatial/adapters/dictybase/tests   # host adapter
python3 spatial/demo/serve_demo.py                                 # then open:
#   http://localhost:8791/tests/js/test.html   browser tests
#   http://localhost:8791/demo/                standalone demo
```

All automated tests and the demo use synthetic fixtures for two invented
organisms. Regenerate them with `python3 spatial/tests/fixtures/make_fixtures.py`.
`expected.json` holds reference answers from the Python code that the browser
tests must reproduce.

The browser suite also runs from Python (`spatial/tests/test_browser.py`) in
headless Chrome when one is installed, with no extra dependency.

## Host adapters

Files in `adapters/dictybase/`:

| File | Role |
|---|---|
| `build_bundle.py` | Builds the local bundle from the supplementary tables |
| `compartment_go.json` | Reviewed mapping of compartment labels to GO terms, with the rationale for each |
| `build_go_closure.py`, `go_cc_closure.json` | GO terms that are a kind or part of each mapped term |
| `dicty_site.py` | Server side: gated bundle access, per-gene lookup, GO annotation layers |
| `adapter.js` | Browser side: the `/tools/spatial` page, gene page section, GO enrichment |

The site serves a bundle marked `public` to everyone. Any other bundle is
served only when the server is started with `DICTY_SPATIAL_PREVIEW=1`. That is
the site owner's switch for local review or an unlisted preview. It is not
access control: with it on, anyone who has the address can read the data.

```
DICTY_SPATIAL_PREVIEW=1 python3 serve.py      # then open http://localhost:8774/tools/spatial
```

`adapters/dictybase/build_bundle.py` builds a local bundle from the
supplementary tables of Tinker et al. 2026. Its output directory is gitignored.
The source is CC BY-NC-ND 4.0 and the authors ask to be contacted before reuse,
so that bundle must stay local until they agree.
