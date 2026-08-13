# How accurate is human biocuration? Published measurements

Reference notes for the NAR manuscript and the grant. Every number below was read from a primary source unless flagged. Unverified items are marked.

## The one-paragraph version

Expert curators reading the same paper pick the same GO term 39% to 47% of the time. They do not even agree on which genes the paper is about roughly 30% of the time. Agreement on whether a paper is worth curating at all is about 77% three ways. The shape is the same in every study: precision is high and stable, between 0.86 and 0.97, while recall is low and wildly variable, between 0.14 and 0.79. Curators rarely record something false. They differ in how much of a paper they write down, and at what level of granularity.

## Curator versus curator, same paper

**Camon et al. 2005**, BMC Bioinformatics 6(Suppl 1):S17, PMID 15960829. The canonical study, self-described as the first inter-annotator agreement study for manual GO curation. Three GOA curators, 30 co-curated papers.

- Exact same GO term: **39%**
- Term from same lineage: 18%
- Term from a different lineage: 43%
- Curator precision: **0.94**. Curator recall: **0.72**

**Van Auken et al. 2014 (BC4GO)**, Database 2014:bau074, PMID 25070993. The cross-MOD replication. 200 full-text articles, 8 curators from FlyBase, MaizeGDB, RGD, TAIR, WormBase.

- GO term selection: **47% F1 strict**, 62.9% hierarchical
- Evidence sentence selection: **9.3% F1 strict**, 42.7% relaxed
- Gene selection: **69%**
- Disagreements were 78.4% missing annotations, 21.6% incorrect. About a quarter of the "incorrect" were only granularity differences.

**Van Auken et al. 2012**, Database 2012:bas040, PMID 23160413. The WormBase, dictyBase and TAIR paper. Two curators worked the same 15 papers against one gold standard.

- Precision **78.3% and 77.8%**
- Recall **37.1% and 14.5%**

This is the closest thing to a dictyBase number that exists. A 2.6-fold spread in recall with near-identical precision.

**CRAFT corpus, Bada et al. 2012**, BMC Bioinformatics 13:161, PMID 22776079. Three PhD-level annotators, 97 full-text articles, F-score on exact class plus exact span.

- NCBI Taxonomy 98.7, Cell Ontology 94.3, GO Cellular Component 92.8, ChEBI 92.5, Sequence Ontology 92.2
- **GO Biological Process and Molecular Function: 72.9** (minimum session 9.7)

Naming an entity is easy. Judging what it does is not.

## Triage agreement

**Wiegers et al. 2009**, BMC Bioinformatics 10:326, PMID 19814812. The best "real MOD workflow" study. Three CTD biocurators, the same 112 MEDLINE articles, normal pace, two of the three unaware they were duplicating.

- Agreement on disposition of the article: **77%** three ways, 85% average pairwise
- Individual "this is curatable" rates on identical input: **51% to 66%**
- Content level against an adjudicated gold standard: precision 0.91, recall 0.71, F1 0.77

**Krallinger et al. 2011**, BMC Bioinformatics 12(Suppl 8):S3, PMID 22151929. Binary curatability, 649 double-annotated articles.

- MINT versus BioGRID: 96% raw, kappa 0.85
- Either database versus a contracted domain expert: 91% to 92%, kappa 0.69

Shared protocol buys a lot. Two curators trained the same way agree far more than two curators trained differently.

## Across databases curating the same publication

**Turinsky et al. 2010**, Database 2010:baq026, PMID 21183497. Largest N in the field: 15,471 shared publications, 27,399 pairwise co-citations, 9 databases.

- Interactions agree: **42%**. Proteins agree: 62%
- Identical interaction sets in 24% of co-citations. **Completely different in 42%**
- After splice-isoform normalization, interaction agreement rises to 54%

**Chatr-aryamontri et al. 2008**, Genome Biol 9(Suppl 2):S5, PMID 18834496. 52 publications curated independently by MINT and IntAct.

- Identical interaction pairs in **6 of 52 papers**
- Identical experimental-method terms in 9 of 52

The same paper records the fix, which is the more useful half. After both adopted the IMEx curation manual, a 2005 re-test on five publications found no differences in either molecule identification or detection method.

## Error rate proper

**Jones, Brown & Baumann 2007**, BMC Bioinformatics 8:170, PMID 17519041. The only published error-rate number for GO curation as such.

