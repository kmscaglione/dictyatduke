const genes = [
  {
    id: "CLN5",
    symbol: "cln5",
    name: "Ceroid-lipofuscinosis neuronal protein 5 homolog",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007088.5: 1,696,443-1,697,768",
    summary: "Dictyostelium CLN5 homolog connected to lysosome biology, protein trafficking, autophagy, and disease-model literature.",
    aliases: ["CLN5_DICDI", "DDB_G0275299", "8619889", "Q553W9"],
    tags: ["lysosome", "protein trafficking", "autophagy", "Batten disease"],
    ncbiGene: "8619889",
    uniprot: "Q553W9",
    veupath: "DDB_G0275299",
    go: [
      ["lysosome", "UniProt keyword"],
      ["protein transport", "UniProt annotation"],
      ["autophagy-linked phenotype", "PubMed curated"]
    ],
    phenotypes: [
      ["growth", "altered growth under cln5-deficient conditions"],
      ["development", "multicellular development defects reported in knockout model"],
      ["trafficking", "altered intracellular degradation and protein trafficking"]
    ],
    literature: [
      ["42031177", "CLN5 disease-causing mutations impact lysosomal biology by affecting intracellular degradation and protein trafficking.", "Biochim Biophys Acta Mol Basis Dis · 2026"],
      ["38272448", "Mechanisms regulating the intracellular trafficking and release of CLN5 and CTSD.", "Traffic · 2024"],
      ["34291044", "Aberrant Autophagy Impacts Growth and Multicellular Development in a Dictyostelium Knockout Model of CLN5 Disease.", "Front Cell Dev Biol · 2021"],
      ["36437924", "An altered transcriptome underlies cln5-deficiency phenotypes in Dictyostelium discoideum.", "Front Genet · 2022"],
      ["32087303", "Mfsd8 localizes to endocytic compartments and influences the secretion of Cln5 and cathepsin D in Dictyostelium.", "Cell Signal · 2020"]
    ],
    structures: [["AlphaFold", "Q553W9", "Predicted protein structure"]]
  },
  {
    id: "acaA",
    symbol: "acaA",
    name: "adenylate cyclase",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007087.5: 1,217,455-1,223,835",
    summary: "Adenylyl cyclase A is a central cAMP signaling gene involved in aggregation, chemotaxis, and developmental signaling.",
    aliases: ["DDB_G0281545", "8623247", "Q03100", "ACA"],
    tags: ["cAMP signaling", "aggregation", "chemotaxis"],
    ncbiGene: "8623247",
    uniprot: "Q03100",
    veupath: "DDB_G0281545",
    go: [["adenylate cyclase activity", "UniProt"], ["cAMP biosynthetic process", "curated"], ["aggregation", "phenotype-linked"]],
    phenotypes: [["aggregation", "aggregation defects when signaling is disrupted"], ["chemotaxis", "altered cAMP relay and movement"]],
    literature: [
      ["36261860", "Adenylate cyclase A amplification and functional diversification during Polyspondylium pallidum development.", "EvoDevo · 2022"],
      ["31016257", "Sir2D regulates adenylate cyclase A expression early in Dictyostelium development upon starvation.", "Heliyon · 2019"],
      ["29618632", "Adenylyl cyclase A mRNA localized at the back of cells is actively translated in live chemotaxing Dictyostelium.", "J Cell Sci · 2018"],
      ["28057864", "Adenylate cyclase A acting on PKA mediates induction of stalk formation by cyclic diguanylate.", "PNAS · 2017"],
      ["26840347", "Biological Activity of the Alternative Promoters of the Dictyostelium discoideum Adenylyl Cyclase A Gene.", "PLoS One · 2016"]
    ],
    structures: [["AlphaFold", "Q03100", "Predicted protein structure"]]
  },
  {
    id: "myosin II",
    symbol: "mhcA",
    name: "myosin II heavy chain",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007087.5: 3,570,725-3,577,322",
    summary: "Myosin II heavy chain is connected to cytokinesis, cortical contractility, cell mechanics, and multicellular morphogenesis.",
    aliases: ["mhcA", "DDB_G0286355", "8625606", "P08799"],
    tags: ["cytokinesis", "contractility", "cell mechanics"],
    ncbiGene: "8625606",
    uniprot: "P08799",
    veupath: "DDB_G0286355",
    go: [["motor activity", "UniProt"], ["actin binding", "UniProt"], ["cytokinesis", "curated"]],
    phenotypes: [["cytokinesis", "contractility and division phenotypes"], ["motility", "altered movement and mechanics"]],
    literature: [
      ["41437214", "Actomyosin dynamics in detached cells: linking clutch model to cell migration and cytokinesis.", "BMC Mol Cell Biol · 2025"],
      ["41332277", "The RNA-binding protein RNP1A is essential and interacts with contractility kit proteins to facilitate cell mechanics.", "J Cell Sci · 2026"]
    ],
    structures: [["AlphaFold", "P08799", "Predicted protein structure"]]
  },
  {
    id: "carA",
    symbol: "carA",
    name: "cAMP receptor 1",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007088.5: curated locus",
    summary: "cAR1 is a cAMP receptor involved in chemotaxis, signaling relay, and aggregation-stage responses.",
    aliases: ["cAR1", "DDB_G0273533", "8619010", "P13773"],
    tags: ["GPCR", "chemotaxis", "cAMP receptor"],
    ncbiGene: "8619010",
    uniprot: "P13773",
    veupath: "DDB_G0273533",
    go: [["G protein-coupled receptor activity", "UniProt"], ["chemotaxis", "curated"]],
    phenotypes: [["chemotaxis", "cAMP sensing defects"], ["development", "aggregation-stage signaling defects"]],
    literature: [],
    structures: [["AlphaFold", "P13773", "Predicted protein structure"]]
  },
  {
    id: "rasG",
    symbol: "rasG",
    name: "Ras protein G",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007089.5: curated locus",
    summary: "RasG is a small GTPase connected to chemotaxis, macropinocytosis, and signaling dynamics.",
    aliases: ["DDB_G0293434", "8629223", "P15064"],
    tags: ["Ras", "chemotaxis", "macropinocytosis"],
    ncbiGene: "8629223",
    uniprot: "P15064",
    veupath: "DDB_G0293434",
    go: [["GTP binding", "UniProt"], ["signal transduction", "curated"]],
    phenotypes: [["chemotaxis", "migration and polarity phenotypes"], ["uptake", "macropinocytosis-linked phenotypes"]],
    literature: [],
    structures: [["AlphaFold", "P15064", "Predicted protein structure"]]
  },
  {
    id: "pkaC",
    symbol: "pkaC",
    name: "protein kinase A catalytic subunit",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007087.5: curated locus",
    summary: "PKA catalytic subunit is a central developmental regulator connected to cAMP signaling, differentiation, and multicellular development.",
    aliases: ["DDB_G0283907", "8624359", "P34099", "PKA-C"],
    tags: ["protein kinase", "cAMP signaling", "development"],
    ncbiGene: "8624359",
    uniprot: "P34099",
    veupath: "DDB_G0283907",
    go: [["protein kinase activity", "UniProt"], ["cAMP-mediated signaling", "curated"], ["multicellular organism development", "curated"]],
    phenotypes: [["development", "PKA signaling is linked to developmental transitions"], ["differentiation", "cell-type and maturation phenotypes"]],
    literature: [],
    structures: [["AlphaFold", "P34099", "Predicted protein structure"]]
  },
  {
    id: "gbpC",
    symbol: "gbpC",
    name: "cyclic GMP-binding protein C",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007091.3: 4,959,990-4,968,053",
    summary: "NCBI Gene and UniProt seed for a cGMP-binding protein connected to chemotaxis and myosin regulation.",
    aliases: ["DDB_G0291079", "8627976", "Q8MVR1", "RasGEF domain-containing protein T"],
    tags: ["cGMP", "chemotaxis", "myosin regulation"],
    ncbiGene: "8627976",
    uniprot: "Q8MVR1",
    veupath: "DDB_G0291079",
    go: [["protein kinase activity", "UniProt"], ["chemotaxis", "curated"], ["myosin regulation", "curated"]],
    phenotypes: [["chemotaxis", "linked to signal relay and movement"], ["contractility", "connected to myosin regulation"]],
    literature: [],
    structures: [["AlphaFold", "Q8MVR1", "Predicted protein structure"]]
  },
  {
    id: "sadA",
    symbol: "sadA",
    name: "substrate adhesion molecule",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007091.3: 1,641,836-1,638,799",
    summary: "NCBI Gene and UniProt seed for a substrate-adhesion molecule involved in cell-substrate adhesion and migration.",
    aliases: ["DDB_G0288511", "8626671", "Q8I7T3"],
    tags: ["adhesion", "migration", "cell-substrate"],
    ncbiGene: "8626671",
    uniprot: "Q8I7T3",
    veupath: "DDB_G0288511",
    go: [["cell adhesion", "UniProt"], ["cell migration", "curated"]],
    phenotypes: [["adhesion", "cell-substrate attachment phenotypes"], ["migration", "movement phenotypes"]],
    literature: [],
    structures: [["AlphaFold", "Q8I7T3", "Predicted protein structure"]]
  },
  {
    id: "tgrB1",
    symbol: "tgrB1",
    name: "Tiger protein B1",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007089.4: 3,633,929-3,636,845",
    summary: "NCBI Gene and UniProt seed for a transmembrane TIG/IPT repeat protein involved in self-recognition and development.",
    aliases: ["DDB_G0280689", "8622683", "Q54V07"],
    tags: ["self recognition", "development", "cell adhesion"],
    ncbiGene: "8622683",
    uniprot: "Q54V07",
    veupath: "DDB_G0280689",
    go: [["cell adhesion", "UniProt"], ["multicellular development", "curated"]],
    phenotypes: [["development", "self-recognition and multicellular development context"], ["adhesion", "cell-cell recognition context"]],
    literature: [],
    structures: [["AlphaFold", "Q54V07", "Predicted protein structure"]]
  },
  {
    id: "tgrC1",
    symbol: "tgrC1",
    name: "Tiger protein C1",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007089.4: 3,633,405-3,630,671",
    summary: "NCBI Gene and UniProt seed for a transmembrane TIG/IPT repeat protein paired with tgrB1 in self-recognition biology.",
    aliases: ["DDB_G0280531", "8622682", "P42523"],
    tags: ["self recognition", "development", "cell adhesion"],
    ncbiGene: "8622682",
    uniprot: "P42523",
    veupath: "DDB_G0280531",
    go: [["cell adhesion", "UniProt"], ["multicellular development", "curated"]],
    phenotypes: [["development", "self-recognition and multicellular development context"], ["adhesion", "cell-cell recognition context"]],
    literature: [],
    structures: [["AlphaFold", "P42523", "Predicted protein structure"]]
  },
  {
    id: "pdsA",
    symbol: "pdsA",
    name: "cAMP phosphodiesterase",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007090.3: 3,931,285-3,929,774",
    summary: "NCBI Gene and UniProt seed for a cyclic nucleotide phosphodiesterase connected to cAMP signaling and aggregation.",
    aliases: ["DDB_G0285995", "8625393", "P12019", "PDEase A"],
    tags: ["phosphodiesterase", "cAMP signaling", "aggregation"],
    ncbiGene: "8625393",
    uniprot: "P12019",
    veupath: "DDB_G0285995",
    go: [["3',5'-cyclic-nucleotide phosphodiesterase activity", "UniProt"], ["cAMP signaling", "curated"]],
    phenotypes: [["aggregation", "linked to extracellular cAMP signaling"], ["development", "cyclic nucleotide signaling context"]],
    literature: [],
    structures: [["AlphaFold", "P12019", "Predicted protein structure"]]
  },
  {
    id: "csaA",
    symbol: "csaA",
    name: "contact site A protein",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007091.3: 2,344,338-2,342,794",
    summary: "NCBI Gene and UniProt seed for a cell adhesion molecule also known as contact site A protein or gp80.",
    aliases: ["DDB_G0289073", "8626958", "P08796", "gp80"],
    tags: ["cell adhesion", "aggregation", "surface protein"],
    ncbiGene: "8626958",
    uniprot: "P08796",
    veupath: "DDB_G0289073",
    go: [["cell adhesion", "UniProt"], ["aggregation", "curated"]],
    phenotypes: [["adhesion", "contact-site and aggregation-stage phenotypes"], ["development", "aggregation-stage cell surface context"]],
    literature: [],
    structures: [["AlphaFold", "P08796", "Predicted protein structure"]]
  },
  {
    id: "regA",
    symbol: "regA",
    name: "cAMP phosphodiesterase RegA",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007090.3: 1,959,734-1,956,974",
    summary: "NCBI Gene and UniProt seed for a response-regulator phosphodiesterase connected to cAMP signaling and development.",
    aliases: ["DDB_G0284331", "8624583", "Q23917", "PDEase regA"],
    tags: ["phosphodiesterase", "development", "response regulator"],
    ncbiGene: "8624583",
    uniprot: "Q23917",
    veupath: "DDB_G0284331",
    go: [["3',5'-cyclic-nucleotide phosphodiesterase activity", "UniProt"], ["development", "curated"]],
    phenotypes: [["development", "developmental timing and signaling context"], ["signaling", "cAMP regulation context"]],
    literature: [],
    structures: [["AlphaFold", "Q23917", "Predicted protein structure"]]
  },
  {
    id: "act15",
    symbol: "act15",
    name: "major actin",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007088.5: 1,781,190-1,782,320",
    summary: "NCBI Gene and UniProt seed for a major actin connected to cytoskeletal structure and motility.",
    aliases: ["DDB_G0272520", "8618493", "P07830", "actin-15"],
    tags: ["actin", "cytoskeleton", "motility"],
    ncbiGene: "8618493",
    uniprot: "P07830",
    veupath: "DDB_G0272520",
    go: [["actin binding", "UniProt"], ["cytoskeleton organization", "curated"]],
    phenotypes: [["motility", "cytoskeletal movement context"], ["morphology", "actin organization context"]],
    literature: [],
    structures: [["AlphaFold", "P07830", "Predicted protein structure"]]
  },
  {
    id: "ecmA",
    symbol: "ecmA",
    name: "extracellular matrix protein A",
    organism: "Dictyostelium discoideum AX4",
    location: "NC_007089.4: 558,487-563,917",
    summary: "NCBI Gene and UniProt seed for extracellular matrix protein A, a development and prestalk marker.",
    aliases: ["DDB_G0277853", "8621449", "Q54YG2", "ST430"],
    tags: ["extracellular matrix", "development", "prestalk"],
    ncbiGene: "8621449",
    uniprot: "Q54YG2",
    veupath: "DDB_G0277853",
    go: [["extracellular matrix organization", "UniProt"], ["development", "curated"]],
    phenotypes: [["development", "prestalk and extracellular matrix context"], ["differentiation", "cell-type marker context"]],
    literature: [],
    structures: [["AlphaFold", "Q54YG2", "Predicted protein structure"]]
  }
];

const state = {
  activeGene: null,
  activeTab: "Summary",
  activeResearch: "techniques"
};

const pubMedCache = new Map();

