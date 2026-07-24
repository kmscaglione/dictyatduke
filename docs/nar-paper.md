# dictyBase 2026: a lightweight, sustainable reimplementation of the *Dictyostelium* model organism database

> **NOT THE CANONICAL DRAFT.** The authoritative manuscript is the Word document
> (`dictyBase_v3_<date>_2026.docx`, kept by M. Scaglione); this file is an older,
> diverged snapshot and is **not maintained**. Do not edit it as the current draft —
> its numbers and text may lag the Word version.

**Working manuscript — Nucleic Acids Research (Database Issue) style**

> Framing locked: modern reimplementation of dictyBase (continuity with the established
> resource); title as above; co-authorship to be offered to Rex and Sidd.

Authors: Matthew J. Scaglione¹,\* ; [Siddhartha Basu² and Rex L. Chisholm² — authorship to be offered; names/order to confirm]
Affiliations: ¹Duke University School of Medicine, Durham, NC, USA; ²[dictyBase — affiliation to confirm]
\*To whom correspondence should be addressed.

---

## Abstract

*(~180 words; NAR abstracts are a single paragraph: what the organism is, what the
resource is, what it contains, what is new, availability.)*

*Dictyostelium discoideum* is a premier model organism for the study of chemotaxis,
cell motility, phagocytosis, multicellular development, and an expanding set of
human-disease genes. Its model organism database, dictyBase, has served the research
community for two decades. Here we present a fully reimplemented dictyBase: an openly
documented resource that reproduces and extends the established database on a
deliberately lightweight architecture. The reimplemented resource provides integrated
gene records combining curated summaries, Gene Ontology and phenotype annotations, human
orthologs and disease associations, developmental transcriptomic and proteomic
expression, protein domains and predicted structures; a full complement of analysis
tools including sequence search (BLAST), a multi-genome browser, Gene Ontology,
phenotype and pathway enrichment, expression comparison, and molecular-biology design
utilities; and the complete Dicty Stock Center catalog of 7,079 strains and 1,265
plasmids with an integrated ordering workflow. The entire system runs as a single
self-contained service over static, reproducibly built data drawn from GO, NCBI,
UniProt, InterPro, KEGG and other community sources, allowing a small team to maintain
it at low cost. dictyBase is freely available without registration at [URL].

---

## Introduction

The social amoeba *Dictyostelium discoideum* is a long-established model for cell and
developmental biology. It grows as single cells that consume bacteria by phagocytosis,
and upon starvation aggregates into a multicellular organism that proceeds through a
stereotyped, roughly 24-hour developmental program, making it a uniquely tractable
system for the study of chemotaxis, cell motility, cell–cell signaling, cell-type
differentiation, and morphogenesis [refs]. Its experimental advantages—a compact
haploid genome, efficient homologous recombination and CRISPR-based genome editing, and
inexpensive culture—are increasingly complemented by a role in translational research:
a substantial fraction of its genes have human orthologs, and it serves as a model for
human conditions ranging from the neuronal ceroid lipofuscinoses to disorders of
autophagy, mitochondrial function, and host–pathogen interaction [refs].

For two decades, dictyBase has served as the central model organism database (MOD) for
*D. discoideum* and related dictyostelids (Kreppel et al., 2004; Chisholm et al., 2006;
Fey et al., 2009; Basu et al., 2013). It provides the
community's authoritative gene nomenclature, expert literature curation, Gene Ontology
and phenotype annotations, genome sequences and assemblies, and—through the Dicty Stock
Center—a repository from which strains and plasmids are distributed worldwide. These
resources underpin a large fraction of published *Dictyostelium* research and are relied
upon for gene naming, functional annotation, and reagent access.

Like many model organism databases, dictyBase must sustain a comprehensive,
continuously updated resource against a backdrop of evolving community size and
constrained, uncertain funding (Alliance of Genome Resources Consortium, 2024). Modern MOD infrastructures are
frequently built as distributed, service-oriented systems that, while powerful, require
specialized expertise and continuous engineering effort to operate—an operational burden
that is difficult to sustain for smaller or transitioning communities.

