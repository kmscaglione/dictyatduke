# dictyBase data-accuracy validation checklist (for the NAR manuscript)

**Goal.** Independently confirm that the data the site shows is *correct* (matches the
authoritative sources) and that the specific numbers we claim in the paper are right.
You are trying to *find problems* before a reviewer or reader does.

**Where to work.** Test the **live site: https://dicty.labs.duke.edu**. Where a check
says "compare to dictyBase," use the current dictyBase at **https://dictybase.dev**.

---

## How to actually validate (read this first)

You obviously can't count 13,000 genes or open every record. Use these four
techniques instead. Most of your time is techniques 1 and 3.

### Technique 1 — To check a COUNT, download the data and count it (don't count the screen)

The site can export its data as a spreadsheet. Download it, count the rows, and that
number should match what the site displays. This proves the number on the page really
reflects the served data (not a stale, hand-typed label).

- **Genes:** open `https://dicty.labs.duke.edu/api/bulk?dataset=genes` in your browser
  (it downloads a `.tsv`). Open it in Excel. **Rows minus the header row = the gene
  count.** It should equal the homepage "13,000+" and the `/data` "Gene catalog" number.
- **GO annotations:** `…/api/bulk?dataset=go` → rows = the GO-annotation count.
- **Phenotypes:** `…/api/bulk?dataset=phenotypes`. **Orthologs / disease:** `…/api/bulk?dataset=orthologs`.
- **Genomes (17):** small enough to just count on the downloads page. List them out.
- *Counting rows in Excel:* open the file, press **Ctrl/Cmd+End** to jump to the last
  row; that row number, minus 1 for the header, is the count. Or type `=COUNTA(A:A)-1`.

### Technique 2 — Benchmark each count against an INDEPENDENT source

The site counting itself is not proof. Compare to an outside authority. Exact matches
are **not** expected (annotation versions differ); the same ballpark is good, a
difference of **thousands** is a red flag to write down.

- **Genes:** NCBI Datasets for *D. discoideum* (taxon 44689,
  `ncbi.nlm.nih.gov/datasets/taxonomy/44689/`) and dictyBase both state a gene/protein
  total. Compare. A difference of a few hundred is normal; thousands is not.
- **GO annotations:** download the current GO Consortium GAF
  (`current.geneontology.org/annotations/dictybase.gaf.gz`), count the lines that do
  **not** start with `!`, compare.
- **Proteomics:** the Banu et al. and Williams et al. papers state their protein counts
  in the abstract — compare directly to what the viewer shows.

### Technique 3 — To check ACCURACY, take a random sample (you can't check them all)

Pick a random handful, check each one carefully, and infer the whole. If your whole
sample is correct you have strong confidence in the full dataset; if you find errors,
expand the sample and record how many.

- **Draw the sample:** from the genes `.tsv` you downloaded, add a column `=RAND()` in
  Excel, **sort by that column**, and take the top **~40 genes**. That is an unbiased
  random sample.
- Run the §2 gene-record checks on those ~40 (plus the 6 reference genes below). ~40 is
  a good target for gene records; **5–10 is enough** for tools/search where you're
  testing that a feature *works*, not bulk data.
- **Record the error rate:** "0 of 40 wrong" is a strong result; "3 of 40 wrong" is
  something we need to fix and look into more broadly.

### Technique 4 — Know what counts as a real problem

- **Ignore** cosmetic differences: capitalization, spacing, punctuation, or an accepted
  synonym.
- **Flag** substantive disagreements: a different gene ID, a wrong genomic location, a
  GO term the authoritative source doesn't list, a protein of a different length, a
  disease that doesn't match, or a broken/incorrect link.
- When unsure, write it down and let Matt decide. Over-reporting is fine; a silent miss
  is not.

---

**Reference gene panel** (well-studied genes; use these throughout in addition to your random sample):

| Symbol | DDB_G id | Note |
|---|---|---|
| rasG | DDB_G0293434 | small GTPase, chemotaxis |
| mhcA | DDB_G0286355 | myosin II heavy chain |
| acaA | DDB_G0281545 | adenylyl cyclase A |
| pkaC | DDB_G0283907 | PKA catalytic subunit |
| gbpC | DDB_G0291079 | cGMP-binding protein |
| cln5 | DDB_G0275299 | disease model (human CLN5 / Batten) |