const researchResources = [
  {
    id: "techniques",
    label: "Techniques",
    dek: "Common Dictyostelium methods, protocols, assays, and preparations from the dictyBase techniques collection.",
    paragraphs: [
      "Browse technique resources by category. Links open the original protocol or reference page."
    ],
    sourceUrl: "https://dictybase.dev/research/techniques/show",
    linkSections: [
      {
        title: "Media and buffers",
        links: [
          ["Media and Buffers", "https://dictybase.dev/research/techniques/media/"],
          ["Recipe for FM defined medium", "https://dictybase.dev/research/techniques/fm-medium/"],
          ["Recipe for low fluorescence axenic medium", "https://dictybase.dev/research/techniques/low-flo-medium"],
          ["Recipe for synthetic medium", "https://github.com/dictyBase/migration-data/files/3220576/synthetic_medium.pdf"]
        ]
      },
      {
        title: "Growth and development of Dictyostelium",
        links: [
          ["Methods for growing Dictyostelium", "https://dictybase.dev/research/techniques/growth"],
          ["Methods for Dictyostelium development", "https://dictybase.dev/research/techniques/development"],
          ["Dictyostelium cell storage procedures", "https://dictybase.dev/research/techniques/dicty-storage/"],
          ["Plating Dictyostelium in soft agar", "https://dictybase.dev/research/techniques/soft-agar"],
          ["Thawing cells from DMSO stocks", "https://github.com/dictyBase/migration-data/files/5922084/Thawing.cells.from.DMSO.stocks.docx"]
        ]
      },
      {
        title: "Sexual genetics",
        links: [
          ["Methods for parasexual genetics", "https://dictybase.dev/research/techniques/parasexual-genetics"],
          ["Method for determining mating types", "https://dictybase.dev/research/techniques/mating-types"]
        ]
      },
      {
        title: "Molecular biology",
        links: [
          ["Quick extraction of genomic DNA", "https://dictybase.dev/research/techniques/quick-genomic-dna-extraction"],
          ["Isolation of genomic DNA", "https://dictybase.dev/research/techniques/genomic-dna-extraction"],
          ["Isolation of genomic DNA with CsCl", "https://dictybase.dev/research/techniques/genomic-dna-extraction-csci"],
          ["RT-PCR for Knockout Screening and Expression Analysis", "https://dictybase.dev/research/techniques/rt-pcr"]
        ]
      },
      {
        title: "Transformation",
        links: [
          ["Transformation protocols", "https://dictybase.dev/research/techniques/transformation-protocols"],
          ["Gaudet et al. 2007", "https://dictybase.dev/publication/17545968"],
          ["Calcium phosphate precipitation", "https://dictybase.dev/research/techniques/calcium-phosphate-precipitation"],
          ["Electroporation", "https://dictybase.dev/research/techniques/electroporation"],
          ["Transformation of NC4 or D. mucoroides", "https://dictybase.dev/research/techniques/transformation-nc4"],
          ["Microinjection", "https://dictybase.dev/research/techniques/microinjection"],
          ["Transformation by particle gun", "https://dictybase.dev/research/techniques/transformgun"],
          ["Addition of heat-killed bacteria to transformants", "https://dictybase.dev/research/techniques/addheatkilledbac"],
          ["Transformant selection on bacterial lawns using the V18-Tn5-cassette", "https://dictybase.dev/research/techniques/transformantselectv8tn5cassette"],
          ["DAPI Electroporation", "https://dictybase.dev/research/techniques/dapi-electroporation"]
        ]
      },
      {
        title: "Mutagenesis",
        links: [
          ["Restriction-enzyme mediated insertional mutagenesis (REMI)", "https://dictybase.dev/research/techniques/remi-mutagenesis"],
          ["RNAi procedure", "https://dictybase.dev/research/techniques/rnai-procedure"]
        ]
      },
      {
        title: "Gene expression",
        links: [
          ["Chromatin Immuno-precipitation", "https://dictybase.dev/research/techniques/genexp"],
          ["Whole mount in situ hybridization", "https://dictybase.dev/research/techniques/wmish"],
          ["Agar overlay technique", "https://dictybase.dev/research/techniques/agovlay"],
          ["Indirect immunofluorescence", "https://dictybase.dev/research/techniques/indimmun"]
        ]
      },
      {
        title: "Microscopy",
        links: [
          ["Fixation techniques for immunofluorescence", "https://dictybase.dev/research/techniques/fixtech"],
          ["Visualizing weak fluorescence in multicellular stages", "https://dictybase.dev/research/techniques/weakfluor"]
        ]
      },
      {
        title: "Biochemistry",
        links: [
          ["35S-methionine labelling of Dictyostelium", "https://dictybase.dev/research/techniques/slabel"],
          ["32phosphate labelling of Dictyostelium", "https://dictybase.dev/research/techniques/phoslabel"]
        ]
      },
      {
        title: "Cytoskeleton protein preparation",
        links: [
          ["Isolation of Dictyostelium cytoskeleton", "https://dictybase.dev/research/techniques/cytoisol"],
          ["Isolation of Dictyostelium centrosomes", "https://dictybase.dev/research/techniques/centroiso"],
          ["Preparation of microtubule-associated motor proteins", "https://dictybase.dev/research/techniques/prepmitomamp"],
          ["Purification of muscle actin", "https://dictybase.dev/research/techniques/purmusact"],
          ["One-day Dictyostelium myosin preparation", "https://dictybase.dev/research/techniques/myoprepone"],
          ["Three-day Dictyostelium myosin preparation", "https://dictybase.dev/research/techniques/myoprepthree"]
        ]
      },
      {
        title: "Protein assays",
        links: [
          ["Microtubule gliding assay for microtubule-associated motors", "https://dictybase.dev/research/techniques/micrbindassay"],
          ["ATPase assay for dynein (radioactive)", "https://dictybase.dev/research/techniques/atpdyneinassay"],
          ["CTPase assay for dynein (colorimetric)", "https://dictybase.dev/research/techniques/ctpdyneinassay"],
          ["in vitro motility assay", "https://dictybase.dev/research/techniques/invitmot"],
          ["ATPase assay for Dictyostelium myosin", "https://dictybase.dev/research/techniques/atpasemyoassay"],
          ["Estimation of the number of active myosin heads in isolated myosin", "https://dictybase.dev/research/techniques/activemyohead"],
          ["Myosin-F-actin binding by pelleting assay", "https://dictybase.dev/research/techniques/myofactinpelletassay"],
          ["Dictyostelium anti-gamma-tubulin Westerns", "https://dictybase.dev/research/techniques/gtubwest"],
          ["Dictyostelium cell staining for tubulin", "https://dictybase.dev/research/techniques/tubulstain"]
        ]
      }
    ]
  },
  {
    id: "nomenclature-guidelines",
    label: "Nomenclature guidelines",
    dek: "A uniform nomenclature is essential for compiling Dictyostelium gene, protein, allele, strain, phenotype, genotype, plasmid, construct, and chromosome information.",
    paragraphs: [
      "Dictyostelium discoideum AX4 has a genome of approximately 34 Mb, containing approximately 12,500 genes. Thousands of mutant strains have been obtained, many of which are available from the Dicty Stock Center.",
      "Researchers are encouraged to conform to these guidelines when naming Dictyostelium genes, proteins, mutant alleles, strains, phenotypes, genotypes, plasmids, molecular genetic constructs, and chromosomes.",
      "Questions and comments should be addressed to matt.scaglione@duke.edu."
    ],
    sections: [
      {
        title: "Gene nomenclature",
        definition: "Dictyostelium gene names should use lower-case italicized letters, followed when necessary by a capital italicized letter or a number to distinguish genes sharing a prefix.",
        terms: [
          ["Avoid uninformative prefixes", "", "The use of D, d, or Dd for Dictyostelium, and g or p for gene and protein, is strongly discouraged."],
          ["Established family nomenclature", "", "Established nomenclature for gene families has precedence. Examples include abcA1, abcA2, abcB1, atg1, and atg4."],
          ["1:1 human orthologs", "", "One-to-one human orthologs are named using the established human name, for example eif3f, nmd3, and dgat1."],
          ["Many-to-one homologs", "", "If Dictyostelium has one gene similar to a group of human genes, the Dictyostelium gene is named by dropping numbers or letters that distinguish group members. For example, PCBD1 and PCBD2 correspond to pcbd."],
          ["One-to-many homologs", "", "If Dictyostelium has an expanded gene group compared with organisms that have established nomenclature, additional letters or numbers may distinguish members, for example cyb5A-C."],
          ["Many-to-many homologs", "", "Letter and number suffixes can be mixed when some family members are orthologs and others are Dictyostelium-specific paralogs, for example rab21, rab7A, rab7B, and rabH."],
          ["Human-name exceptions", "", "Human names are discouraged when they do not make sense for Dictyostelium, such as OPA3 or TEX2."],
          ["No appropriate name", "", "If no appropriate name can be identified, leave the DDB_G identifier as the gene name for the time being."],
          ["New gene names", "", "New names, especially for non-conserved genes, should use a three-letter lower-case locus descriptor followed by a capital letter when needed, such as rdeA, rdeB, rdeC or tagA, tagB, tagC."],
          ["Large gene families", "", "For gene families with more than 26 members, numbers are encouraged rather than letters."],
          ["Existing names", "", "Existing gene names remain unchanged. Examples include act15, mhcA, and pyr5-6."],
          ["Name changes", "", "Original naming authors can change a gene name by describing the change in the next publication containing the gene and informing dictyBase."],
          ["Synonyms", "", "All names found in the literature remain in dictyBase as synonyms. For example, pkaC has the synonyms PKA, pkacat, DdPK3, DdPK2, and PKA-C."]
        ]
      },
      {
        title: "Protein nomenclature",
        definition: "A protein may be named after the gene encoding it by capitalizing the first letter and using non-italic text.",
        terms: [
          ["Gene-based protein names", "", "Examples include RegA, encoded by regA, and RegA(D212A), encoded by regA(D212A)."],
          ["Full names and synonyms", "", "Proteins can also be referred to by full names or protein synonyms, such as actin, ribonucleotide reductase small subunit, RNR, protein kinase C, or PKC."],
          ["Physical-property names", "", "Names based on physical properties are discouraged because many proteins can share the same attribute. Examples include p34, 34kDa protein, actin-binding protein, and calcium-binding protein."]
        ]
      },
      {
        title: "Mutant allele nomenclature",
        definition: "Allele names should be italicized and placed in parentheses directly after the gene name, without a space.",
        terms: [
          ["Insertion alleles", "", "Examples include yakA(AK235) and yakA(AK800), representing different insertion mutations in the yakA gene."],
          ["Unknown mutation", "", "When the nature of the mutation is not known, or only a single allele is relevant, a superscript minus sign can be used for brevity, for example regA-."],
          ["General allele superscripts", "", "Superscripts such as ts, cs, hc, or dn may describe temperature-sensitive, cold-sensitive, high-copy, or dominant-negative alleles, but should be limited to two or three letters."],
          ["Amino acid substitutions", "", "Amino acid substitutions should use the old residue in single-letter code, its codon location, and the new residue. For example, regA(D212A) has alanine in place of aspartate at position 212."],
          ["Reference sequence", "", "AX4 is the reference strain for the wild-type amino acid sequence within proteins because it was the first strain sequenced."]
        ]
      },
      {
        title: "Strain nomenclature",
        definition: "Strains are annotated with both a Systematic Strain Name and a Strain Descriptor.",
        terms: [
          ["Systematic strain name", "", "Strains must have an unambiguous name consisting of two or three capital letters plus a unique serial number, such as HM1 or HTY217."],
          ["Prefix assignment", "", "Labs or workers should consistently use the same capital prefix or small group of prefixes. Prefixes are assigned by a clearinghouse upon request."],
          ["dictyBase-assigned strain names", "", "When no systematic name is provided, dictyBase assigns a systematic strain name consisting of DBS followed by seven digits."],
          ["Strain descriptor", "", "The descriptor provides a quick overview of key genetic modifications, including gene name, promoter, mutations, tags, and reporter genes."],
          ["Descriptor format", "", "The format is gene-/[promoter]:gene(substitution or truncation):marker."],
          ["Descriptor symbols", "", "A minus sign marks an endogenous mutant allele, slash marks a compound mutant, brackets mark promoter gene, parentheses indicate substitutions or truncations, and colon marks a fusion between two genes."],
          ["Additional annotations", "", "Bracketed annotations include [unk], [OE], [KD], [AS], [RNAi], and [inviable]."],
          ["Strain ID", "", "All strains curated by dictyBase have a stable DBS strain ID that does not change."]
        ]
      },
      {
        title: "Phenotypes and genotypes",
        definition: "dictyBase uses controlled vocabularies for phenotype annotations and formal conventions for strain genotypes.",
        terms: [
          ["Phenotype vocabulary", "", "dictyBase uses a vocabulary based on PATO for phenotype annotations."],
          ["Phenotype term structure", "", "Phenotype terms combine an entity, such as a biological process or anatomical structure, with a quality describing the abnormality. For example, a mutant with delayed aggregation is annotated to delayed aggregation."],
          ["Publication usage", "", "Researchers are encouraged to use Dictyostelium phenotype and anatomy ontology vocabulary in publications so genes can be annotated accurately."],
          ["Genotypes", "", "Genotypes represent the genetic modifications present in a strain. Genes listed in a genotype are considered mutant in some way."],
          ["Wild type", "", "Wild-type strains have the simple genotype wt."],
          ["Mutant strains", "", "In mutant strains, every genetic element in a genotype should be separated by a comma."],
          ["Introduced DNA", "", "Genes or constructs introduced by transformation should be listed within brackets, whether carried on a plasmid, integrated as a fragment, or amplified inside cells."],
          ["Example genotype", "", "axeA2,axeB2,axeC2,gskA-,[bsRcas],gskA(K85R):GFP,bsR,neoR describes a gskA null mutant in AX2 expressing mutated gskA fused to GFP, blasticidin resistance, and neomycin resistance."]
        ]
      },
      {
        title: "Markers, plasmids, constructs, and chromosomes",
        definition: "Markers and constructs should use consistent names so strain records can be understood quickly.",
        terms: [
          ["Drug resistance markers", "", "Use bleR, bsR, bsS, foaR, hygR, neoR, and neoS for common drug resistance or sensitivity markers."],
          ["Auxotrophic markers", "", "Use thy-, thy+, ura+, and ura- for common nutrient auxotrophy or prototrophy markers."],
          ["Plasmids", "", "Naturally occurring plasmids are named with a prefix indicating genus and species, as in Ddp1. Derivatives and shuttle vectors use a lowercase p prefix, such as pDXA-3C."],
          ["Genes on plasmids", "", "Genes on plasmids or introduced experimentally should use the same naming system as chromosomal genes, but be placed in square brackets."],
          ["Plasmid example", "", "pDneo67[act6/regA] indicates that the regA coding sequence is fused to the actin6 promoter on plasmid pDneo67."],
          ["Molecular genetic constructs", "", "Reporter genes and gene fusions should separate promoters from coding sequence with a slash and coding sequences with dashes."],
          ["Construct examples", "", "Examples include cotB/talA-GFP, talA/talA-GFP, talA-GFP, and talA-GFP(S65T)."],
          ["Chromosomes", "", "Chromosomes are designated by non-italic Arabic numbers, for example Chromosome 1."]
        ]
      },
      {
        title: "Management and references",
        definition: "dictyBase acts as the centralized clearinghouse for gene and strain names.",
        terms: [
          ["Central clearinghouse", "", "Scientific curators at dictyBase verify proposed gene and strain names to encourage application of these guidelines and prevent duplicated names."],
          ["Contact", "", "Questions or naming suggestions can be addressed to matt.scaglione@duke.edu."],
          ["Nomenclature proposal", "", "This document is based on the November 2000 Nomenclature Proposal by the Dictyostelium Community Organizing Committee."],
          ["General reference", "", "Demerec, M. et al. (1966). A proposal for a uniform nomenclature in bacterial genetics. Genetics 54:61-76."],
          ["Additional reference", "", "Kay, Loomis, Devreotes (2001) TIG S.5-S.6."],
          ["Updated", "", "Updated June 30, 2020."]
        ]
      },
      {
        title: "Assigned strain prefixes",
        definition: "Current list of assigned strain prefixes included in the source document.",
        terms: [
          ["AD, HAD", "", "Adrian Harwood"],
          ["AK", "", "Adam Kuspa"],
          ["ARK", "", "Alan Kimmel"],
          ["AJW", "", "Alan Warren"],
          ["BS", "", "Bubba Singleton"],
          ["BW", "", "Bin Wang (Kuspa lab)"],
          ["CT", "", "Chris Thompson"],
          ["CW", "", "Tom Egelhoff"],
          ["DG", "", "Bill Loomis (Developmental Gene)"],
          ["DH", "", "Dale Herald (except DH100-199: Rich Kessin)"],
          ["DR", "", "Doug Robinson"],
          ["GS", "", "Gad Shaulsky"],
          ["HC, DCB", "", "Barrie Coukell"],
          ["HDK, DDK", "", "David Knecht"],
          ["HDT", "", "Meg Titus"],
          ["HG, DG", "", "Guenther Gerisch"],
          ["HGR", "", "Michel Sartre"],
          ["HH, DH100-199", "", "Rich Kessin (Haploid Harvard)"],
          ["HJW, JGW", "", "Jeff Williams"],
          ["HK, DK", "", "Gene Katz"],
          ["HKT", "", "Kei Inouye"],
          ["HL, DL", "", "Bill Loomis"],
          ["HM, DM", "", "Rob Kay"],
          ["HMW", "", "Randy Dimond (Haploid Madison Wisconsin)"],
          ["HO", "", "Terry O'Halloran"],
          ["HP, HPX", "", "Pasteur Institute"],
          ["HPF, DPF", "", "Paul Fisher"],
          ["HPS, DPS", "", "Reg Deering (Haploid Penn State)"],
          ["HR", "", "Herb Ennis and Rich Kessin"],
          ["HS, DS", "", "Jim Spudich"],
          ["HSB", "", "Salvo Bozzaro"],
          ["HT", "", "Adrian Tsang"],
          ["HTU", "", "Taro Uyeda"],
          ["HTY", "", "Kaichiro Yanagisawa"],
          ["HU, DUK", "", "Keith Williams"],
          ["HUD, DUD", "", "Dennis Welker"],
          ["HW", "", "Chris West"],
          ["IIB", "", "Instituto de Investigaciones Biomedicas"],
          ["IR, DIR, RI (old)", "", "Rob Insall"],
          ["JB", "", "Jane Borleis (Peter Devreotes' lab)"],
          ["JGW, HJW", "", "Jeff Williams"],
          ["JH", "", "Jeff Hadwiger"],
          ["JM", "", "Jacqueline Milne (Peter Devreotes' lab)"],
          ["JS", "", "Justin Stege (Bill Loomis' lab)"],
          ["KS", "", "Karl Saxe"],
          ["KY", "", "Kaichiro Yanagisawa (or T. Yamada?)"],
          ["LW", "", "Lijun Wu (Peter Devreotes' lab)"],
          ["NP, DP", "", "Peter Newell"],
          ["PD", "", "Peter Devreotes"],
          ["QS", "", "Queller-Strassmann lab"],
          ["RI", "", "Rob Insall (old prefix)"],
          ["SA, DSA", "", "Steve Alexander"],
          ["SB", "", "Simone Blagg"],
          ["TL", "", "Bill Loomis"],
          ["V, W", "", "Adam Kuspa"],
          ["WTC", "", "Wen-Tsan Chang"],
          ["X, XP", "", "Peter Newell"],
          ["XMC", "", "Hideko Urushihara (XP55-derived MaCrocyst defective)"]
        ]
      }
    ],
    note: "Nomenclature text provided for v2. The strain-prefix list is included as a browsable reference section."
  },
  {
    id: "anatomy-ontology",
    label: "Anatomy ontology",
    dek: "dictyBase curators, in collaboration with Jeff Williams from the University of Dundee, developed an ontology to describe Dictyostelium anatomy throughout its life cycle.",
    paragraphs: [
      "The Dictyostelium anatomy ontology defines the structural makeup of Dictyostelium and its composing parts, including different cell types throughout the life cycle.",
      "The ontology promotes consistent annotation of Dictyostelium-specific events, such as phenotypes, and future gene expression information. It also encourages researchers to use the same terms with the same intended meaning.",
      "The paper Gaudet, Williams, Fey and Chisholm, 2008 gives a description of the ontology and definitions of the terms in the context of the Dictyostelium life cycle.",
      "The ontology is dynamic, and modifications will be made as knowledge evolves."
    ],
    sections: [
      {
        title: "Anatomical structure",
        id: "DDANAT:0010001",
        definition: "Material anatomical entity that has inherent 3D shape and is generated by coordinated expression of the Dictyostelium discoideum genome.",
        terms: [
          ["Multicellular organism", "DDANAT:0010082", "Anatomical structure that is an individual member of the Dictyostelium discoideum species and consists of more than one cell."],
          ["aggregation territory", "DDANAT:0000003", "Area covered by a group of chemotactic cells converging toward the same aggregation center. Can reach a diameter of up to 1 cm."],
          ["loose aggregate", "DDANAT:0000004", "First adherent mass of cells observed during development, relatively flat with indistinct borders."],
          ["mound", "DDANAT:0000005", "Hemispherical structure composed of post-aggregative cells that are undergoing differentiation."],
          ["tipped mound", "DDANAT:0000006", "Hemispherical structure composed of post-aggregative cells that are undergoing differentiation and that have formed a tip."],
          ["standing slug", "DDANAT:0000007", "Cylindrical structure formed by elongation of the mound under the control of the tip. The elongating tip is called the first finger."],
          ["migratory slug", "DDANAT:0000008", "When conditions are not optimal for completion of development, the standing slug bends from a vertical position to a horizontal position and migrates toward more favorable conditions."],
          ["early culminant", "DDANAT:0000009", "Structure formed after arrest of slug migration when cells of the posterior region move under the tip. Stalk tube formation is initiated at this stage."],
          ["mid culminant", "DDANAT:0000010", "Structure in which stalk tube formation has progressed down the prespore zone. Basal disc formation begins at this stage."],
          ["late culminant", "DDANAT:0000011", "Structure in which stalk tube formation has progressed down to the basal disc. Terminal differentiation occurs at this stage."],
          ["fruiting body", "DDANAT:0000012", "Terminally differentiated asexual organism consisting of a long stalk topped by a sorus that contains spores."]
        ]
      },
      {
        title: "Cell",
        id: "DDANAT:0000401",
        definition: "Anatomical structure that has as its parts a maximally connected cell compartment surrounded by a plasma membrane.",
        terms: [
          ["single cell organism", "DDANAT:0000083", "Cell that is an individual member of the species Dictyostelium discoideum."],
          ["aggregate cell", "DDANAT:0000403", "Differentiating cell composing the aggregate that has acquired adhesive properties."],
          ["anterior like cell", "DDANAT:0000404", "Cell that has properties of anterior cells but is scattered throughout the rear of the slug."],
          ["apical disc cell", "DDANAT:0000119", "Cell forming the apical disc formed of upper cup cells that remain at the top of the fruiting body once stalk formation is complete."],
          ["peripheral layer cell", "DDANAT:0000095", "Electron-dense cell connected to neighboring peripheral layer cells, forming a coherent tissue around the multicellular organism."],
          ["prespore cell", "DDANAT:0000405", "Cell that is undergoing differentiation to become a spore and is characterized by prespore vesicles."],
          ["prestalk cell", "DDANAT:0000406", "Cell that is undergoing differentiation to become a stalk cell and is located in the anterior portion of the organism during development."],
          ["pstA cell", "", "Cell undergoing differentiation to become a stalk cell. PstA cells express the ecmA marker from the proximal promoter region and are located at the anterior-most region of the slug."],
          ["pstAB cell", "", "Cell undergoing differentiation to become a stalk cell. PstAB cells express both ecmA and ecmB either simultaneously or sequentially."],
          ["pstB cell", "", "Cell undergoing differentiation to become a stalk cell. PstB cells express ecmB and form the outer basal disc in the fruiting body."],
          ["pstO cell", "", "Cell undergoing differentiation to become a stalk cell. PstO cells express ecmA at a very low level and are located at the posterior half of the prestalk zone."],
          ["tip-organiser cell", "", "Type of pstA cell that composes the very tip of the organism."],
          ["sentinel cell", "DDANAT:0000418", "Cell present in the multicellular organism with high ability to engulf bacteria and toxin, presumed to have a detoxification and immune-like role."],
          ["stalk cell", "DDANAT:0000413", "Polyhedric cell filling the stalk tube. Stalk cells are highly vacuolated, surrounded by cellulose-containing cell wall, and die upon terminal differentiation."]
        ]
      },
      {
        title: "Subdivision",
        id: "DDANAT:0010085",
        definition: "Anatomical structure which is a primary subdivision of whole Dictyostelium organism. The mereological sum of these is the whole organism.",
        terms: [
          ["prespore region", "DDANAT:0000086", "Region mostly composed of prespore cells. It also contains anterior-like cells and occupies about three quarters of the organism."],
          ["prestalk region", "DDANAT:0000087", "Region located at the most apical part of the organism and consisting of about one quarter of the cells."],
          ["prestalk A region", "DDANAT:0000088", "Anterior-most region of the prestalk zone characterized by high expression of ecmA from the proximal promoter."],
          ["prestalk AB core region", "DDANAT:0000091", "Cone-shaped area of the prestalk zone that occupies a core among the pstA region. Cells express both ecmA and ecmB."],
          ["prestalk O region", "DDANAT:0000092", "Area of the prestalk zone posterior to the pstA region and characterized by low expression of ecmA from the distal promoter."],
          ["sorus", "DDANAT:0000094", "Ovoid structure supported by the stalk that contains spores."],
          ["stalk", "DDANAT:0000093", "Tubular structure of cellulose-covered cells stacked on top of each other and surrounded by an acellular stalk tube."],
          ["stream", "DDANAT:0000013", "Macroscopic appearance of chemotactic cells orienting head-to-tail as they migrate toward a chemotactic stimulus to form aggregates."],
          ["tip-organizer", "DDANAT:0000103", "Part of the prestalk region that acts as a signalling center directing morphological characteristics of the organism."]
        ]
      }
    ],
    note: "This page summarizes 37 of the most general terms from the Dictyostelium anatomy ontology text provided for v2."
  },
  {
    id: "teaching-labs",
    label: "Teaching labs",
    dek: "Teaching tools and classroom laboratory resources using Dictyostelium discoideum.",
    sourceUrl: "https://dictybase.dev/explore/teach/show",
    htmlContent: window.teachingLabsContent?.contentHtml || ""
  }
];

const organisms = [
  {
    id: "d-discoideum-ax4",
    name: "Dictyostelium discoideum AX4",
    shortName: "D. discoideum AX4",
    group: "Group 4",
    description: "The primary model organism for Dictyostelia and the reference genome for dictyBase. AX4 is an axenic strain derived from the wild-type NC4.",
    genomeSize: "34 Mb",
    chromosomes: "6",
    genes: "~12,500",
    assembly: "GCA_000004695.1",
    assemblyName: "dicty_2.7",
    gcfAccession: "GCF_000004695.1",
    genomeFile: "/assets/genomes/D_discoideum_AX4_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCF_000004695.1/",
    amoebaDbUrl: "https://amoebadb.org/amoeba/app/record/organism/Dictyostelium_discoideum_AX4",
    papers: [
      { pmid: "15875012", title: "The genome of the social amoeba Dictyostelium discoideum", journal: "Nature · 2005", url: "https://pubmed.ncbi.nlm.nih.gov/15875012/" }
    ]
  },
  {
    id: "d-purpureum",
    name: "Dictyostelium purpureum",
    shortName: "D. purpureum",
    group: "Group 4",
    description: "A group 4 species used for comparative genomics with D. discoideum. Shared a common ancestor approximately 400 million years ago with D. discoideum.",
    genomeSize: "33 Mb",
    chromosomes: "6 (scaffolds)",
    genes: "~11,300",
    assembly: "GCA_000190715.1",
    assemblyName: "v1.0",
    genomeFile: "/assets/genomes/D_purpureum_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000190715.1/",
    amoebaDbUrl: "https://amoebadb.org/amoeba/app/record/organism/Dictyostelium_purpureum",
    papers: [
      { pmid: "21356102", title: "Comparative genomics of the social amoebae Dictyostelium discoideum and Dictyostelium purpureum", journal: "Genome Biology · 2011", url: "https://pubmed.ncbi.nlm.nih.gov/21356102/" }
    ]
  },
  {
    id: "c-fasciculata-sh3",
    name: "Cavenderia fasciculata SH3",
    shortName: "C. fasciculata SH3",
    group: "Group 2",
    description: "Formerly known as Dictyostelium fasciculatum. A group 2 species used in comparative genomics studies of dictyostelid evolution.",
    genomeSize: "36 Mb",
    chromosomes: "Super-contigs",
    genes: "~11,900",
    assembly: "GCA_000203815.1",
    assemblyName: "DfasII1",
    genomeFile: "/assets/genomes/C_fasciculata_SH3_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000203815.1/",
    amoebaDbUrl: "https://amoebadb.org/amoeba/app/record/organism/Dictyostelium_fasciculatum_SH3",
    papers: [
      { pmid: "23494301", title: "Comparative genomics of the dictyostelids", journal: "Methods Mol Biol · 2013", url: "https://pubmed.ncbi.nlm.nih.gov/23494301/" }
    ]
  },
  {
    id: "h-pallidum-pn500",
    name: "Heterostelium pallidum PN500",
    shortName: "H. pallidum PN500",
    group: "Group 1",
    description: "Formerly known as Polysphondylium pallidum. A group 1 species representing the earliest-diverging lineage of dictyostelids with sequenced genomes.",
    genomeSize: "34 Mb",
    chromosomes: "Super-contigs",
    genes: "~10,800",
    assembly: "GCA_000004825.1",
    assemblyName: "PolPal_Dec2009",
    genomeFile: "/assets/genomes/H_pallidum_PN500_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000004825.1/",
    amoebaDbUrl: "https://amoebadb.org/amoeba/app/record/organism/Polysphondylium_pallidum_PN500",
    papers: [
      { pmid: "23494301", title: "Comparative genomics of the dictyostelids", journal: "Methods Mol Biol · 2013", url: "https://pubmed.ncbi.nlm.nih.gov/23494301/" }
    ]
  },
  {
    id: "c-polycephalum",
    name: "Coremiostelium polycephalum",
    shortName: "C. polycephalum",
    group: "Group 2",
    description: "Formerly known as Dictyostelium polycephalum. A group 2 species sequenced as part of comparative dictyostelid genomics studies.",
    genomeSize: "~52 Mb",
    chromosomes: "Scaffolds",
    genes: "~13,700",
    assembly: "GCA_900092265.1",
    assemblyName: "ASM90009226v1",
    genomeFile: "/assets/genomes/C_polycephalum_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_900092265.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "23494301", title: "Comparative genomics of the dictyostelids", journal: "Methods Mol Biol · 2013", url: "https://pubmed.ncbi.nlm.nih.gov/23494301/" }
    ]
  },
  {
    id: "s-polycarpum",
    name: "Synstelium polycarpum",
    shortName: "S. polycarpum",
    group: "Group 2",
    description: "Formerly known as Dictyostelium polycarpum. A group 2 species sequenced as part of comparative dictyostelid genomics studies.",
    genomeSize: "~65 Mb",
    chromosomes: "Scaffolds",
    genes: "~14,200",
    assembly: "GCA_900092255.1",
    assemblyName: "ASM90009225v1",
    genomeFile: "/assets/genomes/S_polycarpum_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_900092255.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "23494301", title: "Comparative genomics of the dictyostelids", journal: "Methods Mol Biol · 2013", url: "https://pubmed.ncbi.nlm.nih.gov/23494301/" }
    ]
  },
  {
    id: "p-violaceum",
    name: "Polysphondylium violaceum",
    shortName: "P. violaceum",
    group: "Group 1",
    description: "A group 1 dictyostelid species with a sequenced genome used in comparative studies of dictyostelid evolution and multicellularity.",
    genomeSize: "~28 Mb",
    chromosomes: "Scaffolds",
    genes: "~10,500",
    assembly: "GCA_000277445.1",
    assemblyName: "ASM27744v1",
    genomeFile: "/assets/genomes/P_violaceum_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_000277445.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "23494301", title: "Comparative genomics of the dictyostelids", journal: "Methods Mol Biol · 2013", url: "https://pubmed.ncbi.nlm.nih.gov/23494301/" }
    ]
  },
  {
    id: "h-pallidum-new",
    name: "Heterostelium pallidum",
    shortName: "H. pallidum (2026)",
    group: "Group 1",
    description: "A newly released chromosome-level genome assembly of Heterostelium pallidum, published in 2026. Distinct from the older PN500 assembly.",
    genomeSize: "~34 Mb",
    chromosomes: "Chromosome-level",
    genes: "~10,800",
    assembly: "GCA_054501735.1",
    assemblyName: "ASM5450173v1",
    genomeFile: "/assets/genomes/H_pallidum_new_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_054501735.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "", title: "Chromosome-level genome assembly of the social amoeba Heterostelium pallidum", journal: "Scientific Data · 2026", url: "https://www.nature.com/articles/s41597-026-06820-4" }
    ]
  },
  {
    id: "d-firmibasis",
    name: "Dictyostelium firmibasis",
    shortName: "D. firmibasis",
    group: "Group 4",
    description: "A recently sequenced group 4 species with a high-quality chromosome-level assembly generated using Oxford Nanopore and Illumina sequencing.",
    genomeSize: "31.5 Mb",
    chromosomes: "6",
    genes: "~11,044",
    assembly: "GCA_036169595.1",
    assemblyName: "ASM3616959v1",
    genomeFile: "/assets/genomes/D_firmibasis_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_036169595.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "38898145", title: "Chromosome-level genome assembly and annotation of the social amoeba Dictyostelium firmibasis", journal: "Scientific Data · 2024", url: "https://pubmed.ncbi.nlm.nih.gov/38898145/" }
    ]
  }
];

const techniqueRecords = buildTechniqueRecords();

const toolsShell = document.querySelector("#tools");
const organismShell = document.querySelector("#organism");

const form = document.querySelector("#search-form");
const input = document.querySelector("#search-input");
const suggestions = document.querySelector("#suggestions");
const recordShell = document.querySelector("#record");
const communityShell = document.querySelector("#community");
const researchShell = document.querySelector("#research");
const mobileMenu = document.querySelector("#mobile-menu");
const mobileMenuToggle = document.querySelector(".mobile-menu-toggle");

// Section scrolling. In-app navigation animates (smooth); the very first
// deep-link landing jumps instantly. Programmatic smooth scrolls are
// unreliable while the page is still loading and are skipped entirely under
// "reduce motion" — both left deep links to /gene, /go, /strain and /data
// stranded up at the hero. `appReady` flips true once the initial route is
// hydrated (see the bottom of this file).
let appReady = false;
function scrollToY(top) {
  window.scrollTo({ top: Math.max(0, top), behavior: appReady ? "smooth" : "instant" });
}
function scrollToEl(el) {
  if (!el) return;
  if (appReady) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }
  scrollToY(el.getBoundingClientRect().top + window.scrollY - 60);
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function normalizeQuery(q) {
  // Remove common noise, lowercase, collapse whitespace
  return q.trim().toLowerCase().replace(/[_\-\s]+/g, " ");
}

function matchesGene(gene, query) {
  const q = normalizeQuery(query);
  if (!q) return true;
  const fields = [
    gene.id,
    gene.symbol,
    gene.name,
    gene.ncbiGene,
    gene.uniprot,
    gene.veupath,
    gene.summary,
    ...(gene.aliases || []),
    ...(gene.tags || [])
  ];
  // Normalize each field the same way for comparison
  return fields.some((value) => normalizeQuery(String(value || "")).includes(q));
}

function rankedGenes(query) {
  const q = normalizeQuery(query);
  if (!q) return [];
  return genes
    .filter((gene) => matchesGene(gene, query))
    .sort((a, b) => {
      // Exact symbol/id match ranks first
      const aExact = normalizeQuery(a.symbol) === q || normalizeQuery(a.id) === q ? 0 : 1;
      const bExact = normalizeQuery(b.symbol) === q || normalizeQuery(b.id) === q ? 0 : 1;
      // Starts-with symbol ranks second
      const aStarts = normalizeQuery(a.symbol).startsWith(q) ? 0 : 1;
      const bStarts = normalizeQuery(b.symbol).startsWith(q) ? 0 : 1;
      return (aExact - bExact) || (aStarts - bStarts) || a.symbol.localeCompare(b.symbol);
    });
}

// Full D. discoideum gene catalog (symbol/id/name) loaded lazily for typeahead.
// Each entry: { id, symbol, name, location, ncbiGene }.
let geneIndex = [];

(async function loadGeneIndex() {
  try {
    const res = await fetch("/assets/gene_index.json");
    if (!res.ok) return;
    const rows = await res.json();
    geneIndex = rows.map(([id, symbol, name, location, ncbiGene]) => ({
      id, symbol, name, location, ncbiGene,
      organism: "Dictyostelium discoideum AX4"
    }));
    // If the user is mid-search, refresh suggestions now that the index is ready.
    if (input && input.value.trim()) renderSuggestions(input.value);
  } catch { /* typeahead falls back to NCBI search */ }
})();

function searchIndex(query, limit = 8) {
  const q = normalizeQuery(query);
  if (q.length < 2 || !geneIndex.length) return [];
  const matches = [];
  for (const g of geneIndex) {
    const sym = normalizeQuery(g.symbol);
    const idn = normalizeQuery(g.id);
    const nm = normalizeQuery(g.name);
    if (!(sym.includes(q) || idn.includes(q) || nm.includes(q))) continue;
    let rank = 3;
    if (sym === q || idn === q) rank = 0;
    else if (sym.startsWith(q)) rank = 1;
    else if (idn.startsWith(q)) rank = 2;
    matches.push({ g, rank });
  }
  matches.sort((a, b) => (a.rank - b.rank) || a.g.symbol.localeCompare(b.g.symbol));
  return matches.slice(0, limit).map((m) => m.g);
}

function findGeneByToken(token) {
  const q = normalize(decodeURIComponent(token || ""));
  if (!q) return null;
  return genes.find((gene) => [
    gene.id,
    gene.symbol,
    gene.ncbiGene,
    gene.uniprot,
    gene.veupath,
    ...(gene.aliases || [])
  ].some((value) => normalize(value) === q)) || rankedGenes(q)[0] || null;
}