Here we describe a ground-up reimplementation of dictyBase built around a different
principle: to preserve the completeness and authority of the resource while minimizing
the cost and expertise required to run it. The reimplemented dictyBase delivers
integrated gene records, comparative and human-disease data, transcriptomic and
proteomic expression, and a full suite of analysis tools over a single self-contained
service backed by static, reproducibly generated data assets. These assets are rebuilt
from authoritative community sources—the Gene Ontology Consortium, NCBI, UniProt,
InterPro, and KEGG, among others—by a documented set of scripts, and the running system
requires no database server or distributed services. Beyond reproducing dictyBase's
established functionality, this release adds human-ortholog and disease integration,
faceted gene discovery, expanded analysis and molecular-biology design tools, and an
education module for undergraduate teaching. We show that this architecture supports a
content-complete MOD that can be maintained by a small team at modest cost, and we
discuss its implications as a sustainable model for community databases.

## Data content and sources

*(Numbers below reflect the current data build and should be re-verified against the
released assets before submission.)*

**Gene records and nomenclature.** dictyBase provides records for the 13,892
protein-coding and RNA genes of the *D. discoideum* AX4 reference genome, keyed by
stable DDB_G identifiers and the community's approved gene symbols. Each record
integrates a curated free-text summary where available, gene models derived from the
reference annotation, cross-references to NCBI, UniProt, and related resources, and
downloadable genomic, coding, and protein sequences. dictyBase remains the authority
for *Dictyostelium* gene nomenclature.

**Function: Gene Ontology and phenotypes.** Gene Ontology annotations are imported from
the Gene Ontology Consortium's *D. discoideum* release (Gene Ontology Consortium, 2023) and displayed grouped by
aspect (molecular function, biological process, cellular component) with supporting
evidence codes and references. Each annotation carries a provenance badge distinguishing
expert dictyBase curation from electronic inference (UniProt, InterPro, GO_Central), so
users can weight annotations by evidence quality. Curated loss-of-function phenotypes are
provided for 474 genes, each with associated experimental conditions and literature.

**Comparative genomics and human disease.** To support translational use, dictyBase
links *D. discoideum* genes to their human orthologs and, where applicable, to human
disease. Orthology is derived from the OMA browser (Altenhoff et al., 2024) and UniProt, and disease
associations from the Human Phenotype Ontology (Gargano et al., 2024); 2,521 genes
have an assigned human ortholog and 423 are linked to a human disease (for example, the
*cln5* ortholog of human *CLN5*, mutated in neuronal ceroid lipofuscinosis). Within-species
paralog and gene-family relationships are computed on demand by sequence comparison.

**Expression: transcriptomics and proteomics.** Developmental gene-expression profiles
across the aggregation-to-fruiting time course are provided from RNA-seq (Parikh et al.,
2010) and are used both to compute co-expression relationships and to overlay expression
tracks in the genome browser. Two mass-spectrometry proteomic datasets are integrated: a
developmental proteome spanning five life-cycle stages (4,502 proteins; Banu et al., 2026)
and an insoluble/heat-stress proteome (8,043 proteins; Williams et al., 2026).

**Pathways.** Metabolic and signaling pathway memberships are imported from KEGG (Kanehisa
and Goto, 2000), covering 1,927 genes across 131 pathways, and are surfaced both on each gene record
and as a term set for enrichment analysis.

**Protein structure and domains.** Protein records display InterPro domain architectures
(Paysan-Lafosse et al., 2023) as annotated diagrams, embed AlphaFold predicted structures
(Jumper et al., 2021; Varadi et al., 2022) where available, and present curated
post-translational modification annotations.

