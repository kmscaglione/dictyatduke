# dictyBase data-accuracy validation checklist (for the NAR manuscript)

**Goal.** Independently confirm that the data the site shows is *correct* — matches
the authoritative sources — and that the specific numbers we claim in the paper are
right. You are trying to *find problems* before a reviewer or reader does.

**How to work.**
- Test the **live site: https://dicty.labs.duke.edu**
- For every check, mark **PASS** or **FAIL**. If FAIL, write down: the gene/input,
  what the site showed, what the correct value is, and the source you checked
  against. Use the recording table at the bottom (copy it into a spreadsheet).
- When a check says "compare to dictyBase," use the current dictyBase at
  **https://dictybase.dev** (search the same gene there).
- You do **not** need to be exhaustive. For each section, do the listed reference
  genes **plus 3–5 genes you pick yourself at random**, so problems that only affect
  some records get caught.

**Reference gene panel** (well-studied genes; use these throughout):

| Symbol | DDB_G id | Note |
|---|---|---|
| rasG | DDB_G0293434 | small GTPase, chemotaxis |
| mhcA | DDB_G0286355 | myosin II heavy chain |
| acaA | DDB_G0281545 | adenylyl cyclase A |
| pkaC | DDB_G0283907 | PKA catalytic subunit |
| gbpC | DDB_G0291079 | cGMP-binding protein |
| cln5 | DDB_G0275299 | disease model (human CLN5 / Batten) |

**Authoritative sources you'll use:** dictyBase (dictybase.dev), NCBI Gene, UniProt,
QuickGO (ebi.ac.uk/QuickGO), KEGG, OMA Browser, Orphanet, AlphaFold, InterPro, and
the primary papers (PubMed).

---

## 1. Headline numbers (these go in the manuscript — verify exactly)

Check each number on the site and confirm it matches what the manuscript states.
Open **/data** (footer → "Data & freshness") for the per-dataset record counts.

- [ ] **Gene records** — homepage says "13,000+"; /data "Gene catalog" count. Record the exact number.
- [ ] **Sequenced genomes** — homepage says "17". Confirm on the genome browser / downloads page that 17 assemblies are actually listed (11 species-level + 6 wild isolates).
- [ ] **Stock center** — homepage "28,000+ strains". Confirm the Stock Center actual catalog counts (browsable strains + plasmids) match the manuscript's numbers.
- [ ] **Disease genes** — the manuscript states a count (e.g. 423). Confirm it matches the site's disease-models page / count.
- [ ] **Proteomics** — the proteome viewers state protein counts (e.g. Banu et al. ~4,502; Williams et al. ~8,043). Confirm the viewers actually show those numbers.
- [ ] **GO annotations** — /data shows a GO annotation count. Note it; it should be in the same ballpark as the current GO Consortium dictyBase GAF.
- [ ] Any other count that appears as a specific number in the manuscript — find it on the site and confirm.

## 2. Gene records (the core of the site)

For **each reference gene** (and your random picks), open its record and check:

- [ ] **Symbol + name + DDB_G id** match dictyBase and NCBI Gene.
- [ ] **Genomic location** (chromosome + coordinates) matches NCBI Gene / dictyBase.
- [ ] **Summary text** is present and consistent with dictyBase (spot-check wording; it should not contradict dictyBase).
- [ ] **Curation badge is correct**: if a summary is labeled "dictyBase legacy," confirm that text really comes from dictyBase. If anything is labeled **AI**, confirm it is clearly badged as AI and is *not* presented as curated fact.
- [ ] **GO terms**: pick 3 GO terms shown; look each up in QuickGO and confirm the term id matches the name, and that dictyBase/QuickGO also associates that gene with that term.
- [ ] **Phenotypes** (if any) match the mutant phenotypes dictyBase lists for that gene.
- [ ] **Human ortholog + disease** (genes that have them, e.g. cln5): the human ortholog matches OMA, and the disease matches Orphanet (cln5 → CLN5 → neuronal ceroid lipofuscinosis / Batten).
- [ ] **Cross-reference links** (UniProt, NCBI) open the *correct* entry for that gene, not a different one.
- [ ] **Sequences** — retrieve genomic, cDNA, and protein. Protein sequence should match the UniProt entry (same length, same first/last residues). cDNA should translate to the protein.
- [ ] **Protein structure** (AlphaFold) loads and corresponds to the right UniProt accession.
- [ ] **Domains** (InterPro/Pfam) shown match what InterPro lists for that UniProt accession.

## 3. Search