function genePath(gene) {
  return `/gene/${encodeURIComponent(gene.symbol)}`;
}

function alphaFoldUrl(gene) {
  if (gene.uniprot) return `https://alphafold.ebi.ac.uk/entry/${gene.uniprot}`;
  return `https://alphafold.ebi.ac.uk/search/text/${encodeURIComponent(gene.symbol)}`;
}

function sourceLinks(gene) {
  return [
    ["PubMed", `Search ${gene.symbol} papers`, pubMedSearchUrl(gene)],
    ["AlphaFold", gene.uniprot || `Search ${gene.symbol}`, alphaFoldUrl(gene)],
    ["NCBI Gene", gene.ncbiGene, `https://www.ncbi.nlm.nih.gov/gene/${gene.ncbiGene}`],
    ["UniProt", gene.uniprot, `https://www.uniprot.org/uniprotkb/${gene.uniprot}/entry`],
    ["VEuPathDB", `AmoebaDB:${gene.veupath}`, `https://www.veupathdb.org/gene/AmoebaDB:${gene.veupath}`],
    ["STRING", `${gene.symbol} interactions`, `https://string-db.org/cgi/network?species_text=Dictyostelium+discoideum&identifiers=${encodeURIComponent(gene.symbol)}`]
  ].filter(([, detail]) => detail);
}

function pubMedQuery(gene) {
  const geneTerms = [gene.symbol, gene.name, gene.veupath, gene.uniprot]
    .filter(Boolean)
    .map((term) => `"${term}"`)
    .join(" OR ");
  return `(${geneTerms}) AND Dictyostelium`;
}

function pubMedSearchUrl(gene) {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubMedQuery(gene))}`;
}

// --- Recently searched genes (per-browser, stored in localStorage) ---
const RECENT_GENES_KEY = "dictybase:recentGenes";
const RECENT_GENES_MAX = 6;
const recentGenesEl = document.querySelector("#recent-genes");

function loadRecentGenes() {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_GENES_KEY) || "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string" && s) : [];
  } catch {
    return [];
  }
}

function recordRecentGene(symbol) {
  if (!symbol) return;
  const sym = String(symbol);
  const list = [sym, ...loadRecentGenes().filter((s) => s.toLowerCase() !== sym.toLowerCase())].slice(0, RECENT_GENES_MAX);
  try {
    localStorage.setItem(RECENT_GENES_KEY, JSON.stringify(list));
  } catch {
    /* storage full or unavailable (private mode) — just skip persistence */
  }
  renderRecentGenes();
}

function renderRecentGenes() {
  if (!recentGenesEl) return;
  const list = loadRecentGenes();
  if (!list.length) {
    recentGenesEl.innerHTML = "";
    recentGenesEl.setAttribute("hidden", "");
    return;
  }
  recentGenesEl.innerHTML = list
    .map((s) => `<button type="button" data-query="${escapeHtml(s)}">${escapeHtml(s)}</button>`)
    .join("");
  recentGenesEl.removeAttribute("hidden");
}

function setRoute(gene, tab = state.activeTab) {
  const query = new URLSearchParams();
  if (tab !== "Summary") query.set("tab", tab);
  history.pushState(null, "", `${genePath(gene)}${query.toString() ? `?${query.toString()}` : ""}`);
}

function openGene(gene, tab = "Summary", updateRoute = true) {
  state.activeGene = gene;
  state.activeTab = tab;
  recordRecentGene(gene?.symbol);
  renderRecord();
  if (updateRoute) setRoute(gene, tab);
  scrollToEl(document.querySelector("#record"));
  // Enrich from dictyBase corpus asynchronously
  enrichGeneFromCorpus(gene).then((enriched) => {
    if (state.activeGene?.symbol === enriched.symbol && JSON.stringify(enriched) !== JSON.stringify(gene)) {
      state.activeGene = enriched;
      renderRecord();
    }
  });
}

let suggestionDebounceTimer = null;

function renderSuggestions(query) {
  if (!query.trim()) {
    suggestions.innerHTML = "";
    return;
  }
  const local = rankedGenes(query).slice(0, 5);
  const localKeys = new Set(local.map((g) => g.ncbiGene));
  // Full-catalog matches (e.g. "dsca" -> dscA-1, dscA-2), minus anything already curated.
  const indexed = searchIndex(query, 8).filter((g) => !localKeys.has(g.ncbiGene));

  const localHtml = local.map((gene) => `
    <button class="suggestion" type="button" data-gene="${gene.id}">
      <span>
        <strong>${gene.symbol} · ${gene.name}</strong>
        <small>${gene.organism} · ${gene.location}</small>
      </span>
      <span class="tag">Local</span>
    </button>
  `).join("");
  const indexHtml = indexed.map((gene) => `
    <button class="suggestion" type="button" data-ncbi-gene="${escapeHtml(gene.ncbiGene)}">
      <span>
        <strong>${escapeHtml(gene.symbol)}${gene.name ? ` · ${escapeHtml(gene.name)}` : ""}</strong>
        <small>D. discoideum · ${escapeHtml(gene.location)}</small>
      </span>
      <span class="tag">Gene</span>
    </button>
  `).join("");

  suggestions.innerHTML = (localHtml + indexHtml)
    || `<div class="notice muted">Searching NCBI for <em>${escapeHtml(query)}</em>…</div>`;

  // Only reach out to NCBI when we have nothing locally (aliases, other taxa, UniProt IDs).
  clearTimeout(suggestionDebounceTimer);
  if (!local.length && !indexed.length) {
    suggestionDebounceTimer = setTimeout(() => fetchNCBISuggestions(query, local), 400);
  }
}

function looksLikeUniProt(q) {
  return /^[A-Z][0-9][A-Z0-9]{3}[0-9]$/i.test(q.trim());
}

async function fetchUniProtGene(uniprotId) {
  const res = await fetch(`https://rest.uniprot.org/uniprotkb/${uniprotId.toUpperCase()}.json`);
  if (!res.ok) throw new Error("UniProt entry not found");
  const data = await res.json();

  const symbol = data.genes?.[0]?.geneName?.value || uniprotId;
  const name = data.proteinDescription?.recommendedName?.fullName?.value
    || data.proteinDescription?.submissionNames?.[0]?.fullName?.value
    || symbol;
  const ncbiGeneRef = data.uniProtKBCrossReferences?.find((r) => r.database === "GeneID");
  const ncbiGene = ncbiGeneRef?.id || "";
  const veupathRef = data.uniProtKBCrossReferences?.find((r) => r.database === "VEuPathDB");
  const veupath = veupathRef?.id || "";
  const allAliases = data.genes?.flatMap((g) => [
    g.geneName?.value,
    ...(g.synonyms || []).map((s) => s.value)
  ]).filter(Boolean) || [];
  const organism = data.organism?.scientificName || "Dictyostelium discoideum AX4";
  const location = data.genes?.[0]?.orderedLocusNames?.[0]?.value || "";

  return {
    id: uniprotId.toUpperCase(),
    symbol,
    name,
    organism,
    location: location || "See UniProt record",
    summary: name,
    aliases: [...new Set([uniprotId.toUpperCase(), ncbiGene, veupath, ...allAliases].filter(Boolean))],
    tags: [],
    ncbiGene,
    uniprot: uniprotId.toUpperCase(),
    veupath,
    go: [],
    phenotypes: [],
    literature: [],
    structures: [["AlphaFold", uniprotId.toUpperCase(), "Predicted protein structure"]]
  };
}

function looksLikeDDB(q) {
  return /^DDB(_G)?\d+$/i.test(q.trim());
}

function buildNCBITerm(query) {
  const q = query.trim();
  // DDB gene ID — search by locus tag
  if (looksLikeDDB(q)) return `${q}[gene] AND 352472[taxid]`;
  // Symbol OR alias — strict enough to avoid noise, broad enough to catch synonyms
  return `(${q}[gene] OR ${q}[gene alias]) AND 352472[taxid]`;
}

async function fetchNCBISuggestions(query, localRows) {
  try {
    const localHtml = localRows.map((gene) => `
      <button class="suggestion" type="button" data-gene="${gene.id}">
        <span><strong>${gene.symbol} · ${gene.name}</strong><small>${gene.organism} · ${gene.location}</small></span>
        <span class="tag">Local</span>
      </button>`).join("");

    // UniProt ID shortcut
    if (looksLikeUniProt(query)) {
      const upId = query.toUpperCase();
      suggestions.innerHTML = localHtml + `
        <button class="suggestion" type="button" data-uniprot-gene="${escapeHtml(upId)}">
          <span><strong>${escapeHtml(upId)}</strong><small>UniProt accession</small></span>
          <span class="tag">UniProt</span>
        </button>`;
      return;
    }

    const searchParams = new URLSearchParams({
      db: "gene", retmax: "10", retmode: "json",
      term: buildNCBITerm(query)
    });
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`);
    if (!res.ok) return;
    const data = await res.json();
    let ids = (data.esearchresult?.idlist || []).filter((id) => !localRows.some((g) => g.ncbiGene === id));


    if (!ids.length) {
      suggestions.innerHTML = localHtml || `<div class="notice">No results found for "${escapeHtml(query)}".</div>`;
      return;
    }
    const summaryParams = new URLSearchParams({ db: "gene", id: ids.join(","), retmode: "json" });
    const sumRes = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`);
    if (!sumRes.ok) return;
    const sumData = await sumRes.json();
    const liveRows = (sumData.result?.uids || ids).map((id) => sumData.result?.[id]).filter(Boolean);
    const liveHtml = liveRows.map((item) => `
      <button class="suggestion" type="button" data-ncbi-gene="${escapeHtml(item.uid)}">
        <span><strong>${escapeHtml(item.name)} · ${escapeHtml(item.description)}</strong><small>D. discoideum · NCBI Gene ${escapeHtml(item.uid)}</small></span>
        <span class="tag">NCBI</span>
      </button>`).join("");
    suggestions.innerHTML = (localHtml + liveHtml) || `<div class="notice">No results found for "${escapeHtml(query)}".</div>`;
  } catch {
    // silently fail — local results still shown
  }
}

async function openUniProtGene(uniprotId) {
  recordShell.innerHTML = `<div class="empty-state"><p class="notice muted">Loading ${escapeHtml(uniprotId)} from UniProt…</p></div>`;
  scrollToEl(recordShell);
  try {
    const gene = await fetchUniProtGene(uniprotId);
    input.value = gene.symbol;
    openGene(gene, "Summary", true);
  } catch (err) {
    recordShell.innerHTML = `<div class="empty-state"><p class="notice">Could not load UniProt entry ${escapeHtml(uniprotId)}: ${escapeHtml(err.message)}</p></div>`;
  }
}

async function openRemoteGene(ncbiId) {
  recordShell.innerHTML = `<div class="empty-state"><p class="notice muted">Loading gene ${escapeHtml(ncbiId)}…</p></div>`;
  scrollToEl(recordShell);
  try {
    // 1. NCBI Gene summary
    const summaryParams = new URLSearchParams({ db: "gene", id: ncbiId, retmode: "json" });
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${summaryParams}`);
    const data = await res.json();
    const item = data.result?.[ncbiId];
    if (!item) throw new Error("Gene not found");

    const symbol = item.name || ncbiId;
    const name = item.description || "";
    const chrInfo = item.genomicinfo?.[0];
    const location = chrInfo
      ? `${chrInfo.chraccver}: ${Number(chrInfo.chrstart).toLocaleString()}–${Number(chrInfo.chrstop).toLocaleString()}`
      : "See NCBI Gene record";
    const aliasList = [
      ...(item.otheraliases ? item.otheraliases.split(",").map((s) => s.trim()).filter(Boolean) : []),
      ...(item.otherdesignations ? item.otherdesignations.split("|").map((s) => s.trim()).filter(Boolean) : [])
    ];
    // Extract DDB_G ID directly from NCBI aliases — no UniProt needed
    const ddbFromAliases = aliasList.find((a) => /^DDB_G\d+$/.test(a)) || "";
    const aliases = [ncbiId, ...aliasList].filter(Boolean);

    // 2. Use DDB_G from NCBI aliases immediately — fast path for most D. discoideum genes
    let veupath = ddbFromAliases;

    // 3. UniProt lookup — try symbol as-is then lowercase
    let uniprot = "";
    let uniprotFullRecord = null;
    try {
      const symsToTry = [...new Set([symbol, symbol.toLowerCase()])];
      for (const sym of symsToTry) {
        const upRes = await fetch(`https://rest.uniprot.org/uniprotkb/search?query=gene:${encodeURIComponent(sym)}+AND+organism_id:44689&format=json&size=1`);
        const upData = await upRes.json();
        if (upData.results?.[0]) {
          uniprotFullRecord = upData.results[0];
          uniprot = uniprotFullRecord.primaryAccession || "";
          break;
        }
      }
      if (uniprotFullRecord) {
        // Fill veupath from UniProt if not already found
        if (!veupath) {
          const veupathRef = uniprotFullRecord.uniProtKBCrossReferences?.find((r) => r.database === "VEuPathDB");
          veupath = veupathRef?.id || "";
        }
        const uniAliases = uniprotFullRecord.genes?.flatMap((g) => [
          g.geneName?.value,
          ...(g.synonyms || []).map((s) => s.value)
        ]).filter(Boolean) || [];
        aliases.push(...uniAliases);
      }
    } catch { /* proceed without UniProt */ }

    const structures = uniprot
      ? [["AlphaFold", uniprot, "Predicted protein structure"]]
      : [["AlphaFold", symbol, "No UniProt entry — search AlphaFold manually"]];

    const gene = {
      id: ncbiId,
      symbol,
      name,
      organism: "Dictyostelium discoideum AX4",
      location,
      summary: name,
      aliases: [...new Set(aliases)],
      tags: [],
      ncbiGene: ncbiId,
      uniprot,
      veupath,
      go: [],
      phenotypes: [],
      literature: [],
      structures
    };

    input.value = symbol;
    openGene(gene, "Summary", true);
  } catch (err) {
    recordShell.innerHTML = `<div class="empty-state"><p class="notice">Could not load gene ${escapeHtml(ncbiId)}: ${escapeHtml(err.message)}</p></div>`;
  }
}

let currentViewer = null;

function initStructureViewer(uniprot) {
  const el = document.getElementById("af-viewer");
  if (!el) return;
  if (currentViewer) { try { currentViewer.clear(); } catch {} }
  el.innerHTML = `<p style="font-size:0.75rem;color:#9ca3af;padding:8px;text-align:center">Loading structure…</p>`;

  const renderIntoEl = () => {
    const viewer = $3Dmol.createViewer(el, { backgroundColor: "white", antialias: true });
    currentViewer = viewer;
    const url = `/api/alphafold/${uniprot}`;
    fetch(url)
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.text(); })
      .then((pdbData) => {
        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { colorscheme: "ssJmol" } });
        viewer.zoomTo();
        viewer.spin(true);
        viewer.render();
      })
      .catch(() => { el.innerHTML = `<p style="font-size:0.75rem;color:#9ca3af;padding:8px;text-align:center">Structure unavailable</p>`; });
  };

  if (window.$3Dmol) {
    renderIntoEl();
  } else {
    const script = document.createElement("script");
    script.src = "https://3Dmol.csb.pitt.edu/build/3Dmol-min.js";
    script.onload = renderIntoEl;
    script.onerror = () => { el.innerHTML = `<p style="font-size:0.75rem;color:#9ca3af;padding:8px;text-align:center">Viewer unavailable</p>`; };
    document.head.appendChild(script);
  }
}

function renderRecord() {
  const gene = state.activeGene;
  if (!gene) return;
  const tabs = ["Summary", "GO", "Phenotypes", "Literature", "Structures", "Interactions", "Orthologs", "PTMs"];
  recordShell.innerHTML = `
    <article class="record-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Gene record</p>
          <h2>${gene.symbol}</h2>
          <p><strong>${escapeHtml(gene.name)}</strong> · ${renderCuratedText(gene.summary)}</p>
          <div class="tag-row">
            ${gene.tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
            ${gene._curator ? `<span class="tag" style="background:var(--soft,#edf6f2);color:var(--teal-dark)" title="Curated by ${escapeHtml(gene._curator)}">✓ dictyBase curated</span>` : ""}
          </div>
        </div>
        ${gene.uniprot ? `<div class="structure-viewer" id="af-viewer" data-uniprot="${escapeHtml(gene.uniprot)}"></div>` : ""}
      </header>

      <div class="source-links" aria-label="External links">
        ${sourceLinks(gene).map(([label, detail, href]) => `
          <a class="source-link" href="${href}" target="_blank" rel="noopener">
            <strong>${label}</strong>
            <span>${detail}</span>
          </a>
        `).join("")}
      </div>

      <div class="tabs" aria-label="Record sections">
        ${tabs.map((tab) => `<button class="tab ${tab === state.activeTab ? "active" : ""}" type="button" data-tab="${tab}">${tab}</button>`).join("")}
      </div>

      <div class="record-body">${renderTab(gene, state.activeTab)}</div>
      ${gene._curator ? `<p style="font-size:0.75rem;color:var(--muted,#6b7280);padding:0 24px 16px">Gene summary curated by ${escapeHtml(gene._curator)} · <a class="text-link" href="https://doi.org/10.1002/dvg.22867" target="_blank" rel="noopener">dictyBase (Basu et al. 2015)</a> · <a class="text-link" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a></p>` : ""}
    </article>
  `;
  if (gene.uniprot) {
    requestAnimationFrame(() => initStructureViewer(gene.uniprot));
  }
  loadTabData(gene, state.activeTab);
}

// Fire the async data loader(s) for a single record tab.
function loadTabData(gene, tab) {
  switch (tab) {
    case "Summary":
      requestAnimationFrame(() => loadRNAseqInline(gene));
      break;
    case "GO":
      loadGOResults(gene);
      break;
    case "Phenotypes":
      loadPhenotypes(gene);
      break;
    case "Interactions":
      loadStringResults(gene);
      break;
    case "Orthologs":
      loadOMAResults(gene);
      break;
    case "PTMs":
      loadPTMs(gene);
      break;
    case "Literature":
      loadCuratedReferences(gene);
      loadPubMedResults(gene);
      break;
    case "Structures":
      loadPDBResults(gene);
      break;
  }
}

// Swap only the active tab's body — leaves the header (and its structure
// viewer) untouched so it doesn't flicker or re-fetch on every tab click.
function switchTab(tab) {
  const gene = state.activeGene;
  if (!gene) return;
  state.activeTab = tab;
  recordShell.querySelectorAll(".tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
  const body = recordShell.querySelector(".record-body");
  if (!body) {
    renderRecord();
    return;
  }
  body.innerHTML = renderTab(gene, tab);
  loadTabData(gene, tab);
}

function findResearchByToken(token) {
  const q = normalize(decodeURIComponent(token || ""));
  return researchResources.find((item) => normalize(item.id) === q || normalize(item.label) === q) || researchResources[0];
}

function setResearchRoute(resource) {
  history.pushState(null, "", `/research/${encodeURIComponent(resource.id)}`);
}

function setTechniqueRoute(technique) {
  history.pushState(null, "", `/research/techniques/${encodeURIComponent(technique.slug)}`);
}

function openResearch(resource, updateRoute = true) {
  hideContentSections();
  state.activeResearch = resource.id;
  renderResearch();
  if (updateRoute) setResearchRoute(resource);
  scrollToEl(document.querySelector("#research"));
}

function openTechnique(technique, updateRoute = true) {
  if (!technique) {
    openResearch(findResearchByToken("techniques"), updateRoute);
    return;
  }
  hideContentSections();
  state.activeResearch = "techniques";
  renderTechnique(technique);
  if (updateRoute) setTechniqueRoute(technique);
  scrollToEl(document.querySelector("#research"));
}

function openTool(tool, updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", `/tools/${encodeURIComponent(tool)}`);
  if (!toolsShell) return;
  if (tool === "genome-browser") {
    toolsShell.innerHTML = renderGenomeBrowser();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    requestAnimationFrame(initGenomeBrowser);
  } else if (tool === "blast") {
    toolsShell.innerHTML = renderBlastPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
  } else if (tool === "heatstress") {
    toolsShell.innerHTML = renderHeatStressPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initHeatStressViewer();
  } else if (tool === "proteomics") {
    toolsShell.innerHTML = renderProteomicsPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initProteomicsViewer();
  } else if (tool === "downloads") {
    toolsShell.innerHTML = renderDownloadsShell();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    loadDownloads();
  }
}

function formatBytes(n) {
  if (!n) return "";
  const mb = n / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function renderDownloadsShell() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Downloads</p>
          <h2>Genome downloads</h2>
          <p>Genome assemblies (FASTA) and gene annotations (GFF3) for all nine sequenced dictyostelid species. FASTA files are gzip-compressed.</p>
        </div>
      </header>
      <div class="record-body">
        <div data-downloads-results>
          <p class="notice muted">Loading downloads…</p>
        </div>
      </div>
    </article>`;
}

async function loadDownloads() {
  const container = document.querySelector("[data-downloads-results]");
  if (!container) return;
  try {
    const res = await fetch("/assets/downloads_manifest.json");
    if (!res.ok) throw new Error("manifest unavailable");
    const manifest = await res.json();
    container.innerHTML = manifest.map((sp) => `
      <section class="data-block" style="margin-bottom:14px">
        <div style="display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <h3 style="margin:0"><em>${escapeHtml(sp.label)}</em></h3>
          <a class="text-link" href="https://www.ncbi.nlm.nih.gov/datasets/genome/${encodeURIComponent(sp.assembly)}/" target="_blank" rel="noopener" style="font-size:0.8125rem">${escapeHtml(sp.assembly)} ↗</a>
        </div>
        <ul class="list" style="margin-top:10px">
          ${sp.files.map((f) => `
            <li style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <span><strong>${escapeHtml(f.type)}</strong><br><span style="color:var(--muted,#6b7280);font-size:0.8125rem">${escapeHtml(f.name)}</span></span>
              <a class="button" href="${escapeHtml(f.url)}" download>Download · ${escapeHtml(formatBytes(f.size))}</a>
            </li>`).join("")}
        </ul>
      </section>`).join("");
  } catch {
    container.innerHTML = `<p class="notice">Downloads could not be loaded right now.</p>`;
  }
}

let heatStressData = null;
let hsChart = null;
let hsSelected = [];
const HS_CONDITIONS = ["Control", "Heat stress", "Development"];
const HS_COLORS = ["#0f766e", "#dc2626", "#2563eb"];

function renderHeatStressPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools · Proteomics</p>
          <h2>Insoluble proteome viewer</h2>
          <p>8,043 proteins from the insoluble fraction of <em>D. discoideum</em> under control, heat stress, and development conditions. Source: <a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/41820831/" target="_blank" rel="noopener">Williams et al., BMC Mol Cell Biol 2026</a>.</p>
        </div>
      </header>
      <div class="record-body">

        <section class="data-block">
          <h3>Search proteins</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input id="hs-search" type="text" placeholder="Gene name, UniProt ID, or description…" style="flex:1;min-width:220px">
            <button class="button primary" id="hs-search-btn">Search</button>
            <button class="button" id="hs-clear-btn">Clear chart</button>
          </div>
          <div id="hs-suggestions" style="margin-top:8px;display:grid;gap:6px;max-height:220px;overflow-y:auto"></div>
        </section>

        <section class="data-block">
          <h3>Insoluble abundance across conditions</h3>
          <p style="font-size:0.8125rem;color:var(--muted,#6b7280)">Log₂ intensity (averaged replicates). Up to 8 proteins shown simultaneously.</p>
          <div style="position:relative;height:380px">
            <canvas id="hs-chart"></canvas>
          </div>
          <div id="hs-legend" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px"></div>
        </section>

        <section class="data-block">
          <h3>Most changed by heat stress vs control</h3>
          <p style="font-size:0.8125rem;color:var(--muted,#6b7280)">Ranked by absolute fold change (heat stress vs control). Click a row to add to chart.</p>
          <div id="hs-top-table" style="overflow-x:auto"><p class="notice muted">Loading…</p></div>
        </section>

      </div>
    </article>
  `;
}

async function initHeatStressViewer() {
  if (!heatStressData) {
    try {
      const res = await fetch("/assets/heatstress_data.json");
      heatStressData = await res.json();
    } catch {
      document.getElementById("hs-top-table").innerHTML = `<p class="notice">Could not load data.</p>`;
      return;
    }
  }

  const loadChart = () => {
    const canvas = document.getElementById("hs-chart");
    if (!canvas || !window.Chart) return;
    if (hsChart) hsChart.destroy();
    hsChart = new Chart(canvas, {
      type: "bar",
      data: { labels: HS_CONDITIONS, datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Condition" } },
          y: { title: { display: true, text: "log₂ intensity" } }
        }
      }
    });
    renderHSTopTable();
    wireHSSearch();
  };

  if (window.Chart) { loadChart(); }
  else {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    s.onload = loadChart;
    document.head.appendChild(s);
  }
}

function hsSearch(query) {
  if (!heatStressData || !query.trim()) return [];
  const q = query.toLowerCase();
  return heatStressData.filter((p) =>
    p.gene.toLowerCase().includes(q) ||
    p.acc.toLowerCase().includes(q) ||
    p.desc.toLowerCase().includes(q)
  ).slice(0, 10);
}

function addToHSChart(protein) {
  if (!hsChart) return;
  if (hsSelected.find((p) => p.gene === protein.gene)) return;
  if (hsSelected.length >= 8) hsSelected.shift();
  hsSelected.push(protein);
  updateHSChart();
}

function updateHSChart() {
  if (!hsChart) return;
  const vals = (p) => [p.ctrl, p.hs, p.dev];
  hsChart.data.datasets = hsSelected.map((p, i) => ({
    label: p.gene,
    data: vals(p),
    backgroundColor: HS_COLORS.map((c) => c + "99"),
    borderColor: HS_COLORS,
    borderWidth: 2
  }));
  // Group bars by protein
  hsChart.data.datasets = hsSelected.map((p, i) => ({
    label: p.gene,
    data: vals(p),
    backgroundColor: HS_COLORS[i % HS_COLORS.length] + "88",
    borderColor: HS_COLORS[i % HS_COLORS.length],
    borderWidth: 2
  }));
  hsChart.update();

  const legend = document.getElementById("hs-legend");
  if (legend) {
    legend.innerHTML = hsSelected.map((p, i) => `
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8125rem;background:${HS_COLORS[i % HS_COLORS.length]}18;padding:3px 10px;border-radius:999px;border:1px solid ${HS_COLORS[i % HS_COLORS.length]}44">
        <span style="width:10px;height:10px;border-radius:50%;background:${HS_COLORS[i % HS_COLORS.length]};flex-shrink:0"></span>
        ${escapeHtml(p.gene)}
        <button onclick="removeFromHSChart('${escapeHtml(p.gene)}')" style="background:none;border:none;cursor:pointer;padding:0;font-size:12px;color:#6b7280;min-height:unset">✕</button>
      </span>`).join("");
  }
}