**Genomes.** dictyBase hosts 17 dictyostelid genome assemblies: 11 species-level genomes
(including the *D. discoideum* AX4 reference and spanning the taxonomic groups of the
social amoebae) together with 6 *D. discoideum* and *D. citrinum* wild isolates. Assemblies
are downloadable as FASTA with GFF3 annotations where available, and are browsable in an
integrated genome browser, supporting comparative, evolutionary, and population-level
analysis.

**The Dicty Stock Center.** The complete Dicty Stock Center catalog is integrated directly
into the resource: 7,079 strains and 1,265 plasmids, synchronized from the dictyBase
collection, each with genotype, phenotype, availability, and depositor information; a
further ~21,500 genome-wide (GWDI) knockout strains are accessible. Users assemble orders
in a cart and submit them through an integrated request workflow.

**A separated machine-generated annotation layer.** Recognizing both the demand for and
the risks of automated annotation, dictyBase includes an explicitly separated,
machine-generated annotation layer covering 1,374 genes. These annotations are visually
badged, individually toggleable, and kept strictly distinct from expert-curated evidence;
they are never merged into the curated record. Every gene symbol and GO identifier in the
layer is validated against the authoritative gene and Gene Ontology sets during
generation, so that no identifier is fabricated.

## Implementation and architecture

**Design overview.** dictyBase is implemented as a single self-contained web service
written against the Python standard library, serving a vanilla-JavaScript single-page
application (Figure 1). The system uses no external database, no message broker, and no distributed
services; it has no build step, and its only runtime dependency for core function is a
Python interpreter. Analyses that require established bioinformatics tools (for example,
BLAST) invoke standard command-line binaries. This design deliberately trades the
horizontal scalability of a service-oriented architecture—unnecessary at the query
volumes of a specialized MOD—for radically lower operational complexity.

**Data as reproducible static builds.** Rather than serving data from a live database,
dictyBase serves pre-computed, versioned data assets in JSON and standard bioinformatics
formats. A documented suite of build scripts regenerates these assets from authoritative
community sources—the Gene Ontology Consortium, NCBI, UniProt, InterPro, KEGG, the OMA
browser, the Human Phenotype Ontology, AlphaFold, and the dictyBase collection—so that
the entire data content of the resource is reproducible from source and its provenance is
explicit. The running service reads these assets directly, compressing text responses on
the fly. Data updates are performed by re-running the relevant build script and
redeploying the assets, decoupling data maintenance from software operation.

**Access and computation.** In addition to the web interface, dictyBase exposes a public
REST API of approximately 40 endpoints providing programmatic access to gene records,
search, sequence retrieval, and each analysis tool. Analyses are computed in-process:
sequence retrieval is performed from the genome assembly and gene models; over-
representation analysis uses a self-contained hypergeometric implementation with
Benjamini–Hochberg control of the false-discovery rate; and molecular-biology utilities
(guide-RNA design with genome-wide off-target screening, primer design, and codon
optimization) are implemented directly against the genome. No user accounts or personal
data are stored, and usage is measured with a cookieless, first-party analytics counter
that records only aggregate, bucketed page categories.

**Operational footprint.** Because the resource requires only a single service and static
assets, it can be hosted on a single modest virtual machine at an annual cost of
approximately US$700, and the bulk of its content can alternatively be served as static
files behind a lightweight dynamic backend. The complete source code and data-build
scripts are openly available (see Availability), enabling independent deployment,
inspection, and reuse. We return to the implications of this footprint for MOD
sustainability in the Discussion.

**AI-assisted software development.** The software described here was written with
substantial assistance from an AI coding assistant (Anthropic's Claude, used through the
Claude Code command-line interface [version to confirm]). The assistant was used to
draft and refactor the service, the single-page application, and the data-build scripts,
under continuous direction and review by the authors. We report this workflow openly
because it is relevant to the central claim of the paper. Assisted development is part of
what allows a small team to build and maintain a content-complete resource, and it lowers
the engineering effort a community must sustain to keep a database running.