**Authoritative sources:** dictyBase (dictybase.dev), NCBI Gene / Datasets, UniProt,
QuickGO (ebi.ac.uk/QuickGO), KEGG, OMA Browser, Orphanet, AlphaFold, InterPro, PubMed.

---

## 1. Headline numbers (these go in the manuscript — verify exactly)

Use **Technique 1** (download + count) then **Technique 2** (benchmark). For each,
record: the site's number, your counted number, and the independent benchmark.

- [ ] **Gene records** — homepage "13,000+" and `/data` "Gene catalog". Download `api/bulk?dataset=genes`, count rows, confirm it matches; then check it's in NCBI/dictyBase's range for *D. discoideum*.
- [ ] **Sequenced genomes** — count the assemblies listed on the downloads page and genome browser; should be **17** (11 species-level + 6 wild isolates). Match each name to NCBI.
- [ ] **Stock center** — the browsable strain + plasmid counts. Compare to what dictyBase's Dicty Stock Center reports.
- [ ] **Disease genes** — this is the number of *genes that have a disease*, not ortholog rows. Easiest: use the count on the disease-models page / advanced-finder "has disease" filter. To verify it: open `api/bulk?dataset=orthologs`, filter the **disease** column to non-empty, and count the **distinct** `ddb_g`. Confirm it matches the manuscript (e.g. 423).
- [ ] **Proteomics** — the two proteome viewers state protein counts; confirm they match the numbers in the Banu et al. and Williams et al. abstracts.
- [ ] **GO annotations** — download `api/bulk?dataset=go`, count rows; benchmark against the GO Consortium dictyBase GAF (count non-`!` lines).
- [ ] Any other specific number in the manuscript — find it on the site, count/benchmark it the same way.

## 2. Gene records (the core of the site)

Run these on your **~40-gene random sample (Technique 3)** plus the 6 reference genes.
For each gene, open its record and check:

- [ ] **Symbol + name + DDB_G id** match dictyBase and NCBI Gene.
- [ ] **Genomic location** (chromosome + coordinates) matches NCBI Gene / dictyBase.
- [ ] **Summary text** is present and does not contradict dictyBase.
- [ ] **Curation badge is correct** — "dictyBase legacy" text really comes from dictyBase; anything "AI" is clearly badged and not presented as curated fact.
- [ ] **GO terms** — pick 3; look each up in QuickGO; the term id matches its name, and dictyBase/QuickGO also associate that gene with it.
- [ ] **Phenotypes** (if any) match the mutant phenotypes dictyBase lists.
- [ ] **Human ortholog + disease** (e.g. cln5) — ortholog matches OMA; disease matches Orphanet (cln5 → CLN5 → neuronal ceroid lipofuscinosis / Batten).
- [ ] **Cross-reference links** (UniProt, NCBI) open the *correct* entry, not a different gene.
- [ ] **Sequences** — protein matches UniProt: paste the site's protein into the UniProt entry's BLAST or just compare **length and the first/last ~10 residues**. cDNA should translate to that protein.
- [ ] **Protein structure** (AlphaFold) loads and is for the right UniProt accession.
- [ ] **Domains** (InterPro/Pfam) match what InterPro lists for that UniProt accession.

*Report the error rate here (e.g. "1 of 40 genes had a wrong location").*

## 3. Search

Functional checks — 5–10 examples each is enough.

- [ ] **Gene search** — each reference symbol returns the correct gene as top hit; search by DDB_G id, UniProt accession, and NCBI Gene id also resolve to the right gene.
- [ ] **Phenotype search** — pick a phenotype; spot-check 2 results against dictyBase.
- [ ] **GO term search** — search a term; the genes returned are annotated to it. *How to spot-check the size:* compare the number of genes the site returns for that term to the number QuickGO shows for the same GO term in *D. discoideum* — same ballpark is fine.
- [ ] **Localization search** — pick a location; results are plausible.
- [ ] **Advanced gene finder** — apply a filter (e.g. has human ortholog + disease); confirm 3 results actually meet the filter.

## 4. BLAST