window.removeFromHSChart = (gene) => {
  hsSelected = hsSelected.filter((p) => p.gene !== gene);
  updateHSChart();
};

let hsSortCol = "hs_fc";
let hsSortAsc = false;

function sortHSData() {
  const sorters = {
    ctrl:     (a, b) => (b.ctrl    ?? -Infinity) - (a.ctrl    ?? -Infinity),
    hs:       (a, b) => (b.hs      ?? -Infinity) - (a.hs      ?? -Infinity),
    dev:      (a, b) => (b.dev     ?? -Infinity) - (a.dev     ?? -Infinity),
    hs_fc:    (a, b) => (b.hs_fc   ?? 0)         - (a.hs_fc   ?? 0),
    hs_pval:  (a, b) => (a.hs_pval ?? 1)         - (b.hs_pval ?? 1),
    dev_fc:   (a, b) => (b.dev_fc  ?? 0)         - (a.dev_fc  ?? 0),
    dev_pval: (a, b) => (a.dev_pval ?? 1)        - (b.dev_pval ?? 1),
  };
  const fn = sorters[hsSortCol] || sorters.hs_fc;
  return [...heatStressData.filter((p) => p.hs_fc !== null)]
    .sort((a, b) => hsSortAsc ? -fn(a, b) : fn(a, b))
    .slice(0, 20);
}

function renderHSTopTable() {
  const container = document.getElementById("hs-top-table");
  if (!container || !heatStressData) return;
  const ranked = sortHSData();

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border,#e5e7eb)">
          <th style="text-align:left;padding:8px">Gene</th>
          <th style="text-align:left;padding:8px">Description</th>
          ${[["ctrl","Control"],["hs","Heat stress"],["dev","Development"],["hs_fc","HS FC"],["hs_pval","HS p-val"],["dev_fc","Dev FC"],["dev_pval","Dev p-val"]].map(([col, label]) => {
            const active = hsSortCol === col;
            const arrow = active ? (hsSortAsc ? " ↑" : " ↓") : " ↕";
            return `<th data-hs-sort="${col}" style="text-align:right;padding:8px;cursor:pointer;user-select:none;white-space:nowrap;${active ? "color:var(--teal-dark);font-weight:900" : ""}">${label}${arrow}</th>`;
          }).join("")}
          <th style="text-align:center;padding:8px">HS sig</th>
          <th style="text-align:center;padding:8px">Dev sig</th>
        </tr>
      </thead>
      <tbody>
        ${ranked.map((p) => {
          const fc = p.hs_fc || 0;
          const fcColor = fc > 0 ? "#dc2626" : "#2563eb";
          return `
          <tr class="hs-table-row" data-gene="${escapeHtml(p.gene)}" style="border-bottom:1px solid var(--border,#f3f4f6);cursor:pointer">
            <td style="padding:8px;font-weight:700;color:var(--teal-dark)">${escapeHtml(p.gene)}</td>
            <td style="padding:8px;color:var(--muted,#6b7280);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.desc)}</td>
            <td style="text-align:right;padding:8px">${p.ctrl !== null ? p.ctrl.toFixed(1) : "—"}</td>
            <td style="text-align:right;padding:8px">${p.hs !== null ? p.hs.toFixed(1) : "—"}</td>
            <td style="text-align:right;padding:8px">${p.dev !== null ? p.dev.toFixed(1) : "—"}</td>
            <td style="text-align:right;padding:8px;font-weight:700;color:${fcColor}">${fc > 0 ? "+" : ""}${fc.toFixed(2)}</td>
            <td style="text-align:right;padding:8px">${p.hs_pval !== null ? p.hs_pval.toExponential(2) : "—"}</td>
            ${(() => { const dfc = p.dev_fc || 0; const dc = dfc > 0 ? "#dc2626" : "#2563eb"; return `
            <td style="text-align:right;padding:8px;font-weight:700;color:${dc}">${dfc > 0 ? "+" : ""}${dfc.toFixed(2)}</td>
            <td style="text-align:right;padding:8px">${p.dev_pval !== null ? p.dev_pval.toExponential(2) : "—"}</td>`; })()}
            <td style="text-align:center;padding:8px">${escapeHtml(p.hs_sig || "")}</td>
            <td style="text-align:center;padding:8px">${escapeHtml(p.dev_sig || "")}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table>`;

  container.querySelectorAll(".hs-table-row").forEach((row) => {
    row.addEventListener("click", () => {
      const p = heatStressData.find((x) => x.gene === row.dataset.gene);
      if (p) addToHSChart(p);
    });
    row.addEventListener("mouseenter", () => row.style.background = "var(--soft,#edf6f2)");
    row.addEventListener("mouseleave", () => row.style.background = "");
  });

  container.querySelectorAll("[data-hs-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const col = th.dataset.hsSort;
      if (hsSortCol === col) {
        hsSortAsc = !hsSortAsc;
      } else {
        hsSortCol = col;
        hsSortAsc = false;
      }
      renderHSTopTable();
    });
  });
}

function wireHSSearch() {
  const input = document.getElementById("hs-search");
  const suggestionsEl = document.getElementById("hs-suggestions");

  const showSuggestions = () => {
    const results = hsSearch(input?.value || "");
    if (!suggestionsEl) return;
    if (!results.length) { suggestionsEl.innerHTML = ""; return; }
    suggestionsEl.innerHTML = results.map((p) => `
      <button class="suggestion hs-suggestion" type="button" data-gene="${escapeHtml(p.gene)}" style="text-align:left;justify-content:space-between">
        <span>
          <strong>${escapeHtml(p.gene)}${p.acc ? ` · ${escapeHtml(p.acc)}` : ""}</strong>
          <small style="display:block;color:var(--muted,#6b7280)">${escapeHtml(p.desc.slice(0, 80))}</small>
        </span>
        <span class="tag">Add</span>
      </button>`).join("");
    suggestionsEl.querySelectorAll(".hs-suggestion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = heatStressData.find((x) => x.gene === btn.dataset.gene);
        if (p) { addToHSChart(p); suggestionsEl.innerHTML = ""; if (input) input.value = ""; }
      });
    });
  };

  input?.addEventListener("input", showSuggestions);
  document.getElementById("hs-search-btn")?.addEventListener("click", showSuggestions);
  document.getElementById("hs-clear-btn")?.addEventListener("click", () => {
    hsSelected = []; updateHSChart();
    if (suggestionsEl) suggestionsEl.innerHTML = "";
    if (input) input.value = "";
  });
}

let proteomicsData = null;
const STAGES = ["Vegetative", "Aggregation", "Mound", "Culmination", "Fruiting body"];
const STAGE_COLORS = ["#0f766e","#2563eb","#d97706","#dc2626","#7c3aed"];
let proteomicsChart = null;
let proteomicsSelected = [];

function renderProteomicsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools · Proteomics</p>
          <h2>Developmental proteome viewer</h2>
          <p>4,502 proteins quantified across five <em>D. discoideum</em> life cycle stages. Search a gene to plot its expression trajectory. Source: <a class="text-link" href="https://pmc.ncbi.nlm.nih.gov/articles/PMC12821622/" target="_blank" rel="noopener">Banu et al., Proteomes 2026</a>.</p>
        </div>
      </header>
      <div class="record-body">

        <section class="data-block">
          <h3>Search proteins</h3>
          <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
            <input id="prot-search" type="text" placeholder="Gene name, UniProt ID, or description…" style="flex:1;min-width:220px">
            <button class="button primary" id="prot-search-btn">Search</button>
            <button class="button" id="prot-clear-btn">Clear chart</button>
          </div>
          <div id="prot-suggestions" style="margin-top:8px;display:grid;gap:6px;max-height:220px;overflow-y:auto"></div>
        </section>

        <section class="data-block">
          <h3>Expression across development</h3>
          <p style="font-size:0.8125rem;color:var(--muted,#6b7280)">Log₂ intensity (averaged replicates). Up to 8 proteins shown simultaneously.</p>
          <div style="position:relative;height:360px">
            <canvas id="prot-chart"></canvas>
          </div>
          <div id="prot-legend" style="margin-top:12px;display:flex;flex-wrap:wrap;gap:8px"></div>
        </section>

        <section class="data-block">
          <h3>Most variable proteins across development</h3>
          <p style="font-size:0.8125rem;color:var(--muted,#6b7280)">Top 20 proteins by standard deviation across the five stages. Click a row to add it to the chart.</p>
          <div id="prot-top-table" style="overflow-x:auto"><p class="notice muted">Loading…</p></div>
        </section>

      </div>
    </article>
  `;
}

async function initProteomicsViewer() {
  if (!proteomicsData) {
    try {
      const res = await fetch("/assets/proteomics_data.json");
      proteomicsData = await res.json();
    } catch {
      const c = document.getElementById("prot-top-table");
      if (c) c.innerHTML = `<p class="notice">Could not load proteomics data.</p>`;
      return;
    }
  }

  const loadChart = () => {
    const canvas = document.getElementById("prot-chart");
    if (!canvas || !window.Chart) return;
    if (proteomicsChart) proteomicsChart.destroy();
    proteomicsChart = new Chart(canvas, {
      type: "line",
      data: { labels: STAGES, datasets: [] },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: "Developmental stage" } },
          y: { title: { display: true, text: "log₂ intensity" } }
        }
      }
    });
    renderTopTable();
    wireProteomicsSearch();
  };

  if (window.Chart) {
    loadChart();
  } else {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    s.onload = loadChart;
    document.head.appendChild(s);
  }
}

function proteomicsSearch(query) {
  if (!proteomicsData || !query.trim()) return [];
  const q = query.toLowerCase();
  return proteomicsData.filter((p) =>
    p.gene.toLowerCase().includes(q) ||
    p.uniprot.toLowerCase().includes(q) ||
    p.desc.toLowerCase().includes(q)
  ).slice(0, 10);
}

function addToChart(protein) {
  if (!proteomicsChart) return;
  if (proteomicsSelected.find((p) => p.gene === protein.gene)) return;
  if (proteomicsSelected.length >= 8) proteomicsSelected.shift();
  proteomicsSelected.push(protein);
  updateChart();
}

function updateChart() {
  if (!proteomicsChart) return;
  proteomicsChart.data.datasets = proteomicsSelected.map((p, i) => ({
    label: p.gene,
    data: STAGES.map((s) => p.stages[s]),
    borderColor: STAGE_COLORS[i % STAGE_COLORS.length],
    backgroundColor: STAGE_COLORS[i % STAGE_COLORS.length] + "22",
    tension: 0.3, pointRadius: 5, pointHoverRadius: 7
  }));
  proteomicsChart.update();
  const legend = document.getElementById("prot-legend");
  if (legend) {
    legend.innerHTML = proteomicsSelected.map((p, i) => `
      <span style="display:inline-flex;align-items:center;gap:5px;font-size:0.8125rem;background:${STAGE_COLORS[i % STAGE_COLORS.length]}18;padding:3px 10px;border-radius:999px;border:1px solid ${STAGE_COLORS[i % STAGE_COLORS.length]}44">
        <span style="width:10px;height:10px;border-radius:50%;background:${STAGE_COLORS[i % STAGE_COLORS.length]};flex-shrink:0"></span>
        ${escapeHtml(p.gene)}
        <button onclick="removeFromChart('${escapeHtml(p.gene)}')" style="background:none;border:none;cursor:pointer;padding:0;font-size:12px;color:#6b7280;min-height:unset">✕</button>
      </span>`).join("");
  }
}

window.removeFromChart = (gene) => {
  proteomicsSelected = proteomicsSelected.filter((p) => p.gene !== gene);
  updateChart();
};

function renderTopTable() {
  const container = document.getElementById("prot-top-table");
  if (!container || !proteomicsData) return;
  const withStd = proteomicsData.map((p) => {
    const vals = STAGES.map((s) => p.stages[s]);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / vals.length);
    return { ...p, std: Math.round(std * 100) / 100 };
  }).sort((a, b) => b.std - a.std).slice(0, 20);

  container.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:0.875rem">
      <thead>
        <tr style="border-bottom:2px solid var(--border,#e5e7eb)">
          <th style="text-align:left;padding:8px">Gene</th>
          <th style="text-align:left;padding:8px">Description</th>
          ${STAGES.map((s) => `<th style="text-align:right;padding:8px;white-space:nowrap">${s.split(" ")[0]}</th>`).join("")}
          <th style="text-align:right;padding:8px">SD</th>
        </tr>
      </thead>
      <tbody>
        ${withStd.map((p) => `
          <tr class="prot-table-row" data-gene="${escapeHtml(p.gene)}" style="border-bottom:1px solid var(--border,#f3f4f6);cursor:pointer" title="Click to add to chart">
            <td style="padding:8px;font-weight:700;color:var(--teal-dark)">${escapeHtml(p.gene)}</td>
            <td style="padding:8px;color:var(--muted,#6b7280);max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.desc)}</td>
            ${STAGES.map((s) => `<td style="text-align:right;padding:8px">${p.stages[s].toFixed(1)}</td>`).join("")}
            <td style="text-align:right;padding:8px;font-weight:600">${p.std}</td>
          </tr>`).join("")}
      </tbody>
    </table>`;

  container.querySelectorAll(".prot-table-row").forEach((row) => {
    row.addEventListener("click", () => {
      const gene = row.dataset.gene;
      const protein = proteomicsData.find((p) => p.gene === gene);
      if (protein) addToChart(protein);
    });
    row.addEventListener("mouseenter", () => row.style.background = "var(--soft,#edf6f2)");
    row.addEventListener("mouseleave", () => row.style.background = "");
  });
}

function wireProteomicsSearch() {
  const input = document.getElementById("prot-search");
  const suggestionsEl = document.getElementById("prot-suggestions");
  const searchBtn = document.getElementById("prot-search-btn");
  const clearBtn = document.getElementById("prot-clear-btn");

  const showSuggestions = () => {
    const results = proteomicsSearch(input?.value || "");
    if (!suggestionsEl) return;
    if (!results.length) { suggestionsEl.innerHTML = ""; return; }
    suggestionsEl.innerHTML = results.map((p) => `
      <button class="suggestion prot-suggestion" type="button" data-gene="${escapeHtml(p.gene)}" style="text-align:left;justify-content:space-between">
        <span>
          <strong>${escapeHtml(p.gene)}${p.uniprot ? ` · ${escapeHtml(p.uniprot)}` : ""}</strong>
          <small style="display:block;color:var(--muted,#6b7280)">${escapeHtml(p.desc.slice(0, 80))}</small>
        </span>
        <span class="tag">Add to chart</span>
      </button>`).join("");
    suggestionsEl.querySelectorAll(".prot-suggestion").forEach((btn) => {
      btn.addEventListener("click", () => {
        const protein = proteomicsData.find((p) => p.gene === btn.dataset.gene);
        if (protein) { addToChart(protein); suggestionsEl.innerHTML = ""; if (input) input.value = ""; }
      });
    });
  };

  input?.addEventListener("input", showSuggestions);
  searchBtn?.addEventListener("click", showSuggestions);
  clearBtn?.addEventListener("click", () => {
    proteomicsSelected = [];
    updateChart();
    if (suggestionsEl) suggestionsEl.innerHTML = "";
    if (input) input.value = "";
  });
}

function renderBlastPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Sequence search (BLAST)</h2>
          <p>BLAST a sequence against the nine sequenced dictyostelid genomes hosted here — hits in <em>D. discoideum</em> link straight to their gene page — or hand off to NCBI for an all-organisms search.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block">
          <h3>Search dictyBase genomes</h3>
          <form class="annotation-form" id="local-blast-form" novalidate>
            <div class="form-field">
              <label for="lblast-program">Program <span class="required">*</span></label>
              <select id="lblast-program" name="program" required>
                <option value="blastn">blastn — nucleotide query</option>
                <option value="tblastn">tblastn — protein query (translated search)</option>
              </select>
            </div>
            <div class="form-field">
              <label for="lblast-db">Genome <span class="required">*</span></label>
              <select id="lblast-db" name="database" required>
                ${Object.entries(LOCAL_BLAST_DBS).map(([id, label]) => `<option value="${id}"${id === "d-discoideum-ax4" ? " selected" : ""}>${label}</option>`).join("")}
                <option value="all">All nine dictyostelids</option>
              </select>
            </div>
            <div class="form-field">
              <label for="lblast-query">Query sequence <span class="required">*</span></label>
              <textarea id="lblast-query" name="query" required rows="7" placeholder="Paste a nucleotide (blastn) or protein (tblastn) sequence — FASTA or raw&#10;&#10;&gt;my_seq&#10;ATGCATGCATGC..."></textarea>
            </div>
            <div class="form-actions"><button type="submit" class="button primary">Run BLAST</button></div>
          </form>
          <div id="local-blast-results" style="margin-top:14px"></div>
        </section>

        <details class="data-block">
          <summary style="cursor:pointer;font-weight:800">Search NCBI instead (all organisms, protein databases)</summary>
          <form class="annotation-form" id="blast-form" novalidate style="margin-top:14px">
            <div class="form-field">
              <label for="blast-program">BLAST program <span class="required">*</span></label>
              <select id="blast-program" name="PROGRAM" required>
                <option value="blastn">blastn — nucleotide query vs nucleotide database</option>
                <option value="blastp">blastp — protein query vs protein database</option>
                <option value="blastx">blastx — nucleotide query vs protein database</option>
                <option value="tblastn">tblastn — protein query vs nucleotide database</option>
                <option value="tblastx">tblastx — nucleotide query vs translated nucleotide database</option>
              </select>
            </div>
            <div class="form-field">
              <label for="blast-query">Query sequence <span class="required">*</span></label>
              <textarea id="blast-query" name="QUERY" required rows="8" placeholder="Paste a nucleotide or protein sequence in FASTA format or as raw sequence&#10;&#10;&gt;my_sequence&#10;ATGCATGCATGC..."></textarea>
            </div>
            <div class="form-field">
              <label for="blast-db">Database</label>
              <select id="blast-db" name="DATABASE">
                <option value="nr">nr — non-redundant (all organisms)</option>
                <option value="refseq_select">RefSeq Select</option>
                <option value="swissprot">UniProtKB/Swiss-Prot</option>
                <option value="pdb">PDB protein sequences</option>
              </select>
            </div>
            <div class="form-field">
              <label for="blast-organism">Limit to organism (optional)</label>
              <select id="blast-organism" name="EQ_MENU">
                <option value="">All organisms</option>
                <optgroup label="Dictyostelids">
                  <option value="Dictyostelium discoideum (taxid:352472)" selected>D. discoideum AX4</option>
                  <option value="Dictyostelium purpureum (taxid:5786)">D. purpureum</option>
                  <option value="Cavenderia fasciculata (taxid:1217542)">C. fasciculata SH3</option>
                  <option value="Heterostelium pallidum (taxid:670386)">H. pallidum PN500</option>
                  <option value="Dictyostelium firmibasis (taxid:77157)">D. firmibasis</option>
                  <option value="Polysphondylium violaceum (taxid:5786)">P. violaceum</option>
                  <option value="Dictyostelia (taxid:30083)">All Dictyostelia</option>
                </optgroup>
                <optgroup label="Broader">
                  <option value="Amoebozoa (taxid:554915)">All Amoebozoa</option>
                  <option value="">All organisms</option>
                </optgroup>
              </select>
            </div>
            <div class="form-actions" style="display:flex;gap:10px;flex-wrap:wrap">
              <button type="submit" class="button primary">Run BLAST on NCBI</button>
              <button type="button" id="blast-clear" class="button">Clear</button>
            </div>
            <div id="blast-status" aria-live="polite"></div>
          </form>
        </details>
      </div>
    </article>
  `;
}

// species id -> label for the local BLAST genome picker (keys match serve.py BLAST_DBS / built DBs)
const LOCAL_BLAST_DBS = {
  "d-discoideum-ax4": "D. discoideum AX4",
  "d-purpureum": "D. purpureum",
  "d-firmibasis": "D. firmibasis",
  "c-fasciculata-sh3": "C. fasciculata SH3",
  "c-polycephalum": "C. polycephalum",
  "s-polycarpum": "S. polycarpum",
  "h-pallidum-pn500": "H. pallidum PN500",
  "h-pallidum-new": "H. pallidum (2026)",
  "p-violaceum": "P. violaceum",
};

async function runLocalBlast(form) {
  const results = document.getElementById("local-blast-results");
  if (!results) return;
  const program = form.querySelector("#lblast-program").value;
  const database = form.querySelector("#lblast-db").value;
  const query = form.querySelector("#lblast-query").value.trim();
  if (!query) { results.innerHTML = `<p class="notice">Enter a query sequence.</p>`; return; }
  results.innerHTML = `<p class="notice muted">Running ${escapeHtml(program)} against ${database === "all" ? "all nine genomes" : escapeHtml(LOCAL_BLAST_DBS[database] || database)}…</p>`;
  try {
    const res = await fetch("/api/blast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program, database, query })
    });
    const data = await res.json();
    if (!res.ok) { results.innerHTML = `<p class="notice">${escapeHtml(data.error || "BLAST failed.")}</p>`; return; }
    if (!data.hits || !data.hits.length) { results.innerHTML = `<p class="notice">No hits found (E-value &lt; 1e-3).</p>`; return; }
    results.innerHTML = `
      <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 10px">${data.count} hit${data.count === 1 ? "" : "s"} · ${escapeHtml(data.program)} · ${data.databases.length} genome${data.databases.length === 1 ? "" : "s"}</p>
      <ul class="list pubmed-list">
        ${data.hits.map((h) => {
          const name = h.gene
            ? `<a class="text-link curated-xref" href="/gene/${encodeURIComponent(h.gene.symbol)}" data-ddb-ref="${escapeHtml(h.gene.ddb)}">${escapeHtml(h.gene.symbol)}</a>`
            : escapeHtml(h.subject);
          const loc = `${escapeHtml(h.subject)}:${Number(h.sstart).toLocaleString()}–${Number(h.send).toLocaleString()}`;
          return `<li>
            <strong>${name}</strong>
            <span>${loc} · ${h.identity.toFixed(1)}% identity · ${h.length} bp · E=${escapeHtml(h.evalue)} · ${h.bitscore} bits</span>
          </li>`;
        }).join("")}
      </ul>`;
  } catch {
    results.innerHTML = `<p class="notice">Could not reach the BLAST service.</p>`;
  }
}

const browserOrganisms = [
  {
    id: "d-discoideum-ax4",
    label: "D. discoideum AX4",
    assembly: "GCF_000004695.1",
    fastaURL: "/assets/genomes/D_discoideum_AX4_refseq.fna",
    indexURL: "/assets/genomes/D_discoideum_AX4_refseq.fna.fai",
    gffURL: "/assets/genomes/D_discoideum_AX4.gff",
    locus: "NC_007087.3:1-200000"
  },
  {
    id: "d-purpureum",
    label: "D. purpureum",
    assembly: "GCA_000190715.1",
    fastaURL: "/assets/genomes/D_purpureum_browser.fna",
    indexURL: "/assets/genomes/D_purpureum_browser.fna.fai",
    gffURL: "/assets/genomes/D_purpureum_browser.gff",
    locus: "GL870941.1:1-200000"
  },
  {
    id: "d-firmibasis",
    label: "D. firmibasis",
    assembly: "GCA_036169595.1",
    fastaURL: "/assets/genomes/D_firmibasis_browser.fna",
    indexURL: "/assets/genomes/D_firmibasis_browser.fna.fai",
    gffURL: "/assets/genomes/D_firmibasis_browser.gff",
    locus: "CM069765.1:1-200000"
  },
  {
    id: "c-fasciculata-sh3",
    label: "C. fasciculata SH3",
    assembly: "GCA_000203815.1",
    fastaURL: "/assets/genomes/C_fasciculata_SH3_browser.fna",
    indexURL: "/assets/genomes/C_fasciculata_SH3_browser.fna.fai",
    gffURL: "/assets/genomes/C_fasciculata_SH3_browser.gff",
    locus: "GL883006.1:1-200000"
  },
  {
    id: "c-polycephalum",
    label: "C. polycephalum",
    assembly: "GCA_900092265.1",
    fastaURL: "/assets/genomes/C_polycephalum_browser.fna",
    indexURL: "/assets/genomes/C_polycephalum_browser.fna.fai",
    gffURL: null,
    locus: "FLTC01000001.1:1-200000"
  },
  {
    id: "s-polycarpum",
    label: "S. polycarpum",
    assembly: "GCA_900092255.1",
    fastaURL: "/assets/genomes/S_polycarpum_browser.fna",
    indexURL: "/assets/genomes/S_polycarpum_browser.fna.fai",
    gffURL: null,
    locus: "FLTE01000001.1:1-200000"
  },
  {
    id: "h-pallidum-pn500",
    label: "H. pallidum PN500",
    assembly: "GCA_000004825.1",
    fastaURL: "/assets/genomes/H_pallidum_PN500_browser.fna",
    indexURL: "/assets/genomes/H_pallidum_PN500_browser.fna.fai",
    gffURL: "/assets/genomes/H_pallidum_PN500_browser.gff",
    locus: "CP001838.1:1-200000"
  },
  {
    id: "h-pallidum-new",
    label: "H. pallidum (2026)",
    assembly: "GCA_054501735.1",
    fastaURL: "/assets/genomes/H_pallidum_new_browser.fna",
    indexURL: "/assets/genomes/H_pallidum_new_browser.fna.fai",
    gffURL: null,
    locus: "CM137139.1:1-200000"
  },
  {
    id: "p-violaceum",
    label: "P. violaceum",
    assembly: "GCA_000277445.1",
    fastaURL: "/assets/genomes/P_violaceum_browser.fna",
    indexURL: "/assets/genomes/P_violaceum_browser.fna.fai",
    gffURL: "/assets/genomes/P_violaceum_browser.gff",
    locus: "AJWJ01000001.1:1-200000"
  }
];

let igvBrowser = null;

function renderGenomeBrowser() {
  const options = browserOrganisms.map((o) =>
    `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)} · ${escapeHtml(o.assembly)}</option>`
  ).join("");
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Genome browser</h2>
          <p>Interactive genome browser for all nine sequenced dictyostelid species. Powered by IGV.js.</p>
        </div>
      </header>
      <div class="record-body">
        <div style="margin-bottom:12px;display:flex;align-items:center;gap:12px;flex-wrap:wrap">
          <label for="browser-org-select" style="font-size:0.875rem;font-weight:700">Organism:</label>
          <select id="browser-org-select" style="padding:6px 10px;border:1px solid var(--border,#d1d5db);border-radius:6px;font-size:0.875rem;font-family:inherit">
            ${options}
          </select>
          <span id="browser-gff-note" style="font-size:0.8125rem;color:var(--muted,#6b7280)"></span>
        </div>
        <div id="igv-container" style="width:100%;min-height:500px;border:1px solid var(--border,#e5e7eb);border-radius:8px;overflow:hidden;">
          <p style="padding:16px;color:var(--muted,#6b7280);font-size:0.875rem">Loading genome browser…</p>
        </div>
      </div>
    </article>
  `;
}