We treat generated code as a draft, not as an authority. Every component was read, tested,
and revised by the authors before use. Correctness rests on the same mechanisms that would
apply to any code. The system carries an automated test suite, and all served data are
validated against their authoritative sources during the build; for example, every gene
symbol and Gene Ontology identifier is checked against the reference sets, so no identifier
is fabricated. Because the full source is openly available (see Availability), the
implementation can be audited independently of how it was produced.

This use of a language model is confined to writing software. It is separate from the
machine-generated annotation layer in the data (above), which is a distinct, badged, and
toggleable feature kept apart from curated evidence. It is separate again from the curated
content of the resource. Gene summaries, nomenclature, and expert Gene Ontology and
phenotype annotations are human-authored and are not produced by a language model.

## Web interface and analysis tools

**The gene record.** Each gene is presented as a single record organized into tabbed
sections—summary, Gene Ontology, phenotypes, literature, protein structure,
interactions, orthologs, and post-translational modifications—that consolidate the data
described above with cross-references to external resources. Gene symbols throughout the
site are linked and augmented with hovercards that surface a gene's name, summary, and
key attributes without navigation, and any gene can be cited or added to a personal
workspace (below).

**Search and discovery.** dictyBase offers general full-text search across genes and site
content, together with focused searches by curated phenotype, Gene Ontology term, and
subcellular localization. An advanced gene finder supports faceted filtering of the
entire catalog by combinations of properties—curated phenotype, presence of a human
ortholog, disease association, and developmental expression peak—with export of the
resulting gene set. A keyboard-driven command palette provides rapid navigation to any
gene, page, or tool.

**Analysis tools.** An integrated suite of tools operates on genes and sequences.
Sequence-similarity search is available through BLAST (Camacho et al., 2009); a genome
browser built on IGV.js (Robinson et al., 2023) displays the dictyostelid assemblies
with gene models and developmental RNA-seq tracks. Gene-set analyses include Gene Ontology, phenotype, and KEGG pathway
over-representation testing; multi-gene developmental expression comparison; and
identification of co-expressed genes. For experimental design, dictyBase provides
guide-RNA design with genome-wide off-target screening, quantitative-PCR primer design
with parameters tuned for the organism's AT-rich genome, and codon optimization against
*Dictyostelium* codon usage. On the protein record, domain architectures, cross-species
conservation, and AlphaFold predicted structures are displayed interactively.

**A personal workspace.** Users may collect genes of interest into a per-browser
workspace ("basket") that persists locally without an account. The collected set can be
submitted directly to the enrichment and expression-comparison tools or exported as
tabular data or protein FASTA, providing a simple bridge from browsing to analysis.

**Education.** To support the organism's substantial use in undergraduate teaching,
dictyBase includes an education module comprising an interactive depiction of the life
cycle linked to marker genes, a glossary, a self-assessment quiz, and a set of original,
openly licensed teaching figures, alongside a library of classroom laboratory protocols.

## Curation and community

**Curation model.** dictyBase distinguishes three annotation layers: expert curation
performed by dictyBase; community-contributed annotations submitted for review; and the
separated machine-generated layer described above. Each layer is independently badged and
can be shown or hidden by the user, so that the provenance and evidence basis of every
annotation remain transparent.

**Curation interface.** A web-based curator interface allows authorized curators to add
and edit gene and stock-center records directly. Edits are stored as durable overrides
that are preserved across data rebuilds, so that manual curation is never overwritten when
underlying assets are refreshed from source. Community members may submit gene
annotations, corrections, and datasets through structured forms for curator review.

**Interoperability.** As the *Dictyostelium* MOD, dictyBase both consumes and contributes
to community data resources. Its curated Gene Ontology annotations continue to be
contributed to the Gene Ontology Consortium through the established annotation pipeline
[confirm current mechanism], and its gene nomenclature and records are cross-referenced
with NCBI and UniProt, preserving dictyBase's role within the broader annotation
ecosystem.

## Sustainability and future directions