- [ ] **Gene search**: type each reference symbol; the top hit is the correct gene.
- [ ] Search by **DDB_G id**; returns the same gene.
- [ ] Search by **UniProt accession** and **NCBI Gene id**; resolves to the right gene.
- [ ] **Phenotype search**: pick a phenotype; results are genes that really have it (spot-check 2 against dictyBase).
- [ ] **GO term search**: search a GO term; the genes returned are annotated to it (spot-check count/order against QuickGO for the same term where feasible).
- [ ] **Localization search**: pick a subcellular location; results are plausible.
- [ ] **Advanced gene finder**: apply a filter (e.g. has human ortholog + disease); every result actually meets the filter (spot-check 3).

## 4. BLAST

- [ ] Copy a reference gene's **DNA** sequence, run **blastn** against *D. discoideum AX4*; it hits **itself at ~100% identity**, and the hit links back to the correct gene.
- [ ] Copy a **protein** sequence, run **tblastn**; top hit is the correct gene.
- [ ] Run a cross-species search; results are returned for the other genomes without error.
- [ ] Try a nonsense/very short sequence; the site handles it gracefully (clear message, no crash).

## 5. Genome browser & downloads

- [ ] Genome browser **loads** and lists all sequenced species.
- [ ] Navigate to a reference gene's coordinates; the **gene model** (exons) displays and matches the location on its record page.
- [ ] Downloads page lists **all 17 assemblies**. Download **one FASTA and one GFF**; the file opens, is not empty/corrupt, and the assembly name/species matches NCBI.
- [ ] Assembly identifiers / species names on the downloads page match the source (NCBI / the Ahmed et al. 2025 paper for the wild isolates).

## 6. Stock Center

- [ ] Search a **known strain** (e.g. an AX4-derived knockout you can find in dictyBase); its catalog entry (genotype, description) matches dictyBase's Dicty Stock Center.
- [ ] Browse counts of strains and plasmids match the manuscript numbers.
- [ ] Add an item to the order/cart and confirm the order flow works up to (but not including) actually submitting an order.

## 7. Analysis tools

- [ ] **GO enrichment**: paste a set of genes known to share a process (e.g. several chemotaxis genes); the enriched terms make biological sense (chemotaxis / signaling appear near the top).
- [ ] **Gene-set analysis**: paste a hit list; confirm it returns GO, phenotype, KEGG, ortholog/disease, and an expression-peak profile without error, and the numbers are internally consistent.
- [ ] **Compare expression** (Parikh RNA-seq): plot a developmentally regulated gene (e.g. acaA/pkaC); the profile matches its known developmental pattern.
- [ ] **Proteome viewers** (Banu / Williams): look up a protein; it appears with values across stages.
- [ ] **Lab tools** — generate CRISPR guides and qPCR primers for a reference gene; the guides/primers map to that gene's sequence (spot-check one primer against the sequence).
- [ ] **Codon optimization** — run a short protein; output is valid DNA that back-translates to the input protein.
- [ ] **Sequence tools** — region retrieval and in-silico PCR return the expected region/product for known coordinates/primers.
- [ ] **ID converter** — convert a symbol → DDB_G → UniProt → NCBI and back; the ids are consistent with the gene record.

## 8. API (a quick programmatic spot-check)

- [ ] Open `https://dicty.labs.duke.edu/api/gene/rasG` in the browser; the JSON symbol, name, and GO match the rasG record page.
- [ ] Open `https://dicty.labs.duke.edu/api/search?q=mhcA`; mhcA (DDB_G0286355) is in the results.
- [ ] Open `https://dicty.labs.duke.edu/api/gene-annotations?ddb=DDB_G0275299`; GO annotations are returned for cln5.

## 9. External links & attribution

- [ ] On a gene record, click the **UniProt**, **NCBI**, and any **PubMed** links; each opens the correct external entry.
- [ ] **/data** page lists every data source with a license and a working link (UniProt, NCBI, GO, OMA, Orphanet, InterPro, KEGG, AlphaFold, Parikh, proteomics, Stock Center).
- [ ] **/cite** page loads and shows a citation.
- [ ] Footer credit and license line are present and correct.

## 10. Sanity sweep (catch the weird stuff)

- [ ] Visit ~10 **randomly chosen** genes (pick DDB_G ids at random). None should be blank, broken, or error out.
- [ ] Look for any gene where the **summary contradicts the GO terms / name** (a sign of a mismatched record).
- [ ] Check a **hypothetical/uncharacterized** gene: it should show minimal data gracefully, not an error.
- [ ] Note any page that is slow, throws a browser error, or shows "undefined"/"NaN"/placeholder text.

---

## Recording table (copy into a spreadsheet)

| # | Section | Test | Gene / input | Expected | Result (PASS/FAIL) | Discrepancy & source checked |
|---|---|---|---|---|---|---|
| | | | | | | |

**When done:** give Matt (1) the list of every FAIL with details, (2) the exact
headline numbers you recorded in §1 (so we cite the right figures), and (3) any
"looks off but not clearly wrong" notes. Flag anything where the site and dictyBase
*disagree* — those are the highest priority.