function buildIGVOptions(org) {
  const tracks = org.gffURL ? [{
    name: "Gene annotations",
    url: org.gffURL,
    format: "gff3",
    indexed: false,
    displayMode: "EXPANDED",
    color: "rgb(15, 118, 110)"
  }] : [];
  return {
    genome: {
      id: org.id,
      name: org.label,
      fastaURL: org.fastaURL,
      indexURL: org.indexURL,
      tracks
    },
    locus: org.locus
  };
}

function initGenomeBrowser() {
  const container = document.getElementById("igv-container");
  const select = document.getElementById("browser-org-select");
  const note = document.getElementById("browser-gff-note");
  if (!container || !select) return;

  const loadBrowser = (org) => {
    if (note) note.textContent = org.gffURL ? "" : "No gene annotations available for this organism.";
    if (igvBrowser) {
      igvBrowser.loadGenome(buildIGVOptions(org).genome).catch(() => {});
      return;
    }
    igv.createBrowser(container, buildIGVOptions(org))
      .then((b) => { igvBrowser = b; })
      .catch(() => {
        container.innerHTML = `<p style="padding:16px;color:var(--muted,#6b7280)">Browser could not be loaded.</p>`;
      });
  };

  const startWithOrg = browserOrganisms[0];

  const run = () => {
    loadBrowser(startWithOrg);
    select.addEventListener("change", () => {
      const org = browserOrganisms.find((o) => o.id === select.value);
      if (org) loadBrowser(org);
    });
  };

  if (window.igv) {
    run();
  } else {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/igv@3.0.2/dist/igv.min.js";
    script.onload = run;
    script.onerror = () => {
      container.innerHTML = `<p style="padding:16px;color:var(--muted,#6b7280)">IGV.js could not be loaded.</p>`;
    };
    document.head.appendChild(script);
  }
}

function hideContentSections() {
  [toolsShell, organismShell, communityShell, researchShell].forEach((shell) => {
    if (shell) {
      shell.innerHTML = "";
      shell.setAttribute("hidden", "");
    }
  });
}

function openOrganism(id, updateRoute = true) {
  hideContentSections();
  const org = organisms.find((o) => o.id === id);
  if (!org) return;
  if (updateRoute) history.pushState(null, "", `/organisms/${encodeURIComponent(id)}`);
  if (organismShell) {
    organismShell.innerHTML = renderOrganismPage(org);
    organismShell.removeAttribute("hidden");
  }
  const shell = document.querySelector("#organism");
  if (shell) scrollToY(shell.offsetTop - 60);
}

function renderOrganismPage(org) {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Organism · ${escapeHtml(org.group)}</p>
          <h2><em>${escapeHtml(org.name)}</em></h2>
          <p>${escapeHtml(org.description)}</p>
        </div>
        <a class="button primary" href="${escapeHtml(org.ncbiUrl)}" target="_blank" rel="noopener">NCBI Assembly</a>
      </header>
      <div class="record-body">
        <div class="section-grid">
          <section class="data-block">
            <h3>Assembly</h3>
            <div class="kv">
              <span>Accession</span><strong><a class="text-link" href="${escapeHtml(org.ncbiUrl)}" target="_blank" rel="noopener">${escapeHtml(org.assembly)}</a></strong>
              <span>Assembly name</span><strong>${escapeHtml(org.assemblyName)}</strong>
              <span>Genome size</span><strong>${escapeHtml(org.genomeSize)}</strong>
              <span>Chromosomes</span><strong>${escapeHtml(org.chromosomes)}</strong>
              <span>Genes</span><strong>${escapeHtml(org.genes)}</strong>
            </div>
          </section>
          <section class="data-block">
            <h3>External resources</h3>
            <div class="kv">
              <span>NCBI</span><strong><a class="text-link" href="${escapeHtml(org.ncbiUrl)}" target="_blank" rel="noopener">${escapeHtml(org.assembly)}</a></strong>
              ${org.amoebaDbUrl ? `<span>AmoebaDB</span><strong><a class="text-link" href="${escapeHtml(org.amoebaDbUrl)}" target="_blank" rel="noopener">AmoebaDB record</a></strong>` : ""}
            </div>
          </section>
        </div>

        <section class="data-block">
          <h3>Genome download</h3>
          <p>Genome sequence archived locally from NCBI (${escapeHtml(org.assembly)}). Gzipped FASTA format.</p>
          <a class="button primary" href="${escapeHtml(org.genomeFile)}" download>Download genome FASTA (.fna.gz)</a>
        </section>

        <section class="data-block">
          <h3>Source publications</h3>
          <ul class="list">
            ${org.papers.map((p) => `
              <li>
                <strong><a href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a></strong>
                <span>${escapeHtml(p.journal)} · PMID ${escapeHtml(p.pmid)}</span>
              </li>
            `).join("")}
          </ul>
        </section>
      </div>
    </article>
  `;
}

function openCommunity(section, updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", `/community/${encodeURIComponent(section)}`);
  renderCommunity(section);
  const shell = document.querySelector("#community");
  if (shell) scrollToY(shell.offsetTop - 60);
}

function renderCommunity(section) {
  if (!communityShell) return;
  if (section === "meetings") {
    communityShell.innerHTML = renderMeetingsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "labs") {
    communityShell.innerHTML = renderLabsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "annotations") {
    communityShell.innerHTML = renderAnnotationsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "upload-data") {
    communityShell.innerHTML = renderUploadDataPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "corrections") {
    communityShell.innerHTML = renderCorrectionsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "suggestions") {
    communityShell.innerHTML = renderSuggestionsPage();
    communityShell.removeAttribute("hidden");
  } else {
    communityShell.innerHTML = "";
    communityShell.setAttribute("hidden", "");
  }
}

function renderAnnotationsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Submit annotations</h2>
          <p>Upload gene annotations for review by dictyBase curators. You can submit GO terms, phenotypes, literature links, or other gene-level evidence. Accepted formats: CSV, TSV, XLSX, or plain text.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block" id="annotation-form-section">
          <h3>Annotation submission</h3>
          <form class="annotation-form" id="annotation-form" novalidate>
            <div class="form-field">
              <label for="ann-submitter-name">Your name <span class="required">*</span></label>
              <input type="text" id="ann-submitter-name" name="submitter_name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="ann-submitter-email">Email address <span class="required">*</span></label>
              <input type="email" id="ann-submitter-email" name="submitter_email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="ann-gene">Gene symbol or DDB ID <span class="required">*</span></label>
              <input type="text" id="ann-gene" name="gene" required placeholder="e.g. cln5, DDB_G0275299">
            </div>
            <div class="form-field">
              <label for="ann-type">Annotation type <span class="required">*</span></label>
              <select id="ann-type" name="annotation_type" required>
                <option value="">Select a type…</option>
                <option value="go">GO term</option>
                <option value="phenotype">Phenotype</option>
                <option value="literature">Literature / PMID</option>
                <option value="nomenclature">Nomenclature correction</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="ann-notes">Notes or description <span class="required">*</span></label>
              <textarea id="ann-notes" name="notes" required rows="4" placeholder="Describe the annotation, evidence, or correction you are submitting."></textarea>
            </div>
            <div class="form-field">
              <label for="ann-pmid">Supporting PMID (optional)</label>
              <input type="text" id="ann-pmid" name="pmid" placeholder="e.g. 34291044">
            </div>
            <div class="form-field">
              <label for="ann-file">Attach a file (optional)</label>
              <input type="file" id="ann-file" name="annotation_file" accept=".csv,.tsv,.xlsx,.txt,.pdf,.docx">
              <small>CSV, TSV, XLSX, TXT, PDF, or DOCX · max 10 MB</small>
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit annotation</button>
            </div>
            <div id="annotation-form-status" aria-live="polite"></div>
          </form>
        </section>
        <section class="data-block">
          <h3>What happens next</h3>
          <div class="kv">
            <span>Review</span><strong>Submissions are reviewed by dictyBase curators before being added to the database.</strong>
            <span>Contact</span><strong>Curators may follow up at the email address you provide.</strong>
            <span>Questions</span><strong>Email <a class="text-link" href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a> with any questions.</strong>
          </div>
        </section>
      </div>
    </article>
  `;
}

function renderUploadDataPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Upload data</h2>
          <p>Submit genome sequences, RNAseq, or proteomic datasets for inclusion in dictyBase. Fill in the form for your data type and a curator will follow up with transfer instructions. Large files are handled outside this form.</p>
        </div>
      </header>
      <div class="record-body">

        <section class="data-block">
          <h3>Genome sequence</h3>
          <form class="annotation-form" id="upload-genome-form" novalidate>
            <div class="form-field">
              <label for="gen-name">Your name <span class="required">*</span></label>
              <input type="text" id="gen-name" name="name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="gen-email">Email address <span class="required">*</span></label>
              <input type="email" id="gen-email" name="email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="gen-species">Species / strain <span class="required">*</span></label>
              <input type="text" id="gen-species" name="species" required placeholder="e.g. Dictyostelium discoideum AX4">
            </div>
            <div class="form-field">
              <label for="gen-assembly">Assembly version or accession</label>
              <input type="text" id="gen-assembly" name="assembly" placeholder="e.g. GCA_000004695.1">
            </div>
            <div class="form-field">
              <label for="gen-sequencing">Sequencing technology <span class="required">*</span></label>
              <select id="gen-sequencing" name="sequencing" required>
                <option value="">Select…</option>
                <option value="illumina">Illumina</option>
                <option value="nanopore">Oxford Nanopore</option>
                <option value="pacbio">PacBio</option>
                <option value="hybrid">Hybrid assembly</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="gen-format">File format <span class="required">*</span></label>
              <select id="gen-format" name="format" required>
                <option value="">Select…</option>
                <option value="fasta">FASTA</option>
                <option value="gff">GFF / GFF3</option>
                <option value="genbank">GenBank flat file</option>
                <option value="multiple">Multiple files</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="gen-size">Approximate dataset size</label>
              <input type="text" id="gen-size" name="size" placeholder="e.g. 120 MB, 2 GB">
            </div>
            <div class="form-field">
              <label for="gen-notes">Additional notes</label>
              <textarea id="gen-notes" name="notes" rows="3" placeholder="Annotation status, associated publication, access restrictions, etc."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit genome dataset</button>
            </div>
            <div id="upload-genome-status" aria-live="polite"></div>
          </form>
        </section>

        <section class="data-block">
          <h3>RNAseq data</h3>
          <form class="annotation-form" id="upload-rnaseq-form" novalidate>
            <div class="form-field">
              <label for="rna-name">Your name <span class="required">*</span></label>
              <input type="text" id="rna-name" name="name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="rna-email">Email address <span class="required">*</span></label>
              <input type="email" id="rna-email" name="email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="rna-species">Species / strain <span class="required">*</span></label>
              <input type="text" id="rna-species" name="species" required placeholder="e.g. Dictyostelium discoideum AX4">
            </div>
            <div class="form-field">
              <label for="rna-condition">Experimental condition <span class="required">*</span></label>
              <input type="text" id="rna-condition" name="condition" required placeholder="e.g. starvation time course, 0–24h">
            </div>
            <div class="form-field">
              <label for="rna-replicates">Number of replicates</label>
              <input type="number" id="rna-replicates" name="replicates" min="1" placeholder="e.g. 3">
            </div>
            <div class="form-field">
              <label for="rna-platform">Sequencing platform <span class="required">*</span></label>
              <select id="rna-platform" name="platform" required>
                <option value="">Select…</option>
                <option value="illumina-bulk">Illumina bulk RNA-seq</option>
                <option value="illumina-scrna">Illumina single-cell RNA-seq</option>
                <option value="nanopore">Oxford Nanopore</option>
                <option value="pacbio">PacBio</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="rna-accession">GEO or SRA accession (if deposited)</label>
              <input type="text" id="rna-accession" name="accession" placeholder="e.g. GSE123456 or SRP123456">
            </div>
            <div class="form-field">
              <label for="rna-size">Approximate dataset size</label>
              <input type="text" id="rna-size" name="size" placeholder="e.g. 40 GB">
            </div>
            <div class="form-field">
              <label for="rna-notes">Additional notes</label>
              <textarea id="rna-notes" name="notes" rows="3" placeholder="Alignment reference, pipeline used, associated publication, etc."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit RNAseq dataset</button>
            </div>
            <div id="upload-rnaseq-status" aria-live="polite"></div>
          </form>
        </section>

        <section class="data-block">
          <h3>Proteomic data</h3>
          <form class="annotation-form" id="upload-proteomics-form" novalidate>
            <div class="form-field">
              <label for="pro-name">Your name <span class="required">*</span></label>
              <input type="text" id="pro-name" name="name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="pro-email">Email address <span class="required">*</span></label>
              <input type="email" id="pro-email" name="email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="pro-species">Species / strain <span class="required">*</span></label>
              <input type="text" id="pro-species" name="species" required placeholder="e.g. Dictyostelium discoideum AX4">
            </div>
            <div class="form-field">
              <label for="pro-type">Data type <span class="required">*</span></label>
              <select id="pro-type" name="data_type" required>
                <option value="">Select…</option>
                <option value="mass-spec">Mass spectrometry (LC-MS/MS)</option>
                <option value="phospho">Phosphoproteomics</option>
                <option value="ubiquitin">Ubiquitinomics</option>
                <option value="interaction">Protein interaction (AP-MS, BioID)</option>
                <option value="abundance">Protein abundance (TMT, iTRAQ, SILAC)</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="pro-condition">Experimental condition <span class="required">*</span></label>
              <input type="text" id="pro-condition" name="condition" required placeholder="e.g. aggregation stage, wild type vs. cln5 null">
            </div>
            <div class="form-field">
              <label for="pro-repository">ProteomeXchange / PRIDE accession (if deposited)</label>
              <input type="text" id="pro-repository" name="repository" placeholder="e.g. PXD012345">
            </div>
            <div class="form-field">
              <label for="pro-format">File format</label>
              <select id="pro-format" name="format">
                <option value="">Select…</option>
                <option value="raw">Vendor raw files</option>
                <option value="mzml">mzML</option>
                <option value="txt">Tab-delimited results table</option>
                <option value="multiple">Multiple formats</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="pro-size">Approximate dataset size</label>
              <input type="text" id="pro-size" name="size" placeholder="e.g. 15 GB">
            </div>
            <div class="form-field">
              <label for="pro-notes">Additional notes</label>
              <textarea id="pro-notes" name="notes" rows="3" placeholder="Search database, software pipeline, associated publication, etc."></textarea>
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit proteomics dataset</button>
            </div>
            <div id="upload-proteomics-status" aria-live="polite"></div>
          </form>
        </section>

        <section class="data-block">
          <h3>Data transfer</h3>
          <div class="kv">
            <span>Large files</span><strong>After submitting a form, curators will follow up with secure transfer instructions (Globus, SFTP, or shared drive).</strong>
            <span>Accessions</span><strong>If your data is already deposited in GEO, SRA, PRIDE, or another repository, providing the accession is sufficient.</strong>
            <span>Contact</span><strong>Email <a class="text-link" href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a> with any questions.</strong>
          </div>
        </section>

      </div>
    </article>
  `;
}

function renderLabsPage() {
  const labs = window.dictyLabs || [];
  const active = labs.filter((l) => !l.emeritus).sort((a, b) => a.pi.split(" ").pop().localeCompare(b.pi.split(" ").pop()));
  const emeriti = labs.filter((l) => l.emeritus).sort((a, b) => a.pi.split(" ").pop().localeCompare(b.pi.split(" ").pop()));

  const renderCards = (list) => list.map((lab) => `
    <div class="ontology-term" style="align-items:flex-start">
      <div>
        <strong>
          ${lab.url
            ? `<a href="${escapeHtml(lab.url)}" target="_blank" rel="noopener" class="text-link">${escapeHtml(lab.pi)}</a>`
            : escapeHtml(lab.pi)}
        </strong>
        <span>${escapeHtml(lab.institution)}</span>
      </div>
      <p style="margin:0;color:var(--muted,#6b7280);font-size:0.8125rem">${escapeHtml(lab.location)}</p>
    </div>`).join("");

  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Dictyostelium labs</h2>
          <p>${active.length} active labs worldwide using <em>Dictyostelium</em> as a model organism. PI names link to lab websites.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block">
          <h3>Active labs</h3>
          <div class="ontology-term-list">${renderCards(active)}</div>
        </section>
        ${emeriti.length ? `
        <section class="data-block">
          <h3>Emeritus researchers</h3>
          <div class="ontology-term-list">${renderCards(emeriti)}</div>
        </section>` : ""}
        <p class="research-note">To add your lab, use <a class="text-link" href="/community/corrections">Submit corrections</a> or email <a class="text-link" href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a>.</p>
      </div>
    </article>
  `;
}

function renderCorrectionsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Submit corrections</h2>
          <p>Found an error on dictyBase? Use this form to report incorrect gene names, wrong links, outdated information, or any other mistake. Curators review all submissions.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block">
          <h3>Correction report</h3>
          <form class="annotation-form" id="corrections-form" novalidate>
            <div class="form-field">
              <label for="corr-name">Your name <span class="required">*</span></label>
              <input type="text" id="corr-name" name="name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="corr-email">Email address <span class="required">*</span></label>
              <input type="email" id="corr-email" name="email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="corr-page">Page or URL where the error appears <span class="required">*</span></label>
              <input type="text" id="corr-page" name="page" required placeholder="e.g. /gene/cln5 or Research > Techniques">
            </div>
            <div class="form-field">
              <label for="corr-type">Type of error <span class="required">*</span></label>
              <select id="corr-type" name="error_type" required>
                <option value="">Select a type…</option>
                <option value="wrong-data">Incorrect data (gene name, ID, sequence, etc.)</option>
                <option value="broken-link">Broken or wrong link</option>
                <option value="outdated">Outdated information</option>
                <option value="typo">Typo or formatting issue</option>
                <option value="missing">Missing information</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="corr-description">Describe the error <span class="required">*</span></label>
              <textarea id="corr-description" name="description" required rows="4" placeholder="What is wrong, and what should it say instead?"></textarea>
            </div>
            <div class="form-field">
              <label for="corr-source">Source or evidence (optional)</label>
              <input type="text" id="corr-source" name="source" placeholder="e.g. PMID, external URL, or database record">
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit correction</button>
            </div>
            <div id="corrections-form-status" aria-live="polite"></div>
          </form>
        </section>
      </div>
    </article>
  `;
}

function renderSuggestionsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Suggestions</h2>
          <p>Have an idea to improve dictyBase? We welcome suggestions for new features, content, tools, or anything else that would make the site more useful for the community.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block">
          <h3>Share your idea</h3>
          <form class="annotation-form" id="suggestions-form" novalidate>
            <div class="form-field">
              <label for="sug-name">Your name <span class="required">*</span></label>
              <input type="text" id="sug-name" name="name" autocomplete="name" required placeholder="Jane Smith">
            </div>
            <div class="form-field">
              <label for="sug-email">Email address <span class="required">*</span></label>
              <input type="email" id="sug-email" name="email" autocomplete="email" required placeholder="you@institution.edu">
            </div>
            <div class="form-field">
              <label for="sug-category">Category <span class="required">*</span></label>
              <select id="sug-category" name="category" required>
                <option value="">Select a category…</option>
                <option value="new-feature">New feature or tool</option>
                <option value="content">New content or data</option>
                <option value="design">Design or usability</option>
                <option value="search">Search improvements</option>
                <option value="integration">External resource integration</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div class="form-field">
              <label for="sug-title">Suggestion title <span class="required">*</span></label>
              <input type="text" id="sug-title" name="title" required placeholder="Brief title for your idea">
            </div>
            <div class="form-field">
              <label for="sug-description">Description <span class="required">*</span></label>
              <textarea id="sug-description" name="description" required rows="5" placeholder="Describe your suggestion in as much detail as you like. What problem would it solve? How should it work?"></textarea>
            </div>
            <div class="form-field">
              <label for="sug-priority">How important is this to you?</label>
              <select id="sug-priority" name="priority">
                <option value="">No preference</option>
                <option value="nice-to-have">Nice to have</option>
                <option value="would-use-often">I would use it often</option>
                <option value="essential">Essential for my work</option>
              </select>
            </div>
            <div class="form-actions">
              <button type="submit" class="button primary">Submit suggestion</button>
            </div>
            <div id="suggestions-form-status" aria-live="polite"></div>
          </form>
        </section>
      </div>
    </article>
  `;
}

function renderMeetingsPage() {
  const data = window.meetingsContent;
  if (!data) return "";
  const upcoming = data.conferences.filter((c) => c.upcoming);
  const past = data.conferences.filter((c) => !c.upcoming);
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Annual International Dictyostelium Conferences</h2>
          <p>${escapeHtml(data.intro)}</p>
        </div>
      </header>
      <div class="record-body">
        ${upcoming.length ? `
          <section class="data-block">
            <h3>Upcoming</h3>
            <div class="ontology-term-list">
              ${upcoming.map(renderConferenceItem).join("")}
            </div>
          </section>
        ` : ""}
        <section class="data-block">
          <h3>Previous meetings</h3>
          <div class="ontology-term-list">
            ${past.map(renderConferenceItem).join("")}
          </div>
        </section>
        <p class="research-note">${escapeHtml(data.acknowledgment)}</p>
      </div>
    </article>
  `;
}

function renderConferenceItem(conf) {
  const organizers = conf.organizers.join(", ");
  const meta = [conf.dates, conf.local ? "local meeting" : ""].filter(Boolean).join(" · ");
  return `
    <article class="ontology-term">
      <div>
        <strong>${escapeHtml(conf.year + (conf.name !== "Dicty " + conf.year ? " — " + conf.name : ""))}</strong>
        ${meta ? `<span>${escapeHtml(meta)}</span>` : ""}
      </div>
      <p>${escapeHtml(conf.location)}${organizers ? " · Organized by " + escapeHtml(organizers) : ""}</p>
    </article>
  `;
}

function renderResearch() {
  const resource = findResearchByToken(state.activeResearch);
  if (!researchShell || !resource) return;
  researchShell.removeAttribute("hidden");
  researchShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Research</p>
          <h2>${escapeHtml(resource.label)}</h2>
          <p>${escapeHtml(resource.dek || "Content for this research section will be added from the source document you provide.")}</p>
        </div>
      </header>

      ${renderResearchDropdown(resource)}

      <div class="record-body">
        ${renderResearchContent(resource)}
      </div>
    </article>
  `;
}

function renderTechnique(technique) {
  if (!researchShell) return;
  researchShell.removeAttribute("hidden");
  const hasArchivedContent = Boolean(technique.contentHtml);
  researchShell.innerHTML = `
    <article class="record-card research-card technique-detail-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Technique</p>
          <h2>${escapeHtml(technique.label)}</h2>
          <p>${escapeHtml(technique.category)} resource preserved as a local v2 route.</p>
        </div>
      </header>

      ${renderResearchDropdown(findResearchByToken("techniques"))}

      <div class="record-body">
        <div class="technique-detail-layout">
          <section class="data-block technique-archive-block">
            <a class="text-link" href="/research/techniques" data-research-tab="techniques">Back to all techniques</a>
            ${hasArchivedContent ? `
              <h3>${escapeHtml(technique.title || technique.label)}</h3>
              <div class="technique-archive-content">
                ${stripLeadingTechniqueHeading(technique.contentHtml)}
              </div>
            ` : `
              <h3>${escapeHtml(technique.label)}</h3>
              <p>This page now lives inside dictyBase v2, so the technique directory can keep routing even if the old dictyBase page is removed.</p>
              <p>This record points to an external file or publication rather than a dictyBase editor page. We can mirror the file itself in a later preservation pass.</p>
            `}
          </section>
          <aside class="data-block technique-source-block">
            <h3>Source record</h3>
            <div class="kv">
              <span>Category</span><strong>${escapeHtml(technique.category)}</strong>
              <span>Local path</span><strong>/research/techniques/${escapeHtml(technique.slug)}</strong>
              <span>Original</span><strong><a href="${escapeHtml(technique.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(new URL(technique.sourceUrl).hostname.replace(/^www\\./, ""))}</a></strong>
            </div>
          </aside>
        </div>
      </div>
    </article>
  `;
}

function renderResearchDropdown(activeResource) {
  return `
    <div class="research-dropdown" aria-label="Research sections">
      <button class="research-dropdown-trigger" type="button" aria-expanded="false" data-research-dropdown-trigger>
        <span>${escapeHtml(activeResource.label)}</span>
      </button>
      <div class="research-dropdown-menu">
        ${researchResources.map((item) => renderResearchDropdownOption(item, activeResource)).join("")}
      </div>
    </div>
  `;
}

function renderResearchDropdownOption(item, activeResource) {
  const content = `
    <strong>${escapeHtml(item.label)}</strong>
    <span>${escapeHtml(researchOptionSummary(item))}</span>
  `;
  return `<a class="research-dropdown-option ${item.id === activeResource.id ? "active" : ""}" href="/research/${escapeHtml(item.id)}">${content}</a>`;
}

function researchOptionSummary(resource) {
  if (resource.id === "techniques") return "Methods, protocols, assays, and preparations.";
  if (resource.id === "nomenclature-guidelines") return "Gene, strain, allele, and plasmid naming standards.";
  if (resource.id === "anatomy-ontology") return "Controlled terms for structures, stages, and cell types.";
  if (resource.id === "teaching-labs") return "Classroom-ready exercises and teaching resources.";
  return resource.dek || "";
}