- [ ] Copy a reference gene's **DNA**, run **blastn** vs *D. discoideum AX4* → it hits **itself at ~100% identity** and the hit links back to the correct gene. (This is the cleanest accuracy check: the sequence must find its own gene.)
- [ ] Copy a **protein**, run **tblastn** → top hit is the correct gene.
- [ ] Run a **cross-species** search → results returned for the other genomes, no error.
- [ ] Try a nonsense / very short sequence → handled gracefully (clear message, no crash).

## 5. Genome browser & downloads

- [ ] Genome browser loads and lists all sequenced species.
- [ ] Navigate to a reference gene's coordinates → the **gene model** (exons) matches the location shown on its record page.
- [ ] Downloads page lists **17 assemblies**. Download **one FASTA and one GFF**; open them — not empty/corrupt, species matches NCBI. *Sanity-check a FASTA:* the first line starts with `>` and the sequence is only A/C/G/T/N. *Sanity-check a GFF:* it has `gene`/`mRNA`/`CDS` feature rows.
- [ ] Assembly names/species match the source (NCBI / Ahmed et al. 2025 for the wild isolates).

## 6. Stock Center

- [ ] Search a **known strain** → its catalog entry (genotype, description) matches dictyBase's Dicty Stock Center.
- [ ] Strain and plasmid counts match the manuscript (Technique 1/2).
- [ ] Add an item to the order/cart → the order flow works up to (not including) actually submitting.

## 7. Analysis tools

Functional checks — one or two good examples each.

- [ ] **GO enrichment** — paste genes known to share a process (e.g. several chemotaxis genes: carA-1, gpaB, acaA, pikA); the top enriched terms should be about chemotaxis/signaling. *Validation:* the result makes biological sense and the p-values are small for the expected terms.
- [ ] **Gene-set analysis** — paste a hit list → returns GO, phenotype, KEGG, ortholog/disease, and an expression-peak profile with no error; numbers are internally consistent (e.g. "disease genes" count ≤ total genes in the set).
- [ ] **Compare expression** (Parikh RNA-seq) — plot a developmentally regulated gene (acaA/pkaC); the profile matches its known developmental timing.
- [ ] **Proteome viewers** — a protein appears with values across the life-cycle stages.
- [ ] **Lab tools** — generate CRISPR guides and qPCR primers for a reference gene; confirm one guide/primer sequence actually occurs in that gene's sequence (search for it with Ctrl+F in the retrieved sequence).
- [ ] **Codon optimization** — run a short protein; paste the output DNA into any translate tool (e.g. ExPASy Translate) and confirm it back-translates to the input protein.
- [ ] **Sequence tools** — region retrieval and in-silico PCR return the expected region/product for known coordinates/primers.
- [ ] **ID converter** — convert a symbol → DDB_G → UniProt → NCBI and back; the ids stay consistent with the gene record.

## 8. API (quick programmatic spot-check)

Open each URL in the browser and compare the JSON to the record page.

- [ ] `…/api/gene/rasG` → symbol, name, GO match the rasG record page.
- [ ] `…/api/search?q=mhcA` → mhcA (DDB_G0286355) is in the results.
- [ ] `…/api/gene-annotations?ddb=DDB_G0275299` → GO annotations returned for cln5.

## 9. External links & attribution

- [ ] On a gene record, the **UniProt / NCBI / PubMed** links open the *correct* external entry.
- [ ] **/data** lists every data source with a license and a working link.
- [ ] **/cite** loads and shows a citation; footer credit and license line are present and correct.

## 10. Sanity sweep (catch the weird stuff)

- [ ] From your random sample, confirm **none** are blank, broken, or error out.
- [ ] Look for any gene where the **summary contradicts its GO terms / name**.
- [ ] Check a **hypothetical/uncharacterized** gene → shows minimal data gracefully, not an error.
- [ ] Note any page that is slow, throws a browser error, or shows "undefined" / "NaN" / placeholder text.

---

## Recording table (copy into a spreadsheet)

| # | Section | Test / gene | Site showed | Expected / source | PASS / FAIL | Notes |
|---|---|---|---|---|---|---|
| | | | | | | |

**When done, give Matt:** (1) every FAIL with details, (2) the exact **headline numbers**
from §1 (site number, your count, and the independent benchmark) so we cite the right
figures, (3) the **error rate** from your §2 random sample, and (4) any "looks off but
not clearly wrong" notes. Anything where the site and dictyBase *disagree* is highest priority.