- All curated GO sequence annotations: **28% to 30%**
- Non-ISS (experimental and author-statement codes): **13% to 18%**
- ISS (sequence similarity): **49%**

Important caveat: there is no gold standard. This is a model-based extrapolation from injected-error simulations against BLAST-transfer precision. There is no breakdown by individual evidence code and none by GO aspect, despite frequent claims otherwise.

**Škunca, Altenhoff & Dessimoz 2012**, PLoS Comput Biol 8(5):e1002533. Longitudinal, completely different method, similar neighbourhood.

- Electronic (IEA) annotation reliability: 0.52
- **Curated non-experimental annotation reliability: 0.33**, rising to 0.58 excluding RCA

**Keseler et al. 2014**, Database 2014:bau058, PMID 24923819. Does the cited publication actually support the assertion? 633 facts, EcoCyc and CGD.

- **1.58% overall** error rate (EcoCyc 1.40%, CGD 1.82%)
- Method note worth quoting: validators initially reported 8 and 13 errors, and curator rescoring cut both to 5. "Not only do curators make errors while curating but also validators make mistakes while validating."

**Schnoes et al. 2009**, PLoS Comput Biol 5(12):e1000605, PMID 20011109. The counterweight, and the standard citation for manual curation being good.

- UniProtKB/Swiss-Prot manual: **0% or very nearly 0%** misannotation in four of six enzyme superfamilies
- GenBank NR, TrEMBL, KEGG: **5% to 63%**
- NR misannotation rose from roughly 0% for 1993 submissions to about **40% for 2005 submissions**

## The Cusick / Salwinski dispute

Worth citing as a pair. It is the cleanest demonstration that "curation error rate" depends on who defines error.

**Cusick et al. 2009**, Nat Methods 6(1):39-46, PMID 19116613. Re-curation of literature-derived protein interactions.

- Yeast, 100 singly-supported interactions: only **25% substantiated**, 35% incorrectly curated
- Human literature-sampled: **45% not validated**

**Salwinski et al. 2009**, Nat Methods 6(12):860-861, PMID 19935838. The database curators re-curated the same interactions.

- "The actual curation error rate was, in fact, consistently under 10%"
- **2% to 9%** across three species and five databases. Yeast BioGRID: 4 errors in the same 100 interactions, against Cusick's 35

## Community and author curation

**Berardini et al. 2012 (TAIR)**, Database 2012:bas030, PMID 22859749. 503 community-submitted annotations re-assessed by TAIR curators.

- **97.2%** experimentally supported, 93% at appropriate specificity
- But completeness only **72%** of all possible annotations, per-article range 3% to 96%

**Bunt et al. 2012 (FlyBase Fast-Track Your Paper)**, Database 2012:bas024, PMID 22554788. 748 papers author-triaged then fully curated.

- Authors triaged completely accurately in **59.9%** of cases
- Curators removed incorrect gene associations from only **4.1%**

**Arnaboldi et al. 2020 (WormBase ACKnowledge)**, Database 2020:baaa006, PMID 32185395. The only MOD to publish author-versus-curator accuracy tables.

- Anatomic expression 0.87 / 0.87 / 0.72 (accuracy / precision / recall)
- Genetic interactions 0.76 / 0.83 / **0.48**
- Author gene lists: 61.8% precision, 82.3% recall against a curator's list

**PomBase, Lock et al. 2020**, Database 2020:baaa028, PMID 32353878. The most-cited claim that author curation matches professional curation, and it carries **no percentage**. The paper says changes to submitted curation are rare and that there is "no qualitative difference in accuracy between authors and professional curators." It also notes professional curators made errors that community members caught. PomBase 2026 (Genetics 232(4):iyag001) still gives no accuracy figure, only that 26.9% of curated publications went through community curation and session acceptance is 57.2%.

## Machine versus human, recent

**Raciti et al. 2025 (WormBase)**, Database 2025:baaf063, PMID 41026497. Reports curator agreement and model F1 on the same tasks, which almost nobody does.

- Two curators, Jaccard agreement: **90% / 82% / 88%** across three sentence-classification tasks
- GPT-4o F1: gene expression **0.925 / 0.942 / 0.957**; protein kinase 0.894 / 0.924 / 0.980