function renderResearchContent(resource) {
  return `
    <div class="research-intro">
      ${(resource.paragraphs || []).map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
      ${resource.note ? `<p class="research-note">${escapeHtml(resource.note)}</p>` : ""}
      ${resource.sourceUrl ? `<p><a class="text-link" href="${escapeHtml(resource.sourceUrl)}" target="_blank" rel="noreferrer">Original dictyBase source page</a></p>` : ""}
    </div>
    ${renderResearchLinkSections(resource.linkSections || [])}
    ${resource.htmlContent ? `<section class="archived-page-content">${resource.htmlContent}</section>` : ""}
    <div class="ontology-groups">
      ${(resource.sections || []).map((section) => `
        <section class="data-block ontology-group">
          <div class="ontology-group-header">
            <h3>${escapeHtml(section.title)}</h3>
            ${section.id ? `<span>${escapeHtml(section.id)}</span>` : ""}
          </div>
          <p>${escapeHtml(section.definition || "")}</p>
          <div class="ontology-term-list">
            ${(section.terms || []).map(([term, id, definition]) => `
              <article class="ontology-term">
                <div>
                  <strong>${escapeHtml(term)}</strong>
                  ${id ? `<span>${escapeHtml(id)}</span>` : ""}
                </div>
                <p>${escapeHtml(definition)}</p>
              </article>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function renderResearchLinkSections(sections) {
  if (!sections.length) {
    return "";
  }

  return `
    <div class="technique-link-groups">
      ${sections.map((section) => `
        <section class="data-block technique-link-group">
          <h3>${escapeHtml(section.title)}</h3>
          <div class="technique-links">
            ${(section.links || []).map(([label, href]) => `
              <a class="technique-link" href="${escapeHtml(localTechniqueHref(label, href))}">
                <span>${escapeHtml(label)}</span>
                <small>${escapeHtml(new URL(href).hostname.replace(/^www\\./, ""))}</small>
              </a>
            `).join("")}
          </div>
        </section>
      `).join("")}
    </div>
  `;
}

function stripLeadingTechniqueHeading(html) {
  return String(html || "").replace(/^<h[1-3]>.*?<\/h[1-3]>/i, "").trim();
}

function buildTechniqueRecords() {
  const techniques = researchResources.find((resource) => resource.id === "techniques");
  return (techniques?.linkSections || []).flatMap((section) => (
    (section.links || []).map(([label, sourceUrl]) => {
      const slug = techniqueSlugFromUrl(label, sourceUrl);
      const archived = window.techniqueContent?.[slug] || {};
      return {
        label,
        sourceUrl,
        category: section.title,
        slug,
        title: archived.title,
        contentHtml: archived.contentHtml || ""
      };
    })
  ));
}

function techniqueSlugFromUrl(label, href) {
  try {
    const url = new URL(href);
    const parts = url.pathname.split("/").filter(Boolean);
    const lastPart = parts[parts.length - 1] || "";
    if (url.hostname.includes("dictybase.dev") && lastPart && lastPart !== "show") {
      return slugify(lastPart);
    }
  } catch (error) {
    // Fall through to the label-derived slug.
  }
  return slugify(label);
}

function slugify(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function localTechniqueHref(label, href) {
  return `/research/techniques/${encodeURIComponent(techniqueSlugFromUrl(label, href))}`;
}

function findTechniqueByToken(token) {
  const q = slugify(decodeURIComponent(token || ""));
  return techniqueRecords.find((item) => item.slug === q);
}

function renderTab(gene, tab) {
  if (tab === "GO") {
    return `
      <div class="data-block">
        <h3>Gene Ontology</h3>
        <div data-go-results="${gene.id}">
          <p class="notice muted">Loading GO annotations for ${escapeHtml(gene.symbol)}…</p>
        </div>
      </div>
    `;
  }
  if (tab === "Phenotypes") {
    return `
      <div class="data-block">
        <h3>Phenotypes</h3>
        <div data-phenotype-results="${escapeHtml(gene.id)}">
          <p class="notice muted">Loading phenotypes for ${escapeHtml(gene.symbol)}…</p>
        </div>
      </div>`;
  }
  if (tab === "Literature") {
    return `
      <div class="data-block">
        <h3>Literature</h3>
        <div class="curated-refs" data-curated-refs="${escapeHtml(gene.id)}">
          <p class="notice muted">Loading curated references…</p>
        </div>
        <a class="literature-search" href="${pubMedSearchUrl(gene)}" target="_blank" rel="noopener" style="margin-top:16px">Search PubMed for all ${escapeHtml(gene.symbol)} papers</a>
        <div class="pubmed-results" data-pubmed-results="${gene.id}">
          <p class="notice muted">Loading recent PubMed matches for ${escapeHtml(gene.symbol)}…</p>
        </div>
        ${gene.literature && gene.literature.length ? `
        <div class="seeded-literature">
          <h4>Seeded literature links</h4>
          ${list(gene.literature, ([pmid, title, journal]) => [`PMID ${pmid}`, `${title} ${journal}`], true)}
        </div>` : ""}
      </div>
    `;
  }
  if (tab === "Interactions") {
    return `
      <div class="data-block">
        <h3>Protein interactions <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— STRING database</span></h3>
        <div data-string-results="${escapeHtml(gene.id)}">
          <p class="notice muted">Loading STRING interactions for ${escapeHtml(gene.symbol)}…</p>
        </div>
      </div>
      <div class="data-block">
        <h3>Interaction network</h3>
        <div id="string-network-img" style="text-align:center">
          <p class="notice muted">Loading network image…</p>
        </div>
      </div>`;
  }

  if (tab === "Orthologs") {
    return `
      <div class="data-block">
        <h3>Orthologs <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— OMA Browser</span></h3>
        <div data-oma-results="${escapeHtml(gene.id)}">
          <p class="notice muted">Loading orthologs for ${escapeHtml(gene.symbol)}…</p>
        </div>
      </div>`;
  }

  if (tab === "PTMs") {
    return `
      <div class="data-block">
        <h3>Post-translational modifications <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— UniProt</span></h3>
        <div data-ptm-results="${escapeHtml(gene.id)}">
          <p class="notice muted">Loading PTMs for ${escapeHtml(gene.symbol)}…</p>
        </div>
      </div>`;
  }

  if (tab === "Structures") {
    const structureItems = gene.structures.map(([source, id, detail]) => {
      const href = source === "AlphaFold" && gene.uniprot
        ? `https://alphafold.ebi.ac.uk/entry/${gene.uniprot}`
        : source === "AlphaFold search"
          ? `https://alphafold.ebi.ac.uk/search/text/${encodeURIComponent(id)}`
          : null;
      const label = href ? `<a href="${escapeHtml(href)}" target="_blank" rel="noopener">${escapeHtml(source)}</a>` : escapeHtml(source);
      return `<li><strong>${label}</strong><span>${escapeHtml(id)} · ${escapeHtml(detail)}</span></li>`;
    }).join("");
    return `
      <div class="data-block">
        <h3>Predicted structures</h3>
        <ul class="list">${structureItems}</ul>
      </div>
      <div class="data-block">
        <h3>RCSB PDB — experimental structures</h3>
        <div class="pubmed-results" data-pdb-results="${gene.id}">
          <p class="notice muted">Searching PDB for ${gene.uniprot}…</p>
        </div>
      </div>
    `;
  }
  return `
    <div class="section-grid">
      <div style="display:grid;gap:14px;align-content:start">
        <section class="data-block">
          <h3>RNA-seq expression <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— Parikh et al. development time course</span></h3>
          <div id="rnaseq-inline-chart" data-gene-ddb="${escapeHtml(gene.veupath || '')}" style="position:relative;height:180px">
            <p class="notice muted" style="padding:8px">Loading expression data…</p>
          </div>
          <a class="text-link" href="https://app.dictyexpress.org/?gene=${encodeURIComponent(gene.symbol)}" target="_blank" rel="noopener" style="font-size:0.8125rem;margin-top:6px;display:block">View full data in dictyExpress →</a>
        </section>
        <section class="data-block">
          <h3>Record coverage</h3>
          <div class="kv">
            <span>GO rows</span><strong>${gene.go.length}</strong>
            <span>Phenotypes</span><strong>${gene.phenotypes.length}</strong>
            <span>Literature</span><strong>${gene.literature.length}</strong>
            <span>Structures</span><strong>${gene.structures.length}</strong>
          </div>
        </section>
      </div>
      <div style="display:grid;gap:14px;align-content:start">
        <section class="data-block">
          <h3>Identifiers</h3>
          <div class="kv">
            <span>Symbol</span><strong>${gene.symbol}</strong>
            <span>Name</span><strong>${gene.name}</strong>
            <span>Organism</span><strong>${gene.organism}</strong>
            <span>Location</span><strong>${gene.location}</strong>
            <span>NCBI Gene</span><strong>${gene.ncbiGene}</strong>
            <span>UniProt</span><strong>${gene.uniprot}</strong>
            <span>VEuPathDB</span><strong>AmoebaDB:${gene.veupath}</strong>
          </div>
        </section>
        ${/^DDB_G\d+$/.test(gene.veupath || "") ? `
        <section class="data-block">
          <h3>Sequences <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— FASTA download</span></h3>
          <ul class="list">
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=genomic&symbol=${encodeURIComponent(gene.symbol)}" download>Genomic DNA</a></strong><span>Gene region including introns</span></li>
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=cdna&symbol=${encodeURIComponent(gene.symbol)}" download>cDNA</a></strong><span>Spliced transcript (exons)</span></li>
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=protein&symbol=${encodeURIComponent(gene.symbol)}" download>Protein</a></strong><span>Translated coding sequence</span></li>
          </ul>
        </section>` : ""}
      </div>
    </div>
  `;
}

