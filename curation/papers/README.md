# Paper curation workspace

This is the working folder for whole-paper curation done in Claude Code, the
human-in-the-loop path added in `serve.py` (`/api/curator/papers/export` and
`/api/curator/papers/import`). Nothing here is read by the site. The site only
sees what you import back through the curator dashboard.

**The files live outside the repo**, in two folders on Matt's Desktop:

```
~/Desktop/Dicty curation  exported files/     <- batches OUT of the dashboard
  2026-07-30/dictybase-curation-batch-*.json     one folder per export day

~/Desktop/Dicty files to import/              <- finished curation, BACK IN
  dictybase-curation-results-2026-07-30.json     flat; the name carries the date
```

Look in the first for the newest batch to curate. Write finished curation into
the second, which is what Matt picks in "Import results".

`curation/papers/results/` here holds the working copy of whatever is being
curated right now; `batches/` stays empty. Both are gitignored, because batches
carry fetched publisher full text and results are unreviewed AI drafts. Neither
belongs in a public repo.

"Export batch" is a browser download, so it always lands in `~/Downloads` first.
`scripts/file_curation_files.py` moves it into the dated folder above, and
`scripts/com.dictybase.file-curation.plist` is a LaunchAgent that runs it
automatically whenever Downloads changes.

## The loop

1. Open the curator dashboard at `/tools/curate` and go to the papers queue.
   Click **Fetch full text** first. Without it you are curating abstracts, which
   is much weaker, and the import still labels the draft "whole paper".
2. Click **Export batch**. The file lands in `~/Downloads` as
   `dictybase-curation-batch-YYYYMMDD.json`.
3. Move it into `batches/`, keeping the dated filename.
4. Curate it in Claude Code. Read the batch's own `instructions` field: it is the
   authoritative prompt and it travels with the file. Write the output to
   `results/YYYYMMDD-results.json`.
5. Check the shape before you upload anything:

   ```bash
   python3 scripts/check_curation_results.py curation/papers/results/YYYYMMDD-results.json
   ```

6. Back in the dashboard, click **Import results** and pick that file. Each
   matched draft's AI content is replaced and tagged `Claude Code (whole paper)`,
   then flows on to author review and approval as usual.

## Result shape

```json
{"results": [{
  "pmid": "42458551",
  "summary": "at most two sentences on the paper",
  "gene_summaries": [{"gene": "iqgD", "sentence": "one dictyBase-style sentence"}],
  "go": [{"gene": "iqgD", "term": "GO term or plain description", "aspect": "P"}],
  "phenotypes": [{"gene": "iqgD", "phenotype": "mutant phenotype"}],
  "interactions": [{"gene_a": "iqgD", "gene_b": "rac1A", "type": "physical"}]
}]}
```

Rules that matter, because the import does not enforce them:

- Only *Dictyostelium* genes actually named in the paper. Never invent a gene
  symbol, a GO term, or a number.
- `aspect` is `P`, `F` or `C`. `type` is `physical` or `genetic`.
- Import matches on `pmid` only. A result whose pmid is not in the drafts store
  is skipped silently, so the validator's pmid check is worth running.
- Every string is truncated at 500 characters (800 for `summary`), and each list
  is capped at 100 entries.
- Nothing published here is live. A curator or author still approves each draft.

## Related

- `docs/CURATION.md`: the browser workflow for curators, no terminal.
- `curation/curation.tsv`: the separate hand-curated gene annotation overlay,
  merged by `scripts/merge_curation.py`. Different pipeline, do not mix them up.