On the middle task the model exceeds curator-curator agreement.

**Balhoff & Lapp 2026**, arXiv:2605.28965. EQ phenotype annotation, 344 character states, gold standard from three named human curators (Dahdul et al. 2018).

- All five frontier agents fell **inside the human inter-curator range** on nearly every metric
- Three Claude models exceeded two of the three named human curators on SimJ, partial precision and partial recall
- Point estimates are figure-only. There is no numeric table.

**Dahdul et al. 2018**, Database 2018:bay110, PMID 30576485. The underlying human ceiling.

- Curators reached on average **54% of maximum possible consistency** by Jaccard, 80% by information content
- Only 26% of character-state comparisons were exact matches

**BioCreative V CDR, Wei et al. 2016**, Database 2016:baw032. The most quotable ceiling sentence in the field.

- Inter-annotator agreement: chemicals 96.05%, **diseases 87.49%**
- Best disease NER system F 86.46%, explicitly described as approaching the 0.8875 human agreement

**GOFlowLLM, Green et al. 2025**, bioRxiv 2025.10.07.680945. The most useful single result for the "gold standards go stale" argument.

- Against **historical** GO annotations (110 papers, pre-2022 guidelines): reproduces the manual annotation **30%** of the time
- On re-curation under current guidelines, the same output is judged correct **90%** of the time
- On novel literature: 86.7% correct annotations, 95% correct targets

A 2015 gold standard scores a good 2025 system at 30%. That gap is guideline drift, not model failure.

## Gaps worth naming in a paper

1. No MOD has published a two-curator agreement number for its own workflow other than BC4GO's 10-paper blind re-annotation and Camon's 30-paper study from 2005. Both are small and old.
2. SGD, RGD, ZFIN and dictyBase have published no inter-curator agreement measurement at all. RGD and SGD both describe running consistency exercises without publishing results, which makes them good citations for "MODs run these exercises but do not publish the numbers."
3. PomBase's author-equivalence claim has never been quantified.
4. No published study quantifies how many annotations in GO, UniProt or a MOD trace to a retracted or corrected paper. This is an open measurement, not a citable one.
5. BioRED reconciles annotators to 100% consensus and publishes no agreement figure, which structurally erases the signal.
6. **Tang et al. 2019**, "Ten quick tips for biocuration," PLoS Comput Biol 15(5):e1006906, sets the field's normative target: measure inter-curator consistency and evolve guidelines until it reaches 90% to 95%. That target is asserted with no supporting citation, and nearly every measured number above falls short of it.

## Citation corrections

Three errors circulate in secondary literature. Do not repeat them.

- **Buza et al. 2008** is *Nucleic Acids Research* 36(2):e12, not Briefings in Bioinformatics, and it measures annotation coverage, depth and evidence-code composition via a GAQ score. **It is not an error-rate paper.**
- **MacMullen** is routinely cited for a GO agreement measurement. There is no such measurement. His own slides present Camon et al. 2005. The number attributed to him is Camon's 39%.
- The sequence-checking tool is **Seek & Blastn**, not Seqcheck.
- The "GENIA event corpus, kappa 0.84 to 0.93" figure belongs to Thompson et al. 2011, a separate meta-knowledge layer. Kim et al. 2008 reports no agreement number at all.

## Literature-origin errors, for the section on why curation is hard

- **Park et al. 2022**, Life Sci Alliance 5(4):e202101203: 712 articles across 78 journals with a wrongly identified nucleotide sequence. 17% of papers in *Gene*, 26% in *Oncology Reports*.
- **Abeysooriya et al. 2021**, PLoS Comput Biol 17(7):e1008984: **30.9%** of genomics papers with supplementary gene lists contain Excel-autocorrupted gene names, stable across 2014 to 2020.
- **Vasilevsky et al. 2013**, PeerJ 1:e148: only **54%** of research resources in 238 manuscripts were uniquely identifiable. Antibodies 44%, cell lines 43%, constructs 25%.
- **Horbach & Halffman 2017**, PLoS ONE 12(10):e0186281: 32,755 primary articles used misidentified cell lines, cited by roughly half a million secondary articles.
- **Mogull 2017**, PLoS ONE 12(9):e0184727: recalculated quotation error rate of **14.5%** of assertions. Even reading a paper and stating what it says fails at a double-digit rate.