function list(rows, mapRow, linkPubMed = false) {
  return `<ul class="list">${rows.map((row) => {
    const [title, detail] = mapRow(row);
    const href = linkPubMed ? `https://pubmed.ncbi.nlm.nih.gov/${row[0]}/` : "";
    return `<li><strong>${href ? `<a href="${href}" target="_blank" rel="noopener">${title}</a>` : title}</strong><span>${detail}</span></li>`;
  }).join("")}</ul>`;
}

function escapeHtml(value) {
  return String(value || "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

// Render a dictyBase curated summary, converting its wiki-style markup into
// safe HTML: [target label] links (gene cross-refs, GO terms, PubMed),
// ''italics'', and <br /> line breaks. Plain text is escaped.
function renderCuratedText(text) {
  if (!text) return "";
  const s = String(text);
  const re = /\[(\S+)\s+([^\]]*)\]|''(.+?)''|<br\s*\/?>/g;
  let out = "", last = 0, m;
  while ((m = re.exec(s)) !== null) {
    out += escapeHtml(s.slice(last, m.index));
    last = re.lastIndex;
    if (m[1] !== undefined) out += curatedLink(m[1], (m[2] || "").trim());
    else if (m[3] !== undefined) out += `<em>${escapeHtml(m[3])}</em>`;
    else out += "<br>";
  }
  out += escapeHtml(s.slice(last));
  return out;
}

function curatedLink(target, label) {
  const text = escapeHtml(label || target);
  if (/^https?:/i.test(target)) {
    const pm = target.match(/pubmed\/(\d+)/i);
    const href = pm ? `https://pubmed.ncbi.nlm.nih.gov/${pm[1]}/` : target;
    return `<a class="text-link" href="${escapeHtml(href)}" target="_blank" rel="noopener">${text}</a>`;
  }
  if (target.startsWith("/gene/")) {
    const ddb = target.slice(6).split(/[/?#]/)[0];
    return `<a class="text-link curated-xref" href="/gene/${encodeURIComponent(label || ddb)}" data-ddb-ref="${escapeHtml(ddb)}">${text}</a>`;
  }
  if (target.startsWith("/ontology/go/")) {
    const go = target.split("/ontology/go/")[1].split(/[/?#]/)[0];
    const goId = "GO:" + go.padStart(7, "0");
    return `<a class="text-link" href="/go/${escapeHtml(goId)}">${text}</a>`;
  }
  return text;
}

async function fetchPubMedResults(gene) {
  if (pubMedCache.has(gene.id)) return pubMedCache.get(gene.id);

  const baseUrl = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/";
  const searchParams = new URLSearchParams({
    db: "pubmed",
    retmax: "12",
    retmode: "json",
    sort: "pub date",
    tool: "dictybase_v2",
    term: pubMedQuery(gene)
  });
  const searchResponse = await fetch(`${baseUrl}esearch.fcgi?${searchParams.toString()}`);
  if (!searchResponse.ok) throw new Error("PubMed search failed");
  const searchData = await searchResponse.json();
  const ids = searchData.esearchresult?.idlist || [];
  if (!ids.length) {
    pubMedCache.set(gene.id, []);
    return [];
  }

  const summaryParams = new URLSearchParams({
    db: "pubmed",
    id: ids.join(","),
    retmode: "json",
    tool: "dictybase_v2"
  });
  const summaryResponse = await fetch(`${baseUrl}esummary.fcgi?${summaryParams.toString()}`);
  if (!summaryResponse.ok) throw new Error("PubMed summary failed");
  const summaryData = await summaryResponse.json();
  const papers = (summaryData.result?.uids || ids)
    .map((pmid) => summaryData.result?.[pmid])
    .filter(Boolean)
    .map((item) => ({
      pmid: item.uid,
      title: item.title || "Untitled PubMed record",
      journal: item.fulljournalname || item.source || "PubMed",
      date: item.pubdate || "",
      authors: (item.authors || []).slice(0, 3).map((author) => author.name).filter(Boolean).join(", ")
    }));
  pubMedCache.set(gene.id, papers);
  return papers;
}

async function loadPubMedResults(gene) {
  const container = document.querySelector("[data-pubmed-results]");
  if (!container) return;

  try {
    const papers = await fetchPubMedResults(gene);
    if (state.activeGene !== gene || state.activeTab !== "Literature") return;
    if (!papers.length) {
      container.innerHTML = `<p class="notice">No PubMed results returned for this gene query. Use the PubMed search link above to broaden the search.</p>`;
      return;
    }
    container.innerHTML = `
      <h4>PubMed search results</h4>
      <ul class="list pubmed-list">
        ${papers.map((paper) => `
          <li>
            <strong><a href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(paper.pmid)}/" target="_blank" rel="noopener">${escapeHtml(paper.title)}</a></strong>
            <span>${escapeHtml([paper.journal, paper.date, paper.authors].filter(Boolean).join(" · "))}</span>
          </li>
        `).join("")}
      </ul>
    `;
  } catch (error) {
    container.innerHTML = `<p class="notice">PubMed results could not be loaded right now. The seeded literature links below are still available.</p>`;
  }
}

// Papers cited in the dictyBase curated summary (PMIDs embedded in the markup).
const curatedRefCache = new Map();

function curatedPmids(gene) {
  const out = [];
  const seen = new Set();
  const re = /pubmed\/(\d+)/gi;
  let m;
  while ((m = re.exec(String(gene.summary || ""))) !== null) {
    if (!seen.has(m[1])) { seen.add(m[1]); out.push(m[1]); }
  }
  return out;
}

async function loadCuratedReferences(gene) {
  const container = document.querySelector("[data-curated-refs]");
  if (!container) return;
  const pmids = curatedPmids(gene).slice(0, 60);
  if (!pmids.length) {
    container.innerHTML = `<p class="notice muted">No references are cited in the curated summary for ${escapeHtml(gene.symbol)}.</p>`;
    return;
  }
  const renderHeader = (n) => `<h4>Curated references <span style="font-weight:500;color:var(--muted,#6b7280)">— cited in the dictyBase summary (${n})</span></h4>`;
  try {
    let papers;
    if (curatedRefCache.has(gene.id)) {
      papers = curatedRefCache.get(gene.id);
    } else {
      const params = new URLSearchParams({ db: "pubmed", id: pmids.join(","), retmode: "json", tool: "dictybase_v2" });
      const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?${params.toString()}`);
      if (!res.ok) throw new Error("esummary failed");
      const data = await res.json();
      papers = pmids.map((pmid) => {
        const item = data.result?.[pmid];
        return {
          pmid,
          title: item?.title || `PMID ${pmid}`,
          journal: item?.fulljournalname || item?.source || "",
          date: item?.pubdate || "",
          authors: (item?.authors || []).slice(0, 3).map((a) => a.name).filter(Boolean).join(", ")
        };
      });
      curatedRefCache.set(gene.id, papers);
    }
    if (state.activeGene !== gene || state.activeTab !== "Literature") return;
    container.innerHTML = `
      ${renderHeader(papers.length)}
      <ul class="list pubmed-list">
        ${papers.map((p) => `
          <li>
            <strong><a href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(p.pmid)}/" target="_blank" rel="noopener">${escapeHtml(p.title)}</a></strong>
            <span>${escapeHtml([p.authors, p.journal, p.date].filter(Boolean).join(" · ")) || `PMID ${escapeHtml(p.pmid)}`}</span>
          </li>`).join("")}
      </ul>`;
  } catch {
    if (state.activeGene !== gene || state.activeTab !== "Literature") return;
    // Fallback: linked PMIDs without titles
    container.innerHTML = `
      ${renderHeader(pmids.length)}
      <ul class="list">
        ${pmids.map((pmid) => `<li><strong><a href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(pmid)}/" target="_blank" rel="noopener">PMID ${escapeHtml(pmid)}</a></strong></li>`).join("")}
      </ul>`;
  }
}

document.addEventListener("submit", (event) => {
  if (event.target.id === "local-blast-form") {
    event.preventDefault();
    runLocalBlast(event.target);
    return;
  }
  if (event.target.id === "blast-form") {
    event.preventDefault();
    const f = event.target;
    const query = f.querySelector("#blast-query")?.value.trim();
    const status = document.getElementById("blast-status");
    if (!query) {
      if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please paste a sequence before running BLAST.</p>`;
      return;
    }
    const program = f.querySelector("#blast-program")?.value || "blastn";
    const database = f.querySelector("#blast-db")?.value || "nr";
    const organism = f.querySelector("#blast-organism")?.value || "";
    const blastForm = document.createElement("form");
    blastForm.method = "POST";
    blastForm.action = "https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi";
    blastForm.target = "_blank";
    blastForm.style.display = "none";
    const params = {
      QUERY: query,
      PROGRAM: program,
      DATABASE: database,
      CMD: "Put",
      FORMAT_TYPE: "HTML",
      SHOW_OVERVIEW: "yes",
      ...(organism ? { EQ_MENU: organism } : {})
    };
    Object.entries(params).forEach(([k, v]) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = k;
      input.value = v;
      blastForm.appendChild(input);
    });
    document.body.appendChild(blastForm);
    blastForm.submit();
    document.body.removeChild(blastForm);
    if (status) status.innerHTML = `<p class="notice" style="color:green">BLAST submitted — results are opening on NCBI in a new tab.</p>`;
    return;
  }

  if (event.target.id === "annotation-form") {
    event.preventDefault();
    const form = event.target;
    const required = Array.from(form.querySelectorAll("[required]"));
    const missing = required.filter((el) => !el.value.trim());
    const status = document.querySelector("#annotation-form-status");
    if (missing.length) {
      missing[0].focus();
      if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please fill in all required fields.</p>`;
      return;
    }
    const data = new FormData(form);
    const summary = [
      `Submitter: ${data.get("submitter_name")} <${data.get("submitter_email")}>`,
      `Gene: ${data.get("gene")}`,
      `Type: ${data.get("annotation_type")}`,
      `Notes: ${data.get("notes")}`,
      data.get("pmid") ? `PMID: ${data.get("pmid")}` : null
    ].filter(Boolean).join("\n");
    const file = data.get("annotation_file");
    const hasFile = file && file.size > 0;
    window.location.href = `mailto:matt.scaglione@duke.edu?subject=${encodeURIComponent("Gene annotation submission: " + data.get("gene"))}&body=${encodeURIComponent(summary + (hasFile ? "\n\n[File attached: " + file.name + " — please attach it manually to this email]" : ""))}`;
    if (status) status.innerHTML = `<p class="notice">Your email client should have opened. If not, send your annotation directly to <a href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a>.</p>`;
    return;
  }

  const uploadForms = { "upload-genome-form": "Genome submission", "upload-rnaseq-form": "RNAseq submission", "upload-proteomics-form": "Proteomics submission" };
  if (uploadForms[event.target.id]) {
    event.preventDefault();
    const f = event.target;
    const missing = Array.from(f.querySelectorAll("[required]")).filter((el) => !el.value.trim());
    const statusId = f.id.replace("-form", "-status");
    const status = document.querySelector(`#${statusId}`);
    if (missing.length) { missing[0].focus(); if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please fill in all required fields.</p>`; return; }
    const d = new FormData(f);
    const lines = Array.from(d.entries()).map(([k, v]) => v ? `${k}: ${v}` : null).filter(Boolean);
    window.location.href = `mailto:matt.scaglione@duke.edu?subject=${encodeURIComponent(uploadForms[f.id] + ": " + (d.get("species") || ""))}&body=${encodeURIComponent(lines.join("\n"))}`;
    if (status) status.innerHTML = `<p class="notice">Your email client should have opened. A curator will follow up with data transfer instructions.</p>`;
    return;
  }

  if (event.target.id === "corrections-form") {
    event.preventDefault();
    const f = event.target;
    const missing = Array.from(f.querySelectorAll("[required]")).filter((el) => !el.value.trim());
    const status = document.querySelector("#corrections-form-status");
    if (missing.length) { missing[0].focus(); if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please fill in all required fields.</p>`; return; }
    const d = new FormData(f);
    const body = [`Page: ${d.get("page")}`, `Error type: ${d.get("error_type")}`, `Description: ${d.get("description")}`, d.get("source") ? `Source: ${d.get("source")}` : null, `From: ${d.get("name")} <${d.get("email")}>`].filter(Boolean).join("\n");
    window.location.href = `mailto:matt.scaglione@duke.edu?subject=${encodeURIComponent("Correction report: " + d.get("page"))}&body=${encodeURIComponent(body)}`;
    if (status) status.innerHTML = `<p class="notice">Your email client should have opened. If not, email <a href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a> directly.</p>`;
    return;
  }

  if (event.target.id === "suggestions-form") {
    event.preventDefault();
    const f = event.target;
    const missing = Array.from(f.querySelectorAll("[required]")).filter((el) => !el.value.trim());
    const status = document.querySelector("#suggestions-form-status");
    if (missing.length) { missing[0].focus(); if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please fill in all required fields.</p>`; return; }
    const d = new FormData(f);
    const body = [`Category: ${d.get("category")}`, `Title: ${d.get("title")}`, `Description: ${d.get("description")}`, d.get("priority") ? `Priority: ${d.get("priority")}` : null, `From: ${d.get("name")} <${d.get("email")}>`].filter(Boolean).join("\n");
    window.location.href = `mailto:matt.scaglione@duke.edu?subject=${encodeURIComponent("Suggestion: " + d.get("title"))}&body=${encodeURIComponent(body)}`;
    if (status) status.innerHTML = `<p class="notice">Your email client should have opened. If not, email <a href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a> directly.</p>`;
    return;
  }
});

const goCache = new Map();

const GO_ASPECT_LABEL = {
  "biological_process": "Biological Process",
  "molecular_function": "Molecular Function",
  "cellular_component": "Cellular Component",
  "P": "Biological Process",
  "F": "Molecular Function",
  "C": "Cellular Component"
};

async function fetchGOResults(gene) {
  if (goCache.has(gene.id)) return goCache.get(gene.id);
  if (!gene.uniprot) { goCache.set(gene.id, []); return []; }

  const response = await fetch(
    `https://www.ebi.ac.uk/QuickGO/services/annotation/search?geneProductId=UniProtKB:${gene.uniprot}&limit=100&includeFields=goName,name`,
    { headers: { Accept: "application/json" } }
  );
  if (!response.ok) throw new Error("QuickGO fetch failed");
  const data = await response.json();

  const seen = new Map();
  for (const ann of data.results || []) {
    const id = ann.goId;
    if (!seen.has(id)) {
      seen.set(id, {
        id,
        name: ann.goName || id,
        aspect: GO_ASPECT_LABEL[ann.goAspect] || ann.goAspect || "Unknown",
        evidence: ann.evidenceCode || ""
      });
    }
  }

  const results = Array.from(seen.values()).sort((a, b) => a.aspect.localeCompare(b.aspect) || a.name.localeCompare(b.name));
  goCache.set(gene.id, results);
  return results;
}

// dictyBase curated GO annotations (GO Consortium GAF): { ddb: [[goId, aspect, evidence, pmid], ...] }
let goAnnotData = null;
async function ensureGOAnnotations() {
  if (goAnnotData) return goAnnotData;
  const res = await fetch("/assets/go_annotations.json");
  if (!res.ok) throw new Error("GO annotations unavailable");
  goAnnotData = await res.json();
  return goAnnotData;
}

async function resolveGONames(goIds) {
  const out = {};
  if (!goIds.length) return out;
  try {
    const res = await fetch(`https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/${goIds.join(",")}`, { headers: { Accept: "application/json" } });
    if (res.ok) {
      const data = await res.json();
      for (const t of data.results || []) if (t.id && t.name) out[t.id] = t.name;
    }
  } catch { /* names fall back to GO IDs */ }
  return out;
}

async function loadGOResults(gene) {
  const container = document.querySelector("[data-go-results]");
  if (!container) return;
  const ddb = gene.veupath || gene.ddb || "";
  try {
    // Prefer dictyBase curated GO annotations from the GAF
    let curated = null;
    if (ddb) {
      try { curated = (await ensureGOAnnotations())[ddb]; } catch { /* fall through */ }
    }
    if (curated && curated.length) {
      const ids = [...new Set(curated.map((a) => a[0]))];
      const names = await resolveGONames(ids);
      if (state.activeGene !== gene || state.activeTab !== "GO") return;
      const aspects = { F: new Map(), P: new Map(), C: new Map() };
      for (const [go, aspect, ev, pmid] of curated) {
        const bucket = aspects[aspect] || (aspects[aspect] = new Map());
        if (!bucket.has(go)) bucket.set(go, []);
        bucket.get(go).push({ ev, pmid });
      }
      const html = ["F", "P", "C"].filter((a) => aspects[a] && aspects[a].size).map((a) => `
        <div style="margin-bottom:20px">
          <h4 style="margin:0 0 8px;font-size:0.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280)">${escapeHtml(GO_ASPECT_LABEL[a])}</h4>
          <ul class="list">
            ${[...aspects[a].entries()].map(([go, evs]) => {
              const refs = [...new Set(evs.map((e) => `${escapeHtml(e.ev)}${e.pmid ? ` <a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(e.pmid)}/" target="_blank" rel="noopener">PMID ${escapeHtml(e.pmid)}</a>` : ""}`))];
              return `<li>
                <strong><a href="/go/${escapeHtml(go)}">${escapeHtml(names[go] || go)}</a></strong>
                <span>${escapeHtml(go)} · ${refs.join(", ")}</span>
              </li>`;
            }).join("")}
          </ul>
        </div>`).join("");
      container.innerHTML = html + `<p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:4px">Source: dictyBase GO annotations (GO Consortium GAF) · <a class="text-link" href="http://geneontology.org/docs/guide-go-evidence-codes/" target="_blank" rel="noopener">evidence codes</a>.</p>`;
      return;
    }

    // Fallback: live QuickGO/UniProt lookup
    const terms = await fetchGOResults(gene);
    if (state.activeGene !== gene || state.activeTab !== "GO") return;
    if (!terms.length) {
      container.innerHTML = `<p class="notice">No GO annotations found for ${escapeHtml(gene.symbol)}.</p>`;
      return;
    }
    const byAspect = {};
    for (const term of terms) {
      (byAspect[term.aspect] = byAspect[term.aspect] || []).push(term);
    }
    container.innerHTML = Object.entries(byAspect).map(([aspect, items]) => `
      <div style="margin-bottom:20px">
        <h4 style="margin:0 0 8px;font-size:0.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280)">${escapeHtml(aspect)}</h4>
        <ul class="list">
          ${items.map((t) => `
            <li>
              <strong><a href="/go/${escapeHtml(t.id)}">${escapeHtml(t.name)}</a></strong>
              <span>${escapeHtml(t.id)}${t.evidence ? " · " + escapeHtml(t.evidence) : ""}</span>
            </li>
          `).join("")}
        </ul>
      </div>
    `).join("") + `<p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:4px">Source: QuickGO / UniProt (no dictyBase curated GO for this gene).</p>`;
  } catch (error) {
    container.innerHTML = `<p class="notice">GO annotations could not be loaded right now.</p>`;
  }
}

// --- GO term browsing: genes annotated to a GO term ---
function openGOTerm(goid, updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", `/go/${encodeURIComponent(goid)}`);
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Gene Ontology</p>
          <h2 id="go-term-name">${escapeHtml(goid)}</h2>
          <p id="go-term-def" style="color:var(--muted,#6b7280);line-height:1.55">Loading term…</p>
        </div>
      </header>
      <div class="record-body">
        <div data-go-term-genes><p class="notice muted">Loading annotated genes…</p></div>
      </div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadGOTerm(goid);
}

async function loadGOTerm(goid) {
  const nameEl = document.getElementById("go-term-name");
  const defEl = document.getElementById("go-term-def");
  const genesEl = document.querySelector("[data-go-term-genes]");
  try {
    const r = await fetch(`https://www.ebi.ac.uk/QuickGO/services/ontology/go/terms/${encodeURIComponent(goid)}`, { headers: { Accept: "application/json" } });
    if (r.ok) {
      const t = (await r.json()).results?.[0];
      if (t && nameEl) {
        nameEl.innerHTML = `${escapeHtml(t.name || goid)} <span style="font-size:0.5em;font-weight:500;color:var(--muted,#6b7280)">${escapeHtml(goid)} · ${escapeHtml(GO_ASPECT_LABEL[t.aspect] || t.aspect || "")}</span>`;
        if (defEl) defEl.innerHTML = `${escapeHtml(t.definition?.text || "")} <a class="text-link" href="https://www.ebi.ac.uk/QuickGO/term/${encodeURIComponent(goid)}" target="_blank" rel="noopener">View on QuickGO ↗</a>`;
      }
    }
  } catch { /* term header stays as the GO id */ }
  try {
    const res = await fetch(`/api/go/${encodeURIComponent(goid)}`);
    const data = await res.json();
    if (!genesEl) return;
    if (!data.genes || !data.genes.length) {
      genesEl.innerHTML = `<p class="notice">No <em>D. discoideum</em> genes are annotated to ${escapeHtml(goid)}.</p>`;
      return;
    }
    const byGene = new Map();
    for (const g of data.genes) {
      if (!byGene.has(g.ddb)) byGene.set(g.ddb, { symbol: g.symbol, ddb: g.ddb, evs: new Set() });
      byGene.get(g.ddb).evs.add(g.evidence);
    }
    const genes = [...byGene.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
    genesEl.innerHTML = `
      <div class="data-block">
        <h3>${genes.length} <em>D. discoideum</em> gene${genes.length === 1 ? "" : "s"} annotated to this term</h3>
        <div class="technique-links">
          ${genes.map((g) => `<a class="technique-link curated-xref" data-ddb-ref="${escapeHtml(g.ddb)}" href="/gene/${encodeURIComponent(g.symbol)}"><span>${escapeHtml(g.symbol)}</span><small>${escapeHtml([...g.evs].join(", "))}</small></a>`).join("")}
        </div>
      </div>`;
  } catch {
    if (genesEl) genesEl.innerHTML = `<p class="notice">Could not load annotated genes.</p>`;
  }
}

// --- Strain pages ---
function openStrain(sid, updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", `/strain/${encodeURIComponent(sid)}`);
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Mutant strain</p>
          <h2>${escapeHtml(sid)}</h2>
          <p id="strain-gene" style="color:var(--muted,#6b7280)">Loading…</p>
        </div>
      </header>
      <div class="record-body">
        <div data-strain-phenos><p class="notice muted">Loading phenotypes…</p></div>
      </div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadStrain(sid);
}

async function loadStrain(sid) {
  const geneEl = document.getElementById("strain-gene");
  const phEl = document.querySelector("[data-strain-phenos]");
  try {
    const res = await fetch(`/api/strain/${encodeURIComponent(sid)}`);
    const data = await res.json();
    if (geneEl) {
      geneEl.innerHTML = data.gene
        ? `Mutant of <a class="text-link curated-xref" data-ddb-ref="${escapeHtml(data.gene.ddb)}" href="/gene/${encodeURIComponent(data.gene.symbol || data.gene.ddb)}">${escapeHtml(data.gene.symbol || data.gene.ddb)}</a> · ${escapeHtml(data.gene.ddb)}`
        : "No associated gene in this dataset.";
    }
    if (!phEl) return;
    const ph = data.phenotypes || [];
    if (!ph.length) { phEl.innerHTML = `<p class="notice">No phenotypes recorded for ${escapeHtml(sid)}.</p>`; return; }
    phEl.innerHTML = `
      <div class="data-block">
        <h3>${ph.length} phenotype${ph.length === 1 ? "" : "s"}</h3>
        <ul class="list">
          ${ph.map((p) => {
            const note = String(p.note || "").replace(/\s*\[strain ID:[^\]]*\]/gi, "").trim();
            const detail = [p.condition, note].filter(Boolean).map(escapeHtml).join(" · ");
            const ref = p.pmid ? `<a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(p.pmid)}/" target="_blank" rel="noopener">PMID ${escapeHtml(p.pmid)}</a>` : "";
            return `<li><strong>${escapeHtml(p.phenotype)}</strong><span>${[detail, ref].filter(Boolean).join(" · ") || "&nbsp;"}</span></li>`;
          }).join("")}
        </ul>
      </div>`;
  } catch {
    if (phEl) phEl.innerHTML = `<p class="notice">Could not load strain ${escapeHtml(sid)}.</p>`;
  }
}

// --- Data & sources (provenance + freshness) ---
function openDataPage(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/data");
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">About</p>
          <h2>Data &amp; sources</h2>
          <p>Where each dataset comes from and when it was last refreshed. dictyBase v2 aggregates and re-presents these sources — it is a modern front-end, not the authoritative curator.</p>
        </div>
      </header>
      <div class="record-body">
        <div data-data-status><p class="notice muted">Loading…</p></div>
      </div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadDataStatus();
}

async function loadDataStatus() {
  const el = document.querySelector("[data-data-status]");
  if (!el) return;
  try {
    const data = await (await fetch("/api/data-status")).json();
    el.innerHTML = `
      <div class="data-block">
        <table style="width:100%;border-collapse:collapse;font-size:0.9375rem">
          <thead><tr style="text-align:left;color:var(--muted,#6b7280);font-size:0.75rem;text-transform:uppercase;letter-spacing:.05em">
            <th style="padding:8px 10px">Dataset</th><th style="padding:8px 10px">Source</th><th style="padding:8px 10px;text-align:right">Records</th><th style="padding:8px 10px">Updated</th>
          </tr></thead>
          <tbody>
            ${data.datasets.map((d) => `<tr style="border-top:1px solid var(--line,#e5e7eb)">
              <td style="padding:10px"><strong>${escapeHtml(d.label)}</strong></td>
              <td style="padding:10px;color:var(--muted,#6b7280)">${escapeHtml(d.source)}</td>
              <td style="padding:10px;text-align:right">${Number(d.records).toLocaleString()}</td>
              <td style="padding:10px;white-space:nowrap">${escapeHtml(d.updated || "—")}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:10px">Dates reflect the last local refresh of each dataset (regenerated via <code>scripts/build_data.py</code>).</p>`;
  } catch {
    el.innerHTML = `<p class="notice">Could not load data status.</p>`;
  }
}

// --- dictyBase curated corpus ---
let dictyCorpus = null;

async function ensureDictyCorpus() {
  if (dictyCorpus) return dictyCorpus;
  const res = await fetch("/assets/dictybase_corpus.json");
  if (!res.ok) throw new Error("Corpus not available");
  dictyCorpus = await res.json();
  return dictyCorpus;
}

async function enrichGeneFromCorpus(gene) {
  const ddb = gene.veupath;
  if (!ddb) return gene;
  try {
    const corpus = await ensureDictyCorpus();
    const entry = corpus[ddb];
    if (!entry) return gene;
    const enriched = { ...gene };
    if (entry.summary && (!enriched.summary || enriched.summary === enriched.name)) {
      enriched.summary = entry.summary;
    }
    if (entry.phenotypes?.length && enriched.phenotypes?.length === 0) {
      enriched.phenotypes = entry.phenotypes.map(([term, note, pmid]) =>
        [term, [note, pmid ? `PMID:${pmid}` : ""].filter(Boolean).join(" ")]
      );
    }
    if (entry.curator) enriched._curator = entry.curator;
    if (entry.note) enriched._curatorNote = entry.note;
    return enriched;
  } catch {
    return gene;
  }
}

// --- Phenotypes (dictyBase mutant-strain curation) ---
let phenotypeData = null;

async function ensurePhenotypeData() {
  if (phenotypeData) return phenotypeData;
  const res = await fetch("/assets/phenotypes.json");
  if (!res.ok) throw new Error("Phenotype data not available");
  phenotypeData = await res.json();
  return phenotypeData;
}

async function loadPhenotypes(gene) {
  const container = document.querySelector("[data-phenotype-results]");
  if (!container) return;
  const ddb = gene.veupath || gene.ddb || "";
  try {
    const [data, geneApi] = await Promise.all([
      ddb ? ensurePhenotypeData() : null,
      ddb ? fetch(`/api/gene/${encodeURIComponent(ddb)}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : null,
    ]);
    if (state.activeGene !== gene || state.activeTab !== "Phenotypes") return;
    const rows = (data && data[ddb]) || [];
    const strains = (geneApi && geneApi.strains) || [];
    const strainLine = strains.length
      ? `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 12px">Mutant strain${strains.length === 1 ? "" : "s"}: ${strains.map((s) => `<a class="text-link" href="/strain/${encodeURIComponent(s)}">${escapeHtml(s)}</a>`).join(", ")}</p>`
      : "";
    if (rows.length) {
      container.innerHTML = strainLine + `
        <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 12px">${rows.length} curated phenotype${rows.length === 1 ? "" : "s"} from dictyBase mutant strains.</p>
        <ul class="list">
          ${rows.map(([term, cond, pmid, note]) => {
            const cleanNote = String(note || "").replace(/\s*\[strain ID:[^\]]*\]/gi, "").trim();
            const detail = [cond, cleanNote].filter(Boolean).map(escapeHtml).join(" · ");
            const ref = pmid ? `<a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/${encodeURIComponent(pmid)}/" target="_blank" rel="noopener">PMID ${escapeHtml(pmid)}</a>` : "";
            return `<li><strong>${escapeHtml(term)}</strong><span>${[detail, ref].filter(Boolean).join(" · ") || "&nbsp;"}</span></li>`;
          }).join("")}
        </ul>`;
      return;
    }
    if (gene.phenotypes && gene.phenotypes.length) {
      container.innerHTML = strainLine + `<ul class="list">${gene.phenotypes.map(([term, detail]) =>
        `<li><strong>${escapeHtml(term)}</strong><span>${escapeHtml(detail || "")}</span></li>`).join("")}</ul>`;
      return;
    }
    container.innerHTML = strainLine + `<p class="notice muted">No curated phenotypes recorded for ${escapeHtml(gene.symbol)} yet.</p>`;
  } catch {
    container.innerHTML = `<p class="notice">Phenotypes could not be loaded right now.</p>`;
  }
}

// --- RNAseq expression (Parikh et al.) ---
let rnaseqData = null;
const TP_LABELS = ["0h", "4h", "8h", "12h", "16h", "20h", "24h"];
const TP_KEYS = [0, 4, 8, 12, 16, 20, 24];

async function ensureRNAseqData() {
  if (rnaseqData) return rnaseqData;
  const res = await fetch("/assets/rnaseq_parikh.json");
  if (!res.ok) throw new Error("RNAseq data not available");
  rnaseqData = await res.json();
  return rnaseqData;
}

async function loadRNAseqInline(gene) {
  const el = document.getElementById("rnaseq-inline-chart");
  if (!el) return;

  const ddb = el.dataset.geneDdb || gene.veupath || gene.ddb || "";
  if (!ddb) {
    el.innerHTML = `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);padding:8px">No DDB ID — expression data unavailable.</p>`;
    return;
  }

  try {
    const data = await ensureRNAseqData();
    const vals = data[ddb];
    if (!vals) {
      el.innerHTML = `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);padding:8px">No expression data found for ${escapeHtml(ddb)}.</p>`;
      return;
    }

    const points = TP_KEYS.map((tp) => vals[tp] ?? 0);
    const max = Math.max(...points) || 1;

    const loadChart = () => {
      const canvas = document.createElement("canvas");
      el.innerHTML = "";
      el.appendChild(canvas);
      new Chart(canvas, {
        type: "line",
        data: {
          labels: TP_LABELS,
          datasets: [{
            label: `${gene.symbol} RPKM`,
            data: points,
            borderColor: "#0f766e",
            backgroundColor: "#0f766e22",
            tension: 0.3,
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => `RPKM: ${ctx.parsed.y.toFixed(1)}`
              }
            }
          },
          scales: {
            x: { title: { display: true, text: "Development (hours)" } },
            y: { title: { display: true, text: "RPKM" }, beginAtZero: true }
          },
          onClick: () => {
            window.open(`https://app.dictyexpress.org/?gene=${encodeURIComponent(gene.symbol)}`, "_blank");
          }
        }
      });
    };

    if (window.Chart) { loadChart(); }
    else {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
      s.onload = loadChart;
      document.head.appendChild(s);
    }
  } catch {
    el.innerHTML = `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);padding:8px">Expression data could not be loaded.</p>`;
  }
}

// --- STRING interactions ---
const stringCache = new Map();

async function loadStringResults(gene) {
  const container = document.querySelector("[data-string-results]");
  const imgContainer = document.getElementById("string-network-img");
  if (!container) return;

  try {
    if (stringCache.has(gene.id)) {
      renderStringResults(gene, stringCache.get(gene.id), imgContainer, container);
      return;
    }
    const sym = encodeURIComponent(gene.symbol);
    const res = await fetch(`https://string-db.org/api/json/interaction_partners?identifiers=${sym}&species=44689&limit=20`);
    if (!res.ok) throw new Error("STRING fetch failed");
    const data = await res.json();
    stringCache.set(gene.id, data);
    renderStringResults(gene, data, imgContainer, container);
  } catch {
    container.innerHTML = `<p class="notice">STRING interactions could not be loaded.</p>`;
    if (imgContainer) imgContainer.innerHTML = "";
  }
}

function renderStringResults(gene, data, imgContainer, container) {
  if (!data.length) {
    container.innerHTML = `<p class="notice">No STRING interactions found for ${escapeHtml(gene.symbol)}.</p>`;
    if (imgContainer) imgContainer.innerHTML = "";
    return;
  }
  const partners = data.filter((r) => r.preferredName_B !== gene.symbol);
  container.innerHTML = `
    <ul class="list">
      ${partners.slice(0, 15).map((r) => {
        const partner = r.preferredName_B || r.preferredName_A;
        const score = (r.score * 100).toFixed(0);
        const barW = Math.round(r.score * 100);
        return `<li>
          <strong><a href="https://string-db.org/cgi/network?species_text=Dictyostelium+discoideum&identifiers=${encodeURIComponent(gene.symbol)}%0D${encodeURIComponent(partner)}" target="_blank" rel="noopener">${escapeHtml(partner)}</a></strong>
          <span style="display:flex;align-items:center;gap:8px">
            <span style="flex:1;max-width:120px;height:6px;background:#e5e7eb;border-radius:999px;overflow:hidden">
              <span style="display:block;height:100%;width:${barW}%;background:var(--teal,#0f766e);border-radius:999px"></span>
            </span>
            Score: ${score}/100
          </span>
        </li>`;
      }).join("")}
    </ul>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin-top:8px">
      <a class="text-link" href="https://string-db.org/cgi/network?species_text=Dictyostelium+discoideum&identifiers=${encodeURIComponent(gene.symbol)}" target="_blank" rel="noopener">View full network on STRING →</a>
    </p>`;
  if (imgContainer) {
    const imgUrl = `https://string-db.org/api/image/network?identifiers=${encodeURIComponent(gene.symbol)}&species=44689&network_flavor=confidence`;
    imgContainer.innerHTML = `<img src="${imgUrl}" alt="STRING network for ${escapeHtml(gene.symbol)}" style="max-width:100%;border-radius:8px;border:1px solid var(--border,#e5e7eb)">`;
  }
}

// --- Search page (General / Phenotype / GO term / Localization) ---
const SEARCH_PAGE_MODES = [
  { key: "general", label: "General", title: "Search dictyBase",
    blurb: "Search the whole site — genes plus organisms, research pages, and tools.",
    placeholder: "Search genes, pages, organisms, tools — e.g. cln5, BLAST, nomenclature" },
  { key: "phenotype", label: "Phenotype", title: "Phenotype search",
    blurb: "Find genes by curated mutant phenotype.",
    placeholder: "Phenotype term — e.g. chemotaxis, aggregation, spore" },
  { key: "go", label: "GO term", title: "GO term search",
    blurb: "Find a Gene Ontology term and the Dictyostelium genes annotated to it.",
    placeholder: "GO term name or ID — e.g. autophagy, GO:0006914" },
  { key: "localization", label: "Localization", title: "Localization search",
    blurb: "Find subcellular locations (GO cellular component) and the genes there.",
    placeholder: "Location — e.g. nucleus, plasma membrane, phagosome" },
];

let searchPageMode = "general";
let searchPageDebounce = null;
let searchPageReq = 0; // invalidates stale async results when typing or switching mode

// A searchable index of the site's content — not just the top-level nav, but
// the individual protocols, nomenclature/anatomy terms, and organism records
// reachable underneath it, so a search for e.g. "media" finds the media
// protocol inside the Techniques page. Built once at startup; `keywords` holds
// extra text that's matched but not displayed (definitions, categories, …).
let SITE_PAGES = [];
function htmlToText(html) {
  return (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}
function buildSiteIndex() {
  const pages = [];
  const byKey = new Map();
  const clip = (s, n = 140) => {
    s = (s || "").replace(/\s+/g, " ").trim();
    return s.length > n ? s.slice(0, n - 1) + "…" : s;
  };
  // Duplicate entries (same page reached two ways) merge their keywords rather
  // than dropping, so the body text from one source enriches the other.
  const add = (title, description, href, group, opts = {}) => {
    title = (title || "").trim();
    if (!title || !href) return;
    const key = (href + "|" + title).toLowerCase();
    const kw = (opts.keywords || "").toLowerCase();
    const existing = byKey.get(key);
    if (existing) {
      if (kw) existing.keywords = `${existing.keywords} ${kw}`.trim();
      return;
    }
    const entry = {
      title,
      description: clip(description),
      href,
      group: group || "",
      external: !!opts.external,
      keywords: kw,
    };
    byKey.set(key, entry);
    pages.push(entry);
  };

  // 1. Top-level nav destinations.
  for (const a of document.querySelectorAll(".nav-links .menu-option")) {
    const href = a.getAttribute("href") || "";
    add(
      a.querySelector("strong")?.textContent || a.textContent,
      a.querySelector("span")?.textContent || "",
      href,
      a.closest(".nav-item")?.querySelector(".nav-trigger")?.textContent.trim() || "",
      { external: a.target === "_blank" || /^https?:/i.test(href) }
    );
  }

  // 2. Individual protocols/techniques — full body text indexed so the recipe
  //    inside a protocol (e.g. "HL5" within Media and Buffers) is findable.
  for (const t of techniqueRecords || []) {
    add(t.label, t.category ? `Technique · ${t.category}` : "Technique",
      localTechniqueHref(t.label, t.sourceUrl), "Techniques",
      { keywords: `${t.category || ""} ${htmlToText(t.contentHtml)}` });
  }

  // 3. Research resources: the page itself (with its full body text), then its
  //    sections, terms, and link categories.
  for (const r of researchResources || []) {
    const href = `/research/${encodeURIComponent(r.id)}`;
    add(r.label, r.dek || "", href, "Research",
      { keywords: `${r.dek || ""} ${(r.paragraphs || []).join(" ")} ${htmlToText(r.htmlContent)}` });
    for (const s of r.sections || []) {
      add(s.title, `${r.label} · ${s.definition || ""}`, href, r.label, { keywords: s.definition });
      for (const term of s.terms || []) {
        add(term[0], `${r.label} — ${s.title}`, href, r.label, { keywords: term[2] });
      }
    }
    for (const ls of r.linkSections || []) {
      add(ls.title, `${r.label} category`, href, r.label, { keywords: (ls.links || []).map((l) => l[0]).join(" ") });
    }
  }

  // 4. Organisms with their full descriptions.
  for (const o of organisms || []) {
    add(o.name, o.description || o.group || "", `/organisms/${encodeURIComponent(o.id)}`, "Organisms",
      { keywords: `${o.shortName || ""} ${o.group || ""}` });
  }

  // 5. Community: every lab/PI by name, plus meeting history text.
  for (const lab of window.dictyLabs || []) {
    if (!lab || !lab.pi) continue;
    add(lab.pi, `Labs · ${[lab.institution, lab.location].filter(Boolean).join(" · ")}`,
      lab.url || "/community/labs", lab.url ? "Labs" : "Community",
      { external: !!lab.url, keywords: `${lab.institution || ""} ${lab.location || ""}` });
  }
  if (window.meetingsContent) {
    add("Meetings", "Dictyostelium meetings and community events.", "/community/meetings", "Community",
      { keywords: htmlToText(JSON.stringify(window.meetingsContent)) });
  }

  SITE_PAGES = pages;
}

function searchSitePages(q) {
  const nq = q.toLowerCase().trim();
  if (nq.length < 2) return [];
  const scored = [];
  for (const p of SITE_PAGES) {
    const title = p.title.toLowerCase();
    if (title.includes(nq)) {
      scored.push([title === nq ? 0 : title.startsWith(nq) ? 1 : 2, p]);
    } else if (
      p.group.toLowerCase().includes(nq) ||
      p.description.toLowerCase().includes(nq) ||
      p.keywords.includes(nq)
    ) {
      scored.push([3, p]);
    }
  }
  scored.sort((a, b) => a[0] - b[0] || a[1].title.localeCompare(b[1].title));
  return scored.slice(0, 15).map((s) => s[1]);
}

function openSearchPage(mode, updateRoute = true) {
  hideContentSections();
  if (!SEARCH_PAGE_MODES.some((m) => m.key === mode)) mode = "general";
  searchPageMode = mode;
  if (updateRoute) history.pushState(null, "", `/search/${mode}`);
  if (!toolsShell) return;
  renderSearchPage();
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
}

function renderSearchPage() {
  if (!toolsShell) return;
  searchPageReq++; // drop any in-flight request from a previous mode
  const cfg = SEARCH_PAGE_MODES.find((m) => m.key === searchPageMode) || SEARCH_PAGE_MODES[0];
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Search</p>
          <h2>${escapeHtml(cfg.title)}</h2>
          <p>${escapeHtml(cfg.blurb)}</p>
        </div>
      </header>
      <div class="tabs" aria-label="Search modes">
        ${SEARCH_PAGE_MODES.map((m) => `<button class="tab ${m.key === searchPageMode ? "active" : ""}" type="button" data-search-tab="${m.key}">${escapeHtml(m.label)}</button>`).join("")}
      </div>
      <div class="record-body">
        <div style="margin-bottom:16px">
          <input id="page-search-input" type="search" autocomplete="off" placeholder="${escapeHtml(cfg.placeholder)}" aria-label="${escapeHtml(cfg.title)}">
        </div>
        <div data-search-results><p class="notice muted">Start typing to search.</p></div>
      </div>
    </article>`;
  const pageInput = document.getElementById("page-search-input");
  if (pageInput) {
    pageInput.addEventListener("input", () => {
      clearTimeout(searchPageDebounce);
      const val = pageInput.value;
      searchPageDebounce = setTimeout(() => runSearchPageQuery(searchPageMode, val), 220);
    });
    if (appReady) requestAnimationFrame(() => pageInput.focus());
  }
}

function runSearchPageQuery(mode, value) {
  const el = document.querySelector("[data-search-results]");
  if (!el) return;
  const q = value.trim();
  const req = ++searchPageReq;
  if (q.length < 2) {
    el.innerHTML = `<p class="notice muted">Type at least two characters to search.</p>`;
    return;
  }
  if (mode === "general") renderGeneralResults(el, q);
  else if (mode === "phenotype") runPhenotypeSearch(el, q, req);
  else if (mode === "go") runGOTermSearch(el, q, null, req);
  else if (mode === "localization") runGOTermSearch(el, q, "cellular_component", req);
}

// Site-wide search: genes plus any site page/tool/organism/research entry.
function renderGeneralResults(el, q) {
  // Curated gene records first, then the rest of the catalog (deduped by NCBI
  // id) so a result opens the same record the user would reach anywhere else.
  const local = rankedGenes(q);
  const localKeys = new Set(local.map((g) => g.ncbiGene));
  const indexed = geneIndex.length ? searchIndex(q, 60).filter((g) => !localKeys.has(g.ncbiGene)) : [];
  const geneTotal = local.length + indexed.length;
  const pages = searchSitePages(q);

  if (!geneTotal && !pages.length) {
    const stillLoading = !geneIndex.length && local.length === 0;
    el.innerHTML = stillLoading
      ? `<p class="notice muted">Loading the gene catalog… try again in a moment.</p>`
      : `<p class="notice">Nothing on the site matches “${escapeHtml(q)}”.</p>`;
    return;
  }

  const geneCard = (g, attr) =>
    `<a class="technique-link" ${attr} href="/gene/${encodeURIComponent(g.symbol)}"><span>${escapeHtml(g.symbol)}</span><small>${escapeHtml(g.name || g.id)}</small></a>`;
  const section = (title, count, inner) => `
    <div class="data-block" style="margin-bottom:14px">
      <h3 style="font-size:0.9375rem">${escapeHtml(title)} <span style="font-weight:500;color:var(--muted,#6b7280)">· ${count}</span></h3>
      <div class="technique-links">${inner}</div>
    </div>`;

  let html = "";
  if (geneTotal) {
    html += section("Genes", geneTotal,
      local.map((g) => geneCard(g, `data-gene="${escapeHtml(g.id)}"`)).join("") +
      indexed.map((g) => geneCard(g, `data-ncbi-gene="${escapeHtml(g.ncbiGene)}"`)).join(""));
  }
  if (pages.length) {
    html += section("Pages & tools", pages.length, pages.map((p) =>
      `<a class="technique-link" href="${escapeHtml(p.href)}"${p.external ? ' target="_blank" rel="noopener"' : ""}>
        <span>${escapeHtml(p.title)}${p.external ? " ↗" : ""}</span>
        <small>${escapeHtml(p.group)}${p.description ? " · " + escapeHtml(p.description) : ""}</small>
      </a>`).join(""));
  }
  el.innerHTML = html;
}

async function runPhenotypeSearch(el, q, req) {
  el.innerHTML = `<p class="notice muted">Searching phenotypes…</p>`;
  try {
    const data = await (await fetch(`/api/phenotype-search?q=${encodeURIComponent(q)}&limit=40`)).json();
    if (req !== searchPageReq) return;
    if (!data.terms || !data.terms.length) {
      el.innerHTML = `<p class="notice">No curated phenotypes match “${escapeHtml(q)}”.</p>`;
      return;
    }
    const shown = data.count < data.totalTerms ? ` (showing ${data.count})` : "";
    el.innerHTML = `
      <p class="notice muted">${data.totalTerms} phenotype${data.totalTerms === 1 ? "" : "s"} matching “${escapeHtml(q)}”${shown}.</p>
      ${data.terms.map((t) => `
        <div class="data-block" style="margin-bottom:14px">
          <h3 style="font-size:0.9375rem">${escapeHtml(t.term)} <span style="font-weight:500;color:var(--muted,#6b7280)">· ${t.genes.length} gene${t.genes.length === 1 ? "" : "s"}</span></h3>
          <div class="technique-links">
            ${t.genes.map((g) => `<a class="technique-link curated-xref" data-ddb-ref="${escapeHtml(g.ddb)}" href="/gene/${encodeURIComponent(g.symbol)}"><span>${escapeHtml(g.symbol)}</span></a>`).join("")}
          </div>
        </div>`).join("")}`;
  } catch {
    if (req !== searchPageReq) return;
    el.innerHTML = `<p class="notice">Phenotype search is unavailable right now.</p>`;
  }
}

async function runGOTermSearch(el, q, aspectFilter, req) {
  el.innerHTML = `<p class="notice muted">Searching the Gene Ontology…</p>`;
  try {
    const url = `https://www.ebi.ac.uk/QuickGO/services/ontology/go/search?query=${encodeURIComponent(q)}&limit=25&page=1`;
    const data = await (await fetch(url, { headers: { Accept: "application/json" } })).json();
    if (req !== searchPageReq) return;
    let results = (data.results || []).filter((r) => !r.isObsolete);
    if (aspectFilter) results = results.filter((r) => r.aspect === aspectFilter);
    if (!results.length) {
      el.innerHTML = `<p class="notice">No ${aspectFilter ? "localization" : "GO"} terms match “${escapeHtml(q)}”.</p>`;
      return;
    }
    el.innerHTML = `
      <p class="notice muted">${results.length} term${results.length === 1 ? "" : "s"} matching “${escapeHtml(q)}”. Select one to see the annotated <em>D. discoideum</em> genes.</p>
      <ul class="list">
        ${results.map((r) => `
          <li>
            <strong><a class="go-search-link" data-go-ref="${escapeHtml(r.id)}" href="/go/${encodeURIComponent(r.id)}">${escapeHtml(r.name)}</a></strong>
            <span>${escapeHtml(r.id)} · ${escapeHtml(GO_ASPECT_LABEL[r.aspect] || r.aspect || "")}${r.definition?.text ? ` — ${escapeHtml(r.definition.text)}` : ""}</span>
          </li>`).join("")}
      </ul>`;
  } catch {
    if (req !== searchPageReq) return;
    el.innerHTML = `<p class="notice">${aspectFilter ? "Localization" : "GO term"} search is unavailable right now.</p>`;
  }
}

// --- OMA orthologs ---
const omaCache = new Map();

async function loadOMAResults(gene) {
  const container = document.querySelector("[data-oma-results]");
  if (!container) return;
  if (!gene.uniprot) {
    container.innerHTML = `<p class="notice">No UniProt ID available — ortholog lookup requires a UniProt accession.</p>`;
    return;
  }
  try {
    if (omaCache.has(gene.id)) {
      renderOMAResults(gene, omaCache.get(gene.id), container);
      return;
    }
    const res = await fetch(`https://omabrowser.org/api/protein/${encodeURIComponent(gene.uniprot)}/orthologs/?format=json`);
    if (!res.ok) throw new Error("OMA fetch failed");
    const data = await res.json();
    const orthologs = Array.isArray(data) ? data : data.results || [];
    omaCache.set(gene.id, orthologs);
    renderOMAResults(gene, orthologs, container);
  } catch {
    container.innerHTML = `<p class="notice">OMA ortholog data could not be loaded.</p>`;
  }
}

// Key model organisms, in display priority order. Matched against the OMA
// scientific name (substring). The most useful row for a curator is almost
// always the human 1:1 ortholog, so Human leads.
const OMA_MODEL_ORGANISMS = [
  { match: "Homo sapiens", label: "Human" },
  { match: "Mus musculus", label: "Mouse" },
  { match: "Rattus norvegicus", label: "Rat" },
  { match: "Danio rerio", label: "Zebrafish" },
  { match: "Xenopus tropicalis", label: "Frog (X. tropicalis)" },
  { match: "Xenopus laevis", label: "Frog (X. laevis)" },
  { match: "Drosophila melanogaster", label: "Fruit fly" },
  { match: "Caenorhabditis elegans", label: "C. elegans" },
  { match: "Saccharomyces cerevisiae", label: "Budding yeast" },
  { match: "Schizosaccharomyces pombe", label: "Fission yeast" },
  { match: "Arabidopsis thaliana", label: "Arabidopsis" },
  { match: "Dictyostelium", label: "Dictyostelid" },
  { match: "Polysphondylium", label: "Dictyostelid" },
  { match: "Cavenderia", label: "Dictyostelid" },
  { match: "Heterostelium", label: "Dictyostelid" },
];

// A 1:1 ortholog is the cleanest evolutionary correspondence; rank it first.
const OMA_REL_RANK = { "1:1": 0, "1:n": 1, "m:1": 2, "m:n": 3 };

function omaRelBadge(rel) {
  if (!rel) return "";
  const one2one = rel === "1:1";
  const bg = one2one ? "var(--accent-soft,#d1fae5)" : "var(--surface-2,#f3f4f6)";
  const fg = one2one ? "var(--accent-strong,#065f46)" : "var(--muted,#6b7280)";
  return `<span title="OMA orthology relationship type" style="display:inline-block;margin-left:8px;padding:1px 6px;border-radius:6px;font-size:0.6875rem;font-weight:600;background:${bg};color:${fg}">${escapeHtml(rel)}</span>`;
}

function omaRow(o) {
  const label = o.canonicalid || o.omaid;
  return `<li>
    <strong><a href="https://omabrowser.org/oma/vps/${encodeURIComponent(o.omaid)}/" target="_blank" rel="noopener">${escapeHtml(label)}</a></strong>${omaRelBadge(o.rel)}
    <span>${escapeHtml(o.sci)}</span>
  </li>`;
}

function renderOMAResults(gene, orthologs, container) {
  if (!orthologs.length) {
    container.innerHTML = `<p class="notice">No orthologs found in OMA for ${escapeHtml(gene.uniprot)}.</p>`;
    return;
  }
  // Normalize each ortholog and tag it with its model-organism rank (if any).
  const rows = orthologs.map((o) => {
    const sci = o.species?.species || o.species?.sciname || "Unknown species";
    const modelIdx = OMA_MODEL_ORGANISMS.findIndex((m) => sci.includes(m.match));
    return {
      omaid: o.omaid,
      canonicalid: o.canonicalid || "",
      sci,
      rel: o.rel_type || "",
      distance: typeof o.distance === "number" ? o.distance : Infinity,
      modelIdx,
      modelLabel: modelIdx >= 0 ? OMA_MODEL_ORGANISMS[modelIdx].label : "",
    };
  });

  const relRank = (r) => (r.rel in OMA_REL_RANK ? OMA_REL_RANK[r.rel] : 9);

  const models = rows
    .filter((r) => r.modelIdx >= 0)
    .sort((a, b) => a.modelIdx - b.modelIdx || relRank(a) - relRank(b) || a.distance - b.distance);

  // Closest non-model species, 1:1 relationships and short distances first.
  const OTHER_LIMIT = 6;
  const others = rows
    .filter((r) => r.modelIdx < 0)
    .sort((a, b) => relRank(a) - relRank(b) || a.distance - b.distance);
  const othersShown = others.slice(0, OTHER_LIMIT);

  const sectionHead = (txt) =>
    `<h4 style="margin:14px 0 6px;font-size:0.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280)">${escapeHtml(txt)}</h4>`;

  const modelsHtml = models.length
    ? sectionHead("Model organisms") +
      `<ul class="list">${models
        .map((r) => `<li>
          <strong><a href="https://omabrowser.org/oma/vps/${encodeURIComponent(r.omaid)}/" target="_blank" rel="noopener">${escapeHtml(r.canonicalid || r.omaid)}</a></strong>${omaRelBadge(r.rel)}
          <span><span style="font-weight:600;color:var(--text,#111827)">${escapeHtml(r.modelLabel)}</span> · ${escapeHtml(r.sci)}</span>
        </li>`)
        .join("")}</ul>`
    : "";

  const othersHtml = othersShown.length
    ? sectionHead(
        others.length > OTHER_LIMIT
          ? `Other species (showing ${othersShown.length} of ${others.length})`
          : "Other species"
      ) + `<ul class="list">${othersShown.map(omaRow).join("")}</ul>`
    : "";

  const oneToOne = rows.filter((r) => r.rel === "1:1").length;
  container.innerHTML = `
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin-bottom:4px">${orthologs.length} orthologs across all species${oneToOne ? `, ${oneToOne} one-to-one` : ""}.</p>
    ${modelsHtml}
    ${othersHtml}
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin-top:14px">
      <a class="text-link" href="https://omabrowser.org/oma/vps/${encodeURIComponent(gene.uniprot)}/" target="_blank" rel="noopener">View all ${orthologs.length} orthologs on OMA Browser →</a>
    </p>`;
}

// --- Post-translational modifications (UniProt sequence features) ---
const ptmCache = new Map();
const PTM_TYPES = new Set(["Modified residue", "Glycosylation", "Lipidation", "Disulfide bond", "Cross-link"]);

async function loadPTMs(gene) {
  const container = document.querySelector("[data-ptm-results]");
  if (!container) return;
  if (!gene.uniprot) {
    container.innerHTML = `<p class="notice">No UniProt accession for ${escapeHtml(gene.symbol)} — PTM annotations require a UniProt entry.</p>`;
    return;
  }
  try {
    let features;
    if (ptmCache.has(gene.id)) {
      features = ptmCache.get(gene.id);
    } else {
      const res = await fetch(`https://rest.uniprot.org/uniprotkb/${encodeURIComponent(gene.uniprot)}.json?fields=ft_mod_res,ft_carbohyd,ft_lipid,ft_disulfid,ft_crosslnk`);
      if (!res.ok) throw new Error("UniProt fetch failed");
      const data = await res.json();
      features = (data.features || []).filter((f) => PTM_TYPES.has(f.type));
      ptmCache.set(gene.id, features);
    }
    if (state.activeGene !== gene || state.activeTab !== "PTMs") return;
    if (!features.length) {
      container.innerHTML = `<p class="notice">No post-translational modifications are annotated in UniProt for ${escapeHtml(gene.uniprot)}.</p>`;
      return;
    }
    const byType = {};
    for (const f of features) (byType[f.type] = byType[f.type] || []).push(f);
    const order = ["Modified residue", "Glycosylation", "Lipidation", "Disulfide bond", "Cross-link"].filter((t) => byType[t]);
    container.innerHTML = order.map((t) => `
      <div style="margin-bottom:20px">
        <h4 style="margin:0 0 8px;font-size:0.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280)">${escapeHtml(t)} <span style="font-weight:500;text-transform:none;letter-spacing:0">(${byType[t].length})</span></h4>
        <ul class="list">
          ${byType[t].map((f) => {
            const s = f.location?.start?.value, e = f.location?.end?.value;
            const pos = (s && e && s !== e) ? `${s}–${e}` : `${s ?? "?"}`;
            const refs = [...new Set((f.evidences || []).filter((ev) => ev.source === "PubMed" && ev.id)
              .map((ev) => `<a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(ev.id)}/" target="_blank" rel="noopener">PMID ${escapeHtml(ev.id)}</a>`))].join(", ");
            return `<li>
              <strong>${escapeHtml(f.description || t)}</strong>
              <span>Position ${escapeHtml(pos)}${refs ? " · " + refs : ""}</span>
            </li>`;
          }).join("")}
        </ul>
      </div>`).join("") +
      `<p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:4px">Source: <a class="text-link" href="https://www.uniprot.org/uniprotkb/${escapeHtml(gene.uniprot)}/entry#ptm_processing" target="_blank" rel="noopener">UniProt ${escapeHtml(gene.uniprot)}</a> sequence annotations.</p>`;
  } catch {
    container.innerHTML = `<p class="notice">PTM annotations could not be loaded right now.</p>`;
  }
}