**A sustainable model for community databases.** The principal claim of this work is
architectural: that a specialized model organism database can be delivered in a form that
is content-complete yet inexpensive and simple to operate. By serving reproducibly built
static assets from a single service, dictyBase removes the standing operational burden of
a database server and distributed microservices, reduces the resource's dependence on any
single engineer, and makes both its software and its data auditable and independently
deployable. For communities whose size or funding cannot support a large engineering
effort—an increasingly common situation among model organism databases—this architecture
offers a route to preserving a comprehensive resource at modest cost. AI-assisted
software development, described above, further reduces the engineering effort required,
and we expect it to become a routine part of how small teams build and maintain such
resources.

**Limitations.** The design makes deliberate trade-offs. It is optimized for a read-mostly
resource at the query volumes typical of a specialized community, and is not intended to
support high-throughput transactional workloads or large, concurrent development teams.
Features that depend on persistent user accounts or complex transactions—such as
large-scale automated order processing—are intentionally minimal, with reagent requests
handled through a lightweight workflow.

**Future directions.** Planned developments include a community beta to gather user
feedback, incorporation of additional data types (for example, spatial and in-situ
expression and allele-level information), expanded mechanisms for community contribution,
and continued synchronization with upstream data sources as they are updated.

## Figures

**Figure 1.** Architecture and data flow of the reimplemented dictyBase. Authoritative
community data sources (Gene Ontology, NCBI, UniProt, InterPro, KEGG, OMA, HPO, AlphaFold
and the dictyBase collection) are transformed by a documented set of build scripts into
versioned static data assets. A single self-contained service delivers these assets to
the web interface, a public REST API, and bulk downloads. No database server or
distributed services are required. (Schematic: `docs/figure1-architecture.svg`.)

**Figure 2.** The dictyBase gene-record interface (gene *cln5* shown, the *Dictyostelium*
ortholog of human *CLN5*, mutated in neuronal ceroid lipofuscinosis / Batten disease).
(A) Global header with search, browse, analysis, and community navigation and the gene
"basket" workspace. (B) Gene identity: approved symbol, product name, curated one-line
summary, functional and disease-model tags (here including "Batten disease"), and a
"dictyBase curated" provenance badge. (C) Embedded AlphaFold predicted
structure. (D) One-click cross-references to external resources (PubMed, AlphaFold, NCBI
Gene, UniProt, VEuPathDB, STRING). (E) Tabbed record sections (Summary, GO, Phenotypes,
Literature, Structures, Interactions, Orthologs, PTMs). (F) The curated summary alongside
a clearly badged, separated machine-generated ("AI") summary. (G) Gene model and
developmental RNA-seq expression displayed inline. (Screenshot: `docs/figure2-interface.png`,
to be captured; callouts overlaid.)

## Availability

