# How to curate (single-curator workflow)

Curation here means editing a gene's **curated summary**, curator **note**, and
reference **PMIDs**. There's one curator and changes are rare, so there's no
database and no review queue to manage — you edit through a simple form and
publish with a deploy.

The authoritative store is one file, `assets/dictybase_corpus.json`. **You never
edit that file by hand** (it's 3.4 MB on a single line — one typo breaks every
gene page). The curator dashboard is the only thing that should write to it.

---

## The golden rule: curate on your **local** copy, then deploy

Do **not** curate on the Duke server. Deploys there run `git reset --hard`,
which would **wipe** any edit made directly on the server. Instead:

1. **Edit locally** on your Mac's dev instance (the dashboard writes to your
   local corpus file, which is tracked in git).
2. **Commit + deploy** — the edit travels to the server as a normal code change
   and survives every future deploy.

So the corpus file is version-controlled: every curation is a git commit you can
see, revert, or roll back.

---

## Step by step

### 1. Start the local server (once)
```bash
cd /Users/matthewscaglione/Documents/Codex/2026-06-03/i-want-to-compile-a-list/outputs/dictybase-v2
CURATOR_PASSWORD='pick-a-password' python3 serve.py
```
(If `CURATOR_PASSWORD` isn't set, a random one is printed to the terminal on
startup — either works.)

### 2. Open the curator dashboard
Go to **http://127.0.0.1:8774/tools/curate** (it's unlisted — not in any menu).
Sign in with the curator password. Put your name in the attribution box.

### 3. Edit a gene
- Type a **gene symbol or DDB_G id** (e.g. `mhcA`) and click **Load**. The
  current summary, note, and PMIDs fill in.
- Edit the **Summary** (dictyBase markup is supported — see the cheatsheet
  below), the optional **note**, and comma-separated **PMIDs**.
- Click **Save curation**. It's saved to your local corpus and shows on the gene
  page immediately. It is **not yet public** — that's the next step.

### 4. Review community submissions (if any)
The **Community submissions** section lists anything submitted through the public
[/community/annotations](/community/annotations) form. **Approve → corpus** merges
one into the corpus (needs a DDB_G id); **Reject** dismisses it. Approvals are
saved the same safe way as a direct edit.

### 5. Publish (commit + deploy)
```bash
# on your Mac, in the project folder:
git add assets/dictybase_corpus.json
git commit -m "curate: <gene> summary"
git push gitlab master

# then on the Duke server:
#   cd /srv/web/dicty.labs.duke.edu/html
#   git fetch origin master && git reset --hard origin/master
```
No `systemctl restart` needed — the corpus is read live. Curated edits go public
the moment the server pulls.

**Cadence:** there's no weekly job to run. Curate when you have something, deploy,
done. (Derived data — GO annotations, human orthologs, UniProt, domains —
refreshes automatically on its own monthly schedule.)

---

## Summary markup cheatsheet

The summary field accepts dictyBase wiki markup, rendered to safe HTML:

| You type | Result |
|---|---|
| `[/gene/DDB_G0286355 mhcA]` | in-app link to a gene |
| `[/ontology/go/GO:0003774 motor activity]` | GO term link |
| `[https://pubmed.ncbi.nlm.nih.gov/12345678 label]` | PubMed link |
| `''italic text''` | *italic* |
| `<br />` | line break |

Anything else is shown as plain text (HTML is escaped), so you can't break the
page with a stray `<` or `&`.

---

## Safety & what not to touch

- **Never hand-edit `assets/dictybase_corpus.json`.** Use the dashboard. Every
  save is atomic (temp file + rename) and keeps a `.bak`, so a crash mid-save
  can't corrupt the file. A hand edit gets none of that.
- **`assets/dictybase-corpus/genesummary.csv`** is the legacy dictyBase *seed*
  only. `scripts/build_data.py` uses it to fill in genes that were never
  hand-curated, and it **will not overwrite** anything you edited through the
  dashboard (those carry a `curator_date` that the rebuild skips). So re-running
  `build_data.py` is safe and won't wipe your curation.
- If a save ever fails, the previous version is untouched (the good file is only
  replaced after the new one is fully written), and `assets/dictybase_corpus.json.bak`
  holds the prior copy.

---

## Where the code lives (for maintainers)

- Dashboard UI: `renderCuratePage()` / `initCurate()` / `loadCurQueue()` in `app.js`.
- Endpoints in `serve.py`: `POST /api/curator/login`, `GET /api/curator/entry`,
  `POST /api/curator/edit` (direct edit), `GET /api/curator/queue`,
  `POST /api/curator/approve` / `/reject`. All corpus writes go through
  `write_corpus()` (atomic + backup + cache-invalidate).