const pdbCache = new Map();

async function fetchPDBResults(gene) {
  if (pdbCache.has(gene.id)) return pdbCache.get(gene.id);
  if (!gene.uniprot) { pdbCache.set(gene.id, []); return []; }

  const query = {
    query: {
      type: "terminal",
      service: "text",
      parameters: {
        attribute: "rcsb_polymer_entity_container_identifiers.reference_sequence_identifiers.database_accession",
        operator: "exact_match",
        value: gene.uniprot
      }
    },
    return_type: "entry"
  };

  const response = await fetch("https://search.rcsb.org/rcsbsearch/v2/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query)
  });
  if (response.status === 204) { pdbCache.set(gene.id, []); return []; }
  if (!response.ok) throw new Error("PDB search failed");
  const data = await response.json();
  const ids = (data.result_set || []).map((r) => r.identifier);

  if (!ids.length) { pdbCache.set(gene.id, []); return []; }

  const details = await Promise.all(ids.map(async (pdbId) => {
    try {
      const r = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
      if (!r.ok) return { pdbId, title: pdbId, method: "", resolution: "" };
      const d = await r.json();
      return {
        pdbId,
        title: d.struct?.title || pdbId,
        method: d.exptl?.[0]?.method || "",
        resolution: d.refine?.[0]?.ls_d_res_high ? `${d.refine[0].ls_d_res_high} Å` : ""
      };
    } catch {
      return { pdbId, title: pdbId, method: "", resolution: "" };
    }
  }));

  pdbCache.set(gene.id, details);
  return details;
}

async function loadPDBResults(gene) {
  const container = document.querySelector("[data-pdb-results]");
  if (!container) return;
  try {
    const entries = await fetchPDBResults(gene);
    if (state.activeGene !== gene || state.activeTab !== "Structures") return;
    if (!entries.length) {
      container.innerHTML = `<p class="notice">No experimental structures found in PDB for UniProt ${escapeHtml(gene.uniprot)}.</p>`;
      return;
    }
    container.innerHTML = `
      <ul class="list pubmed-list">
        ${entries.map((e) => `
          <li>
            <strong><a href="https://www.rcsb.org/structure/${escapeHtml(e.pdbId)}" target="_blank" rel="noopener">${escapeHtml(e.pdbId)}</a></strong>
            <span>${escapeHtml([e.title, e.method, e.resolution].filter(Boolean).join(" · "))}</span>
          </li>
        `).join("")}
      </ul>
    `;
  } catch {
    container.innerHTML = `<p class="notice">PDB results could not be loaded right now.</p>`;
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const first = rankedGenes(input.value)[0];
  if (first) {
    openGene(first);
    suggestions.innerHTML = "";
    return;
  }
  const query = input.value.trim();
  if (!query) return;

  // Full-catalog match (e.g. "dscA-1") — open via the rich NCBI/UniProt path.
  const indexFirst = searchIndex(query, 1)[0];
  if (indexFirst) {
    suggestions.innerHTML = "";
    openRemoteGene(indexFirst.ncbiGene);
    return;
  }

  // UniProt ID shortcut
  if (looksLikeUniProt(query)) {
    suggestions.innerHTML = "";
    openUniProtGene(query);
    return;
  }

  // Fall back to NCBI search
  recordShell.innerHTML = `<div class="empty-state"><p class="notice muted">Searching NCBI for <em>${escapeHtml(query)}</em>…</p></div>`;
  scrollToEl(recordShell);
  try {
    const searchParams = new URLSearchParams({ db: "gene", retmax: "1", retmode: "json", term: buildNCBITerm(query) });
    const res = await fetch(`https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?${searchParams}`);
    const data = await res.json();
    let id = data.esearchresult?.idlist?.[0];
    if (id) {
      openRemoteGene(id);
    } else {
      recordShell.innerHTML = `<div class="empty-state"><h2>No results for "${escapeHtml(query)}"</h2><p>Try a gene symbol, DDB ID, UniProt accession, or protein name.</p></div>`;
    }
  } catch {
    recordShell.innerHTML = `<div class="empty-state"><p class="notice">Search failed. Check your connection and try again.</p></div>`;
  }
});

input.addEventListener("input", () => renderSuggestions(input.value));

document.addEventListener("click", (event) => {
  const mobileToggle = event.target.closest(".mobile-menu-toggle");
  if (mobileToggle && mobileMenu) {
    const isOpen = mobileMenu.classList.toggle("open");
    mobileToggle.setAttribute("aria-expanded", String(isOpen));
    return;
  }

  const navTrigger = event.target.closest(".nav-trigger");
  if (navTrigger) {
    const item = navTrigger.closest(".nav-item");
    const wasOpen = item.classList.contains("open");
    document.querySelectorAll(".nav-item.open").forEach((openItem) => {
      openItem.classList.remove("open");
      openItem.querySelector(".nav-trigger")?.setAttribute("aria-expanded", "false");
    });
    if (!wasOpen) {
      item.classList.add("open");
      navTrigger.setAttribute("aria-expanded", "true");
    }
    return;
  }

  if (!event.target.closest(".nav-item")) {
    document.querySelectorAll(".nav-item.open").forEach((openItem) => {
      openItem.classList.remove("open");
      openItem.querySelector(".nav-trigger")?.setAttribute("aria-expanded", "false");
    });
  }

  const researchDropdownTrigger = event.target.closest("[data-research-dropdown-trigger]");
  if (researchDropdownTrigger) {
    const dropdown = researchDropdownTrigger.closest(".research-dropdown");
    const isOpen = dropdown.classList.toggle("open");
    researchDropdownTrigger.setAttribute("aria-expanded", String(isOpen));
    return;
  }

  if (!event.target.closest(".research-dropdown")) {
    document.querySelectorAll(".research-dropdown.open").forEach((dropdown) => {
      dropdown.classList.remove("open");
      dropdown.querySelector("[data-research-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });
  }

  if (event.target.closest(".menu-option")) {
    document.querySelectorAll(".nav-item.open").forEach((openItem) => {
      openItem.classList.remove("open");
      openItem.querySelector(".nav-trigger")?.setAttribute("aria-expanded", "false");
    });
    mobileMenu?.classList.remove("open");
    mobileMenuToggle?.setAttribute("aria-expanded", "false");
  }

  const techniqueLink = event.target.closest('a[href^="/research/techniques/"]');
  if (techniqueLink) {
    const slug = techniqueLink.getAttribute("href").split("/").filter(Boolean).pop();
    const technique = findTechniqueByToken(slug);
    if (technique) {
      event.preventDefault();
      openTechnique(technique);
    }
    return;
  }

  const toolLink = event.target.closest('a[href^="/tools/"]');
  if (toolLink) {
    const slug = toolLink.getAttribute("href").split("/").filter(Boolean).pop();
    if (["genome-browser", "blast", "proteomics", "heatstress", "downloads"].includes(slug)) {
      event.preventDefault();
      openTool(slug);
      return;
    }
  }

  const blastClear = event.target.closest("#blast-clear");
  if (blastClear) {
    const f = document.getElementById("blast-form");
    if (f) f.reset();
    return;
  }

  const organismLink = event.target.closest('a[href^="/organisms/"]');
  if (organismLink) {
    event.preventDefault();
    const id = organismLink.getAttribute("href").split("/").filter(Boolean).pop();
    openOrganism(id);
    return;
  }

  const communityLink = event.target.closest('a[href^="/community/"]');
  if (communityLink) {
    event.preventDefault();
    const slug = communityLink.getAttribute("href").split("/").filter(Boolean).pop();
    openCommunity(slug);
    return;
  }

  const goLink = event.target.closest('a[href^="/go/"]');
  if (goLink) {
    event.preventDefault();
    openGOTerm(decodeURIComponent(goLink.getAttribute("href").split("/").filter(Boolean).pop()));
    return;
  }

  const strainLink = event.target.closest('a[href^="/strain/"]');
  if (strainLink) {
    event.preventDefault();
    openStrain(decodeURIComponent(strainLink.getAttribute("href").split("/").filter(Boolean).pop()));
    return;
  }

  const dataLink = event.target.closest('a[href="/data"]');
  if (dataLink) {
    event.preventDefault();
    openDataPage();
    return;
  }

  const researchLink = event.target.closest('a[href^="/research/"]');
  if (researchLink) {
    document.querySelectorAll(".research-dropdown.open").forEach((dropdown) => {
      dropdown.classList.remove("open");
      dropdown.querySelector("[data-research-dropdown-trigger]")?.setAttribute("aria-expanded", "false");
    });
    const slug = researchLink.getAttribute("href").split("/").filter(Boolean).pop();
    const resource = findResearchByToken(slug);
    if (resource) {
      event.preventDefault();
      openResearch(resource);
    }
    return;
  }

  const queryButton = event.target.closest("[data-query]");
  if (queryButton) {
    input.value = queryButton.dataset.query;
    const match = rankedGenes(input.value)[0];
    if (match) openGene(match);
    renderSuggestions("");
    return;
  }

  const xref = event.target.closest(".curated-xref");
  if (xref) {
    event.preventDefault();
    const ddb = xref.dataset.ddbRef;
    const hit = geneIndex.find((g) => g.id === ddb);
    suggestions.innerHTML = "";
    if (hit && hit.ncbiGene) {
      openRemoteGene(hit.ncbiGene);
    } else {
      const fallback = findGeneByToken(xref.textContent.trim()) || searchIndex(xref.textContent.trim(), 1)[0];
      if (fallback && fallback.ncbiGene && !genes.includes(fallback)) openRemoteGene(fallback.ncbiGene);
      else if (fallback) openGene(fallback);
    }
    return;
  }

  const geneButton = event.target.closest("[data-gene]");
  if (geneButton) {
    event.preventDefault();
    const gene = genes.find((item) => item.id === geneButton.dataset.gene);
    if (gene) {
      input.value = gene.symbol;
      openGene(gene);
      suggestions.innerHTML = "";
    }
    return;
  }

  const ncbiButton = event.target.closest("[data-ncbi-gene]");
  if (ncbiButton) {
    event.preventDefault();
    suggestions.innerHTML = "";
    openRemoteGene(ncbiButton.dataset.ncbiGene);
    return;
  }

  const uniprotButton = event.target.closest("[data-uniprot-gene]");
  if (uniprotButton) {
    suggestions.innerHTML = "";
    openUniProtGene(uniprotButton.dataset.uniprotGene);
    return;
  }

  const tabButton = event.target.closest("[data-tab]");
  if (tabButton && state.activeGene) {
    switchTab(tabButton.dataset.tab);
    setRoute(state.activeGene, state.activeTab);
  }

  const researchTab = event.target.closest("[data-research-tab]");
  if (researchTab) {
    const resource = findResearchByToken(researchTab.dataset.researchTab);
    if (resource) openResearch(resource);
  }

  const searchTab = event.target.closest("[data-search-tab]");
  if (searchTab) {
    openSearchPage(searchTab.dataset.searchTab);
    return;
  }

  const goRef = event.target.closest("[data-go-ref]");
  if (goRef) {
    event.preventDefault();
    openGOTerm(goRef.dataset.goRef);
    return;
  }
});

window.addEventListener("popstate", hydrateFromRoute);

function hydrateFromRoute() {
  const params = new URLSearchParams(window.location.search);
  const pathParts = window.location.pathname.split("/").filter(Boolean);
  const isGeneRoute = pathParts[0] === "gene" && pathParts[1];
  const isSearchRoute = pathParts[0] === "search";
  const isTechniqueRoute = pathParts[0] === "research" && pathParts[1] === "techniques" && pathParts[2];
  const isResearchRoute = pathParts[0] === "research" && pathParts[1];
  const isToolRoute = pathParts[0] === "tools" && pathParts[1];
  const isOrganismRoute = pathParts[0] === "organisms" && pathParts[1];
  const isCommunityRoute = pathParts[0] === "community" && pathParts[1];
  const gene = isGeneRoute ? findGeneByToken(pathParts[1]) : findGeneByToken(params.get("gene"));
  if (gene) {
    input.value = gene.symbol;
    openGene(gene, params.get("tab") || "Summary", false);
    return;
  }
  if (isTechniqueRoute) {
    openTechnique(findTechniqueByToken(pathParts[2]), false);
    return;
  }
  if (isResearchRoute) {
    openResearch(findResearchByToken(pathParts[1]), false);
    return;
  }
  if (isToolRoute && ["genome-browser", "blast", "proteomics", "heatstress", "downloads"].includes(pathParts[1])) {
    openTool(pathParts[1], false);
    return;
  }
  if (isOrganismRoute) {
    openOrganism(pathParts[1], false);
    return;
  }
  if (isCommunityRoute) {
    openCommunity(pathParts[1], false);
    return;
  }
  if (pathParts[0] === "go" && pathParts[1]) {
    openGOTerm(decodeURIComponent(pathParts[1]), false);
    return;
  }
  if (pathParts[0] === "strain" && pathParts[1]) {
    openStrain(decodeURIComponent(pathParts[1]), false);
    return;
  }
  if (pathParts[0] === "data") {
    openDataPage(false);
    return;
  }
  if (pathParts[0] === "search" && SEARCH_PAGE_MODES.some((m) => m.key === pathParts[1])) {
    openSearchPage(pathParts[1], false);
    return;
  }
  if (isSearchRoute) {
    input.value = params.get("q") || "";
    renderSuggestions(input.value);
  }
}

// Take over scroll handling so the browser's default "restore to top" on a
// fresh load doesn't fight the scroll-to-section that hydrateFromRoute kicks
// off for deep links (/gene, /go, /strain, /data, …).
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

function initialHydrate() {
  buildSiteIndex();
  renderRecentGenes();
  hydrateFromRoute();
  // From here on, in-app navigation scrolls smoothly.
  appReady = true;
}
if (document.readyState === "complete") {
  initialHydrate();
} else {
  // Wait for first load so section offsets are final before we scroll to one.
  window.addEventListener("load", initialHydrate, { once: true });
}