dictyBase is freely available at [https://—— (stable URL to confirm)] with no
registration required. Curated gene summaries are released under CC BY-NC 4.0; other
data are redistributed under the terms of their source resources. The complete source
code and data-build scripts are openly available at [repository URL to confirm] under
[an OSI-approved license, to confirm], enabling independent deployment and reuse.

## Funding

[Funding sources and grant numbers to confirm.]

## Acknowledgments

We thank the *Dictyostelium* research community and the curators and developers of
dictyBase, past and present, whose work this resource builds upon. [Complete as
appropriate.]

## Conflict of interest statement

None declared.

## References

*Core references below are verified; database/tool references (marked †) should be
confirmed against the current release version and formatted to NAR numbered style
before submission.*

1. Kreppel L, Fey P, Gaudet P, Just E, Kibbe WA, Chisholm RL, Kimmel AR. dictyBase: a new *Dictyostelium discoideum* genome database. *Nucleic Acids Res.* 2004;32(Database issue):D332–D333.
2. Chisholm RL, Gaudet P, Just E, Pilcher KE, Fey P, Merchant SN, Kibbe WA. dictyBase, the model organism database for *Dictyostelium discoideum*. *Nucleic Acids Res.* 2006;34(Database issue):D423–D427.
3. Fey P, Gaudet P, Curk T, Zupan B, Just EM, Basu S, Merchant SN, Bushmanova YA, Shaulsky G, Kibbe WA, Chisholm RL. dictyBase—a *Dictyostelium* bioinformatics resource update. *Nucleic Acids Res.* 2009;37(Database issue):D515–D519.
4. Basu S, Fey P, Pandit Y, Dodson R, Kibbe WA, Chisholm RL. DictyBase 2013: integrating multiple Dictyostelid species. *Nucleic Acids Res.* 2013;41(Database issue):D676–D683.
5. Parikh A, Miranda ER, Katoh-Kurasawa M, Fuller D, Rot G, Zagar L, Curk T, Sucgang R, Chen R, Zupan B, Loomis WF, Kuspa A, Shaulsky G. Conserved developmental transcriptomes in evolutionarily divergent species. *Genome Biol.* 2010;11(3):R35.
6. Banu S, Anusha PV, Beltran-Alvarez P, Idris MM, Wollenberg Valero KC, Rivero F. The proteome of *Dictyostelium discoideum* across its entire life cycle reveals sharp transitions between developmental stages. *Proteomes.* 2026;14(1):3.
7. Williams FN, Travis K, Guerra-Hernandez Y, Soderblom E, Scaglione KM. Nutrient and heat stress induce changes to the solubility of predicted prion-like proteins in *Dictyostelium discoideum*. *BMC Mol Cell Biol.* 2026;27(1).
8. † Gene Ontology Consortium. The Gene Ontology knowledgebase in 2023. *Genetics.* 2023;224(1):iyad031.
9. † Altenhoff AM, et al. The OMA orthology database. *Nucleic Acids Res.* [year/volume to confirm].
10. † Gargano MA, et al. The Human Phenotype Ontology in 2024. *Nucleic Acids Res.* 2024;52(D1):D1333–D1346.
11. † Kanehisa M, Goto S. KEGG: Kyoto Encyclopedia of Genes and Genomes. *Nucleic Acids Res.* 2000;28(1):27–30.
12. † Paysan-Lafosse T, et al. InterPro in 2022. *Nucleic Acids Res.* 2023;51(D1):D418–D427.
13. † Jumper J, et al. Highly accurate protein structure prediction with AlphaFold. *Nature.* 2021;596:583–589.
14. † Varadi M, et al. AlphaFold Protein Structure Database. *Nucleic Acids Res.* 2022;50(D1):D439–D444.
15. † Robinson JT, Thorvaldsdóttir H, Turner D, Mesirov JP. igv.js: an embeddable JavaScript implementation of the Integrative Genomics Viewer (IGV). *Bioinformatics.* 2023;39(1):btac830.
16. † Camacho C, Coulouris G, Avagyan V, Ma N, Papadopoulos J, Bealer K, Madden TL. BLAST+: architecture and applications. *BMC Bioinformatics.* 2009;10:421.
17. † Alliance of Genome Resources Consortium. Updates to the Alliance of Genome Resources central infrastructure. *Genetics.* 2024;227(1):iyae049.

---

### Manuscript status / to-do
- Confirm author list, order, and affiliations (offer to Rex and Sidd pending).
- Fill Availability (stable URL, license, repository), Funding, Acknowledgments.
- Add general organism-biology review citations at the remaining `[refs]` markers in the Introduction.
- Confirm the current GO-contribution mechanism in Curation (`[confirm current mechanism]`).
- Render Figure 1 from `docs/figure1-architecture.svg`; consider a Figure 2 (annotated interface screenshot).
- Verify database/tool references (†) against current versions; convert citations to NAR numbered style.
- Length check against NAR Database Issue limits; trim if needed.
- AI-assisted development section: confirm the tool/version string to cite, decide whether to name the specific model, and consider whether to move this disclosure to a standalone "Methods"/transparency note if a reviewer prefers it out of Implementation.
