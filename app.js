// fetch() shim with two jobs:
// 1. Append the data-asset version to /assets/*.json fetches so those files can
//    be cached immutably by the browser and a CDN. window.__ASSET_V comes from
//    the always-revalidated index.html and changes the moment any data file is
//    rebuilt, so a new version busts the cache automatically — no stale data.
// 2. Route GET fetches to the public bio APIs (NCBI/UniProt/EBI/STRING/OMA/RCSB)
//    through our /api/ext server proxy, which caches them, hides the user's IP
//    and query from those upstreams, and avoids CORS. Done in one place so the
//    ~16 call sites don't each have to wrap their URL. (The STRING network
//    *image* is an <img src>, not a fetch, so it stays a direct browser load.)
const EXT_PROXY_HOSTS = new Set([
  "eutils.ncbi.nlm.nih.gov", "rest.uniprot.org", "www.ebi.ac.uk",
  "string-db.org", "omabrowser.org", "search.rcsb.org", "data.rcsb.org",
]);
(function () {
  const _fetch = window.fetch;
  window.fetch = function (input, init) {
    if (typeof input === "string") {
      if (window.__ASSET_V && input.indexOf("/assets/") === 0 &&
          input.slice(-5) === ".json" && input.indexOf("?") === -1) {
        input += "?v=" + window.__ASSET_V;
      } else if (input.indexOf("https://") === 0) {
        const method = (init && init.method ? init.method : "GET").toUpperCase();
        let host = "";
        try { host = new URL(input).host; } catch (e) { /* leave as-is */ }
        if (method === "GET" && EXT_PROXY_HOSTS.has(host)) {
          input = "/api/ext?url=" + encodeURIComponent(input);
          init = init ? Object.assign({}, init, { headers: undefined }) : undefined;
        }
      }
    }
    return _fetch.call(this, input, init);
  };
})();

// First-party, cookieless pageview beacon. The server buckets the path and
// stores only aggregate counts — no cookies, no IP/User-Agent, no PII. Fires on
// initial load and on every SPA navigation (pushState / back-forward).
let _lastPageview = null;
function recordPageview(path) {
  const p = path || window.location.pathname;
  if (p === _lastPageview) return;     // ignore tab-only (?tab=) changes — same path
  _lastPageview = p;
  try {
    const body = JSON.stringify({ path: p });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/hit", body);
    else fetch("/api/hit", { method: "POST", body, keepalive: true });
  } catch (e) { /* analytics is best-effort */ }
}
(function () {
  const _push = history.pushState;
  history.pushState = function () {
    const r = _push.apply(this, arguments);
    try { recordPageview(window.location.pathname); } catch (e) { /* ignore */ }
    return r;
  };
  window.addEventListener("popstate", () => recordPageview(window.location.pathname));
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", () => recordPageview(window.location.pathname));
  } else {
    recordPageview(window.location.pathname);
  }
})();

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
          ["Gaudet et al. 2007", "https://pubmed.ncbi.nlm.nih.gov/17545968/"],
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
  },
  {
    id: "d-citrinum",
    name: "Dictyostelium citrinum GS8b",
    shortName: "D. citrinum GS8b",
    group: "Group 4",
    description: "A group 4 Dictyostelium species. This GS8b assembly was sequenced and annotated as part of a 2025 PNAS study of the rapid evolution of self/non-self recognition genes across the dictyostelids.",
    genomeSize: "31 Mb",
    chromosomes: "89 contigs",
    genes: "~11,300",
    assembly: "GCA_054859325.1",
    assemblyName: "ASM5485932v1",
    genomeFile: "/assets/genomes/D_citrinum_GS8b_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_054859325.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "41400994", title: "Hypermutable hotspot enables the rapid evolution of self/non-self recognition genes in Dictyostelium", journal: "PNAS · 2025", url: "https://pubmed.ncbi.nlm.nih.gov/41400994/" }
    ]
  },
  {
    id: "d-dimigraforme",
    name: "Dictyostelium dimigraforme Ar5b",
    shortName: "D. dimigraforme Ar5b",
    group: "Group 4",
    description: "A group 4 Dictyostelium species. This Ar5b assembly was sequenced and annotated as part of a 2025 PNAS study of the rapid evolution of self/non-self recognition genes across the dictyostelids.",
    genomeSize: "35 Mb",
    chromosomes: "76 contigs",
    genes: "~12,700",
    assembly: "GCA_054859025.1",
    assemblyName: "ASM5485902v1",
    genomeFile: "/assets/genomes/D_dimigraforme_Ar5b_genome.fna.gz",
    ncbiUrl: "https://www.ncbi.nlm.nih.gov/datasets/genome/GCA_054859025.1/",
    amoebaDbUrl: "",
    papers: [
      { pmid: "41400994", title: "Hypermutable hotspot enables the rapid evolution of self/non-self recognition genes in Dictyostelium", journal: "PNAS · 2025", url: "https://pubmed.ncbi.nlm.nih.gov/41400994/" }
    ]
  }
];

// `let` so it can be rebuilt once the lazily-loaded technique bodies arrive.
// Before then, records still carry correct slug/label/category (from
// researchResources) — only `contentHtml` is empty.
let techniqueRecords = buildTechniqueRecords();

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

// Briefly flash an element so the user sees where a search result landed.
function highlightElement(el) {
  if (!el) return;
  el.classList.add("search-target");
  setTimeout(() => el.classList.remove("search-target"), 2400);
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
// Well-known genes shown as starter chips before a visitor has any search history.
const EXAMPLE_GENES = ["mhcA", "rasG", "carA", "acaA", "gbpC"];

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
  const isExamples = !list.length;
  const chips = isExamples ? EXAMPLE_GENES : list;
  const label = isExamples ? "Try a gene" : "Recent";
  recentGenesEl.setAttribute("aria-label", isExamples ? "Example genes" : "Recently searched genes");
  recentGenesEl.innerHTML = `<span class="quick-links-label">${label}</span>` + chips
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
  showHomeChrome(false);
  [toolsShell, organismShell, communityShell, researchShell].forEach((s) => {
    if (s) { s.innerHTML = ""; s.setAttribute("hidden", ""); }
  });
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

// Site-wide page/tool matches for the hero search (shares the command palette's index).
function matchSitePages(query, limit = 4) {
  const ql = query.trim().toLowerCase();
  if (!ql) return [];
  return CMDK_TARGETS
    .filter((t) => t.href !== "/" && (t.label.toLowerCase().includes(ql) || (t.kw || "").includes(ql)))
    .slice(0, limit);
}

function renderSuggestions(query) {
  if (!query.trim()) {
    suggestions.innerHTML = "";
    return;
  }
  const local = rankedGenes(query).slice(0, 5);
  const localKeys = new Set(local.map((g) => g.ncbiGene));
  // Full-catalog matches (e.g. "dsca" -> dscA-1, dscA-2), minus anything already curated.
  const indexed = searchIndex(query, 8).filter((g) => !localKeys.has(g.ncbiGene));
  // Matching tools & pages (e.g. "blast", "downloads", "genome browser").
  const pages = matchSitePages(query, 4);

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
  const pageHtml = pages.map((t) => `
    <button class="suggestion" type="button" data-href="${escapeHtml(t.href)}">
      <span>
        <strong>${escapeHtml(t.label)}</strong>
        ${t.sub ? `<small>${escapeHtml(t.sub)}</small>` : ""}
      </span>
      <span class="tag">${escapeHtml(t.kind)}</span>
    </button>
  `).join("");

  suggestions.innerHTML = (localHtml + indexHtml + pageHtml)
    || `<div class="notice muted">Searching NCBI for <em>${escapeHtml(query)}</em>…</div>`;

  // Only reach out to NCBI when we have nothing locally (aliases, other taxa, UniProt IDs).
  clearTimeout(suggestionDebounceTimer);
  if (!local.length && !indexed.length && !pages.length) {
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
  recordShell.removeAttribute("hidden");
  recordShell.innerHTML = `<div class="empty-state">${loadingHTML(`Loading ${uniprotId} from UniProt…`)}</div>`;
  scrollToEl(recordShell);
  try {
    const gene = await fetchUniProtGene(uniprotId);
    input.value = gene.symbol;
    openGene(gene, "Summary", true);
  } catch (err) {
    recordShell.innerHTML = `<div class="empty-state"><p class="notice">Couldn't load UniProt entry ${escapeHtml(uniprotId)} right now — the source may be temporarily unavailable. Try again in a moment or search another gene.</p></div>`;
  }
}

async function openRemoteGene(ncbiId) {
  recordShell.removeAttribute("hidden");
  recordShell.innerHTML = `<div class="empty-state">${loadingHTML(`Loading gene ${ncbiId}…`)}</div>`;
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

    // 3. UniProt lookup — try symbol as-is, then lowercase, then the DDB_G id.
    // dictyBase symbols often differ from UniProt gene names (e.g. ppk1 -> ppkA),
    // so fall back to the DDB_G id, which UniProt indexes as an ORF name.
    let uniprot = "";
    let uniprotFullRecord = null;
    try {
      const symsToTry = [...new Set([symbol, symbol.toLowerCase(), ddbFromAliases].filter(Boolean))];
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
    recordShell.innerHTML = `<div class="empty-state"><p class="notice">Couldn't load gene ${escapeHtml(ncbiId)} right now — the source may be temporarily unavailable. Try again in a moment or search another gene.</p></div>`;
  }
}

let currentViewer = null;

function initStructureViewer(uniprot) {
  const el = document.getElementById("af-viewer");
  if (!el) return;
  if (currentViewer) { try { currentViewer.clear(); } catch {} }
  el.innerHTML = `<p style="font-size:0.75rem;color:#9ca3af;padding:8px;text-align:center">Loading structure…</p>`;

  // A clean click (not a drag-rotate) on the preview opens the Structures tab.
  el.style.cursor = "pointer";
  let downX = 0, downY = 0;
  el.addEventListener("mousedown", (e) => { downX = e.clientX; downY = e.clientY; });
  el.addEventListener("click", (e) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return; // dragged → rotating, don't navigate
    if (!state.activeGene) return;
    switchTab("Structures");
    setRoute(state.activeGene, state.activeTab);
  });

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

// Large interactive structure on the Structures tab, colored by AlphaFold
// per-residue confidence (pLDDT, stored in the PDB B-factor column).
let currentViewerLarge = null;

function initStructureViewerLarge(uniprot) {
  const el = document.getElementById("af-viewer-large");
  if (!el || !uniprot) return;
  if (currentViewerLarge) { try { currentViewerLarge.clear(); } catch {} currentViewerLarge = null; }
  el.innerHTML = `<p class="viewer-msg">Loading structure…</p>`;

  const renderIntoEl = () => {
    if (!document.getElementById("af-viewer-large")) return; // tab switched away before the lib loaded
    const viewer = $3Dmol.createViewer(el, { backgroundColor: "white", antialias: true });
    currentViewerLarge = viewer;
    fetch(`/api/alphafold/${uniprot}`)
      .then((r) => { if (!r.ok) throw new Error("not found"); return r.text(); })
      .then((pdbData) => {
        if (!document.getElementById("af-viewer-large")) return; // tab switched away during fetch
        viewer.addModel(pdbData, "pdb");
        viewer.setStyle({}, { cartoon: { colorscheme: { prop: "b", gradient: "roygb", min: 50, max: 90 } } });
        viewer.zoomTo();
        viewer.spin(true);
        viewer.render();
      })
      .catch(() => { el.innerHTML = `<p class="viewer-msg">Structure unavailable</p>`; });
  };

  if (window.$3Dmol) {
    renderIntoEl();
  } else {
    const script = document.createElement("script");
    script.src = "https://3Dmol.csb.pitt.edu/build/3Dmol-min.js";
    script.onload = renderIntoEl;
    script.onerror = () => { el.innerHTML = `<p class="viewer-msg">Viewer unavailable</p>`; };
    document.head.appendChild(script);
  }
}

function renderRecord() {
  const gene = state.activeGene;
  if (!gene) return;
  recordShell.removeAttribute("hidden");
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
            ${gene._curator ? `<span class="tag" style="background:var(--soft,#e7eef7);color:var(--teal-dark)" title="Curated by ${escapeHtml(gene._curator)}">✓ dictyBase curated</span>` : ""}
          </div>
          <div class="record-actions">${basketToggleButtonHTML(gene)}${canViewInBrowser(gene) ? `<button type="button" class="button" data-view-browser>View in genome browser →</button>` : ""}</div>
        </div>
        ${gene.uniprot ? `
        <div class="structure-preview">
          <div class="structure-viewer" id="af-viewer" data-uniprot="${escapeHtml(gene.uniprot)}" title="Open the full 3D structure"></div>
          <button type="button" class="structure-preview-link" data-tab="Structures">View 3D structure →</button>
        </div>` : ""}
      </header>

      <div class="source-links" aria-label="External links">
        ${sourceLinks(gene).map(([label, detail, href]) => `
          <a class="source-link" href="${href}" target="_blank" rel="noopener">
            <strong>${label}</strong>
            <span>${detail}</span>
          </a>
        `).join("")}
      </div>

      <div class="tabs" role="tablist" aria-label="Record sections">
        ${tabs.map((tab) => {
          const active = tab === state.activeTab;
          return `<button class="tab ${active ? "active" : ""}" type="button" role="tab" id="record-tab-${tab}" data-tab="${tab}" aria-controls="record-panel" aria-selected="${active}" tabindex="${active ? "0" : "-1"}">${tab}</button>`;
        }).join("")}
      </div>

      <div class="record-body" id="record-panel" role="tabpanel" tabindex="0" aria-labelledby="record-tab-${state.activeTab}">${renderTab(gene, state.activeTab)}</div>
      ${gene._curator ? `<p style="font-size:0.75rem;color:var(--muted,#6b7280);padding:0 24px 4px">Gene summary curated by ${escapeHtml(gene._curator)} · <a class="text-link" href="https://doi.org/10.1002/dvg.22867" target="_blank" rel="noopener">dictyBase (Basu et al. 2015)</a> · <a class="text-link" href="https://creativecommons.org/licenses/by-nc/4.0/" target="_blank" rel="noopener">CC BY-NC 4.0</a></p>` : ""}
      <p style="font-size:0.75rem;color:var(--muted,#6b7280);padding:0 24px 16px">
        <button type="button" class="text-link cite-toggle" data-cite-symbol="${escapeHtml(gene.symbol)}" style="background:none;border:none;cursor:pointer;color:var(--teal-dark);padding:0">Cite this page</button>
        · <a class="text-link" href="/community/corrections?gene=${encodeURIComponent(gene.symbol)}">Report an error</a>
      </p>
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
      loadAISummary(gene);
      loadGeneModel(gene);
      loadCoexpression(gene);
      loadKeggPathways(gene);
      loadStrains(gene);
      initRecordLabTools(gene);
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
      loadHumanDisease(gene);
      loadParalogs(gene);
      loadComparative(gene);
      loadNeighborhood(gene);
      loadVariation(gene);
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
      requestAnimationFrame(() => initStructureViewerLarge(gene.uniprot));
      loadProteinProps(gene);
      loadDomains(gene);
      loadConservation(gene);
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
  recordShell.querySelectorAll(".tab").forEach((b) => {
    const isActive = b.dataset.tab === tab;
    b.classList.toggle("active", isActive);
    b.setAttribute("aria-selected", String(isActive));
    b.tabIndex = isActive ? 0 : -1;
  });
  const body = recordShell.querySelector(".record-body");
  if (!body) {
    renderRecord();
    return;
  }
  body.setAttribute("aria-labelledby", `record-tab-${tab}`);
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

async function openTechnique(technique, updateRoute = true) {
  if (!technique) {
    openResearch(findResearchByToken("techniques"), updateRoute);
    return;
  }
  hideContentSections();
  state.activeResearch = "techniques";
  renderTechnique(technique);
  if (updateRoute) setTechniqueRoute(technique);
  scrollToEl(document.querySelector("#research"));
  // If the protocol body hasn't been lazy-loaded yet, fetch it and re-render
  // in place once it arrives (the header/links above are already on screen).
  if (!technique.contentHtml && !window.techniqueContent) {
    await ensureTechniqueContent();
    if (state.activeResearch !== "techniques") return; // user navigated away
    const full = findTechniqueByToken(technique.slug);
    if (full && full.contentHtml) renderTechnique(full);
  }
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
  } else if (tool === "enrichment") {
    toolsShell.innerHTML = renderEnrichmentPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initEnrichment();
  } else if (tool === "api") {
    toolsShell.innerHTML = renderAPIPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
  } else if (tool === "lab") {
    toolsShell.innerHTML = renderLabPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initLab();
  } else if (tool === "expression") {
    toolsShell.innerHTML = renderExpressionPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initExpressionCompare();
  } else if (tool === "basket") {
    toolsShell.innerHTML = renderBasketPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initBasket();
  } else if (tool === "convert") {
    toolsShell.innerHTML = renderConvertPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initConvert();
  } else if (tool === "sequence") {
    toolsShell.innerHTML = renderSequenceToolsPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initSequenceTools();
  } else if (tool === "geneset") {
    toolsShell.innerHTML = renderGeneSetPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initGeneSet();
  } else if (tool === "stats") {
    toolsShell.innerHTML = renderStatsPage();
    toolsShell.removeAttribute("hidden");
    scrollToY(toolsShell.offsetTop - 60);
    initStats();
  }
}

// Curator-only site stats (unlisted — reachable at /tools/stats). Reads the
// privacy-respecting pageview counter (/api/stats) after a curator sign-in.
function renderStatsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Curator</p>
          <h2>Site visit stats</h2>
          <p>Privacy-respecting pageview counts — no cookies, IP addresses, or personal data; page/section buckets only. Curator sign-in required.</p>
        </div>
      </header>
      <div class="record-body">
        <div id="stats-auth" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
          <input id="stats-pw" type="password" aria-label="Curator password" placeholder="Curator password" style="${FIELD};min-width:240px">
          <button type="button" id="stats-login">Sign in</button>
          <span id="stats-msg" class="muted" style="font-size:13px"></span>
        </div>
        <div id="stats-out"></div>
      </div>
    </article>`;
}

function initStats() {
  const pw = document.getElementById("stats-pw");
  const btn = document.getElementById("stats-login");
  const msg = document.getElementById("stats-msg");
  if (!btn) return;
  const go = async () => {
    const password = (pw.value || "").trim();
    if (!password) { pw.focus(); return; }
    msg.textContent = "Signing in…";
    try {
      const r = await fetch("/api/curator/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!r.ok) { msg.textContent = r.status === 429 ? "Too many attempts — wait a few minutes." : "Wrong password."; return; }
      const { token } = await r.json();
      msg.textContent = "";
      document.getElementById("stats-auth").style.display = "none";
      loadStats(token);
    } catch { msg.textContent = "Sign-in failed — try again."; }
  };
  btn.addEventListener("click", go);
  pw.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
}

async function loadStats(token) {
  const out = document.getElementById("stats-out");
  if (!out) return;
  out.innerHTML = loadingHTML("Loading stats…");
  try {
    const r = await fetch("/api/stats", { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) { out.innerHTML = `<div class="empty-state">Could not load stats — your session may have expired. Reload and sign in again.</div>`; return; }
    const d = await r.json();
    const rows = Object.entries(d.counts || {});
    const total = d.total || 0;
    const max = rows.length ? rows[0][1] : 1;
    const since = d.since ? new Date(d.since).toLocaleDateString() : "—";
    out.innerHTML = `
      <p style="margin:0 0 10px"><strong>${total.toLocaleString()}</strong> page views since ${escapeHtml(since)}
        <span class="muted" style="font-size:12px">· updated ${d.updated ? escapeHtml(new Date(d.updated).toLocaleString()) : "—"}</span></p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:14px">
        <thead><tr>
          <th style="text-align:left;padding:6px 8px">Page</th>
          <th style="text-align:right;padding:6px 8px">Views</th>
          <th style="width:40%"></th>
        </tr></thead>
        <tbody>
        ${rows.length ? rows.map(([k, n]) => `
          <tr style="border-top:1px solid var(--line)">
            <td style="padding:6px 8px;font-family:ui-monospace,monospace">${escapeHtml(k)}</td>
            <td style="padding:6px 8px;text-align:right">${n.toLocaleString()}</td>
            <td style="padding:6px 8px"><div style="height:8px;border-radius:4px;background:var(--teal);width:${Math.max(2, Math.round((n / max) * 100))}%"></div></td>
          </tr>`).join("") : `<tr><td colspan="3" style="padding:12px">No views recorded yet.</td></tr>`}
        </tbody>
      </table></div>`;
  } catch { out.innerHTML = `<div class="empty-state">Could not load stats.</div>`; }
}

function renderExpressionPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Analysis</p>
          <h2>Compare gene expression</h2>
          <p>Overlay the developmental RNA-seq profiles (Parikh et al. time course) of several genes to compare candidates at a glance.</p>
        </div>
      </header>
      <div class="record-body">
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <input id="expr-genes" aria-label="Genes to compare" placeholder="genes — e.g. mhcA acaA carA rasG pkaC" style="${FIELD};min-width:min(340px,100%);flex:1">
          <button type="button" id="expr-run">Plot</button>
        </div>
        <div data-expr-results style="margin-top:12px"><canvas id="expr-chart" height="120" hidden></canvas></div>
      </div>
    </article>`;
}

function initExpressionCompare() {
  const b = document.getElementById("expr-run");
  if (b) b.addEventListener("click", runExpressionCompare);
}

let exprChart = null;
async function runExpressionCompare() {
  const out = document.querySelector("[data-expr-results]");
  const raw = (document.getElementById("expr-genes").value || "").trim();
  if (!raw) { out.innerHTML = `<p class="notice">Enter one or more genes.</p>`; return; }
  out.innerHTML = loadingHTML("Loading expression…");
  let data;
  try {
    data = await (await fetch(`/api/expression?genes=${encodeURIComponent(raw)}`)).json();
    if (data.error) throw new Error(data.error);
  } catch { out.innerHTML = `<p class="notice">Could not load expression data.</p>`; return; }
  if (!data.series || !data.series.length) {
    out.innerHTML = `<p class="notice">No expression data for those genes.${data.unmatched && data.unmatched.length ? " Unrecognized: " + escapeHtml(data.unmatched.join(", ")) : ""}</p>`;
    return;
  }
  const palette = ["#00539b", "#be123c", "#047857", "#b45309", "#6b2fb3", "#0891b2", "#9d174d", "#1d4ed8"];
  out.innerHTML = `<canvas id="expr-chart" height="120"></canvas>${data.unmatched && data.unmatched.length ? `<p style="font-size:.75rem;color:var(--muted,#6b7280);margin-top:6px">Not recognized: ${escapeHtml(data.unmatched.join(", "))}</p>` : ""}`;
  const draw = () => {
    if (!window.Chart) return;
    if (exprChart) exprChart.destroy();
    exprChart = new Chart(document.getElementById("expr-chart"), {
      type: "line",
      data: {
        labels: data.timepoints.map((t) => t + "h"),
        datasets: data.series.map((s, i) => ({
          label: s.symbol, data: s.values,
          borderColor: palette[i % palette.length],
          backgroundColor: palette[i % palette.length] + "22",
          tension: 0.3, pointRadius: 3, fill: false,
        })),
      },
      options: { responsive: true, maintainAspectRatio: true,
        scales: { y: { title: { display: true, text: "RPKM" } },
                  x: { title: { display: true, text: "Development (h)" } } } },
    });
  };
  if (window.Chart) { draw(); } else {
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js";
    s.onload = draw;
    document.head.appendChild(s);
  }
}

const FIELD = "padding:8px 10px;border:1px solid var(--line,#d7dee0);border-radius:8px";
function renderLabPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Lab tools</p>
          <h2>Molecular biology tools</h2>
          <p>Design reagents for <em>Dictyostelium</em>: CRISPR guides and qPCR primers for a gene; codon-optimize a sequence for expression in <em>Dictyostelium</em>, <em>E. coli</em>, or human cells; map restriction sites; and find ORFs. Computational suggestions — validate before use.</p>
        </div>
      </header>
      <div class="record-body">
        <h3>CRISPR guide RNAs <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— SpCas9 (NGG), genome off-target checked</span></h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <input id="crispr-gene" aria-label="Gene symbol or DDB_G id" placeholder="gene symbol or DDB_G id (e.g. cln5)" style="${FIELD};min-width:260px">
          <button type="button" id="crispr-run">Design guides</button>
        </div>
        <div data-crispr-results style="margin-bottom:22px"></div>

        <h3>qPCR primers <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— over the cDNA</span></h3>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <input id="primer-gene" aria-label="Gene symbol or DDB_G id" placeholder="gene symbol or DDB_G id" style="${FIELD};min-width:260px">
          <button type="button" id="primer-run">Design primers</button>
        </div>
        <div data-primer-results style="margin-bottom:22px"></div>

        <h3>Codon optimizer <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— for heterologous expression</span></h3>
        <textarea id="codon-seq" aria-label="Sequence to optimize" rows="4" placeholder="Paste a protein (MFLIK…) or coding DNA sequence" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <label style="font-size:.8125rem;color:var(--muted,#6b7280)">Optimize for
            <select id="codon-organism" style="${FIELD};margin-left:4px">
              <option value="dicty">Dictyostelium (AT-rich)</option>
              <option value="ecoli">E. coli K-12</option>
              <option value="human">Human cells</option>
            </select>
          </label>
          <button type="button" id="codon-run">Optimize</button>
        </div>
        <div data-codon-results style="margin-top:12px"></div>

        <h3 style="margin-top:24px">Restriction sites <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— common cloning enzymes</span></h3>
        <textarea id="re-seq" aria-label="DNA sequence to scan for restriction sites" rows="3" placeholder="Paste a DNA sequence (e.g. a CDS or insert)" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px"><button type="button" id="re-run">Find sites</button></div>
        <div data-re-results style="margin-top:12px"></div>

        <h3 style="margin-top:24px">ORF finder &amp; translation <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— six-frame, ATG→stop, ≥30 aa</span></h3>
        <textarea id="orf-seq" aria-label="DNA sequence to find ORFs in" rows="3" placeholder="Paste a DNA sequence" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px"><button type="button" id="orf-run">Find ORFs</button></div>
        <div data-orf-results style="margin-top:12px"></div>
      </div>
    </article>`;
}

async function resolveGeneToDDB(input) {
  const t = (input || "").trim();
  if (/^DDB_G\d+$/i.test(t)) return t.toUpperCase();
  if (!t) return null;
  try {
    const r = await fetch(`/api/gene/${encodeURIComponent(t)}`);
    if (!r.ok) return null;
    const g = await r.json();
    return g.ddb || g.veupath || null;
  } catch { return null; }
}

function initLab() {
  const on = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener("click", fn); };
  on("crispr-run", runLabCrispr);
  on("primer-run", runLabPrimers);
  on("codon-run", runLabCodon);
  on("re-run", runLabRestriction);
  on("orf-run", runLabOrf);
}

async function runLabRestriction() {
  const out = document.querySelector("[data-re-results]");
  const seq = document.getElementById("re-seq").value.trim();
  if (!seq) { out.innerHTML = `<p class="notice">Paste a DNA sequence.</p>`; return; }
  out.innerHTML = loadingHTML("Scanning for sites…");
  try {
    const r = await (await fetch("/api/restriction", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seq }) })).json();
    if (r.error || !Array.isArray(r.enzymes)) { out.innerHTML = `<p class="notice">${escapeHtml(r.error || "Could not scan that sequence.")}</p>`; return; }
    const cutters = r.enzymes.filter((e) => e.count > 0);
    const noncut = r.enzymes.filter((e) => e.count === 0).map((e) => e.enzyme);
    const td = "padding:5px 8px";
    out.innerHTML = `
      <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">${r.length} bp · ${cutters.length} enzyme${cutters.length === 1 ? "" : "s"} cut · ${noncut.length} don't</p>
      ${cutters.length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)"><th style="${td}">Enzyme</th><th style="${td}">Site</th><th style="${td}">Cuts</th><th style="${td}">Positions (1-based)</th></tr></thead>
        <tbody>${cutters.map((e) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
          <td style="${td}"><strong>${e.enzyme}</strong></td><td style="${td};font-family:ui-monospace,Menlo,monospace">${e.site}</td>
          <td style="${td}">${e.count}</td><td style="${td}">${e.positions.join(", ")}</td></tr>`).join("")}</tbody></table></div>` : `<p class="notice muted">None of the listed enzymes cut this sequence.</p>`}
      ${noncut.length ? `<p style="font-size:.75rem;color:#047857;margin-top:8px"><strong>Non-cutters</strong> (usable as cloning sites): ${noncut.join(", ")}</p>` : ""}`;
  } catch { out.innerHTML = `<p class="notice">Scan failed.</p>`; }
}

async function runLabOrf() {
  const out = document.querySelector("[data-orf-results]");
  const seq = document.getElementById("orf-seq").value.trim();
  if (!seq) { out.innerHTML = `<p class="notice">Paste a DNA sequence.</p>`; return; }
  out.innerHTML = loadingHTML("Finding ORFs…");
  try {
    const r = await (await fetch("/api/orf", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seq }) })).json();
    if (r.error || !Array.isArray(r.orfs)) { out.innerHTML = `<p class="notice">${escapeHtml(r.error || "Could not scan that sequence.")}</p>`; return; }
    if (!r.orfs.length) { out.innerHTML = `<p class="notice">No ORFs ≥30 aa found in any frame.</p>`; return; }
    const td = "padding:5px 8px";
    out.innerHTML = `
      <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">${r.length} bp · ${r.orf_count} ORF${r.orf_count === 1 ? "" : "s"} ≥30 aa · showing longest ${r.orfs.length}</p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)"><th style="${td}">Strand</th><th style="${td}">Frame</th><th style="${td}">Span (nt)</th><th style="${td}">Length</th><th style="${td}">Protein</th></tr></thead>
        <tbody>${r.orfs.map((o) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
          <td style="${td}">${o.strand}</td><td style="${td}">${o.frame}</td><td style="${td}">${o.start}–${o.end}</td><td style="${td}">${o.length_aa} aa</td>
          <td style="${td};font-family:ui-monospace,Menlo,monospace" title="${escapeHtml(o.protein)}">${escapeHtml(o.protein.length > 40 ? o.protein.slice(0, 40) + "…" : o.protein)}</td></tr>`).join("")}</tbody></table></div>
      <p style="font-size:.72rem;color:var(--muted,#6b7280);margin-top:6px">Hover a protein to see the full translation. Longest ORF first.</p>`;
  } catch { out.innerHTML = `<p class="notice">ORF search failed.</p>`; }
}

// Result tables shared by the Lab tools page and the gene-record Lab reagents
// section — both hit /api/crispr and /api/primers, only the gene source differs.
function crisprTableHTML(g) {
  if (!g.length) return `<p class="notice">No guides found.</p>`;
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="padding:5px 8px">Protospacer (5′→3′)</th><th style="padding:5px 8px">PAM</th><th style="padding:5px 8px">Strand</th><th style="padding:5px 8px">Pos</th><th style="padding:5px 8px">GC</th><th style="padding:5px 8px" title="genome off-target sites">Off-tgt</th><th style="padding:5px 8px">Score</th></tr></thead>
      <tbody>${g.slice(0, 15).map((x) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
        <td style="padding:5px 8px;font-family:ui-monospace,Menlo,monospace">${x.protospacer}${x.poly_t ? ` <span title="poly-T (Pol III terminator)" style="color:#b45309">⚠</span>` : ""}</td>
        <td style="padding:5px 8px;font-family:ui-monospace,Menlo,monospace">${x.pam}</td><td style="padding:5px 8px">${x.strand}</td>
        <td style="padding:5px 8px">${x.position}</td><td style="padding:5px 8px">${(x.gc * 100).toFixed(0)}%</td>
        <td style="padding:5px 8px${x.off_targets ? ";color:#be123c" : ""}">${x.off_targets ?? "—"}</td><td style="padding:5px 8px">${x.score}</td></tr>`).join("")}</tbody></table></div>
      <p style="font-size:.72rem;color:var(--muted,#6b7280);margin-top:6px">Off-target = additional near-perfect genomic sites (blastn-short). Ranked by off-target then on-target score. Verify experimentally.</p>`;
}

function primerTableHTML(p) {
  if (!p.length) return `<p class="notice">No primer pairs met the criteria for this transcript.</p>`;
  return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="padding:5px 8px">Forward (5′→3′)</th><th style="padding:5px 8px">Reverse (5′→3′)</th><th style="padding:5px 8px">Product</th><th style="padding:5px 8px">Tm F/R</th></tr></thead>
      <tbody>${p.map((x) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
        <td style="padding:5px 8px;font-family:ui-monospace,Menlo,monospace">${x.forward}</td>
        <td style="padding:5px 8px;font-family:ui-monospace,Menlo,monospace">${x.reverse}</td>
        <td style="padding:5px 8px">${x.product} bp</td><td style="padding:5px 8px">${x.fwd_tm}/${x.rev_tm}°C</td></tr>`).join("")}</tbody></table></div>`;
}

// Run the CRISPR/primer designers for a known DDB_G id, rendering into `out`.
async function fetchCrisprInto(ddb, out) {
  out.innerHTML = loadingHTML("Scanning for guides…");
  try {
    const data = await (await fetch(`/api/crispr?ddb=${encodeURIComponent(ddb)}`)).json();
    out.innerHTML = crisprTableHTML(data.guides || []);
  } catch { out.innerHTML = `<p class="notice">Guide design failed.</p>`; }
}

async function fetchPrimersInto(ddb, out) {
  out.innerHTML = loadingHTML("Designing primers…");
  try {
    const data = await (await fetch(`/api/primers?ddb=${encodeURIComponent(ddb)}`)).json();
    out.innerHTML = primerTableHTML(data.primers || []);
  } catch { out.innerHTML = `<p class="notice">Primer design failed.</p>`; }
}

async function runLabCrispr() {
  const out = document.querySelector("[data-crispr-results]");
  out.innerHTML = loadingHTML("Resolving gene and scanning for guides…");
  const ddb = await resolveGeneToDDB(document.getElementById("crispr-gene").value);
  if (!ddb) { out.innerHTML = `<p class="notice">Gene not found.</p>`; return; }
  await fetchCrisprInto(ddb, out);
}

async function runLabPrimers() {
  const out = document.querySelector("[data-primer-results]");
  out.innerHTML = loadingHTML("Resolving gene and designing primers…");
  const ddb = await resolveGeneToDDB(document.getElementById("primer-gene").value);
  if (!ddb) { out.innerHTML = `<p class="notice">Gene not found.</p>`; return; }
  await fetchPrimersInto(ddb, out);
}

// Wire the on-demand Lab reagents buttons on a gene record's Summary tab.
// The record already knows its DDB_G id, so no gene resolution is needed.
function initRecordLabTools(gene) {
  const ddb = gene.veupath;
  if (!ddb || !/^DDB_G\d+$/.test(ddb)) return;
  const cb = document.querySelector("[data-record-crispr-run]");
  if (cb) cb.addEventListener("click", () => fetchCrisprInto(ddb, document.querySelector("[data-record-crispr-results]")));
  const pb = document.querySelector("[data-record-primer-run]");
  if (pb) pb.addEventListener("click", () => fetchPrimersInto(ddb, document.querySelector("[data-record-primer-results]")));
}

const CODON_ORGANISM_LABELS = { dicty: "Dictyostelium", ecoli: "E. coli K-12", human: "Human cells" };
async function runLabCodon() {
  const out = document.querySelector("[data-codon-results]");
  const seq = document.getElementById("codon-seq").value.trim();
  const sel = document.getElementById("codon-organism");
  const organism = sel ? sel.value : "dicty";
  if (!seq) { out.innerHTML = `<p class="notice">Paste a sequence.</p>`; return; }
  out.innerHTML = loadingHTML("Optimizing…");
  try {
    const r = await (await fetch("/api/codon-optimize", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seq, organism }) })).json();
    if (r.error) { out.innerHTML = `<p class="notice">${escapeHtml(r.error)}</p>`; return; }
    const label = CODON_ORGANISM_LABELS[r.organism] || r.organism;
    out.innerHTML = `
      <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">Optimized for <strong>${escapeHtml(label)}</strong> · ${r.length_aa} aa · GC ${(r.optimized_gc * 100).toFixed(0)}%${r.input_was_dna && r.input_cai != null ? ` · input CAI ${r.input_cai}` : ""}</p>
      <textarea readonly aria-label="Optimized DNA sequence" rows="4" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD}">${escapeHtml(r.optimized_dna)}</textarea>`;
  } catch { out.innerHTML = `<p class="notice">Optimization failed.</p>`; }
}

function renderAPIPage() {
  const get = (path, desc, params) => `
    <li style="margin-bottom:14px">
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
        <span style="font-size:0.7rem;font-weight:700;color:#047857;background:#ecfdf5;border-radius:4px;padding:2px 6px">GET</span>
        <code style="font-size:0.8125rem">${escapeHtml(path)}</code>
        <a class="text-link" href="${escapeHtml(path)}" target="_blank" rel="noopener" style="font-size:0.75rem">try it →</a>
      </div>
      <p style="margin:4px 0 0;font-size:0.8125rem;color:var(--muted,#6b7280)">${desc}${params ? ` <span style="color:#9ca3af">· ${escapeHtml(params)}</span>` : ""}</p>
    </li>`;
  const post = (path, desc, body) => `
    <li style="margin-bottom:14px">
      <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap">
        <span style="font-size:0.7rem;font-weight:700;color:#b45309;background:#fffbeb;border-radius:4px;padding:2px 6px">POST</span>
        <code style="font-size:0.8125rem">${escapeHtml(path)}</code>
      </div>
      <p style="margin:4px 0 4px;font-size:0.8125rem;color:var(--muted,#6b7280)">${desc}</p>
      <pre style="margin:0;background:var(--soft,#f1f5f4);border-radius:6px;padding:8px 10px;font-size:0.75rem;overflow-x:auto">${escapeHtml(body)}</pre>
    </li>`;
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Developers</p>
          <h2>REST API</h2>
          <p>A small JSON API over the same data the site uses. All responses are JSON with <code>Access-Control-Allow-Origin: *</code> (usable from other sites and notebooks). Base URL is this site's origin. No key or auth needed for the read endpoints below.</p>
        </div>
      </header>
      <div class="record-body">
        <h3>Records &amp; search</h3>
        <ul style="list-style:none;padding:0">
          ${get("/api/gene/mhcA", "Full gene record. Accepts a gene symbol or DDB_G id.", "/api/gene/{symbol|DDB_G id}")}
          ${get("/api/search?q=myosin", "Search genes by symbol, name, or description.", "q=term · limit (1–200, default 25)")}
          ${get("/api/phenotype-search?q=chemotaxis", "Find genes by curated mutant phenotype.", "q=term · limit (1–200, default 40)")}
          ${get("/api/go/GO:0006914", "Genes annotated to a GO term.", "/api/go/{GO:id}")}
          ${get("/api/strain/DBS0236830", "Strain record (gene + curated phenotypes).", "/api/strain/{DBS id}")}
          ${get("/api/data-status", "Dataset versions and last-refresh provenance.", "")}
        </ul>
        <h3>Sequence, structure &amp; domains</h3>
        <ul style="list-style:none;padding:0">
          ${get("/api/sequence?ddb=DDB_G0286355&type=protein&symbol=mhcA", "FASTA sequence download.", "type=genomic|cdna|protein")}
          ${get("/api/domains?acc=P08799", "InterPro/Pfam domain architecture for a UniProt accession.", "acc=UniProt accession")}
          ${get("/api/alphafold/P08799", "AlphaFold structure (PDB), proxied from EBI.", "/api/alphafold/{UniProt}")}
        </ul>
        <h3>Analysis (POST JSON)</h3>
        <ul style="list-style:none;padding:0">
          ${post("/api/enrichment", "GO-term or phenotype over-representation (hypergeometric + BH FDR).", 'curl -X POST {origin}/api/enrichment \\\n  -H "Content-Type: application/json" \\\n  -d \'{"genes":["mhcA","abpC","racE"],"set":"go","min_study":2}\'')}
          ${post("/api/blast", "Local BLAST against the bundled dictyostelid genomes (database=all searches every species; or pass a single genome id).", 'curl -X POST {origin}/api/blast \\\n  -H "Content-Type: application/json" \\\n  -d \'{"program":"tblastn","database":"d-discoideum-ax4","query":">q\\nMSEEVVA..."}\'')}
        </ul>
        <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:8px">Curator/write endpoints (upload, login, submit) exist but require authentication and aren't part of the public API.</p>
      </div>
    </article>`;
}

function renderEnrichmentPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Analysis</p>
          <h2>Enrichment analysis</h2>
          <p>Paste a list of genes (symbols like <em>mhcA</em> or DDB_G ids, separated by spaces, commas, or new lines) to find <strong>GO terms</strong> or curated <strong>mutant phenotypes</strong> that are statistically over-represented — useful for interpreting a hit list from RNA-seq, proteomics, or a screen. Hypergeometric test against all annotated <em>D. discoideum</em> genes, with Benjamini–Hochberg FDR.</p>
        </div>
      </header>
      <div class="record-body">
        <form id="enrich-form">
          <textarea id="enrich-genes" rows="6" aria-label="Gene list — symbols or DDB_G ids, space- or newline-separated" placeholder="mhcA acaA carA rasG pkaC gbpC&#10;DDB_G0286509" style="width:100%;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:0.875rem;padding:10px;border:1px solid var(--line,#d7dee0);border-radius:8px;resize:vertical"></textarea>
          <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:10px">
            <button type="submit">Run enrichment</button>
            <label style="font-size:0.8125rem;color:var(--muted,#6b7280)">analyze
              <select id="enrich-set" aria-label="Analysis type: GO terms, phenotypes, or KEGG pathways" style="margin-left:4px;padding:4px 6px;border:1px solid var(--line,#d7dee0);border-radius:6px">
                <option value="go">GO terms</option>
                <option value="phenotype">Phenotypes</option>
                <option value="kegg">KEGG pathways</option>
              </select>
            </label>
            <label style="font-size:0.8125rem;color:var(--muted,#6b7280)">min genes per term
              <input id="enrich-min" type="number" min="1" max="50" value="2" style="width:56px;margin-left:4px;padding:4px 6px;border:1px solid var(--line,#d7dee0);border-radius:6px">
            </label>
            <button type="button" id="enrich-example" class="text-link" style="background:none;border:none;cursor:pointer;color:var(--teal-dark)">Load an example</button>
          </div>
        </form>
        <div id="enrich-results" style="margin-top:18px"></div>
      </div>
    </article>`;
}

function initEnrichment() {
  const form = document.getElementById("enrich-form");
  const example = document.getElementById("enrich-example");
  if (example) example.addEventListener("click", () => {
    document.getElementById("enrich-genes").value =
      "abpA abpC corA ctxA ctxB fimA sevA proA proB myoB racE limE forH arpB cofA myoI";
  });
  if (form) form.addEventListener("submit", (e) => { e.preventDefault(); runEnrichment(); });
}

async function runEnrichment() {
  const out = document.getElementById("enrich-results");
  const raw = document.getElementById("enrich-genes").value.trim();
  const setVal = (document.getElementById("enrich-set") || {}).value;
  const set = ["phenotype", "kegg"].includes(setVal) ? setVal : "go";
  const minStudy = Math.max(1, Math.min(50, parseInt(document.getElementById("enrich-min").value, 10) || 2));
  if (!raw) { out.innerHTML = `<p class="notice">Enter at least one gene.</p>`; return; }
  const genes = raw.split(/[\s,]+/).filter(Boolean);
  const what = { phenotype: "phenotype annotations", kegg: "KEGG pathways" }[set] || "the GO annotation";
  out.innerHTML = `<p class="notice muted">Testing ${genes.length} gene${genes.length === 1 ? "" : "s"} against ${what}…</p>`;
  try {
    const res = await fetch("/api/enrichment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ genes, min_study: minStudy, set })
    });
    const data = await res.json();
    if (!res.ok) { out.innerHTML = `<p class="notice">${escapeHtml(data.error || "Enrichment failed.")}</p>`; return; }
    const rows = data.results || [];
    const ASPECT = { P: "biological process", F: "molecular function", C: "cellular component" };
    const head = `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">
      ${data.study_n} of ${genes.length} gene${genes.length === 1 ? "" : "s"} mapped to annotations · background ${data.background_n.toLocaleString()} genes
      ${data.unmatched.length ? ` · <span title="${escapeHtml(data.unmatched.join(", "))}">${data.unmatched.length} not recognized</span>` : ""}</p>`;
    const noun = { phenotype: "phenotypes", kegg: "pathways" }[set] || "GO terms";
    if (!rows.length) { out.innerHTML = head + `<p class="notice">No ${noun} reached the threshold for this list.</p>`; return; }
    const cols = set === "go"
      ? `<th style="padding:6px 8px">GO term</th><th style="padding:6px 8px">Aspect</th>`
      : `<th style="padding:6px 8px">${set === "kegg" ? "Pathway" : "Phenotype"}</th>`;
    out.innerHTML = head + `
      <div style="overflow-x:auto">
      <table class="enrich-table" style="width:100%;border-collapse:collapse;font-size:0.8125rem">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
          ${cols}
          <th style="padding:6px 8px" title="genes in your list with this term / genes tested">In list</th>
          <th style="padding:6px 8px" title="fold over the genome-wide rate">Fold</th>
          <th style="padding:6px 8px">P</th><th style="padding:6px 8px" title="Benjamini–Hochberg FDR">q (FDR)</th>
        </tr></thead>
        <tbody>
          ${rows.map((t) => {
            const sig = t.q_value < 0.05;
            const label = set === "go"
              ? `<td style="padding:6px 8px"><a class="text-link" href="/go/${escapeHtml(t.id)}">${t.name ? escapeHtml(t.name) : `<span style="color:var(--muted,#6b7280)">${escapeHtml(t.id)}</span>`}</a></td><td style="padding:6px 8px">${ASPECT[t.aspect] || t.aspect}</td>`
              : set === "kegg"
                ? `<td style="padding:6px 8px"><a class="text-link" href="https://www.kegg.jp/pathway/${escapeHtml(t.id)}" target="_blank" rel="noopener">${escapeHtml(t.term)}</a></td>`
                : `<td style="padding:6px 8px">${escapeHtml(t.term)}</td>`;
            return `<tr style="border-bottom:1px solid var(--line,#eef2f3)${sig ? "" : ";opacity:.6"}">
              ${label}
              <td style="padding:6px 8px">${t.study_count}/${t.study_n}</td>
              <td style="padding:6px 8px">${t.fold_enrichment != null ? t.fold_enrichment + "×" : "—"}</td>
              <td style="padding:6px 8px">${t.p_value.toExponential(1)}</td>
              <td style="padding:6px 8px">${t.q_value.toExponential(1)}</td>
            </tr>`;
          }).join("")}
        </tbody>
      </table></div>
      <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:8px">Rows with FDR ≥ 0.05 are dimmed.${set === "go" ? " Term names link to the GO browser." : set === "kegg" ? " Pathway names link to KEGG." : ""}</p>`;
  } catch {
    out.innerHTML = `<p class="notice">Could not reach the enrichment service.</p>`;
  }
}

function formatBytes(n) {
  if (!n) return "";
  const mb = n / 1024 / 1024;
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}

function genomeOptionsHTML(selected) {
  const sp = Object.entries(LOCAL_BLAST_DBS).map(([id, l]) => `<option value="${id}"${id === selected ? " selected" : ""}>${escapeHtml(l)}</option>`).join("");
  const iso = Object.entries(WILD_ISOLATES).map(([id, l]) => `<option value="${id}">${escapeHtml(l)}</option>`).join("");
  return `<optgroup label="Species">${sp}</optgroup><optgroup label="Wild isolates (Ahmed et al. 2025)">${iso}</optgroup>`;
}

function renderSequenceToolsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Sequence tools</h2>
          <p>Pull genomic DNA by coordinates, run in-silico PCR against any hosted genome, and align a set of sequences. Works across the sequenced dictyostelids and the wild isolates.</p>
        </div>
      </header>
      <div class="record-body">
        <h3>Retrieve a genomic region</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="reg-genome" aria-label="Genome" style="${FIELD}">${genomeOptionsHTML("d-discoideum-ax4")}</select>
          <input id="reg-chrom" aria-label="Contig" placeholder="contig (e.g. NC_007092.3)" style="${FIELD};min-width:200px">
          <input id="reg-start" aria-label="Start" placeholder="start" inputmode="numeric" style="${FIELD};width:110px">
          <input id="reg-end" aria-label="End" placeholder="end" inputmode="numeric" style="${FIELD};width:110px">
          <select id="reg-strand" aria-label="Strand" style="${FIELD}"><option value="+">+ strand</option><option value="-">− strand</option></select>
          <input id="reg-flank" aria-label="Flank" placeholder="flank bp" inputmode="numeric" value="0" style="${FIELD};width:100px">
          <button type="button" id="reg-run">Get sequence</button>
        </div>
        <div data-region-results style="margin-top:12px"></div>

        <h3 style="margin-top:26px">In-silico PCR</h3>
        <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">Perfect-match search for amplicons bounded by a primer pair (either orientation).</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
          <select id="pcr-genome" aria-label="Genome" style="${FIELD}">${genomeOptionsHTML("d-discoideum-ax4")}</select>
          <input id="pcr-fwd" aria-label="Forward primer" placeholder="forward primer (5'→3')" style="${FIELD};min-width:240px;font-family:ui-monospace,Menlo,monospace">
          <input id="pcr-rev" aria-label="Reverse primer" placeholder="reverse primer (5'→3')" style="${FIELD};min-width:240px;font-family:ui-monospace,Menlo,monospace">
          <input id="pcr-max" aria-label="Max product size" placeholder="max bp" inputmode="numeric" value="4000" style="${FIELD};width:100px">
          <button type="button" id="pcr-run">Find amplicons</button>
        </div>
        <div data-pcr-results style="margin-top:12px"></div>

        <h3 style="margin-top:26px">Multiple sequence alignment</h3>
        <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">Paste 2+ sequences in FASTA (protein or DNA). Center-star alignment — best for related sequences (orthologs, isolates).</p>
        <textarea id="aln-input" aria-label="Sequences to align (FASTA)" rows="6" placeholder=">seq1&#10;MSEEVVA…&#10;>seq2&#10;MSEDVVA…" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px"><button type="button" id="aln-run">Align</button></div>
        <div data-aln-results style="margin-top:12px"></div>
      </div>
    </article>`;
}

function initSequenceTools() {
  const wire = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener("click", fn); };
  wire("reg-run", runRegion);
  wire("pcr-run", runIsPcr);
  wire("aln-run", runAlign);
}

async function runRegion() {
  const out = document.querySelector("[data-region-results]");
  const g = document.getElementById("reg-genome").value;
  const chrom = document.getElementById("reg-chrom").value.trim();
  const start = document.getElementById("reg-start").value.trim();
  const end = document.getElementById("reg-end").value.trim();
  const strand = document.getElementById("reg-strand").value;
  const flank = document.getElementById("reg-flank").value.trim() || "0";
  if (!chrom || !start || !end) { out.innerHTML = `<p class="notice">Enter a contig, start, and end.</p>`; return; }
  out.innerHTML = loadingHTML("Extracting…");
  let d;
  try {
    d = await (await fetch(`/api/region?genome=${encodeURIComponent(g)}&chrom=${encodeURIComponent(chrom)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&strand=${encodeURIComponent(strand)}&flank=${encodeURIComponent(flank)}`)).json();
  } catch { out.innerHTML = `<p class="notice">Could not fetch the region.</p>`; return; }
  if (d.error) {
    out.innerHTML = `<p class="notice">${escapeHtml(d.error)}${d.contigs ? `<br><span style="font-size:.8em;color:var(--muted,#6b7280)">e.g. ${d.contigs.slice(0, 6).map(escapeHtml).join(", ")}</span>` : ""}</p>`;
    return;
  }
  const header = `>${escapeHtml(d.chrom)}:${d.start}-${d.end}(${d.strand}) ${escapeHtml(LOCAL_BLAST_DBS[d.genome] || WILD_ISOLATES[d.genome] || d.genome)} | dictyBase`;
  const wrapped = d.seq.replace(/(.{60})/g, "$1\n");
  out.innerHTML = `<p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">${d.length.toLocaleString()} bp</p>
    <textarea readonly aria-label="Region FASTA" rows="6" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.78rem;${FIELD}">${escapeHtml(header)}\n${escapeHtml(wrapped)}</textarea>`;
}

async function runIsPcr() {
  const out = document.querySelector("[data-pcr-results]");
  const g = document.getElementById("pcr-genome").value;
  const fwd = document.getElementById("pcr-fwd").value.trim();
  const rev = document.getElementById("pcr-rev").value.trim();
  const max = document.getElementById("pcr-max").value.trim() || "4000";
  if (!fwd || !rev) { out.innerHTML = `<p class="notice">Enter both primers.</p>`; return; }
  out.innerHTML = loadingHTML("Searching for amplicons…");
  let d;
  try {
    d = await (await fetch(`/api/ispcr?genome=${encodeURIComponent(g)}&fwd=${encodeURIComponent(fwd)}&rev=${encodeURIComponent(rev)}&maxsize=${encodeURIComponent(max)}`)).json();
  } catch { out.innerHTML = `<p class="notice">In-silico PCR failed.</p>`; return; }
  if (d.error) { out.innerHTML = `<p class="notice">${escapeHtml(d.error)}</p>`; return; }
  if (!d.products || !d.products.length) { out.innerHTML = `<p class="notice muted">No amplicons (perfect-match, ≤ ${escapeHtml(max)} bp). Check primers and genome.</p>`; return; }
  const td = "padding:5px 8px";
  out.innerHTML = `<p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 6px">${d.products.length} amplicon${d.products.length === 1 ? "" : "s"}</p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)"><th style="${td}">Contig</th><th style="${td}">Position</th><th style="${td}">Size</th><th style="${td}">Strand</th><th style="${td}">Product</th></tr></thead>
      <tbody>${d.products.map((p) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
        <td style="${td}">${escapeHtml(p.chrom)}</td><td style="${td}">${p.start.toLocaleString()}–${p.end.toLocaleString()}</td>
        <td style="${td}"><strong>${p.size.toLocaleString()} bp</strong></td><td style="${td}">${p.strand}</td>
        <td style="${td};font-family:ui-monospace,Menlo,monospace;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(p.seq)}">${escapeHtml(p.seq.slice(0, 40))}…</td></tr>`).join("")}</tbody></table></div>`;
}

async function runAlign() {
  const out = document.querySelector("[data-aln-results]");
  const fasta = (document.getElementById("aln-input").value || "").trim();
  if (!fasta) { out.innerHTML = `<p class="notice">Paste at least two sequences.</p>`; return; }
  out.innerHTML = loadingHTML("Aligning…");
  let d;
  try {
    d = await pollJob(() => fetch("/api/align", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ fasta }) }).then((r) => r.json()));
  } catch (e) { out.innerHTML = `<p class="notice">${escapeHtml(e.message || "Alignment failed.")}</p>`; return; }
  if (!d || d.error) { out.innerHTML = `<p class="notice">${escapeHtml((d && d.error) || "Alignment failed.")}</p>`; return; }
  out.innerHTML = renderAlignment(d);
  const cp = document.getElementById("aln-copy");
  if (cp) cp.addEventListener("click", () => {
    const fa = (d.rows || []).map((r) => `>${r.name}\n${r.seq}`).join("\n");
    if (navigator.clipboard) navigator.clipboard.writeText(fa);
    cp.textContent = "Copied ✓";
  });
}

function renderAlignment(d) {
  const rows = d.rows || [];
  const cons = d.consensus || "";
  const nameW = Math.min(18, Math.max(6, ...rows.map((r) => r.name.length)));
  const colorize = rows.length * d.length <= 14000;
  const cell = (ch, consCh) => {
    if (!colorize) return ch === "<" ? "&lt;" : ch;
    if (ch === "-") return `<span style="color:#cbd5e1">-</span>`;
    if (ch === consCh) return `<span style="background:#e7f3ea">${escapeHtml(ch)}</span>`;
    return `<span style="background:#fde7d6">${escapeHtml(ch)}</span>`;
  };
  const line = (name, seq) => {
    const label = escapeHtml((name || "").slice(0, nameW).padEnd(nameW, " "));
    const body = colorize ? [...seq].map((ch, i) => cell(ch, cons[i])).join("") : escapeHtml(seq);
    return `<div style="white-space:pre"><span style="color:var(--muted,#6b7280)">${label}</span> ${body}</div>`;
  };
  return `
    <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">${rows.length} sequences · ${d.length} columns · ${d.identity}% mean pairwise identity
      <button type="button" id="aln-copy" class="text-link" style="background:none;border:none;cursor:pointer;color:var(--teal-dark)">Copy aligned FASTA</button></p>
    <div style="overflow-x:auto;font-family:ui-monospace,Menlo,monospace;font-size:.74rem;line-height:1.5;border:1px solid var(--line,#d7dee0);border-radius:8px;padding:10px;background:#fff">
      ${rows.map((r) => line(r.name, r.seq)).join("")}
      <div style="white-space:pre;border-top:1px solid var(--line,#eef2f3);margin-top:4px;padding-top:4px"><span style="color:var(--muted,#6b7280)">${"consensus".slice(0, nameW).padEnd(nameW, " ")}</span> ${colorize ? escapeHtml(cons) : escapeHtml(cons)}</div>
    </div>`;
}

function renderGeneSetPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Gene set analysis</h2>
          <p>Paste a hit list — differentially-expressed genes, proteomics hits, a screen — and get an instant interpretation: enriched GO terms, mutant phenotypes, and KEGG pathways, the human-ortholog and disease overlap, the developmental expression-peak profile of your set, and a plain-language summary. Accepts gene symbols, DDB_G ids, UniProt accessions, and NCBI Gene ids. All computed locally from the site's curated data — no account, no limits.</p>
        </div>
      </header>
      <div class="record-body">
        <textarea id="gs-input" aria-label="Gene list" rows="5" placeholder="mhcA abpC racE rasG&#10;DDB_G0286355  P08799  cln5 tpp1 ctsD" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button type="button" id="gs-run">Analyze gene set</button>
          <button type="button" id="gs-example" class="text-link" style="background:none;border:none;cursor:pointer;color:var(--teal-dark)">Load an example</button>
        </div>
        <div data-gs-results style="margin-top:16px"></div>
      </div>
    </article>`;
}

function initGeneSet() {
  const b = document.getElementById("gs-run");
  if (b) b.addEventListener("click", runGeneSet);
  const ex = document.getElementById("gs-example");
  if (ex) ex.addEventListener("click", () => {
    document.getElementById("gs-input").value = "mhcA abpC racE rasG rasD arpC myoB limE forA cln5 tpp1 ctsD";
    runGeneSet();
  });
}

async function runGeneSet() {
  const out = document.querySelector("[data-gs-results]");
  const raw = (document.getElementById("gs-input").value || "").trim();
  if (!raw) { out.innerHTML = `<p class="notice">Paste a gene list.</p>`; return; }
  const genes = raw.split(/[\s,;]+/).filter(Boolean);
  out.innerHTML = loadingHTML("Analyzing gene set…");
  let d;
  try {
    d = await (await fetch("/api/geneset-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ genes }) })).json();
    if (d.error) throw new Error(d.error);
  } catch (e) { out.innerHTML = `<p class="notice">${escapeHtml(e.message || "Could not analyze that set.")}</p>`; return; }
  out.innerHTML = renderGeneSetReport(d);
}

function renderGeneSetReport(d) {
  if (!d.matched_n) return `<p class="notice">${escapeHtml(d.summary || "No genes recognized.")}</p>`;
  const td = "padding:5px 8px";
  const ASPECT = { P: "Process", F: "Function", C: "Component" };
  const enrichTable = (rows, kind) => {
    if (!rows || !rows.length) return `<p class="notice muted">No significant ${kind} enrichment.</p>`;
    return `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)"><th style="${td}">Term</th><th style="${td}">Genes</th><th style="${td}">Fold</th><th style="${td}">q</th></tr></thead>
      <tbody>${rows.map((r) => {
        const label = kind === "GO"
          ? `<a class="text-link" href="/go/${encodeURIComponent(r.id)}">${escapeHtml(r.id)}</a> <span style="color:var(--muted,#6b7280);font-size:.85em">${escapeHtml(ASPECT[r.aspect] || r.aspect || "")}</span>`
          : `${escapeHtml(r.term || r.id)}${r.id ? ` <span style="color:var(--muted,#9ca3af);font-size:.8em">${escapeHtml(r.id)}</span>` : ""}`;
        return `<tr style="border-bottom:1px solid var(--line,#eef2f3)"><td style="${td}">${label}</td><td style="${td}">${r.study_count}</td><td style="${td}">${r.fold}×</td><td style="${td}">${r.q < 0.001 ? r.q.toExponential(1) : r.q}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  };
  const e = d.expression || { stages: [], hist: [], no_peak: 0 };
  const maxH = Math.max(1, ...(e.hist || []));
  const bars = (e.hist || []).map((c, i) => `
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:36px">
      <span style="font-size:.7rem;color:var(--muted,#6b7280)">${c || ""}</span>
      <div style="width:22px;height:60px;display:flex;align-items:flex-end"><div style="width:100%;height:${Math.round(100 * c / maxH)}%;background:var(--teal-dark,#012169);border-radius:3px 3px 0 0;min-height:${c ? 3 : 0}px"></div></div>
      <span style="font-size:.66rem;color:var(--muted,#9ca3af)">${escapeHtml((e.stages[i] || "").replace(" h", ""))}</span>
    </div>`).join("");
  const o = d.orthologs || {};
  return `
    <div class="data-block" style="background:var(--soft,#e7eef7);border-radius:8px;padding:14px 16px;margin-bottom:16px">
      <p style="margin:0;font-size:.95rem">${escapeHtml(d.summary)}</p>
      <p style="margin:8px 0 0;font-size:.75rem;color:var(--muted,#6b7280)">${d.matched_n} gene${d.matched_n === 1 ? "" : "s"} recognized${d.unmatched && d.unmatched.length ? ` · not recognized: ${d.unmatched.slice(0, 20).map(escapeHtml).join(", ")}` : ""}</p>
    </div>
    <div class="data-block"><h3>Enriched GO terms</h3>${enrichTable(d.go, "GO")}</div>
    <div class="data-block"><h3>Enriched mutant phenotypes</h3>${enrichTable(d.phenotype, "phenotype")}</div>
    <div class="data-block"><h3>Enriched KEGG pathways</h3>${enrichTable(d.kegg, "KEGG")}</div>
    <div class="data-block">
      <h3>Human orthologs &amp; disease</h3>
      <p style="font-size:.9rem;margin:0 0 10px"><strong>${o.with_ortholog || 0}</strong> of ${o.total} have a human ortholog · <strong>${o.with_disease || 0}</strong> are linked to a human disease.</p>
      ${(d.notable || []).length ? `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.8125rem">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)"><th style="${td}">Gene</th><th style="${td}">Human</th><th style="${td}">Disease</th></tr></thead>
        <tbody>${d.notable.map((x) => `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
          <td style="${td}"><a class="text-link" href="/gene/${encodeURIComponent(x.symbol)}" data-ddb-ref="${escapeHtml(x.ddb)}"><strong>${escapeHtml(x.symbol)}</strong></a></td>
          <td style="${td}">${escapeHtml(x.human || "")}</td><td style="${td};color:var(--muted,#6b7280)">${escapeHtml(x.disease || "")}</td></tr>`).join("")}</tbody></table></div>` : ""}
    </div>
    <div class="data-block">
      <h3>Developmental expression peak <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— when each gene's RNA-seq profile is highest</span></h3>
      <div style="display:flex;gap:6px;align-items:flex-end;flex-wrap:wrap">${bars}</div>
      ${e.no_peak ? `<p style="font-size:.75rem;color:var(--muted,#9ca3af);margin:8px 0 0">${e.no_peak} gene${e.no_peak === 1 ? "" : "s"} with no clear peak (low expression).</p>` : ""}
    </div>
    <p style="font-size:.72rem;color:var(--muted,#9ca3af);margin-top:6px">Enrichment: hypergeometric test with Benjamini–Hochberg FDR (q ≤ 0.05). For the full enrichment tool with options, see <a class="text-link" href="/tools/enrichment">GO &amp; phenotype enrichment</a>.</p>`;
}

function renderConvertPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Gene ID converter</h2>
          <p>Paste a mixed list of gene identifiers — symbols (<em>mhcA</em>), DDB_G ids, UniProt accessions, or NCBI Gene ids — and get them resolved to a single normalized table with every cross-reference. Unrecognized inputs are flagged.</p>
        </div>
      </header>
      <div class="record-body">
        <textarea id="convert-input" aria-label="Identifiers to convert" rows="6" placeholder="mhcA  rasG&#10;DDB_G0286355&#10;P08799&#10;8629223" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:.8125rem;${FIELD};resize:vertical"></textarea>
        <div style="margin-top:8px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
          <button type="button" id="convert-run">Convert</button>
          <button type="button" id="convert-example" class="text-link" style="background:none;border:none;cursor:pointer;color:var(--teal-dark)">Load an example</button>
        </div>
        <div data-convert-results style="margin-top:14px"></div>
      </div>
    </article>`;
}

function initConvert() {
  const b = document.getElementById("convert-run");
  if (b) b.addEventListener("click", runConvert);
  const ex = document.getElementById("convert-example");
  if (ex) ex.addEventListener("click", () => {
    document.getElementById("convert-input").value = "mhcA rasG cln5\nDDB_G0286355\nP08799\n8629223\nnotagene";
    runConvert();
  });
}

async function runConvert() {
  const out = document.querySelector("[data-convert-results]");
  const raw = (document.getElementById("convert-input").value || "").trim();
  if (!raw) { out.innerHTML = `<p class="notice">Paste some identifiers.</p>`; return; }
  const ids = raw.split(/[\s,;]+/).filter(Boolean);
  out.innerHTML = loadingHTML("Resolving identifiers…");
  let data;
  try {
    data = await (await fetch("/api/idmap", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids }) })).json();
    if (data.error) throw new Error(data.error);
  } catch { out.innerHTML = `<p class="notice">Could not resolve identifiers right now.</p>`; return; }
  const td = "padding:5px 8px";
  const rows = (data.results || []).map((r) => {
    if (!r.found) return `<tr style="border-bottom:1px solid var(--line,#eef2f3)"><td style="${td}"><code>${escapeHtml(r.input)}</code></td><td style="${td}" colspan="5"><span style="color:#b91c1c">not found</span></td></tr>`;
    const up = r.uniprot ? `<a class="text-link" href="https://www.uniprot.org/uniprotkb/${encodeURIComponent(r.uniprot)}" target="_blank" rel="noopener">${escapeHtml(r.uniprot)}</a>` : "—";
    const nc = r.ncbiGene ? `<a class="text-link" href="https://www.ncbi.nlm.nih.gov/gene/${encodeURIComponent(r.ncbiGene)}" target="_blank" rel="noopener">${escapeHtml(r.ncbiGene)}</a>` : "—";
    return `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
      <td style="${td}"><code>${escapeHtml(r.input)}</code></td>
      <td style="${td}"><a class="text-link" href="/gene/${encodeURIComponent(r.symbol)}" data-ddb-ref="${escapeHtml(r.ddb)}"><strong>${escapeHtml(r.symbol)}</strong></a></td>
      <td style="${td}">${escapeHtml(r.ddb)}</td>
      <td style="${td}">${up}</td>
      <td style="${td}">${nc}</td>
      <td style="${td};color:var(--muted,#6b7280)">${escapeHtml(r.name || "")}</td></tr>`;
  }).join("");
  const tsv = ["input\tsymbol\tddb_g\tuniprot\tncbi_gene\tname",
    ...(data.results || []).filter((r) => r.found).map((r) => [r.input, r.symbol, r.ddb, r.uniprot, r.ncbiGene, r.name].join("\t"))].join("\n");
  out.innerHTML = `
    <p style="font-size:.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">${data.found} of ${data.count} resolved.
      <button type="button" id="convert-copy" class="text-link" style="background:none;border:none;cursor:pointer;color:var(--teal-dark)">Copy as TSV</button></p>
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="${td}">Input</th><th style="${td}">Symbol</th><th style="${td}">DDB_G</th><th style="${td}">UniProt</th><th style="${td}">NCBI Gene</th><th style="${td}">Name</th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
  const cp = document.getElementById("convert-copy");
  if (cp) cp.addEventListener("click", () => { navigator.clipboard && navigator.clipboard.writeText(tsv); cp.textContent = "Copied ✓"; });
}

function renderDownloadsShell() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Downloads</p>
          <h2>Genome downloads</h2>
          <p>Genome assemblies (FASTA) and gene annotations (GFF3) for the sequenced dictyostelid species, plus a panel of <em>D. discoideum</em> wild isolates. FASTA files are gzip-compressed.</p>
        </div>
      </header>
      <div class="record-body">
        <div data-downloads-results>
          <p class="notice muted">Loading downloads…</p>
        </div>
        <h3 style="margin:22px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--line,#d7dee0)">Bulk data tables</h3>
        <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:-2px 0 12px">Whole-database exports as tab-separated values (TSV) for offline analysis. Also available via the <a class="text-link" href="/tools/api">REST API</a>.</p>
        <ul class="list">
          ${[
            ["genes", "Gene catalog", "DDB_G id, symbol, name, location, NCBI gene, UniProt — all ~13,900 genes."],
            ["go", "GO annotations", "Gene → GO term, aspect, evidence code, PMID."],
            ["phenotypes", "Curated phenotypes", "Gene → mutant phenotype and supporting PMID."],
            ["orthologs", "Human orthologs & disease", "Gene → human ortholog, relationship, linked disease."],
          ].map(([ds, label, desc]) => `
            <li style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
              <span><strong>${label}</strong><br><span style="color:var(--muted,#6b7280);font-size:0.8125rem">${desc}</span></span>
              <a class="button" href="/api/bulk?dataset=${ds}" download>Download TSV</a>
            </li>`).join("")}
        </ul>
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
    const card = (sp) => `
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
      </section>`;
    const species = manifest.filter((sp) => sp.group !== "isolate");
    const isolates = manifest.filter((sp) => sp.group === "isolate");
    const groupHead = (t) => `<h3 style="margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--line,#d7dee0)">${t}</h3>`;
    container.innerHTML =
      groupHead("Sequenced dictyostelid species") + species.map(card).join("") +
      (isolates.length ? groupHead("D. discoideum wild isolates") +
        `<p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:-4px 0 12px">Chromosome- to scaffold-level assemblies of wild <em>D. discoideum</em> isolates (and one additional <em>D. citrinum</em>) from Ahmed et al. 2025, <a class="text-link" href="https://www.pnas.org/doi/10.1073/pnas.2520843122" target="_blank" rel="noopener">PNAS</a> — released under CC BY 4.0.</p>` +
        isolates.map(card).join("") : "");
  } catch {
    container.innerHTML = `<p class="notice">Downloads could not be loaded right now.</p>`;
  }
}

let heatStressData = null;
let hsChart = null;
let hsSelected = [];
const HS_CONDITIONS = ["Control", "Heat stress", "Development"];
const HS_COLORS = ["#00539b", "#dc2626", "#2563eb"];

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
            <input id="hs-search" aria-label="Search heat-stress proteins" type="text" placeholder="Gene name, UniProt ID, or description…" style="flex:1;min-width:220px">
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
        <button onclick="removeFromHSChart('${escapeHtml(p.gene)}')" aria-label="Remove ${escapeHtml(p.gene)} from chart" style="background:none;border:none;cursor:pointer;padding:0;font-size:12px;color:#6b7280;min-height:unset">✕</button>
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
    row.addEventListener("mouseenter", () => row.style.background = "var(--soft,#e7eef7)");
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
const STAGE_COLORS = ["#00539b","#2563eb","#d97706","#dc2626","#7c3aed"];
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
            <input id="prot-search" aria-label="Search proteome" type="text" placeholder="Gene name, UniProt ID, or description…" style="flex:1;min-width:220px">
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
        <button onclick="removeFromChart('${escapeHtml(p.gene)}')" aria-label="Remove ${escapeHtml(p.gene)} from chart" style="background:none;border:none;cursor:pointer;padding:0;font-size:12px;color:#6b7280;min-height:unset">✕</button>
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
    row.addEventListener("mouseenter", () => row.style.background = "var(--soft,#e7eef7)");
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
          <p>BLAST a sequence against the sequenced dictyostelid genomes hosted here — including a panel of <em>D. discoideum</em> wild isolates — hits in <em>D. discoideum</em> link straight to their gene page — or hand off to NCBI for an all-organisms search.</p>
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
                <optgroup label="Comparative species">
                  ${Object.entries(LOCAL_BLAST_DBS).map(([id, label]) => `<option value="${id}"${id === "d-discoideum-ax4" ? " selected" : ""}>${label}</option>`).join("")}
                  <option value="all">All species</option>
                </optgroup>
                <optgroup label="D. discoideum wild isolates (Ahmed et al. 2025)">
                  ${Object.entries(WILD_ISOLATES).map(([id, label]) => `<option value="${id}">${label}</option>`).join("")}
                </optgroup>
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
// Comparative species set — one assembly per species. The cross-species
// comparison, conservation track, and "All species" BLAST iterate this.
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
  "d-citrinum": "D. citrinum GS8b",
  "d-dimigraforme": "D. dimigraforme Ar5b",
};

// Wild isolates from Ahmed et al. 2025 (PNAS, doi:10.1073/pnas.2520843122):
// conspecific D. discoideum strains plus a 2nd D. citrinum. Kept separate from
// the comparative set above — individually BLAST-able but NOT part of the
// cross-species comparison (which compares species, not strains).
const WILD_ISOLATES = {
  "dd-ax2-214": "D. discoideum AX2-214",
  "dd-cr116c": "D. discoideum CR116C",
  "dd-ot3a": "D. discoideum OT3A",
  "dd-m4b": "D. cf. discoideum M4B",
  "dd-s6b": "D. cf. discoideum S6B",
  "dc-cf3b": "D. citrinum Cf3b",
};

// Submit a heavy BLAST/conservation job (server runs it on a bounded worker
// pool) and poll /api/job until it finishes. `submit` returns {job_id}. Resolves
// to the same payload the synchronous endpoint would have returned; throws on
// server error or timeout. Backs off 300ms → 2s between polls.
async function pollJob(submit) {
  const sub = await submit();
  if (!sub || !sub.job_id) throw new Error(sub && sub.error || "could not queue job");
  const id = sub.job_id;
  let delay = 300;
  for (let i = 0; i < 150; i++) {
    await new Promise((r) => setTimeout(r, delay));
    const j = await (await fetch(`/api/job?id=${encodeURIComponent(id)}`)).json();
    if (j.status === "done") {
      if (j.code && j.code >= 400) throw new Error((j.result && j.result.error) || "job failed");
      return j.result;
    }
    if (j.status === "error") throw new Error(j.error || "job failed");
    delay = Math.min(Math.round(delay * 1.3), 2000);
  }
  throw new Error("timed out");
}

async function runLocalBlast(form) {
  const results = document.getElementById("local-blast-results");
  if (!results) return;
  const program = form.querySelector("#lblast-program").value;
  const database = form.querySelector("#lblast-db").value;
  const query = form.querySelector("#lblast-query").value.trim();
  if (!query) { results.innerHTML = `<p class="notice">Enter a query sequence.</p>`; return; }
  results.innerHTML = loadingHTML(`Running ${program} against ${database === "all" ? "all species" : (LOCAL_BLAST_DBS[database] || WILD_ISOLATES[database] || database)}…`);
  try {
    let data;
    if (database === "all") {
      // Heavy multi-genome search — run it as a queued job so it neither holds a
      // request thread nor 503s under load.
      data = await pollJob(() => fetch("/api/blast?async=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, database, query }),
      }).then((r) => r.json()));
    } else {
      const res = await fetch("/api/blast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program, database, query }),
      });
      data = await res.json();
      if (!res.ok) { results.innerHTML = `<p class="notice">${escapeHtml(data.error || "BLAST failed.")}</p>`; return; }
    }
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
  },
  // Ahmed et al. 2025 (PNAS) — new species reps
  { id: "d-citrinum", label: "D. citrinum GS8b", assembly: "GCA_054859325.1", group: "species",
    fastaURL: "/assets/genomes/D_citrinum_GS8b_browser.fna", indexURL: "/assets/genomes/D_citrinum_GS8b_browser.fna.fai",
    gffURL: "/assets/genomes/D_citrinum_GS8b_browser.gff", locus: "JBTAPL010000001.1:1-200000" },
  { id: "d-dimigraforme", label: "D. dimigraforme Ar5b", assembly: "GCA_054859025.1", group: "species",
    fastaURL: "/assets/genomes/D_dimigraforme_Ar5b_browser.fna", indexURL: "/assets/genomes/D_dimigraforme_Ar5b_browser.fna.fai",
    gffURL: "/assets/genomes/D_dimigraforme_Ar5b_browser.gff", locus: "JBTAPM010000002.1:1-200000" },
  // Ahmed et al. 2025 — D. discoideum (+ 2nd citrinum) wild isolates
  { id: "dd-ax2-214", label: "D. discoideum AX2-214", assembly: "GCA_054883475.1", group: "isolate",
    fastaURL: "/assets/genomes/Dd_AX2-214_browser.fna", indexURL: "/assets/genomes/Dd_AX2-214_browser.fna.fai",
    gffURL: "/assets/genomes/Dd_AX2-214_browser.gff", locus: "CM142508.1:1-200000" },
  { id: "dd-cr116c", label: "D. discoideum CR116C", assembly: "GCA_054859385.1", group: "isolate",
    fastaURL: "/assets/genomes/Dd_CR116C_browser.fna", indexURL: "/assets/genomes/Dd_CR116C_browser.fna.fai",
    gffURL: "/assets/genomes/Dd_CR116C_browser.gff", locus: "JBTAPF010000001.1:1-200000" },
  { id: "dd-ot3a", label: "D. discoideum OT3A", assembly: "GCA_054859355.1", group: "isolate",
    fastaURL: "/assets/genomes/Dd_OT3A_browser.fna", indexURL: "/assets/genomes/Dd_OT3A_browser.fna.fai",
    gffURL: "/assets/genomes/Dd_OT3A_browser.gff", locus: "JBTAPG010000033.1:1-200000" },
  { id: "dd-m4b", label: "D. cf. discoideum M4B", assembly: "GCA_054859205.1", group: "isolate",
    fastaURL: "/assets/genomes/Dd_M4B_browser.fna", indexURL: "/assets/genomes/Dd_M4B_browser.fna.fai",
    gffURL: "/assets/genomes/Dd_M4B_browser.gff", locus: "JBTAPH010000036.1:1-200000" },
  { id: "dd-s6b", label: "D. cf. discoideum S6B", assembly: "GCA_054859235.1", group: "isolate",
    fastaURL: "/assets/genomes/Dd_S6B_browser.fna", indexURL: "/assets/genomes/Dd_S6B_browser.fna.fai",
    gffURL: "/assets/genomes/Dd_S6B_browser.gff", locus: "JBTAPI010000014.1:1-200000" },
  { id: "dc-cf3b", label: "D. citrinum Cf3b", assembly: "GCA_054859145.1", group: "isolate",
    fastaURL: "/assets/genomes/D_citrinum_Cf3b_browser.fna", indexURL: "/assets/genomes/D_citrinum_Cf3b_browser.fna.fai",
    gffURL: "/assets/genomes/D_citrinum_Cf3b_browser.gff", locus: "JBTAPK010000002.1:1-200000" }
];

let igvBrowser = null;
let pendingBrowserLocus = null;   // set by viewInBrowser(); consumed on next browser load

// Parse a gene record's location ("NC_007088.5: 1,696,443-1,697,768") into the
// AX4 RefSeq locus the genome browser uses. Coordinate separator may be a hyphen
// or en/em-dash (NCBI records use an en-dash). Returns null when there are no
// coordinates (e.g. "curated locus" / "See NCBI Gene record").
function geneLocus(gene) {
  const m = (gene && gene.location || "").match(/^(N[CW]_[\d.]+)\s*:\s*([\d,]+)\s*[-–—]\s*([\d,]+)/);
  if (!m) return null;
  return { chrom: m[1], start: parseInt(m[2].replace(/,/g, ""), 10), end: parseInt(m[3].replace(/,/g, ""), 10) };
}

function geneDdb(gene) {
  const d = (gene && (gene.veupath || gene.ddb || gene.id) || "").toUpperCase();
  return /^DDB_G\d+$/.test(d) ? d : "";
}

// Show the "view in browser" jump whenever we can place the gene — either its
// location string parses, or it has a DDB_G id we can resolve server-side.
function canViewInBrowser(gene) {
  return !!(geneLocus(gene) || geneDdb(gene));
}

async function viewInBrowser(gene) {
  let loc = geneLocus(gene);
  if (!loc) {
    // Fall back to the authoritative coordinates in gene_models (these always
    // match the browser's contig names), via the neighborhood endpoint.
    const ddb = geneDdb(gene);
    if (!ddb) return;
    try {
      const d = await fetch(`/api/neighborhood?ddb=${encodeURIComponent(ddb)}&k=0`).then((r) => r.json());
      const t = (d.genes || []).find((g) => g.target) || (d.genes || [])[0];
      if (d.chrom && t && t.start && t.end) loc = { chrom: d.chrom, start: t.start, end: t.end };
    } catch { /* fall through */ }
  }
  if (!loc) return;
  const pad = 2000;
  pendingBrowserLocus = `${loc.chrom}:${Math.max(1, loc.start - pad)}-${loc.end + pad}`;
  openTool("genome-browser");
}

function renderGenomeBrowser() {
  const opt = (o) => `<option value="${escapeHtml(o.id)}">${escapeHtml(o.label)} · ${escapeHtml(o.assembly)}</option>`;
  const species = browserOrganisms.filter((o) => o.group !== "isolate");
  const isolates = browserOrganisms.filter((o) => o.group === "isolate");
  const options =
    `<optgroup label="Comparative species">${species.map(opt).join("")}</optgroup>` +
    `<optgroup label="D. discoideum wild isolates (Ahmed et al. 2025)">${isolates.map(opt).join("")}</optgroup>`;
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Tools</p>
          <h2>Genome browser</h2>
          <p>Interactive genome browser for the sequenced dictyostelid species and a panel of <em>D. discoideum</em> wild isolates (Ahmed et al. 2025). Powered by IGV.js.</p>
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
        <details style="margin-bottom:12px">
          <summary style="cursor:pointer;font-size:0.875rem;font-weight:700">Add your own track</summary>
          <div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <input id="track-url" aria-label="Track URL" placeholder="track URL — BED, GFF3, VCF, bigWig, BAM…" style="${FIELD};min-width:min(300px,100%);flex:1">
            <input id="track-name" aria-label="Track name" placeholder="track name (optional)" style="${FIELD};width:170px">
            <select id="track-format" aria-label="Track format" style="${FIELD}">
              <option value="">auto-detect</option><option value="bed">BED</option><option value="gff3">GFF3</option><option value="gtf">GTF</option><option value="vcf">VCF</option><option value="bigwig">bigWig</option><option value="bedgraph">bedGraph</option><option value="bam">BAM</option><option value="wig">WIG</option>
            </select>
            <button type="button" id="track-add">Add track</button>
          </div>
          <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:6px 0 0">Your browser fetches the file directly from the URL, so it must be publicly reachable and CORS-enabled. Indexed formats (BAM, VCF.gz) need their index (.bai / .tbi) at the same location.</p>
          <div id="track-msg" style="font-size:0.8125rem;margin-top:6px"></div>
        </details>
        <div id="igv-container" class="igv-wrap">
          <div class="igv-loading"><span class="spinner" aria-hidden="true"></span>Loading genome browser…</div>
        </div>
      </div>
    </article>
  `;
}

// Parikh developmental RNA-seq time course as IGV wig tracks (AX4 only — the
// genome these gene coordinates + expression values belong to).
const RNASEQ_TPS = ["0", "4", "8", "12", "16", "20", "24"];
function rnaseqTracks() {
  return RNASEQ_TPS.map((tp, i) => ({
    name: `RNA-seq ${tp}h`,
    url: `/assets/tracks/rnaseq_${tp}h.bedgraph`,
    format: "bedgraph",
    type: "wig",
    height: 32,
    autoscaleGroup: "rnaseq",
    color: `rgb(${i * 2}, ${83 - i * 8}, ${155 - i * 8})`,
  }));
}

function buildIGVOptions(org) {
  // Use the bgzipped + tabix-indexed annotation so IGV byte-ranges only the
  // visible window (built by scripts/build_browser_tracks.py). org.gffURL still
  // points at the plain .gff; the indexed copy is `${gffURL}.gz` (+ .gz.tbi).
  const tracks = org.gffURL ? [{
    name: "Gene annotations",
    url: `${org.gffURL}.gz`,
    indexURL: `${org.gffURL}.gz.tbi`,
    format: "gff3",
    indexed: true,
    displayMode: "EXPANDED",
    color: "rgb(0, 83, 155)"
  }] : [];
  if (org.id === "d-discoideum-ax4") tracks.push(...rnaseqTracks());
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

  igvBrowser = null;   // container was just re-rendered; build a fresh instance

  const loadBrowser = (org) => {
    if (note) note.textContent = org.gffURL ? "" : "No gene annotations available for this organism.";
    const locus = pendingBrowserLocus; pendingBrowserLocus = null;
    if (igvBrowser) {
      igvBrowser.loadGenome(buildIGVOptions(org).genome)
        .then(() => { if (locus) igvBrowser.search(locus); }).catch(() => {});
      return;
    }
    const opts = buildIGVOptions(org);
    if (locus) opts.locus = locus;
    igv.createBrowser(container, opts)
      .then((b) => { igvBrowser = b; })
      .catch(() => {
        container.innerHTML = `<p style="padding:16px;color:var(--muted,#6b7280)">Browser could not be loaded.</p>`;
      });
  };

  const startWithOrg = browserOrganisms[0];

  const addBtn = document.getElementById("track-add");
  if (addBtn) addBtn.addEventListener("click", () => {
    const url = (document.getElementById("track-url").value || "").trim();
    const name = (document.getElementById("track-name").value || "").trim();
    const fmt = document.getElementById("track-format").value;
    const msg = document.getElementById("track-msg");
    if (!url) { msg.style.color = "#b91c1c"; msg.textContent = "Enter a track URL."; return; }
    if (!igvBrowser) { msg.style.color = "#b91c1c"; msg.textContent = "Browser still loading — try again in a moment."; return; }
    const cfg = { url, name: name || url.split("/").pop().split("?")[0] };
    if (fmt) cfg.format = fmt;
    if (/\.(bam|cram)(\?|$)/i.test(url)) cfg.indexURL = url + ".bai";
    else if (/\.(vcf|bed|gff3?|gtf)\.gz(\?|$)/i.test(url)) cfg.indexURL = url + ".tbi";
    msg.style.color = "var(--muted,#6b7280)"; msg.textContent = "Loading track…";
    Promise.resolve(igvBrowser.loadTrack(cfg))
      .then(() => { msg.style.color = "#047857"; msg.textContent = `Added “${cfg.name}” ✓`; })
      .catch(() => { msg.style.color = "#b91c1c"; msg.textContent = "Could not load that track — check the URL, format, and that the host allows CORS."; });
  });

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
    script.src = "/assets/vendor/igv.min.js";  // self-hosted (no CDN dependency)
    script.onload = run;
    script.onerror = () => {
      container.innerHTML = `<p style="padding:16px;color:var(--muted,#6b7280)">IGV.js could not be loaded.</p>`;
    };
    document.head.appendChild(script);
  }
}

// ---- Education hub: life cycle, glossary, concept quiz, primer ----
const LIFE_CYCLE = [
  { id: "growth", name: "Vegetative growth", time: "while food lasts",
    summary: "Single amoebae crawl through the soil eating bacteria by phagocytosis and divide every few hours — the unicellular, feeding phase.",
    markers: ["myoB", "phg1a", "rasS"] },
  { id: "starvation", name: "Starvation & cAMP signaling", time: "0–6 h",
    summary: "When food runs out, cells stop dividing, become aggregation-competent, and begin secreting and sensing pulses of the chemoattractant cAMP.",
    markers: ["acaA", "carA", "pdsA", "gpaB", "dagA"] },
  { id: "aggregation", name: "Aggregation (streaming)", time: "~6–10 h",
    summary: "Cells chemotax up relayed cAMP waves toward signaling centers, forming branching streams, and switch on cell–cell adhesion.",
    markers: ["carA", "acaA", "csaA", "gbpC"] },
  { id: "mound", name: "Mound", time: "~10–14 h",
    summary: "~100,000 cells pile into a mound and begin choosing fates — prestalk vs prespore — under the morphogen DIF-1 and continued cAMP signaling.",
    markers: ["ecmA", "pspA", "dimB", "gtaC"] },
  { id: "slug", name: "Slug (migration)", time: "~14–20 h",
    summary: "The mound forms a motile slug with prestalk cells at the front and prespore cells behind; it migrates toward light and warmth (photo/thermotaxis).",
    markers: ["ecmA", "ecmB", "pspA", "cudA", "amtC"] },
  { id: "culmination", name: "Culmination → fruiting body", time: "~20–24 h",
    summary: "The slug stands up: prestalk cells vacuolate into a dead stalk that lifts a sorus of spores. Spores disperse and germinate into new amoebae — the cycle repeats.",
    markers: ["ecmB", "cotB", "cotC", "spiA", "tagC"] },
];

// Original, copyright-free schematic figures instructors can download for slides/handouts.
const TEACHING_FIGURES = [
  {
    id: "dicty-fruiting-body",
    title: "Fruiting body anatomy",
    caption: "The mature sorocarp: a sorus of spores held aloft by a dead cellular stalk on a basal disc.",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 380" role="img" aria-labelledby="fbt fbd" font-family="'Helvetica Neue',Arial,sans-serif">
  <title id="fbt">Dictyostelium fruiting body anatomy</title>
  <desc id="fbd">A schematic of the mature fruiting body (sorocarp): a sorus of spores on a cellular stalk rising from a basal disc.</desc>
  <rect width="360" height="380" fill="#ffffff"/>
  <ellipse cx="150" cy="350" rx="58" ry="13" fill="#012169"/>
  <polygon points="138,344 162,344 156,152 144,152" fill="#9fb8d6" stroke="#012169" stroke-width="1.5"/>
  <g stroke="#012169" stroke-width="1" opacity="0.35">
    <line x1="145" y1="200" x2="155" y2="200"/><line x1="144" y1="244" x2="156" y2="244"/>
    <line x1="143" y1="288" x2="157" y2="288"/><line x1="141" y1="324" x2="159" y2="324"/>
  </g>
  <circle cx="150" cy="110" r="50" fill="#f4c84a" stroke="#d9a92a" stroke-width="2"/>
  <g fill="#a9781a" opacity="0.55">
    <circle cx="132" cy="94" r="5"/><circle cx="150" cy="86" r="5"/><circle cx="168" cy="96" r="5"/>
    <circle cx="124" cy="112" r="5"/><circle cx="143" cy="108" r="5"/><circle cx="161" cy="110" r="5"/><circle cx="176" cy="118" r="5"/>
    <circle cx="134" cy="130" r="5"/><circle cx="152" cy="128" r="5"/><circle cx="168" cy="132" r="5"/>
  </g>
  <g font-size="13" fill="#1a2b3c">
    <line x1="196" y1="92" x2="234" y2="72" stroke="#6b7280" stroke-width="1"/>
    <text x="238" y="69">Sorus</text><text x="238" y="85" font-size="11" fill="#6b7280">ball of spores</text>
    <line x1="120" y1="112" x2="78" y2="112" stroke="#6b7280" stroke-width="1"/>
    <text x="14" y="109">Spores</text>
    <line x1="157" y1="248" x2="234" y2="248" stroke="#6b7280" stroke-width="1"/>
    <text x="238" y="245">Stalk</text><text x="238" y="261" font-size="11" fill="#6b7280">dead, vacuolated cells</text>
    <line x1="206" y1="350" x2="234" y2="350" stroke="#6b7280" stroke-width="1"/>
    <text x="238" y="354">Basal disc</text>
  </g>
</svg>`,
  },
  {
    id: "dicty-slug-patterning",
    title: "Slug cell-type patterning",
    caption: "The migrating pseudoplasmodium: prestalk cells at the anterior tip, prespore cells in the posterior.",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 232" role="img" aria-labelledby="slt sld" font-family="'Helvetica Neue',Arial,sans-serif">
  <title id="slt">Dictyostelium slug cell-type patterning</title>
  <desc id="sld">A migrating slug showing prestalk cells in the anterior ~20% and prespore cells in the posterior ~80%, moving toward light and heat.</desc>
  <rect width="380" height="232" fill="#ffffff"/>
  <defs><clipPath id="slugClip"><rect x="100" y="126" width="220" height="52" rx="26"/></clipPath></defs>
  <line x1="298" y1="72" x2="92" y2="72" stroke="#00539B" stroke-width="2"/>
  <polygon points="92,72 105,65 105,79" fill="#00539B"/>
  <text x="200" y="56" text-anchor="middle" font-size="12.5" fill="#1a2b3c">Migration toward light &amp; heat</text>
  <line x1="24" y1="192" x2="356" y2="192" stroke="#cbd5e1" stroke-width="1.5"/>
  <line x1="300" y1="186" x2="356" y2="186" stroke="#9fb8d6" stroke-width="3" stroke-dasharray="2 6" opacity="0.7"/>
  <g clip-path="url(#slugClip)"><rect x="100" y="126" width="46" height="52" fill="#5f93cb"/></g>
  <polygon points="112,128 84,114 116,150" fill="#5f93cb" stroke="#7da3cf" stroke-width="1.5"/>
  <rect x="100" y="126" width="220" height="52" rx="26" fill="none" stroke="#7da3cf" stroke-width="2"/>
  <g font-size="12.5" fill="#1a2b3c">
    <line x1="96" y1="120" x2="72" y2="92" stroke="#6b7280" stroke-width="1"/>
    <text x="14" y="88">Tip (organizer)</text>
    <line x1="120" y1="178" x2="74" y2="206" stroke="#6b7280" stroke-width="1"/>
    <text x="8" y="222">Prestalk (anterior ~20%)</text>
    <line x1="250" y1="178" x2="306" y2="206" stroke="#6b7280" stroke-width="1"/>
    <text x="372" y="222" text-anchor="end">Prespore (posterior ~80%)</text>
    <text x="328" y="183" font-size="10.5" fill="#6b7280">slime trail</text>
  </g>
</svg>`,
  },
  {
    id: "dicty-aggregation-camp",
    title: "Aggregation & cAMP relay",
    caption: "Starving cells chemotax up relayed cAMP waves toward a signaling center, forming branching streams.",
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 380 300" role="img" aria-labelledby="agt agd" font-family="'Helvetica Neue',Arial,sans-serif">
  <title id="agt">Dictyostelium aggregation and cAMP relay</title>
  <desc id="agd">Cells stream toward a central cAMP signaling source along outward-propagating waves during aggregation.</desc>
  <rect width="380" height="300" fill="#ffffff"/>
  <g fill="none" stroke="#00539B" stroke-dasharray="4 7">
    <circle cx="160" cy="150" r="40" opacity="0.55"/><circle cx="160" cy="150" r="72" opacity="0.4"/>
    <circle cx="160" cy="150" r="104" opacity="0.28"/><circle cx="160" cy="150" r="134" opacity="0.18"/>
  </g>
  <circle cx="160" cy="150" r="22" fill="none" stroke="#f4c84a" stroke-width="2.5" opacity="0.8"/>
  <circle cx="160" cy="150" r="13" fill="#012169"/>
  <g fill="#00539B" opacity="0.85">
    <ellipse cx="300" cy="150" rx="7" ry="4"/><ellipse cx="276" cy="150" rx="7" ry="4"/><ellipse cx="252" cy="150" rx="7" ry="4"/>
    <ellipse cx="64" cy="68" rx="7" ry="4" transform="rotate(40 64 68)"/><ellipse cx="88" cy="92" rx="7" ry="4" transform="rotate(40 88 92)"/><ellipse cx="112" cy="116" rx="7" ry="4" transform="rotate(40 112 116)"/>
    <ellipse cx="160" cy="288" rx="4" ry="7"/><ellipse cx="160" cy="264" rx="4" ry="7"/><ellipse cx="160" cy="240" rx="4" ry="7"/>
  </g>
  <g fill="#012169">
    <polygon points="238,150 250,145 250,155"/>
    <polygon points="126,130 134,120 138,131"/>
    <polygon points="160,226 155,238 165,238"/>
  </g>
  <g font-size="12.5" fill="#1a2b3c">
    <line x1="160" y1="135" x2="160" y2="40" stroke="#6b7280" stroke-width="1"/>
    <text x="160" y="34" text-anchor="middle">Signaling center (cAMP source)</text>
    <line x1="232" y1="118" x2="300" y2="92" stroke="#6b7280" stroke-width="1"/>
    <text x="304" y="89">cAMP</text><text x="304" y="104" font-size="11" fill="#6b7280">waves</text>
    <line x1="276" y1="158" x2="276" y2="208" stroke="#6b7280" stroke-width="1"/>
    <text x="276" y="224" text-anchor="middle">Cells stream in (chemotaxis)</text>
  </g>
</svg>`,
  },
];

// ---- "Start here": an on-ramp for researchers new to Dictyostelium ----
const START_WHY = [
  ["Haploid genetics", "One gene knockout gives a clean null — no need to make homozygotes, so loss-of-function phenotypes show up immediately."],
  ["A 24-hour life cycle", "Starving cells chemotax, cooperate, and build a multicellular fruiting body in a day — chemotaxis, signaling, and development in one organism."],
  ["Human-disease relevance", "Roughly two-thirds of its ~12,000 genes have human orthologs; a tractable model for neurodegeneration, mitochondrial disease, autophagy, and infection."],
  ["Cheap, fast, safe", "Grows in simple liquid medium or on bacteria, doubles in ~8–12 h, and is non-pathogenic (biosafety level 1)."],
  ["Genetically tractable", "Homologous-recombination knockouts, REMI, RNAi, and CRISPR-Cas9 all work in the haploid genome."],
  ["A premier cell-biology model", "Foundational for chemotaxis, phagocytosis, macropinocytosis, cytokinesis, and the evolution of multicellularity."],
];
const START_STEPS = [
  ["See if it fits your question", "Browse the research areas Dictyostelium excels in — each with marker genes, protocols, and key papers.", "/research-areas", "Research areas"],
  ["Find your genes of interest", "Search by symbol, or filter the whole catalog by phenotype, ortholog, disease link, or expression.", "/search/advanced", "Advanced gene finder"],
  ["Get strains & plasmids", "Order from the community Dicty Stock Center.", "https://dictybase.dev/stockcenter", "Dicty Stock Center"],
  ["Grow the cells", "Media, buffers, and growth protocols — axenic in HL5 or on bacteria.", "/research/techniques/media", "Media & buffers"],
  ["Make mutants", "Transformation protocols, plus a CRISPR guide designer with genome off-target checking.", "/tools/lab", "Lab tools"],
  ["Analyze", "Search by sequence (BLAST), browse the genome, and compare expression.", "/tools/blast", "BLAST"],
];
const START_FAQ = [
  ["What is Dictyostelium discoideum?", "A social amoeba (a “cellular slime mold”) that lives in forest soil. It grows as single amoebae that eat bacteria, but when food runs out, up to ~100,000 cells stream together and build a multicellular fruiting body in about 24 hours — making it a uniquely visual, tractable model for chemotaxis, cell–cell signaling, and development."],
  ["Why use it as a model organism?", "It is haploid (one knockout gives an immediate phenotype), cheap and safe to grow, and genetically tractable (homologous recombination, REMI, RNAi, and CRISPR). Its ~34 Mb genome has ~12,000 genes, about two-thirds with human orthologs — so it models human biology and disease while being far easier to manipulate than animal cells."],
  ["What is AX4, and how is it different from NC4?", "NC4 is the original wild isolate, collected from soil, and grows on bacteria. AX4 is an axenic lab strain derived from NC4 that also grows in liquid HL5 medium without bacteria — convenient for large-scale culture. AX4 is the reference genome on this site."],
  ["How do I obtain strains and plasmids?", "From the Dicty Stock Center (under Community → Stock Center), the community repository that distributes Dictyostelium strains and plasmids."],
  ["Can I do CRISPR in Dictyostelium?", "Yes — CRISPR-Cas9 is now standard for marker-free knockouts and edits. You can design guides with genome off-target checking on the Lab tools page."],
  ["How long is the life cycle?", "About 24 hours from the onset of starvation to a mature fruiting body, passing through aggregation, mound, slug, and culmination. Step through each stage on the Learn page."],
  ["How are the cells grown?", "Axenic strains (AX2/AX3/AX4) grow in liquid HL5 medium; any strain can be grown on a lawn of bacteria. See the media and growth protocols under Research → Techniques."],
  ["Is it pathogenic? What biosafety level?", "No — Dictyostelium is non-pathogenic and handled at biosafety level 1. It is even used as a host to study human pathogens such as Legionella and Mycobacterium."],
  ["Where is the genome, and how do I search it?", "Use the gene search on the home page or the Advanced gene finder, browse the assembly in the Genome browser, and search by sequence with BLAST — all on this site."],
];

function openStart(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/start");
  if (!researchShell) return;
  researchShell.innerHTML = renderStartPage();
  researchShell.removeAttribute("hidden");
  scrollToEl(researchShell);
}

function renderStartPage() {
  const why = START_WHY.map(([h, b]) =>
    `<div class="start-why-card"><strong>${escapeHtml(h)}</strong><span>${escapeHtml(b)}</span></div>`).join("");
  const steps = START_STEPS.map(([h, b, href, label], i) => {
    const ext = /^https?:/.test(href);
    const link = `<a class="text-link" href="${escapeHtml(href)}"${ext ? ' target="_blank" rel="noopener"' : ""}>${escapeHtml(label)}${ext ? " ↗" : ""}</a>`;
    return `<li class="start-step"><span class="start-step-n">${i + 1}</span><div><strong>${escapeHtml(h)}</strong><p>${escapeHtml(b)} ${link}</p></div></li>`;
  }).join("");
  const faq = START_FAQ.map(([q, a]) =>
    `<details class="faq-item"><summary>${escapeHtml(q)}</summary><div class="faq-a">${escapeHtml(a)}</div></details>`).join("");
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Start here</p>
        <h2>New to <em>Dictyostelium</em>?</h2>
        <p><em>Dictyostelium discoideum</em> — the social amoeba — is one of biology's most tractable model organisms: a haploid genome rich in human-disease genes, a dramatic 24-hour life cycle, and decades of community tools. This page is the on-ramp: why researchers choose it, and how to get going.</p>
      </div></header>
      <div class="record-body">
        <h3 id="why">Why Dictyostelium?</h3>
        <div class="start-why">${why}</div>

        <h3 id="get-started" style="margin-top:28px">Getting started — a path</h3>
        <ol class="start-steps">${steps}</ol>

        <h3 id="faq" style="margin-top:28px">Frequently asked questions</h3>
        <div class="faq">${faq}</div>

        <h3 style="margin-top:28px">Keep learning</h3>
        <p style="font-size:.9rem">See the <a class="text-link" href="/research-areas">research areas</a> Dicty excels in, explore the interactive <a class="text-link" href="/education">life cycle, glossary, and quiz</a>, the step-by-step <a class="text-link" href="/research/techniques">lab protocols</a>, and the <a class="text-link" href="/community/labs">labs worldwide</a> working on <em>Dictyostelium</em>.</p>
      </div>
    </article>`;
}

// "Is Dictyostelium right for my question?" — the research-areas map.
// Each area links the fields Dicty excels in to verified marker genes (gene
// records on this site), relevant protocols, and a scoped literature search.
// Gene symbols below were checked against assets/gene_index.json so the
// /gene/<symbol> links resolve; protocol slugs exist under /research/techniques.
const RESEARCH_AREAS = [
  {
    id: "chemotaxis",
    icon: "🧭",
    title: "Chemotaxis & cell migration",
    question: "How do cells sense gradients and move?",
    blurb: "Starving cells chemotax toward cAMP with textbook precision, making the amoeba the premier model for eukaryotic gradient sensing, directed motility, and the PI3K/PTEN and Ras/Rac signaling that steers a crawling cell — the same machinery that drives neutrophil chasing and metastasis.",
    genes: ["carA-1", "gpaB", "acaA", "pikA", "pten", "pkbA", "rasC", "racE"],
    protocols: [["Grow & starve cells", "growth"], ["Develop on agar", "development"]],
    pubmed: 'chemotaxis OR "cell migration"',
  },
  {
    id: "development",
    icon: "🍄",
    title: "Development & multicellularity",
    question: "How do single cells build a body?",
    blurb: "When food runs out, up to ~100,000 cells aggregate, sort, and culminate into a fruiting body in 24 hours — a self-organizing program of cell–cell signaling, stalk-vs-spore differentiation, and pattern formation that models the origins of multicellularity.",
    genes: ["acaA", "csaA", "gbpC", "ecmA", "ecmB", "pspA", "cudA", "gtaC"],
    protocols: [["Methods for development", "development"], ["Whole-mount in situ", "wmish"]],
    pubmed: "development OR multicellular OR morphogenesis",
  },
  {
    id: "autophagy",
    icon: "♻️",
    title: "Autophagy & lysosomal biology",
    question: "How do cells recycle themselves?",
    blurb: "Development is fuelled by autophagy, and the conserved ATG machinery is intact yet non-essential in the haploid genome — so clean autophagy nulls are easy to make. A leading model for autophagy, lysosomal storage disease (Batten disease / NCL), and neurodegeneration.",
    genes: ["atg1", "atg5", "atg7", "atg8", "atg9", "atg12", "vmp1"],
    protocols: [["Transformation protocols", "transformation-protocols"], ["RNAi knockdown", "rnai-procedure"]],
    pubmed: "autophagy",
  },
  {
    id: "host-pathogen",
    icon: "🦠",
    title: "Phagocytosis & host–pathogen",
    question: "How do cells eat — and fight infection?",
    blurb: "As a professional phagocyte that hunts bacteria, Dictyostelium shares its eating-and-killing machinery with macrophages, and is a tractable host for human pathogens such as Legionella, Mycobacterium, and Pseudomonas — innate immunity without the animal.",
    genes: ["myoB", "sibA", "talA", "corA", "kil1", "vatA", "phg1a", "nramp1"],
    protocols: [["Grow on bacteria", "growth"], ["Feed heat-killed bacteria", "addheatkilledbac"]],
    pubmed: "phagocytosis OR Legionella OR Mycobacterium",
  },
  {
    id: "cytokinesis",
    icon: "🔬",
    title: "Cytokinesis & the cytoskeleton",
    question: "How does a cell divide and hold its shape?",
    blurb: "Foundational work on non-muscle myosin II, actin dynamics, and the contractile ring was done here — cells lacking myosin II survive on a surface, letting you dissect cytokinesis genetically in ways animal cells won't allow.",
    genes: ["mhcA", "mlcE", "racE", "dynA", "clcA", "abpA", "forA"],
    protocols: [["Isolate the cytoskeleton", "cytoisol"], ["Myosin ATPase assay", "atpasemyoassay"]],
    pubmed: "cytokinesis OR myosin",
  },
  {
    id: "disease-models",
    icon: "🧬",
    title: "Human disease models",
    question: "Is my disease gene conserved here?",
    blurb: "About two-thirds of Dictyostelium genes have human orthologs, many tied to disease — mitochondrial disorders, neurodegeneration, Batten disease, and immune deficiency. Browse the ortholog–disease map to see if your gene of interest has a tractable amoeba counterpart.",
    genes: ["cln5", "cln3", "ppt1", "tpp1", "ndufs4", "sodA", "nramp1", "mfeB"],
    protocols: [["Transformation protocols", "transformation-protocols"], ["REMI mutagenesis", "remi-mutagenesis"]],
    pubmed: '"disease model" OR ortholog OR neurodegeneration',
    more: ["/community/disease-models", "Browse the disease-model table →"],
  },
];

function areaPubMedUrl(area) {
  return `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(`Dictyostelium AND (${area.pubmed})`)}`;
}

function openResearchAreas(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/research-areas");
  if (!researchShell) return;
  researchShell.innerHTML = renderResearchAreasPage();
  researchShell.removeAttribute("hidden");
  scrollToEl(researchShell);
}

function renderResearchAreasPage() {
  const cards = RESEARCH_AREAS.map((a) => {
    const genes = a.genes.map((g) =>
      `<a class="ra-gene" href="/gene/${encodeURIComponent(g)}">${escapeHtml(g)}</a>`).join("");
    const protocols = a.protocols.map(([label, slug]) =>
      `<a class="text-link" href="/research/techniques/${encodeURIComponent(slug)}">${escapeHtml(label)}</a>`).join(" · ");
    const lit = `<a class="text-link" href="${areaPubMedUrl(a)}" target="_blank" rel="noopener">Key literature ↗</a>`;
    const more = a.more
      ? ` · <a class="text-link" href="${escapeHtml(a.more[0])}">${escapeHtml(a.more[1])}</a>`
      : "";
    return `
      <section class="ra-card" id="area-${a.id}">
        <h3 class="ra-title"><span class="ra-icon" aria-hidden="true">${a.icon}</span> ${escapeHtml(a.title)}</h3>
        <p class="ra-q">${escapeHtml(a.question)}</p>
        <p class="ra-blurb">${escapeHtml(a.blurb)}</p>
        <p class="ra-label">Marker genes</p>
        <div class="ra-genes">${genes}</div>
        <p class="ra-foot">Protocols: ${protocols} &nbsp;·&nbsp; ${lit}${more}</p>
      </section>`;
  }).join("");
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Research areas</p>
        <h2>Is <em>Dictyostelium</em> right for my question?</h2>
        <p>The amoeba is a powerhouse in a handful of fields. Find yours below — each links to the <strong>marker genes</strong> to study, the <strong>protocols</strong> to run, and the <strong>literature</strong> to read. If your question maps onto one of these, Dicty is likely a strong, fast, and cheap model for it.</p>
      </div></header>
      <div class="record-body">
        <div class="ra-grid">${cards}</div>
        <p class="ra-note">Marker genes link to records on this site; gene picks and protocols are starting points, not an exhaustive list. New to the organism? Start with <a class="text-link" href="/start">Why Dictyostelium</a>, or order strains from the <a class="text-link" href="https://dictybase.dev/stockcenter" target="_blank" rel="noopener">Dicty Stock Center ↗</a>.</p>
      </div>
    </article>`;
}

function openEducation(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/education");
  if (!researchShell) return;
  researchShell.innerHTML = renderEducationPage();
  researchShell.removeAttribute("hidden");
  scrollToEl(researchShell);
  initEducation();
}

function renderEducationPage() {
  const steps = LIFE_CYCLE.map((s, i) =>
    `<button type="button" class="lc-stage${i === 0 ? " active" : ""}" data-stage="${i}">
       <span class="lc-num">${i + 1}</span><span class="lc-name">${escapeHtml(s.name)}</span><span class="lc-time">${escapeHtml(s.time)}</span>
     </button>`).join('<span class="lc-arrow" aria-hidden="true">→</span>');
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Education</p>
        <h2>Learn <em>Dictyostelium</em></h2>
        <p><em>Dictyostelium discoideum</em> is a social amoeba and a premier teaching organism: cheap and safe to grow, with a dramatic 24-hour life cycle that takes single cells through chemotaxis, cooperation, and multicellular development — and a genome full of human-disease orthologs. Use the interactive life cycle, glossary, and quiz below with your students.</p>
      </div></header>
      <div class="record-body">
        <h3 id="life-cycle">The life cycle <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— click a stage</span></h3>
        <div class="lc-stepper">${steps}</div>
        <div class="lc-detail" data-stage-detail></div>

        <h3 id="glossary" style="margin-top:26px">Glossary</h3>
        <input id="glossary-filter" type="search" placeholder="Filter terms…" aria-label="Filter glossary" style="${FIELD};width:100%;max-width:340px;margin-bottom:10px">
        <div data-glossary><p class="notice muted">Loading glossary…</p></div>

        <h3 id="quiz" style="margin-top:26px">Concept self-quiz</h3>
        <div data-quiz><p class="notice muted">Loading quiz…</p></div>
        <div class="quiz-print-area" data-quiz-print-area aria-hidden="true"></div>

        <h3 id="figures" style="margin-top:26px">Teaching figures <span style="font-size:.75rem;font-weight:500;color:var(--muted,#6b7280)">— free to use in your slides</span></h3>
        <p style="font-size:.875rem">Original schematic diagrams you can download and drop straight into lecture slides or handouts. These are copyright-free — use and adapt them freely, no attribution required.</p>
        <div class="edu-figures">${TEACHING_FIGURES.map((f) => `
          <figure class="edu-figure">
            <div class="edu-figure-art">${f.svg}</div>
            <figcaption><strong>${escapeHtml(f.title)}</strong><span>${escapeHtml(f.caption)}</span></figcaption>
            <button type="button" class="ghost-btn edu-fig-dl" data-fig="${f.id}">Download SVG</button>
          </figure>`).join("")}</div>

        <h3 style="margin-top:26px">Classroom lab materials</h3>
        <p style="font-size:.875rem">Ready-to-use undergraduate lab protocols (chemotaxis, cell migration, the life cycle, and more) are on the <a class="text-link" href="/research/teaching-labs">Teaching labs</a> page.</p>
      </div>
    </article>`;
}

function renderLifeCycleDetail(i) {
  const el = document.querySelector("[data-stage-detail]");
  if (!el) return;
  const s = LIFE_CYCLE[i];
  el.innerHTML = `
    <h4 style="margin:0 0 6px">${escapeHtml(s.name)} <span style="font-weight:500;color:var(--muted,#6b7280)">· ${escapeHtml(s.time)}</span></h4>
    <p style="margin:0 0 8px">${escapeHtml(s.summary)}</p>
    <p style="margin:0;font-size:.8125rem"><strong>Marker genes:</strong> ${s.markers.map((m) => `<a class="text-link" href="/gene/${encodeURIComponent(m)}">${escapeHtml(m)}</a>`).join(", ")}</p>`;
}

async function initEducation() {
  renderLifeCycleDetail(0);
  document.querySelectorAll(".lc-stage").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lc-stage").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderLifeCycleDetail(parseInt(btn.dataset.stage, 10));
    });
  });
  // Glossary
  const gEl = document.querySelector("[data-glossary]");
  if (gEl) {
    try {
      const terms = ((await (await fetch("/assets/glossary.json")).json()).terms || [])
        .sort((a, b) => a.term.localeCompare(b.term));
      const render = (f) => {
        const q = (f || "").trim().toLowerCase();
        const shown = q ? terms.filter((t) => t.term.toLowerCase().includes(q) || t.def.toLowerCase().includes(q)) : terms;
        gEl.innerHTML = `<dl class="glossary">${shown.map((t) => `<dt>${escapeHtml(t.term)}</dt><dd>${escapeHtml(t.def)}</dd>`).join("")}</dl>`;
      };
      render("");
      const inp = document.getElementById("glossary-filter");
      if (inp) inp.addEventListener("input", () => render(inp.value));
    } catch { gEl.innerHTML = `<p class="notice muted">Glossary unavailable.</p>`; }
  }
  // Quiz (scored, resettable, printable)
  const qEl = document.querySelector("[data-quiz]");
  const printArea = document.querySelector("[data-quiz-print-area]");
  if (qEl) {
    try {
      const questions = (await (await fetch("/assets/quiz.json")).json()).questions || [];
      const total = questions.length;
      const state = new Map(); // qi -> chosen choice index

      const countCorrect = () => [...state.entries()].filter(([qi, ci]) => ci === questions[qi].answer).length;
      const updateScore = () => {
        const el = qEl.querySelector("[data-score]");
        if (!el) return;
        const done = state.size, correct = countCorrect();
        const pct = done ? Math.round((correct / done) * 100) : 0;
        el.textContent = done === total
          ? `Quiz complete — ${correct} / ${total} correct (${pct}%)`
          : `Answered ${done} / ${total} · ${correct} correct`;
        el.classList.toggle("done", done === total);
      };

      const mount = () => {
        state.clear();
        qEl.innerHTML = `
          <div class="quiz-scorebar">
            <span class="quiz-score" data-score>Answered 0 / ${total}</span>
            <span class="quiz-actions">
              <button type="button" class="ghost-btn" data-quiz-reset>Reset</button>
              <button type="button" class="ghost-btn" data-quiz-print>Print / save results</button>
            </span>
          </div>
          ${questions.map((q, i) => `
            <div class="quiz-q" data-qi="${i}">
              <p class="quiz-prompt"><strong>${i + 1}.</strong> ${escapeHtml(q.q)}</p>
              <div class="quiz-choices">${q.choices.map((c, ci) => `<button type="button" class="quiz-choice" data-qi="${i}" data-ci="${ci}">${escapeHtml(c)}</button>`).join("")}</div>
              <p class="quiz-feedback" data-feedback="${i}" hidden></p>
            </div>`).join("")}`;
        updateScore();
      };

      const printResults = () => {
        if (printArea) {
          const done = state.size, correct = countCorrect();
          const pct = done ? Math.round((correct / done) * 100) : 0;
          const rows = questions.map((q, i) => {
            const chosen = state.has(i) ? state.get(i) : null;
            const choices = q.choices.map((c, ci) => {
              const isAns = ci === q.answer, isPick = ci === chosen;
              const mark = isAns ? " ✓" : (isPick ? " ✗ (your answer)" : "");
              return `<li class="${isAns ? "pa-correct" : (isPick ? "pa-wrong" : "")}">${escapeHtml(c)}${mark}</li>`;
            }).join("");
            return `<div class="pa-q"><p class="pa-prompt"><strong>${i + 1}. ${escapeHtml(q.q)}</strong></p><ul>${choices}</ul><p class="pa-explain">${escapeHtml(q.explain)}</p></div>`;
          }).join("");
          printArea.innerHTML = `
            <h2>dictyBase — Concept self-quiz</h2>
            <p class="pa-score">Score: ${correct} / ${total} correct${done < total ? ` (${done} of ${total} answered)` : ""} · ${pct}%</p>
            ${rows}
            <p class="pa-foot">dictyBase · Learn Dictyostelium · /education</p>`;
          document.body.classList.add("print-quiz");
          const cleanup = () => { document.body.classList.remove("print-quiz"); window.removeEventListener("afterprint", cleanup); };
          window.addEventListener("afterprint", cleanup);
          setTimeout(cleanup, 1500);
        }
        window.print();
      };

      mount();
      qEl.addEventListener("click", (e) => {
        if (e.target.closest("[data-quiz-reset]")) { mount(); return; }
        if (e.target.closest("[data-quiz-print]")) { printResults(); return; }
        const b = e.target.closest(".quiz-choice");
        if (!b) return;
        const qi = +b.dataset.qi, ci = +b.dataset.ci, q = questions[qi];
        if (state.has(qi)) return; // lock each question after first answer
        state.set(qi, ci);
        const wrap = qEl.querySelector(`.quiz-q[data-qi="${qi}"]`);
        wrap.querySelectorAll(".quiz-choice").forEach((c, idx) => {
          c.disabled = true;
          if (idx === q.answer) c.classList.add("correct");
          else if (idx === ci) c.classList.add("wrong");
        });
        const fb = qEl.querySelector(`[data-feedback="${qi}"]`);
        fb.hidden = false;
        fb.innerHTML = `${ci === q.answer ? "✓ Correct. " : "✗ "}${escapeHtml(q.explain)}`;
        fb.className = `quiz-feedback ${ci === q.answer ? "ok" : "no"}`;
        updateScore();
      });
    } catch { qEl.innerHTML = `<p class="notice muted">Quiz unavailable.</p>`; }
  }

  // Teaching figures: download the inline SVG as a file
  document.querySelectorAll(".edu-fig-dl").forEach((btn) => {
    btn.addEventListener("click", () => {
      const svg = btn.closest(".edu-figure")?.querySelector("svg");
      if (!svg) return;
      const src = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' + svg.outerHTML;
      const url = URL.createObjectURL(new Blob([src], { type: "image/svg+xml" }));
      const a = document.createElement("a");
      a.href = url; a.download = `${btn.dataset.fig || "dicty-figure"}.svg`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  });
}

function hideContentSections() {
  showHomeChrome(false);
  [recordShell, toolsShell, organismShell, communityShell, researchShell].forEach((shell) => {
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
  const pi = section === "labs" ? new URLSearchParams(location.search).get("pi") : null;
  const target = pi ? document.getElementById(`lab-${slugify(pi)}`) : null;
  if (target) {
    highlightElement(target);
    // Jump straight to the PI (instant, not smooth) and clear the ~89px
    // sticky header plus a small gap so the name is visible.
    window.scrollTo({ top: Math.max(0, target.getBoundingClientRect().top + window.scrollY - 100), behavior: "instant" });
  } else if (shell) {
    scrollToY(shell.offsetTop - 60);
  }
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
    initCurationWizard();
  } else if (section === "upload-data") {
    communityShell.innerHTML = renderUploadDataPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "corrections") {
    communityShell.innerHTML = renderCorrectionsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "suggestions") {
    communityShell.innerHTML = renderSuggestionsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "award-recipients") {
    communityShell.innerHTML = renderAwardRecipientsPage();
    communityShell.removeAttribute("hidden");
  } else if (section === "disease-models") {
    communityShell.innerHTML = renderDiseaseModelsPage();
    communityShell.removeAttribute("hidden");
    loadDiseaseModels();
  } else {
    communityShell.innerHTML = "";
    communityShell.setAttribute("hidden", "");
  }
}

function renderDiseaseModelsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Human disease</p>
          <h2>Dictyostelium disease models</h2>
          <p>Dictyostelium genes whose human orthologs are linked to disease — a starting point for using the amoeba as a model system. Orthologs from OMA; disease associations from the Human Phenotype Ontology (OMIM / Orphanet / DECIPHER). These are computational predictions; confirm against the primary literature.</p>
        </div>
      </header>
      <div class="record-body">
        <input id="disease-filter" type="search" placeholder="Filter by Dicty gene, human ortholog, or disease…" aria-label="Filter disease models" style="width:100%;max-width:440px;padding:8px 10px;border:1px solid var(--line,#d7dee0);border-radius:8px;margin-bottom:12px">
        <div data-disease-results><p class="notice muted">Loading disease models…</p></div>
      </div>
    </article>`;
}

async function loadDiseaseModels() {
  const container = document.querySelector("[data-disease-results]");
  if (!container) return;
  try { await ensureOrthologDisease(); } catch { container.innerHTML = `<p class="notice">Disease data is unavailable right now.</p>`; return; }
  const rows = [];
  for (const [ddb, v] of Object.entries(orthologDiseaseData)) {
    if (ddb.startsWith("_")) continue;
    for (const o of (v.orthologs || [])) {
      if (!o.diseases || !o.diseases.length) continue;
      rows.push({ symbol: v.symbol || ddb, human: o.human_symbol, rel: o.relationship, diseases: o.diseases });
    }
  }
  rows.sort((a, b) => a.symbol.localeCompare(b.symbol));
  const render = (filter) => {
    const f = (filter || "").trim().toLowerCase();
    const shown = !f ? rows : rows.filter((r) =>
      r.symbol.toLowerCase().includes(f) || r.human.toLowerCase().includes(f) ||
      r.diseases.some((d) => (d.name || "").toLowerCase().includes(f) || d.id.toLowerCase().includes(f)));
    container.innerHTML = `
      <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">${shown.length} of ${rows.length} disease-linked gene–ortholog pairs</p>
      <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
        <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
          <th style="padding:6px 8px">Dicty gene</th><th style="padding:6px 8px">Human ortholog</th><th style="padding:6px 8px">Disease(s)</th>
        </tr></thead>
        <tbody>
          ${shown.map((r) => `
            <tr style="border-bottom:1px solid var(--line,#eef2f3);vertical-align:top">
              <td style="padding:6px 8px"><a class="text-link" href="/gene/${encodeURIComponent(r.symbol)}">${escapeHtml(r.symbol)}</a></td>
              <td style="padding:6px 8px"><strong>${escapeHtml(r.human)}</strong>${r.rel ? ` <span style="color:var(--muted,#6b7280)">${escapeHtml(r.rel)}</span>` : ""}</td>
              <td style="padding:6px 8px">${r.diseases.map((d) => { const h = diseaseHref(d.id); const lab = escapeHtml(d.name || d.id); return h ? `<a class="text-link" href="${h}" target="_blank" rel="noopener">${lab}</a>` : lab; }).join("<br>")}</td>
            </tr>`).join("")}
        </tbody>
      </table></div>`;
  };
  render("");
  const inp = document.getElementById("disease-filter");
  if (inp) inp.addEventListener("input", () => render(inp.value));
}

function renderAnnotationsPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Curate a gene</h2>
          <p>Add expert, evidence-backed annotations to dictyBase. This short guided form walks you through the same standard steps professional curators follow — modeled on <a class="text-link" href="https://pombase.github.io/canto_tutorial/" target="_blank" rel="noopener">PomBase's Canto</a>, kept deliberately lightweight. Work through one paper, one gene, and one finding at a time.</p>
        </div>
      </header>
      <div class="record-body">
        <section class="data-block" id="curation-resources">
          <h3>Before you start</h3>
          <p>Curation captures a single experimental result from a publication as a standardized annotation. The best annotation is <strong>specific</strong> (the most precise term that fits), <strong>evidenced</strong> (tied to an experiment in the paper), and <strong>attributed</strong> (linked to its PMID). These resources help you choose well:</p>
          <ul class="resource-links">
            <li><a class="text-link" href="https://pombase.github.io/canto_tutorial/" target="_blank" rel="noopener">Canto curation tutorial</a> — the community-curation workflow this form is based on.</li>
            <li><a class="text-link" href="https://www.ebi.ac.uk/QuickGO/" target="_blank" rel="noopener">QuickGO</a> — search the Gene Ontology and copy the most specific term (its name and <code>GO:</code> id).</li>
            <li><a class="text-link" href="https://geneontology.org/docs/guide-go-evidence-codes/" target="_blank" rel="noopener">GO evidence codes</a> — how to describe the experiment that supports an annotation.</li>
            <li><a class="text-link" href="https://geneontology.org/docs/go-annotations/" target="_blank" rel="noopener">What makes a good GO annotation</a> — the annotation best-practice guide.</li>
          </ul>
        </section>

        <section class="data-block" id="annotation-form-section">
          <div id="curation-wizard">
            <ol class="wizard-progress" aria-hidden="true">
              <li data-step="0"><span>1</span> Publication</li>
              <li data-step="1"><span>2</span> Gene</li>
              <li data-step="2"><span>3</span> Annotation</li>
              <li data-step="3"><span>4</span> Review</li>
            </ol>

            <form class="annotation-form" id="annotation-form" novalidate>

              <fieldset class="wizard-step" data-step="0">
                <legend>Step 1 · Start with the publication</legend>
                <p class="wizard-help">Curate one paper at a time — usually your own. Everything you submit should be supported by a result reported in this publication.</p>
                <div class="form-field">
                  <label for="ann-pmid">PubMed ID (PMID) <span class="required">*</span></label>
                  <input type="text" id="ann-pmid" name="pmid" required inputmode="numeric" placeholder="e.g. 34291044">
                  <small>The number from the paper's <a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/" target="_blank" rel="noopener">PubMed</a> page — digits only.</small>
                </div>
                <div class="form-field">
                  <label for="ann-submitter-name">Your name <span class="required">*</span></label>
                  <input type="text" id="ann-submitter-name" name="submitter_name" autocomplete="name" required placeholder="Jane Smith">
                </div>
                <div class="form-field">
                  <label for="ann-submitter-email">Email address <span class="required">*</span></label>
                  <input type="email" id="ann-submitter-email" name="submitter_email" autocomplete="email" required placeholder="you@institution.edu">
                  <small>So a curator can credit you and follow up if there's a question.</small>
                </div>
                <div class="wizard-nav">
                  <span></span>
                  <button type="button" class="button primary" data-wiz-next>Next: the gene →</button>
                </div>
              </fieldset>

              <fieldset class="wizard-step" data-step="1" hidden>
                <legend>Step 2 · Which gene?</legend>
                <p class="wizard-help">One gene per submission. Use its dictyBase symbol or DDB_G id — if you're unsure of the exact id, look it up with gene search first.</p>
                <div class="form-field">
                  <label for="ann-gene">Gene symbol or DDB_G id <span class="required">*</span></label>
                  <input type="text" id="ann-gene" name="gene" required placeholder="e.g. cln5, DDB_G0275299">
                </div>
                <div class="wizard-nav">
                  <button type="button" class="button" data-wiz-back>← Back</button>
                  <button type="button" class="button primary" data-wiz-next>Next: the annotation →</button>
                </div>
              </fieldset>

              <fieldset class="wizard-step" data-step="2" hidden>
                <legend>Step 3 · Describe the finding</legend>
                <p class="wizard-help">Capture one experimental result. Pick the kind of annotation, name the most specific term, and say how it was shown.</p>
                <div class="form-field">
                  <label for="ann-type">Annotation type <span class="required">*</span></label>
                  <select id="ann-type" name="annotation_type" required>
                    <option value="">Select…</option>
                    <optgroup label="Gene Ontology">
                      <option value="GO molecular function">GO · molecular function (what the product does)</option>
                      <option value="GO biological process">GO · biological process (what it's part of)</option>
                      <option value="GO cellular component">GO · cellular component (where it acts)</option>
                    </optgroup>
                    <option value="Phenotype">Phenotype (mutant / knockout / over-expression)</option>
                    <option value="Physical or genetic interaction">Physical or genetic interaction</option>
                    <option value="Literature">Literature link only</option>
                    <option value="Nomenclature correction">Nomenclature correction</option>
                  </select>
                </div>
                <div class="form-field" data-when-go hidden>
                  <label for="ann-goid">GO term id (recommended)</label>
                  <input type="text" id="ann-goid" name="go_id" placeholder="e.g. GO:0016301">
                  <small>Find the most specific term at <a class="text-link" href="https://www.ebi.ac.uk/QuickGO/" target="_blank" rel="noopener">QuickGO</a> and paste its id.</small>
                </div>
                <div class="form-field">
                  <label for="ann-term"><span data-term-text>Term or finding</span> <span class="required">*</span></label>
                  <input type="text" id="ann-term" name="term" required placeholder="e.g. protein kinase activity">
                </div>
                <div class="form-field">
                  <label for="ann-evidence">How was it shown? <span class="required">*</span></label>
                  <select id="ann-evidence" name="evidence" required>
                    <option value="">Select the experiment type…</option>
                    <option value="Direct assay">Direct assay (e.g. enzyme or binding assay)</option>
                    <option value="Mutant or knockout phenotype">Mutant or knockout phenotype</option>
                    <option value="Genetic interaction">Genetic interaction</option>
                    <option value="Physical interaction">Physical interaction (e.g. co-IP, pull-down)</option>
                    <option value="Expression pattern">Expression pattern</option>
                    <option value="Sequence or structural similarity">Sequence or structural similarity</option>
                    <option value="Author statement / review">Author statement / review</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div class="form-field">
                  <label for="ann-figure">Figure or table (optional)</label>
                  <input type="text" id="ann-figure" name="figure" placeholder="e.g. Fig 3B, Table 1">
                </div>
                <div class="form-field">
                  <label for="ann-notes">Anything else for the curator? (optional)</label>
                  <textarea id="ann-notes" name="notes" rows="3" placeholder="Extra context, caveats, or a second annotation to note."></textarea>
                </div>
                <div class="form-field">
                  <label for="ann-file">Attach a file (optional)</label>
                  <input type="file" id="ann-file" name="annotation_file" accept=".csv,.tsv,.xlsx,.txt,.pdf,.docx">
                  <small>CSV, TSV, XLSX, TXT, PDF, or DOCX · max 10 MB. Useful for submitting several annotations at once.</small>
                </div>
                <div class="wizard-nav">
                  <button type="button" class="button" data-wiz-back>← Back</button>
                  <button type="button" class="button primary" data-wiz-next>Review →</button>
                </div>
              </fieldset>

              <fieldset class="wizard-step" data-step="3" hidden>
                <legend>Step 4 · Review &amp; submit</legend>
                <p class="wizard-help">Check your annotation below. A dictyBase curator verifies each submission against the paper before it's added to the database.</p>
                <div class="wizard-review kv" id="wizard-review"></div>
                <div class="wizard-nav">
                  <button type="button" class="button" data-wiz-back>← Back</button>
                  <button type="submit" class="button primary">Submit annotation</button>
                </div>
              </fieldset>

              <div id="annotation-form-status" aria-live="polite"></div>
            </form>
          </div>
        </section>

        <section class="data-block">
          <h3>What happens next</h3>
          <div class="kv">
            <span>Review</span><strong>A curator checks your annotation against the cited paper before it is added — usually within a few days.</strong>
            <span>Credit</span><strong>Accepted annotations are attributed to you as the community curator.</strong>
            <span>More to add?</span><strong>Submit the form again for each additional finding, or attach a file with several at once.</strong>
            <span>Questions</span><strong>Email <a class="text-link" href="mailto:matt.scaglione@duke.edu">matt.scaglione@duke.edu</a>.</strong>
          </div>
        </section>
      </div>
    </article>
  `;
}

// Guided "Canto-lite" curation wizard: step navigation, per-step validation,
// type-aware fields, and a review summary. Submit is handled by the shared
// annotation-form submit handler.
function initCurationWizard() {
  const wiz = document.getElementById("curation-wizard");
  if (!wiz) return;
  const steps = Array.from(wiz.querySelectorAll(".wizard-step"));
  const dots = Array.from(wiz.querySelectorAll(".wizard-progress li"));
  const status = document.getElementById("annotation-form-status");
  let current = 0;

  const show = (i) => {
    steps.forEach((s, idx) => { s.hidden = idx !== i; });
    dots.forEach((d, idx) => {
      d.classList.toggle("active", idx === i);
      d.classList.toggle("done", idx < i);
    });
    current = i;
    if (status) status.innerHTML = "";
    const focusable = steps[i].querySelector("input:not([type=file]), select, textarea");
    if (focusable) focusable.focus({ preventScroll: true });
    wiz.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const flagError = (el) => { const f = el.closest(".form-field"); if (f) f.classList.add("field-error"); };
  const clearErrors = (i) => {
    steps[i].querySelectorAll(".form-field.field-error").forEach((f) => f.classList.remove("field-error"));
    if (status) status.innerHTML = "";
  };
  const say = (msg) => { if (status) status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">${msg}</p>`; };

  const validateStep = (i) => {
    clearErrors(i);
    // Every required field in a step is always visible (the only toggled field,
    // the GO id, is optional), so a plain non-empty check is enough.
    const req = Array.from(steps[i].querySelectorAll("[required]"));
    const missing = req.filter((el) => !el.value.trim());
    if (missing.length) {
      missing.forEach(flagError);
      say("Please fill in the highlighted field" + (missing.length > 1 ? "s" : "") + " before continuing.");
      missing[0].focus();
      return false;
    }
    const pmid = steps[i].querySelector("#ann-pmid");
    if (pmid && !/^\d{4,9}$/.test(pmid.value.trim())) {
      flagError(pmid);
      say("Enter a numeric PubMed ID — just the digits from the paper's PubMed page.");
      pmid.focus();
      return false;
    }
    return true;
  };

  const buildReview = () => {
    const d = new FormData(document.getElementById("annotation-form"));
    const rows = [
      ["Publication", "PMID:" + (d.get("pmid") || "")],
      ["Submitter", `${d.get("submitter_name") || ""} <${d.get("submitter_email") || ""}>`],
      ["Gene", d.get("gene") || ""],
      ["Annotation type", d.get("annotation_type") || ""],
      d.get("go_id") ? ["GO id", d.get("go_id")] : null,
      ["Term / finding", d.get("term") || ""],
      ["Evidence", d.get("evidence") || ""],
      d.get("figure") ? ["Figure / table", d.get("figure")] : null,
      d.get("notes") ? ["Notes", d.get("notes")] : null
    ].filter(Boolean);
    const file = d.get("annotation_file");
    if (file && file.size > 0) rows.push(["Attached file", file.name]);
    const review = document.getElementById("wizard-review");
    if (review) review.innerHTML = rows.map(([k, v]) => `<span>${escapeHtml(k)}</span><strong>${escapeHtml(String(v))}</strong>`).join("");
  };

  wiz.addEventListener("click", (e) => {
    const next = e.target.closest("[data-wiz-next]");
    const back = e.target.closest("[data-wiz-back]");
    if (next) {
      e.preventDefault();
      if (!validateStep(current)) return;
      const to = current + 1;
      if (to === steps.length - 1) buildReview();
      show(to);
    } else if (back) {
      e.preventDefault();
      show(Math.max(0, current - 1));
    }
  });

  // Adapt the annotation step to the chosen type.
  const typeSel = document.getElementById("ann-type");
  const goIdField = wiz.querySelector("[data-when-go]");
  const termText = wiz.querySelector("[data-term-text]");
  const termInput = document.getElementById("ann-term");
  if (typeSel) {
    typeSel.addEventListener("change", () => {
      const v = typeSel.value || "";
      const isGO = v.indexOf("GO ") === 0;
      if (goIdField) goIdField.hidden = !isGO;
      if (termText && termInput) {
        if (isGO) { termText.textContent = "GO term name"; termInput.placeholder = "e.g. protein kinase activity"; }
        else if (v === "Phenotype") { termText.textContent = "Phenotype"; termInput.placeholder = "e.g. reduced fruiting-body formation"; }
        else if (v.indexOf("interaction") > -1) { termText.textContent = "Interacting gene / partner"; termInput.placeholder = "e.g. interacts with gskA"; }
        else if (v === "Nomenclature correction") { termText.textContent = "Proposed correction"; termInput.placeholder = "e.g. rename to ppkA"; }
        else { termText.textContent = "Term or finding"; termInput.placeholder = "Describe the finding"; }
      }
    });
  }

  show(0);
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

// --- Community award recipients (by year, newest first) ---
const AWARD_RECIPIENTS = [
  { year: "2025", awards: [
    { stage: "Graduate Student", names: ["Sarena Banu", "Mark Jacob"], coWinners: true },
    { stage: "Postdoctoral Researcher", names: ["Pavani Hathi"] },
    { stage: "Research Scientist", names: ["Pundrik Jaiswal"] },
    { stage: "Junior Faculty", names: ["Otmane Lamrabet", "Tera Levin"], coWinners: true },
  ] },
  { year: "2024", awards: [
    { stage: "Graduate Student", names: ["William Kim"] },
    { stage: "Postdoctoral Researcher", names: ["Tyler Larsen"] },
    { stage: "Junior Faculty", names: ["Longfei Shu", "Mariko Katoh-Kurasawa"], coWinners: true },
  ] },
  { year: "2023", awards: [
    { stage: "Graduate Student", names: ["Sarah Körber"] },
    { stage: "Postdoctoral Researcher", names: ["Simona Burraco"] },
    { stage: "Research Scientist", names: ["Peter Thomason"] },
    { stage: "Junior Faculty", names: ["Caroline Barisch"] },
  ] },
  { year: "2022", awards: [
    { stage: "Graduate Student", names: ["Hui Tu"] },
    { stage: "Postdoctoral Researcher", names: ["Hugh Ford"] },
    { stage: "Research Scientist", names: ["Debra Brock"] },
    { stage: "Junior Faculty", names: ["Huaqing Cai"] },
  ] },
  { year: "2021", awards: [
    { stage: "Graduate Student", names: ["Megan Aoki"] },
    { stage: "Postdoctoral Researcher", names: ["Peggy Paschke", "Otmane Lamrabet", "Shashi Singh"], coWinners: true },
    { stage: "Junior Faculty", names: ["Pierre Stallforth"] },
  ] },
  { year: "2020", awards: [
    { stage: "Graduate Student", names: ["Eleanor Warren", "Joe Oddy"], coWinners: true },
    { stage: "Postdoctoral Researcher", names: ["Luke Tweedy"] },
    { stage: "Junior Faculty", names: ["Matt Scaglione"] },
  ] },
  { year: "2019", awards: [
    { stage: "Postdoctoral Researcher", names: ["Santosh Sathe", "Ramesh Rijal"], coWinners: true },
    { stage: "Junior Faculty", names: ["Robert Huber", "Allyson Sgro"], coWinners: true },
  ] },
];

function joinAwardNames(names) {
  if (!names || !names.length) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} & ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function renderAwardRecipientsPage() {
  const years = AWARD_RECIPIENTS.map((y) => `
    <section class="data-block">
      <h3>${escapeHtml(y.year)}</h3>
      <div class="ontology-term-list">
        ${y.awards.map((a) => `
          <div class="ontology-term" style="align-items:flex-start">
            <div>
              <strong>${escapeHtml(joinAwardNames(a.names))}</strong>
              <span>${escapeHtml(a.stage)}${a.coWinners ? " · co-winners" : ""}</span>
            </div>
          </div>`).join("")}
      </div>
    </section>`).join("");
  return `
    <article class="record-card research-card">
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Community</p>
          <h2>Award Recipients</h2>
          <p>Annual <em>Dictyostelium</em> community award recipients, by year and career stage.</p>
        </div>
      </header>
      <div class="record-body">${years}</div>
    </article>`;
}

// Emails are stored base64-of-reversed in labs-content.js so the static
// file holds no scrapeable address; reconstruct only at render time.
function decodeEmail(enc) {
  try { return atob(enc).split("").reverse().join(""); } catch { return ""; }
}

function renderLabsPage() {
  const labs = window.dictyLabs || [];
  const active = labs.filter((l) => !l.emeritus).sort((a, b) => a.pi.split(" ").pop().localeCompare(b.pi.split(" ").pop()));
  const emeriti = labs.filter((l) => l.emeritus).sort((a, b) => a.pi.split(" ").pop().localeCompare(b.pi.split(" ").pop()));

  const renderCards = (list) => list.map((lab) => `
    <div class="ontology-term" id="lab-${slugify(lab.pi)}" style="align-items:flex-start">
      <div>
        <strong>
          ${lab.url
            ? `<a href="${escapeHtml(lab.url)}" target="_blank" rel="noopener" class="text-link">${escapeHtml(lab.pi)}</a>`
            : escapeHtml(lab.pi)}
        </strong>
        <span>${escapeHtml(lab.institution)}</span>
      </div>
      ${lab.email ? `<p style="margin:0 0 3px;font-size:0.8125rem">${decodeEmail(lab.email).split(/,\s*/).map((e) => `<a class="text-link" href="mailto:${escapeHtml(e)}">${escapeHtml(e)}</a>`).join(", ")}</p>` : ""}
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
              <p>This page now lives inside dictyBase, so the technique directory can keep routing even if the old dictyBase page is removed.</p>
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

// Lazily fetch technique-content.js (~310KB of protocol bodies). Resolves
// immediately if already present; injects the script once otherwise and
// rebuilds techniqueRecords (so contentHtml is populated) before resolving.
// Fails open — on network error, pages still render without protocol bodies.
let _techniqueContentPromise = null;
function ensureTechniqueContent() {
  if (window.techniqueContent) return Promise.resolve(window.techniqueContent);
  if (!_techniqueContentPromise) {
    _techniqueContentPromise = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/technique-content.js";
      s.onload = () => { techniqueRecords = buildTechniqueRecords(); resolve(window.techniqueContent || null); };
      s.onerror = () => resolve(null);
      document.head.appendChild(s);
    });
  }
  return _techniqueContentPromise;
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
          ${loadingHTML(`Loading GO annotations for ${gene.symbol}…`)}
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
      <div data-human-disease></div>
      <div class="data-block" data-paralogs></div>
      <div class="data-block" data-dicty-comparative></div>
      <div class="data-block" data-neighborhood></div>
      <div class="data-block" data-variation></div>
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
    const viewerBlock = gene.uniprot ? `
      <div class="data-block">
        <h3>Predicted 3D structure <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— AlphaFold, colored by model confidence (pLDDT)</span></h3>
        <div class="structure-viewer-large" id="af-viewer-large" data-uniprot="${escapeHtml(gene.uniprot)}"></div>
        <div class="af-legend">
          <span>Low confidence</span>
          <span class="af-legend-bar" aria-hidden="true"></span>
          <span>High confidence</span>
        </div>
        <p class="af-caption">Drag to rotate · scroll to zoom · <a href="https://alphafold.ebi.ac.uk/entry/${escapeHtml(gene.uniprot)}" target="_blank" rel="noopener">Open in AlphaFold DB →</a></p>
      </div>` : "";
    return `
      ${viewerBlock}
      <div class="data-block" data-protein-props></div>
      <div class="data-block">
        <h3>Domain architecture <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— InterPro / Pfam</span></h3>
        <div data-domains>${gene.uniprot ? `<p class="notice muted">Loading domains for ${escapeHtml(gene.uniprot)}…</p>` : `<p class="notice muted">No UniProt accession for this gene.</p>`}</div>
      </div>
      <div class="data-block" data-conservation></div>
      <div class="data-block">
        <h3>Structure resources</h3>
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
    <div data-ai-summary></div>
    <section class="data-block" data-gene-model hidden></section>
    <div class="section-grid">
      <div style="display:grid;gap:14px;align-content:start">
        <section class="data-block">
          <h3>RNA-seq expression <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— Parikh et al. development time course</span></h3>
          <div id="rnaseq-inline-chart" data-gene-ddb="${escapeHtml(gene.veupath || '')}" style="position:relative;height:180px">
            <p class="notice muted" style="padding:8px">Loading expression data…</p>
          </div>
          <a class="text-link" href="https://app.dictyexpress.org/?gene=${encodeURIComponent(gene.symbol)}" target="_blank" rel="noopener" style="font-size:0.8125rem;margin-top:6px;display:block">View full data in dictyExpress →</a>
        </section>
        <section class="data-block" data-coexpression hidden></section>
        <section class="data-block" data-kegg hidden></section>
        <section class="data-block">
          <h3>Record coverage</h3>
          <div class="kv">
            <span>GO rows</span><strong>${gene._annot ? (gene._annot.go.F.length + gene._annot.go.P.length + gene._annot.go.C.length) : (gene.go ? gene.go.length : 0)}</strong>
            <span>Phenotypes</span><strong>${gene.phenotypes ? gene.phenotypes.length : 0}</strong>
            <span>Literature</span><strong>${gene._annot && gene._annot.literature ? gene._annot.literature.length : (gene.literature ? gene.literature.length : 0)}</strong>
            <span>Structures</span><strong>${gene.structures ? gene.structures.length : 0}</strong>
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
        <section class="data-block" data-strains hidden></section>
        ${/^DDB_G\d+$/.test(gene.veupath || "") ? `
        <section class="data-block">
          <h3>Sequences <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— FASTA download</span></h3>
          <ul class="list">
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=genomic&symbol=${encodeURIComponent(gene.symbol)}" download>Genomic DNA</a></strong><span>Gene region including introns</span></li>
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=cdna&symbol=${encodeURIComponent(gene.symbol)}" download>cDNA</a></strong><span>Spliced transcript (exons)</span></li>
            <li><strong><a class="text-link" href="/api/sequence?ddb=${encodeURIComponent(gene.veupath)}&type=protein&symbol=${encodeURIComponent(gene.symbol)}" download>Protein</a></strong><span>Translated coding sequence</span></li>
          </ul>
        </section>
        <section class="data-block">
          <h3>Lab reagents <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— design on demand</span></h3>
          <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 8px">CRISPR guides and qPCR primers for <strong>${escapeHtml(gene.symbol)}</strong>. Computational suggestions — validate before use.</p>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            <button type="button" data-record-crispr-run>Design CRISPR guides</button>
            <button type="button" data-record-primer-run>Design qPCR primers</button>
          </div>
          <div data-record-crispr-results style="margin-bottom:8px"></div>
          <div data-record-primer-results></div>
          <a class="text-link" href="/tools/lab" style="font-size:0.8125rem;display:inline-block;margin-top:6px">More lab tools (codon optimizer) →</a>
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

// Loading state with an animated spinner. `label` is plain text (escaped).
// `cls` lets callers add modifiers (e.g. "muted") to the .notice element.
function loadingHTML(label, cls = "muted") {
  return `<p class="notice ${cls}"><span class="spinner" aria-hidden="true"></span>${escapeHtml(label)}</p>`;
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
    tool: "dictyatduke",
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
    tool: "dictyatduke"
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
      // PubMed's normalized sort date ("YYYY/MM/DD …"); lexically sortable.
      sortDate: item.sortpubdate || item.epubdate || item.pubdate || "",
      authors: (item.authors || []).slice(0, 3).map((author) => author.name).filter(Boolean).join(", ")
    }));
  // Strictly most-recent first (PubMed's own pub-date sort doesn't always match
  // the human-readable pubdate, which can leave a few entries out of order).
  papers.sort((a, b) => (b.sortDate || "").localeCompare(a.sortDate || ""));
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
  for (const ref of (gene._annot && gene._annot.literature ? gene._annot.literature : [])) {
    const id = String(ref).startsWith("PMID:") ? String(ref).slice(5) : String(ref);
    if (/^\d+$/.test(id) && !seen.has(id)) { seen.add(id); out.push(id); }
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
      const params = new URLSearchParams({ db: "pubmed", id: pmids.join(","), retmode: "json", tool: "dictyatduke" });
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
      `Publication: PMID:${data.get("pmid")}`,
      `Gene: ${data.get("gene")}`,
      `Annotation type: ${data.get("annotation_type")}`,
      data.get("go_id") ? `GO id: ${data.get("go_id")}` : null,
      `Term / finding: ${data.get("term")}`,
      `Evidence: ${data.get("evidence")}`,
      data.get("figure") ? `Figure / table: ${data.get("figure")}` : null,
      data.get("notes") ? `Notes: ${data.get("notes")}` : null
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

// Per-gene GO/literature annotations. Fetched one gene at a time from
// /api/gene-annotations?ddb= (a few KB) rather than pulling the whole 6.6 MB
// gene_annotations.json into the browser. The whole-file load survives only as
// a fallback if the per-gene endpoint is unavailable (e.g. an old server).
const geneAnnotCache = new Map();   // ddb -> rich annot object or null
let geneAnnotData = null;
async function ensureGeneAnnotations() {            // whole-file fallback only
  if (geneAnnotData) return geneAnnotData;
  const res = await fetch("/assets/gene_annotations.json");
  if (!res.ok) throw new Error("gene annotations unavailable");
  geneAnnotData = await res.json();
  return geneAnnotData;
}
async function fetchGeneAnnot(ddb) {
  if (!ddb) return null;
  if (geneAnnotCache.has(ddb)) return geneAnnotCache.get(ddb);
  let annot = null;
  try {
    const res = await fetch(`/api/gene-annotations?ddb=${encodeURIComponent(ddb)}`);
    if (res.ok) {
      const data = await res.json();
      annot = data && Object.keys(data).length ? data : null;
    } else {
      annot = (await ensureGeneAnnotations())[ddb] || null;
    }
  } catch {
    try { annot = (await ensureGeneAnnotations())[ddb] || null; } catch { annot = null; }
  }
  geneAnnotCache.set(ddb, annot);
  return annot;
}
// Flatten one gene's rich annotation into the GO rows the GO tab renders:
// [GO id, aspect, evidence, pmid, source].
function goRowsFromAnnot(g) {
  const rows = [];
  if (!g || !g.go) return rows;
  for (const aspect of ["F", "P", "C"]) {
    for (const e of (g.go[aspect] || [])) {
      const ref = e[3] || "";
      const pmid = ref.startsWith("PMID:") ? ref.slice(5) : "";
      rows.push([e[0], aspect, e[1], pmid, e[5] || ""]);
    }
  }
  return rows;
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

// --- AI-curation layer (machine-generated; always badged "AI") ---
let aiCurationData = null;
async function ensureAICuration() {
  if (aiCurationData) return aiCurationData;
  try {
    const res = await fetch("/assets/ai_curation.json");
    aiCurationData = res.ok ? await res.json() : {};
  } catch { aiCurationData = {}; }
  return aiCurationData;
}
function aiCurationFor(gene) {
  if (!aiCurationData || !gene) return null;
  return aiCurationData[(gene.symbol || "").toLowerCase()] || null;
}

// Human ortholog + disease (assets/ortholog_disease.json, keyed by DDB_G id).
let orthologDiseaseData = null;
async function ensureOrthologDisease() {
  if (orthologDiseaseData) return orthologDiseaseData;
  try {
    const res = await fetch("/assets/ortholog_disease.json");
    orthologDiseaseData = res.ok ? await res.json() : {};
  } catch { orthologDiseaseData = {}; }
  return orthologDiseaseData;
}
function diseaseHref(id) {
  const [src, num] = id.split(":");
  if (src === "OMIM") return `https://omim.org/entry/${num}`;
  // Orphanet's own site sits behind an aggressive Cloudflare bot-check that loops
  // "verifying you are human", so link the disease via EBI's OLS4 (ORDO ontology)
  // instead — reliable, and it surfaces the term plus all its cross-references.
  if (src === "ORPHA") return `https://www.ebi.ac.uk/ols4/ontologies/ordo/classes/${encodeURIComponent(encodeURIComponent("http://www.orpha.net/ORDO/Orphanet_" + num))}`;
  if (src === "DECIPHER") return `https://www.deciphergenomics.org/syndrome/${num}`;
  return "";
}
async function loadHumanDisease(gene) {
  const el = document.querySelector("[data-human-disease]");
  if (!el) return;
  try { await ensureOrthologDisease(); } catch { return; }
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  const ddb = (gene.veupath || gene.ddb || "").toUpperCase();
  const entry = ddb && orthologDiseaseData[ddb];
  const orthologs = entry && entry.orthologs || [];
  if (!orthologs.length) { el.innerHTML = ""; return; }
  const withDisease = orthologs.filter((o) => o.diseases && o.diseases.length);
  el.innerHTML = `
    <div class="data-block">
      <h3>Human ortholog${orthologs.length > 1 ? "s" : ""} &amp; disease
        <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— OMA · UniProt · HPO</span></h3>
      <div class="ortholog-cards">
        ${orthologs.map((o) => {
          const diseases = o.diseases || [];
          const rows = diseases.map((d) => {
            const href = diseaseHref(d.id);
            const name = escapeHtml(d.name || d.id);
            const nameHtml = href ? `<a class="text-link" href="${href}" target="_blank" rel="noopener">${name}</a>` : name;
            // only show the id separately when a real name is the label
            const idHtml = d.name ? `<span class="disease-id">${escapeHtml(d.id)}</span>` : "";
            return `<li class="disease-row"><span class="disease-dot" aria-hidden="true"></span><span class="disease-name">${nameHtml}${idHtml}</span></li>`;
          }).join("");
          return `<div class="ortholog-card">
            <div class="ortholog-head">
              <a class="ortholog-symbol" href="https://www.uniprot.org/uniprotkb?query=${encodeURIComponent(o.human_uniprot)}" target="_blank" rel="noopener">${escapeHtml(o.human_symbol)}</a>
              ${o.relationship ? `<span class="ortholog-rel">${escapeHtml(o.relationship)}</span>` : ""}
              <span class="ortholog-count">${diseases.length ? diseases.length + " disease" + (diseases.length === 1 ? "" : "s") : "no disease link"}</span>
            </div>
            ${rows ? `<ul class="disease-list">${rows}</ul>` : ""}
          </div>`;
        }).join("")}
      </div>
      <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:12px">
        Orthologs from OMA; disease associations from the Human Phenotype Ontology (OMIM / Orphanet / DECIPHER).
        ${withDisease.length ? "" : "No curated disease associations for this ortholog."}
        Computational predictions — confirm against primary sources.</p>
    </div>`;
}

// Three curation layers + the automated/electronic bucket. Each annotation is
// tagged by assigned_by; the user can show/hide whole layers (persisted).
const CURATION_LAYERS = [
  { key: "dicty", label: "dictyBase", cls: "src-dicty" },
  { key: "community", label: "Community", cls: "src-curated" },
  { key: "ai", label: "AI", cls: "src-ai" },
  { key: "auto", label: "Automated", cls: "src-auto" },
];
function curationLayerOf(by) {
  if (by === "dictyBase") return "dicty";
  if (by === "curated-here") return "community";
  if (by === "AI") return "ai";
  return "auto";
}
let curationLayerState = null;
function getCurationLayers() {
  if (!curationLayerState) {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem("dictybase:curationLayers") || "{}"); } catch {}
    curationLayerState = {};
    for (const l of CURATION_LAYERS) curationLayerState[l.key] = saved[l.key] !== false;
  }
  return curationLayerState;
}
function toggleCurationLayer(key) {
  const st = getCurationLayers();
  st[key] = !st[key];
  try { localStorage.setItem("dictybase:curationLayers", JSON.stringify(st)); } catch {}
}
function curationBadge(by) {
  const def = CURATION_LAYERS.find((l) => l.key === curationLayerOf(by));
  const text = by === "curated-here" ? "curated here" : (by === "AI" ? "AI" : by);
  return ` <span class="src-badge ${def.cls}">${escapeHtml(text)}</span>`;
}

async function loadGOResults(gene) {
  const container = document.querySelector("[data-go-results]");
  if (!container) return;
  const ddb = gene.veupath || gene.ddb || "";
  try {
    // Prefer dictyBase curated GO annotations from the GAF
    let curated = null;
    if (ddb) {
      try { curated = goRowsFromAnnot(await fetchGeneAnnot(ddb)); } catch { /* fall through */ }
    }
    // Merge the dictyBase / automated / community rows with the AI layer, then
    // render with a per-layer filter toggle.
    let aiEntry = null;
    try { await ensureAICuration(); aiEntry = aiCurationFor(gene); } catch { /* AI layer optional */ }
    const aiRows = ((aiEntry && aiEntry.go) || []).map(([id, aspect, name]) => [id, aspect, "", "", "AI", name]);
    const allRows = (curated || []).concat(aiRows);
    if (allRows.length) {
      await renderGOTab(container, gene, allRows);
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


let goRenderCtx = null;
let goSearch = "";
let goExpanded = false;
async function renderGOTab(container, gene, allRows) {
  const ids = [...new Set(allRows.filter((r) => !r[5]).map((r) => r[0]))];
  const names = await resolveGONames(ids);
  for (const r of allRows) if (r[5] && !names[r[0]]) names[r[0]] = r[5]; // AI rows carry their own name
  if (state.activeGene !== gene || state.activeTab !== "GO") return;
  goRenderCtx = { container, gene, allRows, names };
  goSearch = "";
  goExpanded = false;
  paintGOTab();
}

function paintGOTab() {
  if (!goRenderCtx) return;
  const { container, allRows } = goRenderCtx;
  const layers = getCurationLayers();
  const counts = { dicty: 0, community: 0, ai: 0, auto: 0 };
  for (const r of allRows) counts[curationLayerOf(r[4])]++;

  const pills = `<div class="layer-toggle" aria-label="Curation layers">${CURATION_LAYERS
    .filter((l) => counts[l.key] > 0)
    .map((l) => `<button type="button" class="layer-pill ${l.cls} ${layers[l.key] ? "on" : "off"}" data-layer="${l.key}" aria-pressed="${layers[l.key]}">${escapeHtml(l.label)} <span class="layer-count">${counts[l.key]}</span></button>`)
    .join("")}</div>`;

  const legend = `<p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:8px">Three curation layers — <span class="src-badge src-dicty">dictyBase</span> (official), <span class="src-badge src-curated">curated here</span> (community-submitted), and <span class="src-badge src-ai">AI</span> (machine-generated, unreviewed) — plus <span class="src-badge src-auto">automated</span> electronic inference (UniProt/InterPro/GO_Central). Toggle a layer to show or hide it. <a class="text-link" href="http://geneontology.org/docs/guide-go-evidence-codes/" target="_blank" rel="noopener">Evidence codes</a>.</p>`;

  container.innerHTML = `
    ${pills}
    <input type="search" class="go-search" placeholder="Filter GO terms by name or id…" aria-label="Filter GO terms" value="${escapeHtml(goSearch)}">
    <div class="go-body"></div>
    ${legend}`;

  const searchEl = container.querySelector(".go-search");
  const bodyEl = container.querySelector(".go-body");
  searchEl.addEventListener("input", () => { goSearch = searchEl.value; paintGOBody(); });
  bodyEl.addEventListener("click", (e) => {
    if (e.target.closest("[data-go-expand]")) { goExpanded = true; paintGOBody(); }
    else if (e.target.closest("[data-go-collapse]")) { goExpanded = false; paintGOBody(); }
  });
  paintGOBody();
}

function paintGOBody() {
  if (!goRenderCtx) return;
  const { container, allRows, names } = goRenderCtx;
  const bodyEl = container.querySelector(".go-body");
  if (!bodyEl) return;
  const layers = getCurationLayers();
  const q = goSearch.trim().toLowerCase();
  const visible = allRows.filter((r) => layers[curationLayerOf(r[4])]);

  const aspects = { F: new Map(), P: new Map(), C: new Map() };
  for (const r of visible) {
    const [go, aspect, ev, pmid, by] = r;
    if (q && !(String(names[go] || go).toLowerCase().includes(q) || String(go).toLowerCase().includes(q))) continue;
    const m = aspects[aspect] || (aspects[aspect] = new Map());
    if (!m.has(go)) m.set(go, []);
    m.get(go).push({ ev, pmid, by });
  }

  const CAP = 8;
  const aspectList = ["F", "P", "C"].filter((a) => aspects[a] && aspects[a].size);
  const total = aspectList.reduce((n, a) => n + aspects[a].size, 0);
  const anyOver = aspectList.some((a) => aspects[a].size > CAP);
  const collapse = !q && !goExpanded;

  const sections = aspectList.map((a) => {
    let entries = [...aspects[a].entries()];
    if (collapse && entries.length > CAP) entries = entries.slice(0, CAP);
    return `
    <div style="margin-bottom:20px">
      <h4 style="margin:0 0 8px;font-size:0.875rem;text-transform:uppercase;letter-spacing:.06em;color:var(--muted,#6b7280)">${escapeHtml(GO_ASPECT_LABEL[a])} <span style="font-weight:500">(${aspects[a].size})</span></h4>
      <ul class="list">
        ${entries.map(([go, evs]) => {
          const refs = [...new Set(evs.map((e) => `${e.ev ? escapeHtml(e.ev) : ""}${e.pmid ? ` <a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/${escapeHtml(e.pmid)}/" target="_blank" rel="noopener">PMID ${escapeHtml(e.pmid)}</a>` : ""}${e.by ? curationBadge(e.by) : ""}`.trim()))];
          return `<li>
            <strong><a class="go-search-link" data-go-ref="${escapeHtml(go)}" href="/go/${escapeHtml(go)}">${escapeHtml(names[go] || go)}</a></strong>
            <span>${escapeHtml(go)}${refs.length ? " · " + refs.join(", ") : ""}</span>
          </li>`;
        }).join("")}
      </ul>
    </div>`;
  }).join("");

  let out;
  if (!total) {
    out = q
      ? `<p class="notice muted">No GO terms match “${escapeHtml(goSearch.trim())}”.</p>`
      : `<p class="notice muted">All curation layers are hidden — re-enable one above.</p>`;
  } else {
    out = sections;
    if (collapse && anyOver) out += `<button type="button" class="oma-toggle" data-go-expand>Show all ${total} GO terms ▾</button>`;
    else if (!q && goExpanded && anyOver) out += `<button type="button" class="oma-toggle" data-go-collapse>Show less ▴</button>`;
  }
  bodyEl.innerHTML = out;
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
// --- Dicty Stock Center: browse strains/plasmids, build a request, email it ---
let stockCenterData = null;
async function ensureStockCenter() {
  if (stockCenterData) return stockCenterData;
  try {
    const res = await fetch("/assets/stock_center.json");
    stockCenterData = res.ok ? await res.json() : { strains: [], plasmids: [] };
  } catch { stockCenterData = { strains: [], plasmids: [] }; }
  return stockCenterData;
}

const STOCK_CART_KEY = "dicty_stock_cart";
const STOCK_ORDER_EMAIL = "matt.scaglione@duke.edu";
function stockCart() { try { return JSON.parse(localStorage.getItem(STOCK_CART_KEY)) || []; } catch { return []; } }
function stockCartSave(items) { try { localStorage.setItem(STOCK_CART_KEY, JSON.stringify(items)); } catch { /* ignore */ } }
function stockCartHas(type, id) { return stockCart().some((i) => i.type === type && i.id === id); }

function openStockCenter(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/stock-center");
  if (!toolsShell) return;
  toolsShell.innerHTML = renderStockCenterPage();
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  initStockCenter();
}

function renderStockCenterPage() {
  return `
    <article class="record-card research-card" data-stock-root>
      <header class="record-header">
        <div class="record-title">
          <p class="eyebrow">Dicty Stock Center</p>
          <h2>Order strains &amp; plasmids</h2>
          <p>Browse the Dictyostelium strain and plasmid collections, add what you need to your cart, then check out to send the request to the Stock Center. Shipping goes on your own FedEx account.</p>
        </div>
      </header>
      <div class="record-body">
        <div class="stock-cartbar" data-stock-cartbar hidden>
          <span>🛒 <strong data-stock-cart-count>0</strong> <span data-stock-cart-word>items</span> in your cart</span>
          <button type="button" class="button primary" data-stock-checkout>Review &amp; check out →</button>
        </div>

        <div data-stock-browse>
          <div class="stock-tabs" role="tablist">
            <button type="button" class="stock-tab active" data-stock-tab="strains" role="tab">Strains</button>
            <button type="button" class="stock-tab" data-stock-tab="plasmids" role="tab">Plasmids</button>
            <button type="button" class="stock-tab" data-stock-tab="gwdi" role="tab">GWDI insertion bank</button>
          </div>
          <div class="form-field" style="margin:14px 0 0">
            <input type="search" id="stock-search" placeholder="Search the catalog…" autocomplete="off" aria-label="Search the stock center catalog">
          </div>
          <div data-stock-list><p class="notice muted">Loading catalog…</p></div>
        </div>

        <div data-stock-checkout-view hidden>
          <button type="button" class="text-link" data-stock-back>← Continue browsing</button>
          <h3 style="margin:10px 0 2px">Your cart (<span data-stock-cart-count>0</span>)</h3>
          <div data-stock-cart></div>
        </div>
      </div>
    </article>`;
}

function stockItemHTML(kind, it) {
  const type = kind === "strains" ? "strain" : "plasmid";
  // Show the strain/plasmid name; carry the DBS/DBP id (canonical) for the order.
  const name = kind === "strains" ? (it.label || it.id) : (it.name || it.id);
  const cartLabel = `${name} (${it.id})`;
  const sub = kind === "strains"
    ? [it.summary, it.genotype].filter(Boolean).join(" · ")
    : [it.description, it.depositor ? "Deposited by " + it.depositor : ""].filter(Boolean).join(" · ");
  const tags = kind === "strains"
    ? `<span class="stock-item-id">${escapeHtml(it.id)}</span>${it.in_stock ? `<span class="stock-badge">In&nbsp;stock</span>` : ""}`
    : `<span class="stock-item-id">${escapeHtml(it.id)}</span>`;
  const inCart = stockCartHas(type, it.id);
  return `
    <div class="stock-item">
      <div class="stock-item-body">
        <strong>${escapeHtml(name)}${tags}</strong>
        ${sub ? `<span>${escapeHtml(sub)}</span>` : ""}
      </div>
      <button type="button" class="button ${inCart ? "" : "primary"}" data-stock-add data-type="${type}" data-id="${escapeHtml(it.id)}" data-label="${escapeHtml(cartLabel)}">${inCart ? "✓ Added" : "Add"}</button>
    </div>`;
}

function stockOrderFormHTML() {
  return `
    <form class="annotation-form" id="stock-order-form" novalidate style="margin-top:16px">
      <h4 style="margin:0 0 4px">Send this request</h4>
      <p class="wizard-help">Emails your request to the Stock Center. We ship on <strong>your</strong> FedEx account — enter the account number so shipping bills to you, or <a class="text-link" href="https://www.fedex.com/en-us/shipping/create-shipment.html" target="_blank" rel="noopener">prepare a prepaid label at FedEx</a> and email it to us.</p>
      <div class="form-field"><label for="stock-name">Your name <span class="required">*</span></label><input type="text" id="stock-name" name="name" required></div>
      <div class="form-field"><label for="stock-email">Email <span class="required">*</span></label><input type="email" id="stock-email" name="email" required></div>
      <div class="form-field"><label for="stock-inst">Institution / lab</label><input type="text" id="stock-inst" name="institution"></div>
      <div class="form-field"><label for="stock-addr">Shipping address <span class="required">*</span></label><textarea id="stock-addr" name="address" rows="3" required></textarea></div>
      <div class="form-field"><label for="stock-fedex">Your FedEx account number <span class="required">*</span></label><input type="text" id="stock-fedex" name="fedex" required placeholder="Shipping is billed to this account"></div>
      <div class="form-actions"><button type="submit" class="button primary">Email my request</button></div>
      <div id="stock-order-status" aria-live="polite"></div>
    </form>`;
}

function initStockCenter() {
  const root = toolsShell.querySelector("[data-stock-root]");
  if (!root) return;
  let active = "strains";
  let showAllStrains = false;   // strains default to in-stock only; toggle reveals all
  const listEl = root.querySelector("[data-stock-list]");
  const searchEl = root.querySelector("#stock-search");
  const browseView = root.querySelector("[data-stock-browse]");
  const checkoutView = root.querySelector("[data-stock-checkout-view]");
  const cartbar = root.querySelector("[data-stock-cartbar]");

  const updateCounts = () => {
    const n = stockCart().length;
    root.querySelectorAll("[data-stock-cart-count]").forEach((el) => { el.textContent = n; });
    const word = root.querySelector("[data-stock-cart-word]");
    if (word) word.textContent = n === 1 ? "item" : "items";
    // Sticky cart bar shows only while browsing and only when the cart has items.
    cartbar.hidden = !(n > 0 && checkoutView.hidden);
  };

  const renderCart = () => {
    const c = stockCart();
    const box = root.querySelector("[data-stock-cart]");
    if (!c.length) {
      box.innerHTML = `<p class="notice muted" style="margin-top:8px">Your cart is empty. <button type="button" class="text-link" data-stock-back>Browse the catalog →</button></p>`;
      return;
    }
    box.innerHTML = `
      <ul class="list stock-cart-list">
        ${c.map((i) => `<li><span><strong>${escapeHtml(i.label)}</strong> <span class="muted">(${i.type})</span></span><button type="button" class="text-link" data-stock-remove data-type="${i.type}" data-id="${escapeHtml(i.id)}">remove</button></li>`).join("")}
      </ul>
      <button type="button" class="text-link" data-stock-clear>Clear cart</button>
      ${stockOrderFormHTML()}`;
  };

  // GWDI insertion bank (~21.5k strains) isn't bundled — search it live via
  // the /api/stock-gwdi proxy. Results are added to the same cart.
  let gwdiSeq = 0, gwdiTimer = null;
  const renderGwdi = () => {
    const q = (searchEl.value || "").trim();
    if (q.length < 2) {
      listEl.innerHTML = `<p class="notice muted" style="margin-top:10px">The GWDI insertion bank has ~21,500 strains — too many to list. Type a gene name (e.g. <button type="button" class="text-link" data-gwdi-example>smp3</button>) to search it live.</p>`;
      return;
    }
    listEl.innerHTML = `<p class="notice muted" style="margin-top:10px">Searching the GWDI bank for “${escapeHtml(q)}”…</p>`;
    const seq = ++gwdiSeq;
    fetch(`/api/stock-gwdi?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (seq !== gwdiSeq || active !== "gwdi") return;      // superseded by a newer search
        const rows = d.strains || [];
        if (!rows.length) {
          listEl.innerHTML = `<p class="notice muted">No GWDI strains found for “${escapeHtml(q)}”. Try a gene symbol (e.g. smp3, mybB).</p>`;
          return;
        }
        listEl.innerHTML = `
          <p style="font-size:.8125rem;color:var(--muted);margin:10px 0 6px">${rows.length}${rows.length >= 150 ? "+" : ""} GWDI strain${rows.length !== 1 ? "s" : ""} matching “${escapeHtml(q)}”${rows.length >= 150 ? " — showing the first 150, refine to narrow" : ""}</p>
          <div class="stock-list">${rows.map((it) => stockItemHTML("strains", it)).join("")}</div>`;
      })
      .catch(() => {
        if (seq === gwdiSeq) listEl.innerHTML = `<p class="notice muted">GWDI search is temporarily unavailable — try again in a moment.</p>`;
      });
  };

  const renderList = () => {
    if (active === "gwdi") { renderGwdi(); return; }
    const data = stockCenterData || { strains: [], plasmids: [] };
    const q = (searchEl.value || "").trim().toLowerCase();
    // Strains default to in-stock only (most aren't stocked); plasmids show all.
    const strainsTab = active === "strains";
    let items = strainsTab ? data.strains : data.plasmids;
    if (strainsTab && !showAllStrains) items = items.filter((it) => it.in_stock);
    const match = (it) => {
      if (!q) return true;
      const hay = strainsTab
        ? `${it.id} ${it.label} ${(it.names || []).join(" ")} ${it.summary} ${it.genotype} ${it.phenotype}`
        : `${it.id} ${it.name} ${it.description} ${it.depositor} ${it.genbank || ""}`;
      return hay.toLowerCase().includes(q);
    };
    const shown = items.filter(match);
    const cap = 300;
    const baseLabel = strainsTab ? (showAllStrains ? "strains" : "in-stock strains") : "plasmids";
    const count = q ? `${shown.length} of ${items.length.toLocaleString()} ${baseLabel}`
                    : `${items.length.toLocaleString()} ${baseLabel}`;
    const toggle = strainsTab
      ? `<button type="button" class="text-link" data-stock-showall>${showAllStrains ? "Show in-stock only" : `Show all ${data.strains.length.toLocaleString()} strains`}</button>`
      : "";
    listEl.innerHTML = `
      <div class="stock-listhead">
        <p>${count}</p>
        ${toggle}
      </div>
      <div class="stock-list">${shown.slice(0, cap).map((it) => stockItemHTML(active, it)).join("")}</div>
      ${shown.length > cap ? `<p class="notice muted">Showing the first ${cap} — refine your search to narrow the list.</p>` : ""}`;
  };

  const showCheckout = () => { browseView.hidden = true; checkoutView.hidden = false; renderCart(); updateCounts(); scrollToY(root.offsetTop - 60); };
  const showBrowse = () => { checkoutView.hidden = true; browseView.hidden = false; renderList(); updateCounts(); };
  // Re-render whichever view is showing after a cart change.
  const refresh = () => { if (checkoutView.hidden) renderList(); else renderCart(); updateCounts(); };

  root.addEventListener("click", (e) => {
    const add = e.target.closest("[data-stock-add]");
    const remove = e.target.closest("[data-stock-remove]");
    const clear = e.target.closest("[data-stock-clear]");
    const tab = e.target.closest("[data-stock-tab]");
    if (add) {
      const exists = stockCartHas(add.dataset.type, add.dataset.id);
      const c = stockCart();
      const next = exists
        ? c.filter((i) => !(i.type === add.dataset.type && i.id === add.dataset.id))
        : c.concat({ type: add.dataset.type, id: add.dataset.id, label: add.dataset.label });
      stockCartSave(next);
      // Update just the clicked button — no full-list re-render (avoids a flash/scroll jump).
      add.textContent = exists ? "Add" : "✓ Added";
      add.classList.toggle("primary", exists);
      updateCounts();
    } else if (remove) {
      stockCartSave(stockCart().filter((i) => !(i.type === remove.dataset.type && i.id === remove.dataset.id)));
      refresh();
    } else if (clear) {
      stockCartSave([]); refresh();
    } else if (tab) {
      active = tab.dataset.stockTab;
      root.querySelectorAll(".stock-tab").forEach((t) => t.classList.toggle("active", t === tab));
      searchEl.value = "";
      searchEl.placeholder = active === "gwdi" ? "Search the GWDI bank by gene name…" : "Search the catalog…";
      renderList();
    } else if (e.target.closest("[data-stock-showall]")) {
      showAllStrains = !showAllStrains; renderList();
    } else if (e.target.closest("[data-gwdi-example]")) {
      searchEl.value = "smp3"; searchEl.focus(); renderGwdi();
    } else if (e.target.closest("[data-stock-checkout]")) {
      showCheckout();
    } else if (e.target.closest("[data-stock-back]")) {
      showBrowse();
    }
  });

  root.addEventListener("submit", (e) => {
    if (e.target.id !== "stock-order-form") return;
    e.preventDefault();
    const f = e.target;
    const status = f.querySelector("#stock-order-status");
    const missing = [...f.querySelectorAll("[required]")].filter((el) => !el.value.trim());
    if (missing.length) { missing[0].focus(); status.innerHTML = `<p class="notice" style="color:var(--red,#c0392b)">Please fill in the required fields.</p>`; return; }
    const c = stockCart();
    if (!c.length) { status.innerHTML = `<p class="notice">Your request is empty.</p>`; return; }
    const d = new FormData(f);
    const body = [
      "Dicty Stock Center — order request", "",
      `Requester: ${d.get("name")} <${d.get("email")}>`,
      d.get("institution") ? `Institution: ${d.get("institution")}` : null,
      "", "Ship to:", d.get("address"), "",
      `FedEx account (bill shipping to recipient): ${d.get("fedex")}`, "",
      `Items requested (${c.length}):`,
      ...c.map((i) => `  - [${i.type}] ${i.label}`)
    ].filter((x) => x !== null).join("\n");
    window.location.href = `mailto:${STOCK_ORDER_EMAIL}?subject=${encodeURIComponent("Dicty Stock Center order — " + c.length + " item(s)")}&body=${encodeURIComponent(body)}`;
    status.innerHTML = `<p class="notice">Your email client should have opened with the request. If not, email <a href="mailto:${STOCK_ORDER_EMAIL}">${STOCK_ORDER_EMAIL}</a> directly.</p>`;
  });

  searchEl.addEventListener("input", () => {
    if (active !== "gwdi") { renderList(); return; }
    clearTimeout(gwdiTimer);
    gwdiTimer = setTimeout(renderGwdi, 350);          // debounce the live API search
  });
  updateCounts();
  ensureStockCenter().then(() => { renderList(); updateCounts(); });
}

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
          <p>Where each dataset comes from and when it was last refreshed. dictyBase aggregates and re-presents these sources — it is a modern front-end, not the authoritative curator.</p>
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

function openCite(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/cite");
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Citation</p>
        <h2>How to cite dictyBase</h2>
        <p>If this resource supported your work, please cite the data release below. Individual gene records also carry a “Cite this page” link.</p>
      </div></header>
      <div class="record-body"><div data-cite><p class="notice muted"><span class="spinner" aria-hidden="true"></span>Loading release info…</p></div></div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadCite();
}

async function loadCite() {
  const el = document.querySelector("[data-cite]");
  if (!el) return;
  let m = {};
  try { m = await (await fetch("/api/version")).json(); } catch { /* fall back to placeholders */ }
  const year = (m.released || "2026").slice(0, 4);
  const url = m.url || location.origin;
  const ref = m.doi ? `https://doi.org/${m.doi}` : url;
  const citation = `${m.authors || "dictyBase contributors"} (${year}). ${m.title || "dictyBase"} (version ${m.version || "—"}) [Data set]. ${m.publisher || ""}. ${ref}`.replace(/\s+\./g, ".");
  const bibtex = `@misc{dictyatduke_${year},
  title   = {${m.title || "dictyBase"}},
  author  = {{${m.authors || "dictyBase contributors"}}},
  year    = {${year}},
  version = {${m.version || ""}},
${m.doi ? `  doi     = {${m.doi}},\n` : ""}  url     = {${url}},
  note    = {${m.publisher || ""}}
}`;
  el.innerHTML = `
    <div class="data-block">
      <div class="kv" style="font-size:0.9375rem">
        <span>Release</span><strong>${escapeHtml(m.version || "—")}</strong>
        <span>Released</span><strong>${escapeHtml(m.released || "—")}</strong>
        <span>Data last updated</span><strong>${escapeHtml(m.data_updated || "—")}</strong>
        <span>DOI</span><strong>${m.doi ? `<a class="text-link" href="https://doi.org/${escapeHtml(m.doi)}" target="_blank" rel="noopener">${escapeHtml(m.doi)}</a>` : `<span style="color:var(--muted,#6b7280)">pending — minted via Zenodo on the first tagged release</span>`}</strong>
      </div>
    </div>
    <h3 style="margin-top:18px">Cite this release</h3>
    <p style="font-size:0.9375rem;background:var(--soft,#f1f5f4);border-radius:8px;padding:12px 14px;margin:0">${escapeHtml(citation)}</p>
    <h3 style="margin-top:18px">BibTeX</h3>
    <textarea readonly aria-label="BibTeX citation (click to select)" rows="9" onclick="this.select()" style="width:100%;font-family:ui-monospace,Menlo,monospace;font-size:0.8125rem;${FIELD};resize:vertical">${escapeHtml(bibtex)}</textarea>
    <h3 style="margin-top:18px">Citing the data sources</h3>
    <p style="font-size:0.9375rem">dictyBase aggregates and re-presents data from dictyBase (Basu et al. 2015), UniProt, NCBI, EBI, OMA, RCSB, and KEGG. The <em>D. discoideum</em> wild-isolate genomes (and the <em>D. citrinum</em> / <em>D. dimigraforme</em> assemblies) are from Ahmed et al. 2025, <a class="text-link" href="https://www.pnas.org/doi/10.1073/pnas.2520843122" target="_blank" rel="noopener">PNAS</a> (CC BY 4.0). Please also cite the primary source relevant to the data you used — each gene record links them. ${escapeHtml(m.license || "")}</p>`;
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
              <td style="padding:10px;color:var(--muted,#6b7280)">${d.source && d.source.includes("dictyBase") ? `<a class="text-link" href="https://dictybase.dev" target="_blank" rel="noopener">${escapeHtml(d.source)}</a>` : escapeHtml(d.source)}</td>
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
    const enriched = { ...gene };
    try {
      const annot = await fetchGeneAnnot(ddb);
      if (annot) enriched._annot = annot;
    } catch { /* annotations optional */ }
    try {
      const corpus = await ensureDictyCorpus();
      const entry = corpus[ddb];
      if (entry) {
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
      }
    } catch { /* corpus optional */ }
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

async function loadAISummary(gene) {
  const el = document.querySelector("[data-ai-summary]");
  if (!el) return;
  try { await ensureAICuration(); } catch { return; }
  if (state.activeGene !== gene || state.activeTab !== "Summary") return;
  const ai = aiCurationFor(gene);
  if (!ai || !ai.summary || !getCurationLayers().ai) { el.innerHTML = ""; return; }
  const tier = ai.basis === "family"
    ? `<span class="ai-tier" title="Predicted from the gene's protein family/domain, not gene-specific literature">family-level</span>`
    : ai.basis === "annotation" ? ""
    : `<span class="ai-tier" title="Model-authored from gene-specific knowledge for this well-studied gene">gene-specific</span>`;
  el.innerHTML = `
    <div class="ai-summary">
      <h3>AI summary <span class="src-badge src-ai">AI</span> ${tier}</h3>
      <p>${escapeHtml(ai.summary)}</p>
      <p class="ai-note">Machine-generated, not curator-reviewed \u2014 may be incomplete or wrong. The dictyBase-curated summary above is authoritative.</p>
    </div>`;
}

// Genomic neighborhood (synteny): the genes flanking this one on the AX4
// chromosome, drawn as a strand-aware arrow track. An on-demand button then
// checks whether that local gene order is conserved in another dictyostelid.
async function loadNeighborhood(gene) {
  const el = document.querySelector("[data-neighborhood]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.innerHTML = ""; return; }
  el.innerHTML = `<h3>Genomic neighborhood <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— gene order on the AX4 chromosome</span></h3>
    <div data-nb-results><p class="notice muted">Loading neighborhood…</p></div>`;
  const out = el.querySelector("[data-nb-results]");
  let data;
  try {
    data = await (await fetch(`/api/neighborhood?ddb=${encodeURIComponent(ddb)}`)).json();
    if (data.error || !data.genes) throw new Error("none");
  } catch { out.innerHTML = `<p class="notice muted">No placed neighborhood for this gene.</p>`; return; }
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  const box = (g) => {
    const arrow = g.strand === "-" ? "◄ " : "";
    const arrowR = g.strand === "-" ? "" : " ►";
    const inner = `${arrow}${escapeHtml(g.symbol)}${arrowR}`;
    const style = `display:inline-block;padding:6px 9px;border-radius:6px;font-size:.78rem;white-space:nowrap;border:1px solid ${g.target ? "var(--teal-dark,#012169)" : "var(--line,#d7dee0)"};background:${g.target ? "var(--soft,#e7eef7)" : "#fff"};font-weight:${g.target ? "800" : "500"}`;
    return g.target
      ? `<span style="${style}" title="${escapeHtml(g.name || "")}">${inner}</span>`
      : `<a href="/gene/${encodeURIComponent(g.symbol)}" data-ddb-ref="${escapeHtml(g.ddb)}" class="text-link" style="${style};text-decoration:none" title="${escapeHtml(g.name || "")}">${inner}</a>`;
  };
  const speciesOpts = Object.entries(LOCAL_BLAST_DBS)
    .filter(([id]) => id !== "d-discoideum-ax4")
    .map(([id, label]) => `<option value="${id}">${escapeHtml(label)}</option>`).join("");
  out.innerHTML = `
    <p style="font-size:.75rem;color:var(--muted,#6b7280);margin:0 0 8px">${escapeHtml(data.chrom)} · arrows show strand · the highlighted gene is <em>${escapeHtml(gene.symbol)}</em>.</p>
    <div style="display:flex;gap:6px;align-items:center;overflow-x:auto;padding-bottom:6px">${data.genes.map(box).join('<span style="color:var(--muted,#9ca3af)">·</span>')}</div>
    <div style="margin-top:12px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <label style="font-size:.8125rem;color:var(--muted,#6b7280)">Check conserved order in
        <select data-nb-species style="${FIELD};margin-left:4px">${speciesOpts}</select></label>
      <button type="button" data-nb-check>Check synteny</button>
    </div>
    <div data-nb-synteny style="margin-top:10px"></div>`;
  const btn = out.querySelector("[data-nb-check]");
  btn.addEventListener("click", () => checkSynteny(gene, data, out));
}

async function checkSynteny(gene, data, out) {
  const btn = out.querySelector("[data-nb-check]");
  const sp = out.querySelector("[data-nb-species]");
  const dbId = sp.value, dbLabel = sp.options[sp.selectedIndex].text;
  const syn = out.querySelector("[data-nb-synteny]");
  btn.disabled = true; btn.textContent = "Checking…";
  syn.innerHTML = `<p class="notice muted">Running tblastn of ${data.genes.length} neighbors against ${escapeHtml(dbLabel)}…</p>`;
  // For each neighbor, fetch its protein and tblastn it against the chosen
  // species (queued jobs). Best-hit contig tells us where it lands.
  const hits = await Promise.all(data.genes.map(async (g) => {
    try {
      const fasta = await fetch(`/api/sequence?ddb=${encodeURIComponent(g.ddb)}&type=protein&symbol=${encodeURIComponent(g.symbol)}`).then((r) => r.text());
      if (!fasta.startsWith(">")) return { g, contig: null };
      const d = await pollJob(() => fetch("/api/blast?async=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program: "tblastn", database: dbId, query: fasta }),
      }).then((r) => r.json()));
      const best = (d.hits || []).reduce((a, b) => (!a || b.bitscore > a.bitscore ? b : a), null);
      return { g, contig: best ? best.subject : null, sstart: best ? best.sstart : null };
    } catch { return { g, contig: null }; }
  }));
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  const counts = {};
  hits.forEach((h) => { if (h.contig) counts[h.contig] = (counts[h.contig] || 0) + 1; });
  const topContig = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const onTop = hits.filter((h) => h.contig === topContig).length;
  const found = hits.filter((h) => h.contig).length;
  const verdict = !topContig ? "No homologs found in this species."
    : onTop === found && found > 1 ? `Local gene order is <strong>conserved</strong> — all ${found} detected neighbors map to one contig in ${escapeHtml(dbLabel)}.`
    : onTop > 1 ? `Order is <strong>partially conserved</strong> — ${onTop} of ${found} detected neighbors share a contig.`
    : "Neighbors are dispersed — little local synteny detected.";
  syn.innerHTML = `
    <p style="font-size:.8125rem;margin:0 0 8px">${verdict}</p>
    <div style="display:flex;gap:6px;align-items:flex-start;overflow-x:auto;padding-bottom:6px">
      ${hits.map((h) => {
        const same = h.contig && h.contig === topContig;
        return `<div style="text-align:center;min-width:64px">
          <div style="font-size:.72rem;font-weight:${h.g.target ? "800" : "500"}">${escapeHtml(h.g.symbol)}</div>
          <div style="font-size:.66rem;color:${same ? "var(--teal-dark,#012169)" : "var(--muted,#9ca3af)"};margin-top:2px">${h.contig ? escapeHtml(h.contig.length > 12 ? h.contig.slice(0, 12) + "…" : h.contig) : "—"}</div>
        </div>`;
      }).join("")}
    </div>
    <p style="font-size:.7rem;color:var(--muted,#9ca3af);margin-top:6px">Each neighbor's best tblastn hit; shared contig (highlighted) = conserved local order. Contig-level, not a full alignment.</p>`;
  btn.disabled = false; btn.textContent = "Re-check synteny";
}

// Natural variation: amino-acid differences in this protein across the Ahmed
// et al. 2025 wild isolates (tblastn vs each isolate assembly). On-demand.
function loadVariation(gene) {
  const el = document.querySelector("[data-variation]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <h3>Natural variation <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— across wild isolates (Ahmed et al. 2025)</span></h3>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 10px">Compare this protein across the sequenced wild <em>D. discoideum</em> isolates to see how polymorphic it is. Runs on demand.</p>
    <button type="button" id="variation-run">Show variation across isolates</button>
    <div data-variation-results style="margin-top:12px"></div>`;
  const btn = document.getElementById("variation-run");
  if (btn) btn.addEventListener("click", () => runVariation(gene));
}

async function runVariation(gene) {
  const out = document.querySelector("[data-variation-results]");
  const btn = document.getElementById("variation-run");
  if (!out || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = "Comparing…"; }
  const ddb = gene.veupath || gene.ddb;
  out.innerHTML = `<p class="notice muted">Running tblastn across the wild isolates…</p>`;
  let data;
  try {
    data = await pollJob(() => fetch(`/api/variation?ddb=${encodeURIComponent(ddb)}&async=1`).then((r) => r.json()));
    if (data.error) throw new Error(data.error);
  } catch {
    out.innerHTML = `<p class="notice">Variation could not be computed.</p>`;
    if (btn) { btn.disabled = false; btn.textContent = "Show variation across isolates"; }
    return;
  }
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  const td = "padding:5px 8px";
  const rows = (data.isolates || []).map((iso) => {
    if (!iso.found) return `<tr style="border-bottom:1px solid var(--line,#eef2f3)"><td style="${td}"><em>${escapeHtml(iso.label)}</em></td><td style="${td}" colspan="3"><span style="color:var(--muted,#6b7280)">no homolog detected</span></td></tr>`;
    const subs = (iso.subs || []).map((s) => `${s.ref}${s.pos}${s.alt}`).join(", ");
    const subsCell = iso.n_subs === 0 ? '<span style="color:#047857">identical</span>'
      : `${iso.n_subs} aa${subs ? ` <span style="color:var(--muted,#6b7280);font-size:.92em">(${escapeHtml(subs)}${iso.n_subs > (iso.subs || []).length ? ", …" : ""})</span>` : ""}`;
    return `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
      <td style="${td}"><em>${escapeHtml(iso.label)}</em></td>
      <td style="${td}">${iso.identity}%</td>
      <td style="${td}">${iso.coverage}%</td>
      <td style="${td}">${subsCell}</td></tr>`;
  }).join("");
  out.innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="${td}">Isolate</th><th style="${td}">% identity</th><th style="${td}">Coverage</th><th style="${td}">Substitutions</th>
      </tr></thead><tbody>${rows}</tbody></table></div>
    <p style="font-size:.7rem;color:var(--muted,#9ca3af);margin-top:6px">Protein-level (tblastn of the AX4 protein vs each isolate assembly), reference = AX4. Substitutions are amino-acid changes vs the reference; positions are AX4 residue numbers.</p>`;
  if (btn) { btn.disabled = false; btn.textContent = "Re-run"; }
}

// Paralogs / gene family: other D. discoideum genes whose product is similar to
// this one, found by tblastn of the protein against the AX4 genome. On-demand.
function loadParalogs(gene) {
  const el = document.querySelector("[data-paralogs]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <h3>Paralogs &amp; similar genes <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— local tblastn vs D. discoideum</span></h3>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 10px">Find other <em>D. discoideum</em> genes with a similar protein (sequence-similarity paralogs / family members). Runs on demand.</p>
    <button type="button" id="paralogs-run">Find paralogs</button>
    <div data-paralogs-results style="margin-top:12px"></div>`;
  const btn = document.getElementById("paralogs-run");
  if (btn) btn.addEventListener("click", () => runParalogs(gene));
}

async function runParalogs(gene) {
  const out = document.querySelector("[data-paralogs-results]");
  const btn = document.getElementById("paralogs-run");
  if (!out || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = "Searching…"; }
  const reset = (label) => { if (btn) { btn.disabled = false; btn.textContent = label; } };
  const ddb = gene.veupath || gene.ddb;
  out.innerHTML = `<p class="notice muted">Running tblastn against the D. discoideum genome…</p>`;
  let fasta;
  try {
    const r = await fetch(`/api/sequence?ddb=${encodeURIComponent(ddb)}&type=protein&symbol=${encodeURIComponent(gene.symbol)}`);
    fasta = await r.text();
    if (!r.ok || !fasta.startsWith(">")) throw new Error("no protein");
  } catch {
    out.innerHTML = `<p class="notice">Could not retrieve a protein sequence for this gene.</p>`;
    reset("Find paralogs");
    return;
  }
  let data;
  try {
    const res = await fetch("/api/blast", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ program: "tblastn", database: "d-discoideum-ax4", query: fasta }),
    });
    data = await res.json();
    if (!res.ok) throw new Error(data.error || "blast failed");
  } catch {
    out.innerHTML = `<p class="notice">Paralog search could not be run.</p>`;
    reset("Find paralogs");
    return;
  }
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  // best hit per gene, excluding this gene's own locus
  const best = new Map();
  for (const h of (data.hits || [])) {
    if (!h.gene || h.gene.ddb === ddb) continue;
    const prev = best.get(h.gene.ddb);
    if (!prev || h.bitscore > prev.bitscore) best.set(h.gene.ddb, h);
  }
  const rows = [...best.values()].sort((a, b) => b.bitscore - a.bitscore);
  reset("Re-run");
  if (!rows.length) { out.innerHTML = `<p class="notice muted">No other D. discoideum genes with significant similarity (E &lt; 1e-3).</p>`; return; }
  out.innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="padding:6px 8px">Gene</th><th style="padding:6px 8px">% identity</th>
        <th style="padding:6px 8px">Aln</th><th style="padding:6px 8px">E-value</th><th style="padding:6px 8px">Bit score</th>
      </tr></thead>
      <tbody>
        ${rows.map((h) => `
          <tr style="border-bottom:1px solid var(--line,#eef2f3)">
            <td style="padding:6px 8px"><a class="text-link curated-xref" data-ddb-ref="${escapeHtml(h.gene.ddb)}" href="/gene/${encodeURIComponent(h.gene.symbol)}">${escapeHtml(h.gene.symbol)}</a></td>
            <td style="padding:6px 8px">${h.identity.toFixed(1)}%</td>
            <td style="padding:6px 8px">${h.length}</td>
            <td style="padding:6px 8px">${escapeHtml(h.evalue)}</td>
            <td style="padding:6px 8px">${h.bitscore}</td>
          </tr>`).join("")}
      </tbody>
    </table></div>
    <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:8px">Sequence-similarity matches (tblastn, E &lt; 1e-3), best hit per gene. Not curated orthology — verify family membership.</p>`;
}

// Comparative genomics: best tblastn hit of this protein in each sequenced
// dictyostelid species. On-demand (button) because it runs one BLAST per species.
function loadComparative(gene) {
  const el = document.querySelector("[data-dicty-comparative]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <h3>Across the sequenced dictyostelids <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— local tblastn</span></h3>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 10px">See how conserved this protein is by searching it against every sequenced dictyostelid species hosted here. Runs on demand.</p>
    <button type="button" id="comparative-run">Compare across species</button>
    <div data-comparative-results style="margin-top:12px"></div>`;
  const btn = document.getElementById("comparative-run");
  if (btn) btn.addEventListener("click", () => runComparative(gene));
}

async function runComparative(gene) {
  const out = document.querySelector("[data-comparative-results]");
  const btn = document.getElementById("comparative-run");
  if (!out || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = "Comparing…"; }
  const reset = (label) => { if (btn) { btn.disabled = false; btn.textContent = label; } };
  const ddb = gene.veupath || gene.ddb;
  out.innerHTML = `<p class="notice muted">Fetching protein and running tblastn across species…</p>`;
  let fasta;
  try {
    const r = await fetch(`/api/sequence?ddb=${encodeURIComponent(ddb)}&type=protein&symbol=${encodeURIComponent(gene.symbol)}`);
    fasta = await r.text();
    if (!r.ok || !fasta.startsWith(">")) throw new Error("no protein");
  } catch {
    out.innerHTML = `<p class="notice">Could not retrieve a protein sequence for this gene.</p>`;
    reset("Compare across species");
    return;
  }
  const results = await Promise.all(Object.entries(LOCAL_BLAST_DBS).map(async ([id, label]) => {
    try {
      // Queued jobs: 11 submits, but the server's pool runs only a few at a time
      // so this can't overwhelm the box (and won't 503 under contention).
      const data = await pollJob(() => fetch("/api/blast?async=1", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ program: "tblastn", database: id, query: fasta }),
      }).then((r) => r.json()));
      if (!data.hits || !data.hits.length) return { label, hit: null };
      return { label, hit: data.hits.reduce((a, b) => (b.bitscore > a.bitscore ? b : a)) };
    } catch { return { label, hit: null }; }
  }));
  if (state.activeGene !== gene || state.activeTab !== "Orthologs") return;
  out.innerHTML = `
    <div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:0.8125rem">
      <thead><tr style="text-align:left;border-bottom:2px solid var(--line,#d7dee0)">
        <th style="padding:6px 8px">Species</th><th style="padding:6px 8px">Best hit</th>
        <th style="padding:6px 8px">% identity</th><th style="padding:6px 8px">Aln</th><th style="padding:6px 8px">E-value</th>
      </tr></thead>
      <tbody>
        ${results.map((r) => {
          if (!r.hit) return `<tr style="border-bottom:1px solid var(--line,#eef2f3)"><td style="padding:6px 8px"><em>${escapeHtml(r.label)}</em></td><td style="padding:6px 8px" colspan="4"><span style="color:var(--muted,#6b7280)">no significant hit</span></td></tr>`;
          const h = r.hit;
          const loc = `${escapeHtml(h.subject)}:${Number(h.sstart).toLocaleString()}–${Number(h.send).toLocaleString()}`;
          const cell = h.gene
            ? `<a class="text-link curated-xref" data-ddb-ref="${escapeHtml(h.gene.ddb)}" href="/gene/${encodeURIComponent(h.gene.symbol)}">${escapeHtml(h.gene.symbol)}</a> <span style="color:var(--muted,#6b7280)">${loc}</span>`
            : loc;
          return `<tr style="border-bottom:1px solid var(--line,#eef2f3)">
            <td style="padding:6px 8px"><em>${escapeHtml(r.label)}</em></td>
            <td style="padding:6px 8px">${cell}</td>
            <td style="padding:6px 8px">${h.identity.toFixed(1)}%</td>
            <td style="padding:6px 8px">${h.length}</td>
            <td style="padding:6px 8px">${escapeHtml(h.evalue)}</td>
          </tr>`;
        }).join("")}
      </tbody>
    </table></div>
    <p style="font-size:0.75rem;color:var(--muted,#6b7280);margin-top:8px">Best tblastn hit per genome (E &lt; 1e-3). The <em>D. discoideum</em> AX4 row is this gene's own locus.</p>`;
  reset("Re-run comparison");
}

// Gene model (exon/intron) diagram from assets/gene_models.json.
let geneModelData = null;
async function ensureGeneModels() {
  if (geneModelData) return geneModelData;
  try {
    const res = await fetch("/assets/gene_models.json");
    geneModelData = res.ok ? await res.json() : {};
  } catch { geneModelData = {}; }
  return geneModelData;
}
async function loadGeneModel(gene) {
  const el = document.querySelector("[data-gene-model]");
  if (!el) return;
  try { await ensureGeneModels(); } catch { return; }
  if (state.activeGene !== gene || state.activeTab !== "Summary") return;
  const m = geneModelData[(gene.veupath || gene.ddb || "").toUpperCase()];
  if (!m || !m.exons || !m.exons.length) { el.setAttribute("hidden", ""); return; }
  el.removeAttribute("hidden");
  const gstart = m.start, glen = Math.max(1, m.end - m.start);
  const W = 760, H = 46, pad = 6, y = 22, exonH = 12, cdsH = 16;
  const x = (p) => pad + ((p - gstart) / glen) * (W - 2 * pad);
  const within = (s, e, list) => list.some(([cs, ce]) => s < ce && e > cs);
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMinYMid meet" role="img" aria-label="Gene model, ${m.exons.length} exons">`;
  // intron line across the whole span
  svg += `<line x1="${x(m.start)}" y1="${y + exonH / 2}" x2="${x(m.end)}" y2="${y + exonH / 2}" stroke="var(--line,#d7dee0)" stroke-width="2"/>`;
  for (const [s, e] of m.exons) {
    const coding = within(s, e, m.cds || []);
    const bx = x(s), bw = Math.max(1.5, x(e) - x(s));
    const h = coding ? cdsH : exonH, ty = coding ? y - 2 : y;
    svg += `<rect x="${bx.toFixed(1)}" y="${ty}" width="${bw.toFixed(1)}" height="${h}" rx="1.5" fill="${coding ? "var(--teal,#00539b)" : "#a9bcd6"}"><title>exon ${s.toLocaleString()}–${e.toLocaleString()}</title></rect>`;
  }
  svg += `<text x="${pad}" y="12" font-size="9" fill="var(--muted,#6b7280)">${m.chrom} (${m.strand})</text>`;
  svg += `<text x="${W - pad}" y="12" font-size="9" fill="var(--muted,#6b7280)" text-anchor="end">${glen.toLocaleString()} bp</text>`;
  svg += `</svg>`;
  el.innerHTML = `<h3>Gene model <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— ${m.exons.length} exon${m.exons.length === 1 ? "" : "s"}, ${m.strand} strand</span></h3>${svg}<p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:4px 0 0">Tall blue = coding (CDS), short grey = UTR/non-coding exon, line = intron. ${m.strand === "+" ? "5′→3′ left to right." : "Minus strand (coordinates increase left to right)."}</p>`;
}

// KEGG pathway membership (assets/kegg_pathways.json, keyed by DDB_G id).
let keggData = null;
async function ensureKegg() {
  if (keggData) return keggData;
  try {
    const r = await fetch("/assets/kegg_pathways.json");
    keggData = r.ok ? await r.json() : {};
  } catch { keggData = {}; }
  return keggData;
}
async function loadKeggPathways(gene) {
  const el = document.querySelector("[data-kegg]");
  if (!el) return;
  try { await ensureKegg(); } catch { return; }
  if (state.activeGene !== gene || state.activeTab !== "Summary") return;
  const ddb = (gene.veupath || gene.ddb || "").toUpperCase();
  const paths = keggData[ddb];
  if (!paths || !paths.length) { el.setAttribute("hidden", ""); return; }
  el.removeAttribute("hidden");
  el.innerHTML = `
    <h3>KEGG pathways <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— ${paths.length}</span></h3>
    <ul class="list" style="font-size:0.8125rem">
      ${paths.map((p) => `<li><a class="text-link" href="https://www.kegg.jp/pathway/${escapeHtml(p.id)}+${escapeHtml(ddb)}" target="_blank" rel="noopener">${escapeHtml(p.name)}</a></li>`).join("")}
    </ul>
    <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:4px 0 0">Links open the KEGG map with this gene highlighted.</p>`;
}

// Co-expressed genes (Pearson over the Parikh developmental time course).
async function loadCoexpression(gene) {
  const el = document.querySelector("[data-coexpression]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.setAttribute("hidden", ""); return; }
  let data;
  try {
    const res = await fetch(`/api/coexpression?ddb=${encodeURIComponent(ddb)}&n=12`);
    data = await res.json();
    if (!res.ok) throw new Error();
  } catch { el.setAttribute("hidden", ""); return; }
  if (state.activeGene !== gene || state.activeTab !== "Summary") return;
  const rows = data.results || [];
  if (!rows.length) { el.setAttribute("hidden", ""); return; }
  el.removeAttribute("hidden");
  el.innerHTML = `
    <h3>Co-expressed genes <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— similar developmental profile</span></h3>
    <ul class="list" style="font-size:0.8125rem">
      ${rows.map((r) => `<li style="display:flex;justify-content:space-between;gap:8px">
        <a class="text-link" href="/gene/${encodeURIComponent(r.symbol)}">${escapeHtml(r.symbol)}</a>
        <span style="color:var(--muted,#6b7280)">r = ${r.r.toFixed(2)}</span></li>`).join("")}
    </ul>
    <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:4px 0 0">Pearson correlation of RNA-seq profiles (Parikh time course). Correlation ≠ function — a hypothesis-generation aid.</p>`;
}

// Known mutant strains for this gene, from the dictyBase strain corpus. The data
// already drives the Phenotypes tab and the /strain/<id> pages; this surfaces it
// on the Summary view so the mutants are visible without opening a tab.
async function loadStrains(gene) {
  const el = document.querySelector("[data-strains]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.setAttribute("hidden", ""); return; }
  let strains;
  try {
    const res = await fetch(`/api/gene/${encodeURIComponent(ddb)}`);
    const data = await res.json();
    strains = (data && data.strains) || [];
  } catch { el.setAttribute("hidden", ""); return; }
  if (state.activeGene !== gene || state.activeTab !== "Summary") return;
  if (!strains.length) { el.setAttribute("hidden", ""); return; }
  el.removeAttribute("hidden");
  el.innerHTML = `
    <h3>Mutant strains <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— ${strains.length} in dictyBase</span></h3>
    <div style="display:flex;flex-wrap:wrap;gap:6px">
      ${strains.map((s) => `<a class="text-link" href="/strain/${encodeURIComponent(s)}" style="font-size:0.8125rem;padding:2px 8px;border:1px solid var(--line,#d7dee0);border-radius:6px">${escapeHtml(s)}</a>`).join("")}
    </div>
    <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:6px 0 0">Strains carrying a mutation in this gene. Order physical stocks from the <a class="text-link" href="https://dictybase.dev/stockcenter" target="_blank" rel="noopener">Dicty Stock Center</a>.</p>`;
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
            borderColor: "#00539b",
            backgroundColor: "#00539b22",
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
              <span style="display:block;height:100%;width:${barW}%;background:var(--teal,#00539b);border-radius:999px"></span>
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
      `/community/labs?pi=${encodeURIComponent(slugify(lab.pi))}`, "Community",
      { keywords: `${lab.institution || ""} ${lab.location || ""}` });
  }
  if (window.meetingsContent) {
    add("Meetings", "Dictyostelium meetings and community events.", "/community/meetings", "Community",
      { keywords: htmlToText(JSON.stringify(window.meetingsContent)) });
  }
  add("Award Recipients", "Annual community award winners by career stage.", "/community/award-recipients", "Community",
    { keywords: AWARD_RECIPIENTS.flatMap((y) => [y.year, ...y.awards.flatMap((a) => [a.stage, ...a.names])]).join(" ") });
  add("Dicty Stock Center", "Order Dictyostelium strains and plasmids.", "/stock-center", "Community",
    { keywords: "stock center order request strains plasmids fedex shipping catalog" });

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

  const others = rows
    .filter((r) => r.modelIdx < 0)
    .sort((a, b) => relRank(a) - relRank(b) || a.distance - b.distance);
  const oneToOne = rows.filter((r) => r.rel === "1:1").length;

  const CAP = 100; // keep the DOM light; the search box + OMA link cover the long tail
  const rowHtml = (r) => `<li>
    <strong><a href="https://omabrowser.org/oma/vps/${encodeURIComponent(r.omaid)}/" target="_blank" rel="noopener">${escapeHtml(r.canonicalid || r.omaid)}</a></strong>${omaRelBadge(r.rel)}
    <span>${r.modelLabel ? `<span style="font-weight:600;color:var(--text,#111827)">${escapeHtml(r.modelLabel)}</span> · ` : ""}${escapeHtml(r.sci)}</span>
  </li>`;
  const sectionHead = (txt) => `<h4 class="oma-subhead">${escapeHtml(txt)}</h4>`;
  const listBlock = (arr) => `<ul class="list">${arr.map(rowHtml).join("")}</ul>`;

  container.innerHTML = `
    <p class="oma-summary">${orthologs.length.toLocaleString()} orthologs across all species${oneToOne ? ` · ${oneToOne} one-to-one` : ""}.</p>
    <input type="search" class="oma-search" placeholder="Search orthologs by organism or id…" aria-label="Search orthologs">
    <div class="oma-list"></div>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin-top:14px">
      <a class="text-link" href="https://omabrowser.org/oma/vps/${encodeURIComponent(gene.uniprot)}/" target="_blank" rel="noopener">View all ${orthologs.length} orthologs on OMA Browser →</a>
    </p>`;

  const listEl = container.querySelector(".oma-list");
  const searchEl = container.querySelector(".oma-search");
  let expanded = false;

  const paint = () => {
    const q = searchEl.value.trim().toLowerCase();
    if (q) {
      const hits = rows
        .filter((r) =>
          r.sci.toLowerCase().includes(q) ||
          (r.canonicalid || "").toLowerCase().includes(q) ||
          (r.omaid || "").toLowerCase().includes(q) ||
          (r.modelLabel || "").toLowerCase().includes(q))
        .sort((a, b) => (a.modelIdx < 0) - (b.modelIdx < 0) || relRank(a) - relRank(b) || a.distance - b.distance);
      if (!hits.length) {
        listEl.innerHTML = `<p class="notice muted">No orthologs match “${escapeHtml(searchEl.value.trim())}”.</p>`;
        return;
      }
      listEl.innerHTML =
        `<p class="oma-count">${hits.length} match${hits.length === 1 ? "" : "es"}${hits.length > CAP ? ` · showing ${CAP}` : ""}</p>` +
        listBlock(hits.slice(0, CAP));
      return;
    }
    if (!expanded) {
      listEl.innerHTML = `<button type="button" class="oma-toggle" data-oma-toggle="open">Show all ${rows.length.toLocaleString()} orthologs ▾</button>`;
      return;
    }
    const modelsHtml = models.length ? sectionHead("Model organisms") + listBlock(models) : "";
    let othersHtml = "";
    if (others.length) {
      othersHtml = sectionHead(`Other species (${others.length})`) + listBlock(others.slice(0, CAP)) +
        (others.length > CAP ? `<p class="oma-count">Showing ${CAP} of ${others.length} — search above or use OMA Browser for the rest.</p>` : "");
    }
    listEl.innerHTML = modelsHtml + othersHtml +
      `<button type="button" class="oma-toggle" data-oma-toggle="close" style="margin-top:12px">Show less ▴</button>`;
  };

  searchEl.addEventListener("input", paint);
  listEl.addEventListener("click", (e) => {
    const t = e.target.closest("[data-oma-toggle]");
    if (!t) return;
    expanded = t.dataset.omaToggle === "open";
    paint();
  });
  paint();
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

  // GET form (?json=) of the RCSB search so it routes through our /api/ext
  // proxy like the other external calls (the v2 API accepts either).
  const response = await fetch("https://search.rcsb.org/rcsbsearch/v2/query?json=" +
    encodeURIComponent(JSON.stringify(query)));
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

const DOMAIN_COLORS = ["#00539b", "#6b2fb3", "#b45309", "#1d4ed8", "#be123c", "#047857", "#7c3aed", "#0891b2"];
function domainColor(s) {
  let h = 0;
  for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return DOMAIN_COLORS[h % DOMAIN_COLORS.length];
}

// Per-residue protein conservation across the dictyostelid genomes (on-demand).
function loadConservation(gene) {
  const el = document.querySelector("[data-conservation]");
  if (!el) return;
  if (!gene.uniprot && !/^DDB_G\d+$/.test(gene.veupath || gene.ddb || "")) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <h3>Conservation across dictyostelids <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— tblastn across species</span></h3>
    <p style="font-size:0.8125rem;color:var(--muted,#6b7280);margin:0 0 10px">Per-residue protein conservation across the sequenced dictyostelids — darker = more conserved. Runs on demand.</p>
    <button type="button" id="conservation-run">Compute conservation</button>
    <div data-conservation-results style="margin-top:12px"></div>`;
  const btn = document.getElementById("conservation-run");
  if (btn) btn.addEventListener("click", () => runConservation(gene));
}

async function runConservation(gene) {
  const out = document.querySelector("[data-conservation-results]");
  const btn = document.getElementById("conservation-run");
  if (!out || (btn && btn.disabled)) return;
  if (btn) { btn.disabled = true; btn.textContent = "Computing…"; }
  const ddb = gene.veupath || gene.ddb;
  out.innerHTML = `<p class="notice muted">Running tblastn across the sequenced species…</p>`;
  let data;
  try {
    data = await pollJob(() => fetch(`/api/conservation?ddb=${encodeURIComponent(ddb)}&async=1`).then((r) => r.json()));
    if (data.error) throw new Error(data.error);
  } catch {
    out.innerHTML = `<p class="notice">Conservation could not be computed.</p>`;
    if (btn) { btn.disabled = false; btn.textContent = "Compute conservation"; }
    return;
  }
  if (state.activeGene !== gene || state.activeTab !== "Structures") return;
  const c = data.conservation || [];
  const L = data.length || c.length;
  if (!L || !data.homologs) { out.innerHTML = `<p class="notice muted">No homologs found in the other genomes.</p>`; if (btn) { btn.disabled = false; btn.textContent = "Compute conservation"; } return; }
  const W = 760, H = 30, pad = 4, cols = Math.min(L, 600), colW = (W - 2 * pad) / cols;
  const shade = (f) => `rgb(${Math.round(231 - f * 231)}, ${Math.round(238 - f * 155)}, ${Math.round(247 - f * 92)})`; // light -> navy
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="none" role="img" aria-label="Conservation track">`;
  for (let i = 0; i < cols; i++) {
    const a = Math.floor(i * L / cols), b = Math.max(a + 1, Math.floor((i + 1) * L / cols));
    let s = 0; for (let j = a; j < b; j++) s += c[j] || 0;
    const f = s / (b - a);
    svg += `<rect x="${(pad + i * colW).toFixed(2)}" y="4" width="${(colW + 0.5).toFixed(2)}" height="${H - 8}" fill="${shade(f)}"/>`;
  }
  svg += `</svg>`;
  const mean = c.reduce((a, b) => a + b, 0) / (c.length || 1);
  out.innerHTML = `${svg}
    <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:6px 0 0">${data.homologs} dictyostelid homolog${data.homologs === 1 ? "" : "s"} · mean conservation ${(mean * 100).toFixed(0)}% · darker = identical across more species. Query-anchored from pairwise tblastn alignments (not a multiple alignment).</p>`;
  if (btn) { btn.disabled = false; btn.textContent = "Re-run"; }
}

async function loadProteinProps(gene) {
  const el = document.querySelector("[data-protein-props]");
  if (!el) return;
  const ddb = gene.veupath || gene.ddb || "";
  if (!/^DDB_G\d+$/.test(ddb)) { el.innerHTML = ""; return; }
  el.innerHTML = `<h3>Protein properties</h3><p class="notice muted">Computing…</p>`;
  let d;
  try { d = await (await fetch(`/api/protein-props?ddb=${encodeURIComponent(ddb)}`)).json(); }
  catch { el.innerHTML = ""; return; }
  if (state.activeGene !== gene || state.activeTab !== "Structures") return;
  if (!d || d.error || !d.length) { el.innerHTML = ""; return; }
  const water = d.gravy > 0 ? "hydrophobic" : "hydrophilic";
  const item = (v, l) => `<span style="display:inline-block"><strong style="font-size:1.05rem">${v}</strong> <span style="color:var(--muted,#6b7280);font-size:.8125rem">${l}</span></span>`;
  el.innerHTML = `
    <h3>Protein properties <span style="font-size:0.75rem;font-weight:500;color:var(--muted,#6b7280)">— computed from the sequence</span></h3>
    <div style="display:flex;gap:22px;flex-wrap:wrap;align-items:baseline">
      ${item(d.length.toLocaleString(), "residues")}
      ${item(d.mw_kda + " kDa", "mol. weight")}
      ${item(d.pi, "isoelectric point")}
      ${item(d.gravy, `GRAVY · ${water}`)}
    </div>`;
}

async function loadDomains(gene) {
  const el = document.querySelector("[data-domains]");
  if (!el) return;
  const ddb = (gene.veupath || gene.ddb || "").toUpperCase();
  let data;
  try {
    // Prefer the precomputed store (server reads domains.json, ~2 KB per gene);
    // fall back to the live InterPro proxy for genes not yet cached.
    let res = ddb ? await fetch(`/api/domains?ddb=${encodeURIComponent(ddb)}`) : null;
    if (res && res.ok) {
      data = await res.json();
    } else if (gene.uniprot) {
      res = await fetch(`/api/domains?acc=${encodeURIComponent(gene.uniprot)}`);
      data = await res.json();
      if (!res.ok) throw new Error(data.error || "failed");
    } else {
      data = { length: 0, domains: [] };
    }
  } catch {
    if (state.activeGene === gene && state.activeTab === "Structures") {
      el.innerHTML = `<p class="notice muted">Domain data could not be loaded.</p>`;
    }
    return;
  }
  if (state.activeGene !== gene || state.activeTab !== "Structures") return;
  const len = data.length || 0;
  const all = data.domains || [];
  if (!len || !all.length) { el.innerHTML = `<p class="notice muted">No domain annotations found${gene.uniprot ? ` for ${escapeHtml(gene.uniprot)}` : ""}.</p>`; return; }

  // Domains for the architecture bar: prefer InterPro's integrated,
  // non-redundant domain set (covers e.g. the myosin tail that Pfam omits),
  // then Pfam, then CDD, then anything positional.
  const positional = (db) => all.filter((d) => d.db === db && (d.type === "domain" || d.type === "repeat"));
  let boxes = positional("interpro");
  if (!boxes.length) boxes = positional("pfam");
  if (!boxes.length) boxes = positional("cdd");
  if (!boxes.length) boxes = all.filter((d) => (d.type === "domain" || d.type === "repeat"));

  const W = 600, H = 44, pad = 4, ty = 18, th = 12;
  const x = (p) => pad + (Math.max(0, Math.min(len, p)) / len) * (W - 2 * pad);
  let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMinYMid meet" role="img" aria-label="Protein domain architecture, ${len} amino acids">`;
  svg += `<line x1="${pad}" y1="${ty + th / 2}" x2="${W - pad}" y2="${ty + th / 2}" stroke="#d7dee0" stroke-width="2"/>`;
  for (const d of boxes) {
    const bx = x(d.start), bw = Math.max(2, x(d.end) - x(d.start));
    svg += `<rect x="${bx.toFixed(1)}" y="${ty}" width="${bw.toFixed(1)}" height="${th}" rx="2" fill="${domainColor(d.accession || d.name)}"><title>${escapeHtml(d.name || d.accession)} (${d.start}–${d.end})</title></rect>`;
  }
  svg += `<text x="${pad}" y="${ty - 4}" font-size="9" fill="#6b7280">1</text>`;
  svg += `<text x="${W - pad}" y="${ty - 4}" font-size="9" fill="#6b7280" text-anchor="end">${len} aa</text>`;
  svg += `</svg>`;

  // Legend / full list (domains first, then families/superfamilies), deduped.
  const seen = new Set();
  const list = all
    .filter((d) => { const k = d.accession + d.start + d.end; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.start - b.start)
    .map((d) => {
      const url = d.db === "pfam" ? `https://www.ebi.ac.uk/interpro/entry/pfam/${d.accession}/`
        : d.db === "interpro" ? `https://www.ebi.ac.uk/interpro/entry/InterPro/${d.accession}/` : "";
      const sw = (d.type === "domain" || d.type === "repeat") ? `<span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${domainColor(d.accession || d.name)};margin-right:6px"></span>` : `<span style="display:inline-block;width:9px;height:9px;margin-right:6px"></span>`;
      const nm = url ? `<a class="text-link" href="${url}" target="_blank" rel="noopener">${escapeHtml(d.name || d.accession)}</a>` : escapeHtml(d.name || d.accession);
      return `<li>${sw}${nm} <span style="color:var(--muted,#6b7280)">· ${escapeHtml(d.type)} · ${escapeHtml(d.db)} · ${d.start}–${d.end}</span></li>`;
    }).join("");
  el.innerHTML = `<div style="margin-bottom:10px">${svg}</div><ul class="list" style="font-size:0.8125rem">${list}</ul>`;
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

  // No gene matched — if the query names a tool or page, go there instead of NCBI.
  const pageHit = matchSitePages(query, 1)[0];
  if (pageHit) {
    suggestions.innerHTML = "";
    if (/^https?:/.test(pageHit.href)) { window.open(pageHit.href, "_blank", "noopener"); }
    else { history.pushState(null, "", pageHit.href); hydrateFromRoute(); }
    return;
  }

  // Fall back to NCBI search
  showHomeChrome(false);
  recordShell.removeAttribute("hidden");
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

// --- Accessible combobox keyboard navigation for the gene-search autocomplete ---
// The suggestion dropdown is rendered as `.suggestion` buttons inside
// `#suggestions` by several code paths (renderSuggestions / fetchNCBISuggestions).
// Rather than touch each render site, a MutationObserver re-applies the listbox
// ARIA wiring (role="option" + unique ids) whenever the dropdown contents change.
let suggestionActiveIndex = -1;

function suggestionOptions() {
  return Array.from(suggestions.querySelectorAll(".suggestion"));
}

function decorateSuggestionOptions() {
  const opts = suggestionOptions();
  opts.forEach((opt, i) => {
    opt.setAttribute("role", "option");
    if (!opt.id) opt.id = `suggestion-option-${i}`;
    opt.setAttribute("aria-selected", "false");
  });
  input.setAttribute("aria-expanded", opts.length ? "true" : "false");
  // The DOM was just replaced — any previous highlight is gone.
  suggestionActiveIndex = -1;
  input.removeAttribute("aria-activedescendant");
}

const suggestionObserver = new MutationObserver(decorateSuggestionOptions);
suggestionObserver.observe(suggestions, { childList: true });

function setActiveSuggestion(index) {
  const opts = suggestionOptions();
  if (!opts.length) return;
  // Wrap at the ends.
  if (index < 0) index = opts.length - 1;
  if (index >= opts.length) index = 0;
  opts.forEach((opt, i) => opt.setAttribute("aria-selected", i === index ? "true" : "false"));
  opts.forEach((opt) => opt.classList.remove("is-active"));
  const active = opts[index];
  active.classList.add("is-active");
  active.scrollIntoView({ block: "nearest" });
  input.setAttribute("aria-activedescendant", active.id);
  suggestionActiveIndex = index;
}

function clearSuggestions() {
  suggestions.innerHTML = "";
  suggestionActiveIndex = -1;
  input.setAttribute("aria-expanded", "false");
  input.removeAttribute("aria-activedescendant");
}

input.addEventListener("keydown", (event) => {
  const opts = suggestionOptions();
  switch (event.key) {
    case "ArrowDown":
      if (!opts.length) return;
      event.preventDefault();
      setActiveSuggestion(suggestionActiveIndex + 1);
      break;
    case "ArrowUp":
      if (!opts.length) return;
      event.preventDefault();
      setActiveSuggestion(suggestionActiveIndex - 1);
      break;
    case "Enter":
      // Activate the highlighted suggestion via the existing click path.
      // With nothing highlighted, fall through to the form's submit handler.
      if (suggestionActiveIndex >= 0 && opts[suggestionActiveIndex]) {
        event.preventDefault();
        opts[suggestionActiveIndex].click();
      }
      break;
    case "Escape":
      if (opts.length) {
        event.preventDefault();
        clearSuggestions();
        input.focus();
      }
      break;
  }
});

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
    if (["genome-browser", "blast", "proteomics", "heatstress", "downloads", "enrichment", "api", "lab", "expression", "basket", "convert", "sequence", "geneset", "stats"].includes(slug)) {
      event.preventDefault();
      openTool(slug);
      return;
    }
  }

  const advLink = event.target.closest('a[href="/search/advanced"]');
  if (advLink) {
    event.preventDefault();
    openAdvancedFinder();
    return;
  }

  const citeToggle = event.target.closest(".cite-toggle");
  if (citeToggle) {
    const sym = citeToggle.dataset.citeSymbol || "";
    const existing = citeToggle.parentElement.querySelector(".cite-box");
    if (existing) { existing.remove(); return; }
    const today = new Date().toISOString().slice(0, 10);
    const box = document.createElement("span");
    box.className = "cite-box";
    box.style.cssText = "display:block;margin-top:6px;padding:8px 10px;background:var(--soft,#e7eef7);border-radius:6px;color:var(--ink,#1f2937);font-size:0.75rem;line-height:1.5";
    box.textContent = `dictyBase. ${sym} gene record. Duke University. Retrieved ${today} from ${location.origin}/gene/${sym}`;
    citeToggle.parentElement.appendChild(box);
    return;
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

  const eduLink = event.target.closest('a[href="/education"]');
  if (eduLink) {
    event.preventDefault();
    openEducation();
    return;
  }

  const startLink = event.target.closest('a[href="/start"]');
  if (startLink) {
    event.preventDefault();
    openStart();
    return;
  }

  const areasLink = event.target.closest('a[href="/research-areas"]');
  if (areasLink) {
    event.preventDefault();
    openResearchAreas();
    return;
  }

  const communityLink = event.target.closest('a[href^="/community/"]');
  if (communityLink) {
    event.preventDefault();
    // Parse as a URL so a "?pi=" query (deep-link to a specific lab)
    // survives instead of being folded into the section slug.
    const u = new URL(communityLink.getAttribute("href"), location.origin);
    const slug = u.pathname.split("/").filter(Boolean).pop();
    history.pushState(null, "", u.pathname + u.search);
    openCommunity(slug, false);
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

  const citeLink = event.target.closest('a[href="/cite"]');
  if (citeLink) {
    event.preventDefault();
    openCite();
    return;
  }

  const newsArchiveLink = event.target.closest('a[href="/news/archive"]');
  if (newsArchiveLink) {
    event.preventDefault();
    openNewsArchive();
    return;
  }

  const newsLink = event.target.closest('a[href="/news"]');
  if (newsLink) {
    event.preventDefault();
    openNews();
    return;
  }

  const viewBrowserBtn = event.target.closest("[data-view-browser]");
  if (viewBrowserBtn) {
    event.preventDefault();
    if (state.activeGene) viewInBrowser(state.activeGene);
    return;
  }

  const toolsIndexLink = event.target.closest('a[href="/tools"]');
  if (toolsIndexLink) {
    event.preventDefault();
    openToolsIndex();
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

  const hrefButton = event.target.closest(".suggestion[data-href]");
  if (hrefButton) {
    event.preventDefault();
    suggestions.innerHTML = "";
    if (input) input.value = "";
    const href = hrefButton.dataset.href;
    if (/^https?:/.test(href)) { window.open(href, "_blank", "noopener"); }
    else { history.pushState(null, "", href); hydrateFromRoute(); }
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

  const layerPill = event.target.closest("[data-layer]");
  if (layerPill) {
    toggleCurationLayer(layerPill.dataset.layer);
    paintGOTab();
    return;
  }

  const goRef = event.target.closest("[data-go-ref]");
  if (goRef) {
    event.preventDefault();
    openGOTerm(goRef.dataset.goRef);
    return;
  }
});

// Standard ARIA tabs keyboard pattern for the gene-record tab strip:
// Left/Right (and Home/End) move focus between tabs and activate the focused
// tab; Enter/Space activate the focused tab. Activation reuses switchTab so the
// existing lazy-load-on-open behavior is preserved.
recordShell.addEventListener("keydown", (event) => {
  const tab = event.target.closest('[role="tab"][data-tab]');
  if (!tab || !state.activeGene) return;
  const tabsList = Array.from(recordShell.querySelectorAll('[role="tab"][data-tab]'));
  const current = tabsList.indexOf(tab);
  let nextIndex = -1;
  switch (event.key) {
    case "ArrowRight":
    case "ArrowDown":
      nextIndex = (current + 1) % tabsList.length;
      break;
    case "ArrowLeft":
    case "ArrowUp":
      nextIndex = (current - 1 + tabsList.length) % tabsList.length;
      break;
    case "Home":
      nextIndex = 0;
      break;
    case "End":
      nextIndex = tabsList.length - 1;
      break;
    case "Enter":
    case " ":
      event.preventDefault();
      switchTab(tab.dataset.tab);
      setRoute(state.activeGene, state.activeTab);
      return;
    default:
      return;
  }
  event.preventDefault();
  const target = tabsList[nextIndex];
  if (!target) return;
  // Activate on focus (standard automatic-activation tabs pattern).
  switchTab(target.dataset.tab);
  setRoute(state.activeGene, state.activeTab);
  // switchTab rewrites tabindex; re-query and focus the now-active tab.
  recordShell.querySelector(`[role="tab"][data-tab="${target.dataset.tab}"]`)?.focus();
});

window.addEventListener("popstate", hydrateFromRoute);

// A proper not-found view (instead of silently showing the home page) for an
// unknown route or an unresolvable /gene/<token>. Offers a search box + the main
// destinations so a dead link is recoverable.
function renderNotFoundPage(opts) {
  const isGene = (opts && opts.kind) === "gene";
  const tok = (opts && opts.token) || window.location.pathname;
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">404</p>
        <h2>${isGene ? "Gene not found" : "Page not found"}</h2>
        <p>${isGene
          ? `No gene matching <strong>${escapeHtml(tok)}</strong> is in the catalog. It may be an outdated name — try a search, or the advanced finder.`
          : `<strong>${escapeHtml(tok)}</strong> isn’t a page on this site. Try a search or one of these:`}</p>
      </div></header>
      <div class="record-body">
        <form data-nf-search style="display:flex;gap:8px;flex-wrap:wrap;margin:0 0 16px">
          <input name="q" placeholder="Search genes (e.g. cln5, mhcA, rasG)" aria-label="Search genes" style="flex:1;min-width:240px;${FIELD}">
          <button type="submit" class="button primary">Search</button>
        </form>
        <ul class="list">
          <li><strong><a class="text-link" href="/">Home</a></strong><span>Gene search and overview</span></li>
          <li><strong><a class="text-link" href="/search/advanced">Advanced gene finder</a></strong><span>Filter the catalog by phenotype, ortholog, disease, expression</span></li>
          <li><strong><a class="text-link" href="/tools/blast">BLAST</a></strong><span>Search by sequence</span></li>
          <li><strong><a class="text-link" href="/start">Start here</a></strong><span>New to <em>Dictyostelium</em>?</span></li>
        </ul>
      </div>
    </article>`;
}

function showNotFound(opts) {
  hideContentSections();
  if (!toolsShell) return;
  toolsShell.innerHTML = renderNotFoundPage(opts);
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  const form = toolsShell.querySelector("[data-nf-search]");
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const q = (form.querySelector("input").value || "").trim();
    if (!q) return;
    history.pushState(null, "", `/search?q=${encodeURIComponent(q)}`);
    hydrateFromRoute();
  });
}

function hydrateFromRoute() {
  showHomeChrome(true);  // default; the branch openers below flip it off for non-home views
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
  // Non-curated gene reached by direct URL (e.g. a /gene/<sym> link from search
  // results or a crawler): findGeneByToken only covers the curated set, so fall
  // back to the full catalog and open via NCBI. Wait for geneIndex if it's still
  // loading (initial hydration can run before the catalog fetch resolves).
  if (isGeneRoute) {
    const tok = normalize(decodeURIComponent(pathParts[1] || ""));
    const fromCatalog = () => {
      const entry = geneIndex.find((g) =>
        normalize(g.id) === tok || normalize(g.symbol) === tok || normalize(g.ncbiGene) === tok);
      if (entry) { input.value = entry.symbol; navigateToGene(entry); return true; }
      return false;
    };
    if (geneIndex.length) {
      if (fromCatalog()) return;
      showNotFound({ kind: "gene", token: decodeURIComponent(pathParts[1] || "") });
      return;
    } else {
      (async () => {
        for (let i = 0; i < 50 && !geneIndex.length; i++) await new Promise((r) => setTimeout(r, 100));
        if (!fromCatalog()) showNotFound({ kind: "gene", token: decodeURIComponent(pathParts[1] || "") });
      })();
      return;
    }
  }
  if (isTechniqueRoute) {
    openTechnique(findTechniqueByToken(pathParts[2]), false);
    return;
  }
  if (isResearchRoute) {
    openResearch(findResearchByToken(pathParts[1]), false);
    return;
  }
  if (isToolRoute && ["genome-browser", "blast", "proteomics", "heatstress", "downloads", "enrichment", "api", "lab", "expression", "basket", "convert", "sequence", "geneset", "stats"].includes(pathParts[1])) {
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
  if (pathParts[0] === "education") {
    openEducation(false);
    return;
  }
  if (pathParts[0] === "start") {
    openStart(false);
    return;
  }
  if (pathParts[0] === "research-areas") {
    openResearchAreas(false);
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
  if (pathParts[0] === "stock-center") {
    openStockCenter(false);
    return;
  }
  if (pathParts[0] === "cite") {
    openCite(false);
    return;
  }
  if (pathParts[0] === "news") {
    if (pathParts[1] === "archive") openNewsArchive(false);
    else openNews(false);
    return;
  }
  if (pathParts[0] === "tools" && !pathParts[1]) {
    openToolsIndex(false);
    return;
  }
  if (pathParts[0] === "search" && pathParts[1] === "advanced") {
    openAdvancedFinder(false);
    return;
  }
  if (pathParts[0] === "search" && SEARCH_PAGE_MODES.some((m) => m.key === pathParts[1])) {
    openSearchPage(pathParts[1], false);
    return;
  }
  if (isSearchRoute) {
    input.value = params.get("q") || "";
    renderSuggestions(input.value);
    return;
  }
  // Nothing matched: home for "/", a real 404 for any other unknown path.
  if (pathParts.length) {
    showNotFound({ kind: "page", token: window.location.pathname });
  }
}

// Take over scroll handling so the browser's default "restore to top" on a
// fresh load doesn't fight the scroll-to-section that hydrateFromRoute kicks
// off for deep links (/gene, /go, /strain, /data, …).
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

// --- Hero video: a YouTube clip cued to a segment, muted + autoplay + looped.
// ToS-compliant embed (no rehosting), on the privacy-enhanced youtube-nocookie
// host. Honors prefers-reduced-motion by falling back to a static thumbnail. ---
let heroPlayer = null;
function initHeroVideo() {
  const wrap = document.querySelector("[data-yt-hero]");
  const mount = document.getElementById("hero-yt");
  if (!wrap || !mount) return;
  const id = wrap.dataset.ytId;
  const start = parseInt(wrap.dataset.ytStart, 10) || 0;
  const end = parseInt(wrap.dataset.ytEnd, 10) || 0;
  // Reduced-motion users get a static thumbnail that links to YouTube instead.
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    mount.outerHTML = `<a class="hero-video-fallback" href="https://youtu.be/${id}?t=${start}" target="_blank" rel="noopener">`
      + `<img src="https://i.ytimg.com/vi/${id}/hqdefault.jpg" alt="Dictyostelium development film — play on YouTube"></a>`;
    return;
  }
  const make = () => {
    heroPlayer = new YT.Player("hero-yt", {
      videoId: id,
      host: "https://www.youtube-nocookie.com",
      playerVars: {
        autoplay: 1, mute: 1, controls: 0, start: start, end: end,
        modestbranding: 1, playsinline: 1, rel: 0, disablekb: 1, fs: 0, iv_load_policy: 3,
      },
      events: {
        onReady: (e) => {
          e.target.mute();
          e.target.seekTo(start);
          e.target.playVideo();
          // The end param stops playback but doesn't reliably loop a segment, so
          // poll and seek back to the start when we pass the end.
          setInterval(() => {
            try { if (end && e.target.getCurrentTime() >= end) e.target.seekTo(start); } catch { /* not ready */ }
          }, 500);
        },
        onStateChange: (e) => {
          if (e.data === YT.PlayerState.ENDED) { e.target.seekTo(start); e.target.playVideo(); }
        },
      },
    });
  };
  if (window.YT && window.YT.Player) { make(); return; }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (typeof prev === "function") prev(); make(); };
  if (!document.querySelector('script[src*="iframe_api"]')) {
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  }
}

// Home-only chrome: the hero (with quick search + video) and the news/papers
// feeds show only on the home view, not on gene/tool/community/etc. pages.
let isHomeView = true;
function showHomeChrome(show) {
  isHomeView = show;
  const hero = document.getElementById("search");
  if (hero) hero.hidden = !show;
  const caps = document.getElementById("capabilities");
  if (caps) caps.hidden = !show;
  const startBanner = document.getElementById("start-banner");
  if (startBanner) startBanner.hidden = !show;
  ["news-feed", "papers-feed"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = !(show && el.children.length > 0);
  });
}

const NEWS_TAG_COLORS = { new: "#00539b", data: "#012169", update: "#5b6678", community: "#8a5b16" };
async function loadNews() {
  const el = document.getElementById("news-feed");
  if (!el) return;
  let data;
  try {
    const r = await fetch("/assets/news.json");
    data = r.ok ? await r.json() : null;
  } catch { return; }
  const items = (data && data.items) || [];
  if (!items.length) { el.setAttribute("hidden", ""); return; }
  el.hidden = !isHomeView;
  el.innerHTML = `
    <div class="news-head"><p class="eyebrow">dictyBase</p><h2><a class="text-link news-all-link" href="/news">News &amp; updates</a></h2></div>
    <div class="news-list">
      ${items.slice(0, 3).map(newsItemHTML).join("")}
    </div>
    <p style="margin-top:12px"><a class="text-link" href="/news">See all news &amp; updates →</a></p>`;
}

function newsItemHTML(it) {
  const color = NEWS_TAG_COLORS[it.tag] || "#5b6678";
  const title = it.link
    ? `<a class="text-link" href="${escapeHtml(it.link)}">${escapeHtml(it.title)}</a>`
    : escapeHtml(it.title);
  return `<article class="news-item">
    <div class="news-meta"><span class="news-date">${escapeHtml(it.date || "")}</span>${it.tag ? `<span class="news-tag" style="background:${color}">${escapeHtml(it.tag)}</span>` : ""}</div>
    <h3>${title}</h3>
    <p>${escapeHtml(it.body || "")}</p>
    ${it.paper ? `<p style="margin-top:6px"><a class="text-link" href="${escapeHtml(it.paper)}" target="_blank" rel="noopener">Read the paper ↗</a></p>` : ""}
  </article>`;
}

const TOOLS_INDEX = [
  ["Search & identifiers", [
    ["Gene ID converter", "/tools/convert", "Map symbols, DDB_G, UniProt, and NCBI ids in one table."],
    ["Advanced gene finder", "/search/advanced", "Filter the catalog by phenotype, ortholog, disease, or expression peak."],
  ]],
  ["Sequence & alignment", [
    ["Sequence tools", "/tools/sequence", "Region retrieval, in-silico PCR, and multiple sequence alignment."],
    ["BLAST", "/tools/blast", "Search a sequence against the dictyostelid genomes and isolates."],
  ]],
  ["Genome", [
    ["Genome browser", "/tools/genome-browser", "IGV across the sequenced genomes — load your own tracks too."],
    ["Downloads", "/tools/downloads", "Genome assemblies, annotations, and whole-database TSV tables."],
  ]],
  ["Expression & function", [
    ["Gene set analysis", "/tools/geneset", "Interpret a hit list — enrichment, disease overlap, expression peak, summary."],
    ["Compare expression", "/tools/expression", "Overlay developmental RNA-seq profiles of several genes."],
    ["GO / phenotype enrichment", "/tools/enrichment", "Over-representation analysis for a gene list."],
    ["Developmental proteome", "/tools/proteomics", "4,502 proteins across five life-cycle stages."],
    ["Insoluble proteome", "/tools/heatstress", "8,043 proteins — heat stress and development."],
  ]],
  ["Bench & workspace", [
    ["Lab tools", "/tools/lab", "CRISPR guides, qPCR primers, codon optimizer, restriction sites, ORFs."],
    ["Gene basket", "/tools/basket", "Collect genes and send the whole set to any tool."],
  ]],
  ["Developers", [
    ["REST API", "/tools/api", "JSON API over the same data the site uses."],
  ]],
];

function renderToolsIndex() {
  return `<article class="record-card research-card">
    <header class="record-header"><div class="record-title">
      <p class="eyebrow">Tools</p><h2>All tools</h2>
      <p>Everything you can do on dictyBase, in one place.</p>
    </div></header>
    <div class="record-body">
      ${TOOLS_INDEX.map(([group, items]) => `
        <h3 style="margin:18px 0 10px;padding-bottom:6px;border-bottom:2px solid var(--line,#d7dee0)">${group}</h3>
        <div class="source-links" aria-label="${escapeHtml(group)} tools">
          ${items.map(([label, href, desc]) => `<a class="source-link" href="${href}"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(desc)}</span></a>`).join("")}
        </div>`).join("")}
    </div></article>`;
}

function openToolsIndex(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/tools");
  if (!toolsShell) return;
  toolsShell.innerHTML = renderToolsIndex();
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
}

function openNews(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/news");
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">dictyBase</p>
        <h2>News &amp; updates</h2>
        <p>The latest site announcements and data updates. <a class="text-link" href="/news.xml" target="_blank" rel="noopener">Subscribe (RSS) ↗</a></p>
      </div></header>
      <div class="record-body">
        <div class="news-list" data-news-all><p class="notice muted"><span class="spinner" aria-hidden="true"></span>Loading…</p></div>
        <p style="margin-top:16px;border-top:1px solid var(--line,#d7dee0);padding-top:12px"><a class="text-link" href="/news/archive">Older posts — browse the full news archive →</a></p>
      </div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadNewsInto("[data-news-all]", "/assets/news.json");
}

function openNewsArchive(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/news/archive");
  if (!toolsShell) return;
  toolsShell.innerHTML = `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">dictyBase</p>
        <h2>News archive</h2>
        <p>Every post ever made, newest first. <a class="text-link" href="/news.xml" target="_blank" rel="noopener">Subscribe (RSS) ↗</a></p>
      </div></header>
      <div class="record-body">
        <div class="news-list" data-news-all><p class="notice muted"><span class="spinner" aria-hidden="true"></span>Loading…</p></div>
        <p style="margin-top:16px"><a class="text-link" href="/news">← Back to the latest news</a></p>
      </div>
    </article>`;
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  loadNewsInto("[data-news-all]", "/assets/news_archive.json");
}

async function loadNewsInto(sel, url) {
  const el = document.querySelector(sel);
  if (!el) return;
  try {
    const r = await fetch(url);
    const data = r.ok ? await r.json() : null;
    const items = (data && data.items) || [];
    el.innerHTML = items.length ? items.map(newsItemHTML).join("") : `<p class="notice muted">No news yet.</p>`;
  } catch { el.innerHTML = `<p class="notice">Could not load news right now.</p>`; }
}

async function loadRecentPapers() {
  const el = document.getElementById("papers-feed");
  if (!el) return;
  let data;
  try {
    const r = await fetch("/api/recent-papers");
    data = r.ok ? await r.json() : null;
  } catch { return; }
  const papers = (data && data.papers) || [];
  if (!papers.length) { el.setAttribute("hidden", ""); return; }
  el.hidden = !isHomeView;
  el.innerHTML = `
    <div class="news-head"><p class="eyebrow">From PubMed · refreshed daily</p><h2>Recent <em>Dictyostelium</em> papers</h2></div>
    <ol class="papers-list">
      ${papers.map((p) => {
        const authors = p.authors && p.authors.length
          ? escapeHtml(p.authors.slice(0, 3).join(", ")) + (p.authors.length > 3 ? " et al." : "")
          : "";
        return `<li class="paper-item">
          <a class="text-link paper-title" href="${escapeHtml(p.url)}" target="_blank" rel="noopener">${escapeHtml(p.title)}</a>
          <div class="paper-meta">${authors}${authors && (p.journal || p.pubdate) ? " · " : ""}<em>${escapeHtml(p.journal || "")}</em>${p.pubdate ? " · " + escapeHtml(p.pubdate) : ""}</div>
        </li>`;
      }).join("")}
    </ol>
    <p style="font-size:0.72rem;color:var(--muted,#6b7280);margin:8px 0 0">Newest PubMed results for “Dictyostelium”. Source: <a class="text-link" href="https://pubmed.ncbi.nlm.nih.gov/?term=Dictyostelium&sort=date" target="_blank" rel="noopener">PubMed (NCBI)</a>.</p>`;
}

// Shared: open a gene from a catalog-index entry ({id, symbol, name, ncbiGene}).
// Used by the command palette, the gene basket, and the advanced finder.
function navigateToGene(entry) {
  if (!entry) return;
  const sym = normalizeQuery(entry.symbol || "");
  const curated = genes.find((x) => x.id === entry.id || (sym && normalizeQuery(x.symbol) === sym));
  if (curated) { openGene(curated); return; }
  if (entry.ncbiGene) { openRemoteGene(entry.ncbiGene); return; }
  const m = findGeneByToken(entry.symbol || entry.id);
  if (m) openGene(m);
}

// ---- Command palette (⌘K / Ctrl-K): quick-jump to any gene, page, or tool ----
const CMDK_TARGETS = [
  { kind: "Page", label: "Home", href: "/", kw: "home start" },
  { kind: "Tool", label: "My gene basket", href: "/tools/basket", sub: "Collected genes — enrichment, compare & export", kw: "basket workspace cart list saved collection" },
  { kind: "Search", label: "Advanced gene finder", href: "/search/advanced", sub: "Filter genes by phenotype, disease, expression", kw: "filter facet find advanced browse" },
  { kind: "Search", label: "General search", href: "/search/general", kw: "search find" },
  { kind: "Search", label: "Phenotype search", href: "/search/phenotype", kw: "phenotype mutant" },
  { kind: "Search", label: "GO term search", href: "/search/go", kw: "gene ontology go term" },
  { kind: "Search", label: "Localization search", href: "/search/localization", kw: "localization subcellular location" },
  { kind: "Tool", label: "Genome browser", href: "/tools/genome-browser", kw: "igv browser genome tracks" },
  { kind: "Tool", label: "BLAST sequence search", href: "/tools/blast", kw: "blast sequence align" },
  { kind: "Tool", label: "GO enrichment", href: "/tools/enrichment", kw: "enrichment go phenotype kegg overrepresented" },
  { kind: "Tool", label: "Gene set analysis", href: "/tools/geneset", sub: "Interpret a hit list: enrichment, disease, expression", kw: "gene set analysis deg hit list omics rnaseq proteomics interpret report enrichment" },
  { kind: "Tool", label: "Compare expression", href: "/tools/expression", kw: "expression rna-seq chart compare profile" },
  { kind: "Tool", label: "Lab tools", href: "/tools/lab", sub: "CRISPR guides, qPCR primers, codon optimizer", kw: "crispr primer codon lab bench design" },
  { kind: "Tool", label: "Gene ID converter", href: "/tools/convert", sub: "Symbol ↔ DDB_G ↔ UniProt ↔ NCBI", kw: "convert id mapping symbol ddb uniprot ncbi validate batch" },
  { kind: "Tool", label: "Sequence tools", href: "/tools/sequence", sub: "Region retrieval, in-silico PCR, alignment", kw: "sequence region coordinates in-silico pcr amplicon primer alignment msa align" },
  { kind: "Page", label: "All tools", href: "/tools", sub: "Browse every analysis tool", kw: "tools index all tools overview list" },
  { kind: "Tool", label: "REST API docs", href: "/tools/api", kw: "api rest json endpoint" },
  { kind: "Tool", label: "Download genomes", href: "/tools/downloads", kw: "download fasta gff genomes assembly" },
  { kind: "Tool", label: "Developmental proteome viewer", href: "/tools/proteomics", kw: "proteome protein development" },
  { kind: "Tool", label: "Insoluble proteome viewer", href: "/tools/heatstress", kw: "proteome heat stress insoluble" },
  { kind: "Learn", label: "Start here — new to Dictyostelium", href: "/start", sub: "Why Dicty, getting started, and FAQ", kw: "start here new beginner why dictyostelium getting started faq introduction onboarding model organism" },
  { kind: "Learn", label: "Research areas — is Dicty right for my question?", href: "/research-areas", sub: "Fields Dicty excels in, with marker genes & protocols", kw: "research areas fields chemotaxis development autophagy phagocytosis host pathogen cytokinesis cytoskeleton disease models marker genes is dicty right for my question topics" },
  { kind: "Learn", label: "Learn Dictyostelium", href: "/education", sub: "Life cycle, glossary, quiz, teaching figures", kw: "education learn teach students life cycle quiz glossary figures" },
  { kind: "Learn", label: "Teaching labs", href: "/research/teaching-labs", kw: "teaching lab classroom protocol undergraduate" },
  { kind: "Research", label: "Techniques", href: "/research/techniques", kw: "methods techniques transformation imaging" },
  { kind: "Research", label: "Nomenclature guidelines", href: "/research/nomenclature-guidelines", kw: "naming nomenclature gene strain" },
  { kind: "Research", label: "Anatomy ontology", href: "/research/anatomy-ontology", kw: "anatomy ontology structures" },
  { kind: "Community", label: "Research labs", href: "/community/labs", kw: "labs community groups" },
  { kind: "Community", label: "Community curation", href: "/community/annotations", sub: "Contribute annotations for curator review", kw: "community curation annotate annotation contribute submit gene curate expert canto" },
  { kind: "Community", label: "Meetings & events", href: "/community/meetings", kw: "meetings conference events dicty conference workshop symposium" },
  { kind: "Community", label: "Upload data", href: "/community/upload-data", kw: "upload submit data genome rnaseq proteomic dataset deposit" },
  { kind: "Research", label: "Disease models", href: "/community/disease-models", kw: "disease human ortholog model" },
  { kind: "Community", label: "Award recipients", href: "/community/award-recipients", kw: "award recipients" },
  { kind: "Community", label: "Dicty Stock Center", href: "/stock-center", sub: "Order strains & plasmids", kw: "stock center strains plasmids order reagents" },
  { kind: "Page", label: "Data & provenance", href: "/data", kw: "data provenance sources downloads" },
  { kind: "Page", label: "News & updates", href: "/news", kw: "news updates announcements changelog history releases" },
  { kind: "Page", label: "How to cite", href: "/cite", kw: "cite citation doi bibtex reference how to cite release version" },
];

const cmdk = { root: null, input: null, list: null, items: [], active: 0, open: false };

function cmdkIsTyping(el) {
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);
}

function cmdkInit() {
  cmdk.root = document.getElementById("cmdk");
  cmdk.input = document.getElementById("cmdk-input");
  cmdk.list = document.getElementById("cmdk-results");
  if (!cmdk.root || !cmdk.input || !cmdk.list) return;
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K")) { e.preventDefault(); cmdkToggle(); return; }
    if (e.key === "/" && !cmdk.open && !cmdkIsTyping(e.target)) { e.preventDefault(); cmdkOpen(); return; }
    // Escape closes an open nav dropdown and returns focus to its trigger.
    if (e.key === "Escape" && !cmdk.open) {
      const openItem = document.querySelector(".nav-item.open");
      if (openItem) {
        e.preventDefault();
        openItem.classList.remove("open");
        const trig = openItem.querySelector(".nav-trigger");
        trig?.setAttribute("aria-expanded", "false");
        trig?.focus();
        return;
      }
    }
    if (!cmdk.open) return;
    if (e.key === "Escape") { e.preventDefault(); cmdkClose(); }
    else if (e.key === "ArrowDown") { e.preventDefault(); cmdkMove(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); cmdkMove(-1); }
    else if (e.key === "Enter") { e.preventDefault(); cmdkActivate(cmdk.active); }
  });
  cmdk.input.addEventListener("input", () => cmdkRender(cmdk.input.value));
  cmdk.list.addEventListener("mousemove", (e) => {
    const li = e.target.closest("[data-idx]"); if (!li) return;
    const i = +li.dataset.idx;
    if (i !== cmdk.active) { cmdk.active = i; cmdkPaintActive(); }
  });
  cmdk.list.addEventListener("click", (e) => {
    const li = e.target.closest("[data-idx]"); if (li) cmdkActivate(+li.dataset.idx);
  });
  cmdk.root.querySelector("[data-cmdk-close]")?.addEventListener("click", cmdkClose);
}

function cmdkToggle() { cmdk.open ? cmdkClose() : cmdkOpen(); }
function cmdkOpen() {
  if (!cmdk.root) return;
  cmdk.returnFocus = document.activeElement;  // restore on close (a11y)
  cmdk.open = true;
  cmdk.root.removeAttribute("hidden");
  document.body.classList.add("cmdk-active");
  cmdk.input.value = "";
  cmdkRender("");
  setTimeout(() => cmdk.input.focus(), 0);
}
function cmdkClose() {
  if (!cmdk.root) return;
  cmdk.open = false;
  cmdk.root.setAttribute("hidden", "");
  document.body.classList.remove("cmdk-active");
  // Return focus to wherever it was before the palette opened.
  const ret = cmdk.returnFocus;
  cmdk.returnFocus = null;
  if (ret && typeof ret.focus === "function" && document.contains(ret)) ret.focus();
}

function cmdkBuild(query) {
  const q = (query || "").trim();
  const items = [];
  if (!q) {
    loadRecentGenes().forEach((symbol) => {
      const g = geneIndex.find((x) => x.symbol.toLowerCase() === symbol.toLowerCase());
      if (g) items.push({ kind: "Gene", label: g.symbol, sub: g.name, gene: g });
    });
    CMDK_TARGETS.slice(0, 8).forEach((t) => items.push({ kind: t.kind, label: t.label, sub: t.sub || "", href: t.href }));
    return items;
  }
  const ql = q.toLowerCase();
  CMDK_TARGETS.forEach((t) => {
    if (t.label.toLowerCase().includes(ql) || (t.kw || "").includes(ql))
      items.push({ kind: t.kind, label: t.label, sub: t.sub || "", href: t.href });
  });
  searchIndex(q, 12).forEach((g) => items.push({ kind: "Gene", label: g.symbol, sub: g.name, gene: g }));
  return items.slice(0, 24);
}

function cmdkRender(query) {
  cmdk.items = cmdkBuild(query);
  cmdk.active = 0;
  if (!cmdk.items.length) {
    cmdk.list.innerHTML = `<li class="cmdk-empty">No matches${query ? ` for “${escapeHtml(query)}”` : ""}.</li>`;
    return;
  }
  cmdk.list.innerHTML = cmdk.items.map((it, i) => `
    <li class="cmdk-item${i === 0 ? " active" : ""}" role="option" data-idx="${i}" aria-selected="${i === 0}">
      <span class="cmdk-kind cmdk-kind-${it.kind.toLowerCase()}">${escapeHtml(it.kind)}</span>
      <span class="cmdk-label">${escapeHtml(it.label)}</span>
      ${it.sub ? `<span class="cmdk-sub">${escapeHtml(it.sub)}</span>` : ""}
    </li>`).join("");
}

function cmdkPaintActive() {
  [...cmdk.list.querySelectorAll(".cmdk-item")].forEach((li, i) => {
    const on = i === cmdk.active;
    li.classList.toggle("active", on);
    li.setAttribute("aria-selected", on ? "true" : "false");
    if (on) li.scrollIntoView({ block: "nearest" });
  });
}
function cmdkMove(d) {
  if (!cmdk.items.length) return;
  cmdk.active = (cmdk.active + d + cmdk.items.length) % cmdk.items.length;
  cmdkPaintActive();
}
function cmdkActivate(i) {
  const it = cmdk.items[i];
  if (!it) return;
  cmdkClose();
  if (it.gene) { navigateToGene(it.gene); return; }
  if (it.href) {
    if (/^https?:/.test(it.href)) { window.open(it.href, "_blank", "noopener"); return; }
    history.pushState(null, "", it.href);
    hydrateFromRoute();
  }
}

// ---- Gene hovercards: hover any /gene/ link to preview the gene ----
const hc = { el: null, link: null, showTimer: null, hideTimer: null, cache: new Map(), token: 0 };

function hovercardInit() {
  if (window.matchMedia && window.matchMedia("(hover: none)").matches) return; // touch devices
  hc.el = document.createElement("div");
  hc.el.className = "hovercard";
  hc.el.setAttribute("hidden", "");
  hc.el.addEventListener("mouseenter", () => clearTimeout(hc.hideTimer));
  hc.el.addEventListener("mouseleave", () => { hc.hideTimer = setTimeout(hovercardHide, 160); });
  document.body.appendChild(hc.el);

  document.addEventListener("mouseover", (e) => {
    const link = e.target.closest('a[href^="/gene/"]');
    if (!link) return;
    if (link === hc.link) { clearTimeout(hc.hideTimer); return; }
    hc.link = link;
    clearTimeout(hc.showTimer); clearTimeout(hc.hideTimer);
    hc.showTimer = setTimeout(() => hovercardShow(link), 280);
  });
  document.addEventListener("mouseout", (e) => {
    const link = e.target.closest('a[href^="/gene/"]');
    if (!link) return;
    const to = e.relatedTarget;
    if (to && (link.contains(to) || (hc.el && hc.el.contains(to)))) return;
    clearTimeout(hc.showTimer);
    hc.hideTimer = setTimeout(hovercardHide, 160);
  });
  window.addEventListener("scroll", hovercardHide, true);
}

function hovercardHide() {
  if (hc.el) hc.el.setAttribute("hidden", "");
  hc.link = null;
}

function hovercardSymbol(href) {
  const m = (href || "").match(/\/gene\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : "";
}

async function hovercardShow(link) {
  const sym = hovercardSymbol(link.getAttribute("href"));
  if (!sym) return;
  const myToken = ++hc.token;
  let data = hc.cache.get(sym.toLowerCase());
  if (!data) {
    try {
      const r = await fetch(`/api/gene-card?id=${encodeURIComponent(sym)}`);
      if (!r.ok) return;
      data = await r.json();
      hc.cache.set(sym.toLowerCase(), data);
    } catch { return; }
  }
  if (myToken !== hc.token || hc.link !== link) return; // pointer moved on
  hc.el.innerHTML = hovercardRender(data);
  hovercardPlace(link.getBoundingClientRect());
}

function hovercardRender(d) {
  const badges = [];
  if (d.phenotype) badges.push('<span class="hc-badge">phenotypes</span>');
  if (d.disease) badges.push('<span class="hc-badge hc-dis">disease link</span>');
  else if (d.ortholog) badges.push('<span class="hc-badge">human ortholog</span>');
  const human = d.human && d.human.length
    ? `<div class="hc-human">↔ human ${d.human.map(escapeHtml).join(", ")}</div>` : "";
  return `
    <div class="hc-head"><strong>${escapeHtml(d.symbol)}</strong>${d.name ? ` <span class="hc-name">${escapeHtml(d.name)}</span>` : ""}</div>
    ${d.summary ? `<p class="hc-summary">${escapeHtml(d.summary)}</p>` : '<p class="hc-summary hc-muted">No curated summary yet.</p>'}
    ${badges.length ? `<div class="hc-badges">${badges.join("")}</div>` : ""}
    ${human}`;
}

function hovercardPlace(rect) {
  const card = hc.el;
  card.style.visibility = "hidden";
  card.removeAttribute("hidden");
  const cw = card.offsetWidth, ch = card.offsetHeight, pad = 12;
  let left = Math.min(rect.left, window.innerWidth - cw - pad);
  if (left < pad) left = pad;
  let top = rect.bottom + 8;
  if (top + ch > window.innerHeight - pad) top = rect.top - ch - 8; // flip above
  if (top < pad) top = pad;
  card.style.left = `${left}px`;
  card.style.top = `${top}px`;
  card.style.visibility = "visible";
}

// ---- Gene basket / workspace (per-browser, localStorage) ----
const BASKET_KEY = "dictybase:basket";

function loadBasket() {
  try {
    const v = JSON.parse(localStorage.getItem(BASKET_KEY) || "[]");
    return Array.isArray(v) ? v.filter((e) => e && (e.ddb || e.symbol)) : [];
  } catch { return []; }
}
function saveBasket(list) {
  try { localStorage.setItem(BASKET_KEY, JSON.stringify(list)); } catch { /* private mode */ }
  updateBasketCount();
}
function basketKey(e) { return String((e && (e.ddb || e.symbol)) || "").toLowerCase(); }
function basketHas(ddb, symbol) {
  const a = String(ddb || "").toLowerCase(), b = String(symbol || "").toLowerCase();
  return loadBasket().some((e) => {
    const ed = String(e.ddb || "").toLowerCase(), es = String(e.symbol || "").toLowerCase();
    return (a && (ed === a || es === a)) || (b && (ed === b || es === b));
  });
}
function basketAdd(entry) {
  if (!entry || (!entry.ddb && !entry.symbol)) return;
  const list = loadBasket();
  if (list.some((e) => basketKey(e) === basketKey(entry))) return;
  list.push({ ddb: entry.ddb || "", symbol: entry.symbol || "", name: entry.name || "", ncbiGene: entry.ncbiGene || "" });
  saveBasket(list);
}
function basketRemove(key) {
  saveBasket(loadBasket().filter((e) => basketKey(e) !== String(key).toLowerCase()));
}
function basketClear() { saveBasket([]); }

function updateBasketCount() {
  const n = loadBasket().length;
  document.querySelectorAll("[data-basket-count]").forEach((el) => { el.textContent = n; el.hidden = n === 0; });
  const tgl = document.querySelector("[data-basket-toggle]");
  if (tgl && state.activeGene) {
    const inB = basketHas(state.activeGene.veupath, state.activeGene.symbol);
    tgl.classList.toggle("in", inB);
    const lbl = tgl.querySelector(".bt-label"); if (lbl) lbl.textContent = inB ? "In basket" : "Add to basket";
    const ic = tgl.querySelector(".bt-icon"); if (ic) ic.textContent = inB ? "✓" : "＋";
  }
  if (document.querySelector("[data-basket-list]")) renderBasketList();
}

function basketToggleButtonHTML(gene) {
  const inB = basketHas(gene.veupath, gene.symbol);
  return `<button type="button" class="basket-toggle${inB ? " in" : ""}" data-basket-toggle
      data-ddb="${escapeHtml(gene.veupath || "")}" data-symbol="${escapeHtml(gene.symbol || "")}"
      data-name="${escapeHtml(gene.name || "")}" data-ncbi="${escapeHtml(gene.ncbiGene || "")}">
      <span class="bt-icon" aria-hidden="true">${inB ? "✓" : "＋"}</span> <span class="bt-label">${inB ? "In basket" : "Add to basket"}</span>
    </button>`;
}

function renderBasketPage() {
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Workspace</p>
        <h2>My gene basket</h2>
        <p>Collect genes as you browse, then analyze or export them as a set. Stored in this browser only — nothing is uploaded.</p>
      </div></header>
      <div class="record-body">
        <div class="basket-toolbar">
          <button type="button" class="button primary" data-basket-action="go">GO enrichment →</button>
          <button type="button" class="button primary" data-basket-action="phenotype">Phenotype enrichment →</button>
          <button type="button" class="button" data-basket-action="expression">Compare expression →</button>
          <button type="button" class="button" data-basket-action="csv">Export CSV</button>
          <button type="button" class="button" data-basket-action="fasta">Export protein FASTA</button>
          <button type="button" class="button" data-basket-action="share">Copy share link</button>
          <button type="button" class="ghost-btn" data-basket-action="clear">Clear</button>
        </div>
        <div data-basket-results style="margin:12px 0"></div>
        <div data-basket-list></div>
      </div>
    </article>`;
}

function renderBasketList() {
  const el = document.querySelector("[data-basket-list]");
  if (!el) return;
  const list = loadBasket();
  if (!list.length) {
    el.innerHTML = `<div class="basket-empty">
      <p><strong>Your basket is empty.</strong></p>
      <p class="muted">Add genes from any gene record with the <em>Add to basket</em> button, or from the
      <a class="text-link" href="/search/advanced">advanced gene finder</a>. Press <kbd>⌘K</kbd> to jump to a gene quickly.</p>
    </div>`;
    return;
  }
  el.innerHTML = `
    <div style="overflow-x:auto">
    <table class="basket-table">
      <thead><tr><th>Gene</th><th>Name</th><th>DDB_G</th><th aria-label="Remove"></th></tr></thead>
      <tbody>
        ${list.map((e) => `<tr>
          <td><a class="text-link" href="/gene/${encodeURIComponent(e.symbol || e.ddb)}">${escapeHtml(e.symbol || e.ddb)}</a></td>
          <td>${escapeHtml(e.name || "")}</td>
          <td class="mono">${escapeHtml(e.ddb || "")}</td>
          <td><button type="button" class="basket-x" data-basket-remove="${escapeHtml(basketKey(e))}" aria-label="Remove ${escapeHtml(e.symbol || e.ddb)} from basket" title="Remove from basket">✕</button></td>
        </tr>`).join("")}
      </tbody>
    </table></div>
    <p class="muted" style="font-size:12px;margin:10px 0 0">${list.length} gene${list.length === 1 ? "" : "s"} in basket.</p>`;
}

// Resolve a share-link token (a DDB_G id or a gene symbol) to a basket entry,
// using the loaded catalog for the name/symbol/ncbi fields where possible.
function resolveBasketToken(tok) {
  const t = String(tok || "").trim();
  if (!t) return null;
  const lc = t.toLowerCase();
  const g = geneIndex.find((x) => x.id.toLowerCase() === lc || (x.symbol || "").toLowerCase() === lc);
  if (g) return { ddb: g.id, symbol: g.symbol || "", name: g.name || "", ncbiGene: g.ncbiGene || "" };
  if (/^DDB_G\d+$/i.test(t)) return { ddb: t.toUpperCase(), symbol: "", name: "", ncbiGene: "" };
  return { ddb: "", symbol: t, name: "", ncbiGene: "" };
}

// Build a shareable URL that re-creates this basket on another machine, and copy
// it to the clipboard. Genes are encoded as DDB_G ids (or symbols) — compact and
// resolvable; no server state needed.
function basketShare(list, results) {
  const ids = list.map((e) => e.ddb || e.symbol).filter(Boolean);
  const url = `${location.origin}/tools/basket?genes=${encodeURIComponent(ids.join(","))}`;
  const show = (msg) => { if (results) results.innerHTML = `<p class="notice">${msg}</p>`; };
  const ok = `Share link copied — ${ids.length} gene${ids.length === 1 ? "" : "s"}. Anyone who opens it gets this set added to their basket.<br><input readonly value="${escapeHtml(url)}" onclick="this.select()" style="width:100%;margin-top:6px;font-size:.8125rem;padding:6px 8px;border:1px solid var(--line,#d7dee0);border-radius:6px">`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(() => show(ok), () => show(ok));
  } else {
    show(ok);
  }
}

// Load a shared gene set from ?genes= into the basket (merging, deduped), then
// strip the param so a refresh doesn't re-trigger. Waits for the catalog so the
// tokens resolve to names.
async function loadSharedBasket() {
  const param = new URLSearchParams(location.search).get("genes");
  if (!param) return 0;
  for (let i = 0; i < 30 && !geneIndex.length; i++) await new Promise((r) => setTimeout(r, 100));
  const tokens = param.split(",").map((s) => s.trim()).filter(Boolean);
  let added = 0;
  for (const tok of tokens) {
    const entry = resolveBasketToken(tok);
    if (entry && (entry.ddb || entry.symbol) && !basketHas(entry.ddb, entry.symbol)) { basketAdd(entry); added++; }
  }
  try { history.replaceState({}, "", "/tools/basket"); } catch { /* ignore */ }
  return { added, total: tokens.length };
}

async function initBasket() {
  const r = await loadSharedBasket();
  renderBasketList();
  if (r && r.total) {
    const results = document.querySelector("[data-basket-results]");
    if (results) results.innerHTML = `<p class="notice">Loaded ${r.added} gene${r.added === 1 ? "" : "s"} from a shared link${r.added < r.total ? ` (${r.total - r.added} already in your basket)` : ""}.</p>`;
  }
}

function basketDownload(text, filename, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type || "text/plain" }));
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function basketExportCSV(list) {
  const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
  const rows = list.map((e) => [e.symbol, e.ddb, e.name, e.ncbiGene].map(esc).join(","));
  basketDownload("symbol,ddb_g,name,ncbi_gene\n" + rows.join("\n") + "\n", "dicty-gene-basket.csv", "text/csv");
}

async function basketExportFasta(list, results) {
  const withDdb = list.filter((e) => e.ddb);
  if (!withDdb.length) { if (results) results.innerHTML = `<p class="notice">None of these genes have a DDB_G id for sequence export.</p>`; return; }
  if (results) results.innerHTML = `<p class="notice muted">Fetching ${withDdb.length} protein sequence${withDdb.length === 1 ? "" : "s"}…</p>`;
  const parts = [];
  for (const e of withDdb) {
    try {
      const r = await fetch(`/api/sequence?ddb=${encodeURIComponent(e.ddb)}&type=protein&symbol=${encodeURIComponent(e.symbol || e.ddb)}`);
      if (r.ok) { const t = (await r.text()).trim(); if (t) parts.push(t); }
    } catch { /* skip this gene */ }
  }
  if (!parts.length) { if (results) results.innerHTML = `<p class="notice">No sequences could be retrieved.</p>`; return; }
  basketDownload(parts.join("\n") + "\n", "dicty-gene-basket.protein.fasta", "text/plain");
  if (results) results.innerHTML = `<p class="notice muted">Downloaded ${parts.length} protein sequence${parts.length === 1 ? "" : "s"} as FASTA.</p>`;
}

function basketAction(kind) {
  const list = loadBasket();
  const results = document.querySelector("[data-basket-results]");
  if (kind === "clear") {
    if (list.length && confirm("Remove all genes from the basket?")) basketClear();
    return;
  }
  if (!list.length) { if (results) results.innerHTML = `<p class="notice muted">Add some genes to the basket first.</p>`; return; }
  const symbols = list.map((e) => e.symbol || e.ddb).filter(Boolean);
  if (kind === "share") { basketShare(list, results); return; }
  if (kind === "csv") { basketExportCSV(list); return; }
  if (kind === "fasta") { basketExportFasta(list, results); return; }
  if (kind === "expression") {
    openTool("expression");
    setTimeout(() => {
      const inp = document.getElementById("expr-genes");
      if (inp) inp.value = symbols.slice(0, 12).join(" ");
      if (typeof runExpressionCompare === "function") runExpressionCompare();
    }, 80);
    return;
  }
  if (kind === "go" || kind === "phenotype") {
    openTool("enrichment");
    setTimeout(() => {
      const g = document.getElementById("enrich-genes"); if (g) g.value = symbols.join(" ");
      const s = document.getElementById("enrich-set"); if (s) s.value = kind === "phenotype" ? "phenotype" : "go";
      if (typeof runEnrichment === "function") runEnrichment();
    }, 80);
  }
}

function basketInit() {
  updateBasketCount();
  document.addEventListener("click", (e) => {
    const tgl = e.target.closest("[data-basket-toggle]");
    if (tgl) {
      const entry = { ddb: tgl.dataset.ddb, symbol: tgl.dataset.symbol, name: tgl.dataset.name, ncbiGene: tgl.dataset.ncbi };
      if (basketHas(entry.ddb, entry.symbol)) basketRemove(basketKey(entry)); else basketAdd(entry);
      return;
    }
    const add = e.target.closest("[data-basket-add]");
    if (add) {
      basketAdd({ ddb: add.dataset.ddb, symbol: add.dataset.symbol, name: add.dataset.name, ncbiGene: add.dataset.ncbi });
      add.classList.add("added");
      add.textContent = "✓";
      add.title = "In basket";
      return;
    }
    const rm = e.target.closest("[data-basket-remove]");
    if (rm) { basketRemove(rm.dataset.basketRemove); return; }
    const act = e.target.closest("[data-basket-action]");
    if (act) { basketAction(act.dataset.basketAction); return; }
    if (e.target.closest("#basket-btn")) { openTool("basket"); }
  });
}

// ---- Advanced gene finder: faceted filtering over the whole catalog ----
let FACETS = null;            // { ddb: [pheno, ortholog, disease, peakStage] }
let finderResults = [];       // current filtered list of { g, p, o, d, x }
const FINDER_STAGES = ["0 h · growth", "4 h", "8 h · aggregation", "12 h · mound", "16 h · slug", "20 h", "24 h · fruiting"];
const FINDER_MAX = 300;

function openAdvancedFinder(updateRoute = true) {
  hideContentSections();
  if (updateRoute) history.pushState(null, "", "/search/advanced");
  if (!toolsShell) return;
  toolsShell.innerHTML = renderAdvancedFinder();
  toolsShell.removeAttribute("hidden");
  scrollToY(toolsShell.offsetTop - 60);
  initAdvancedFinder();
}

function renderAdvancedFinder() {
  const total = geneIndex.length ? `${geneIndex.length.toLocaleString()} ` : "";
  return `
    <article class="record-card research-card">
      <header class="record-header"><div class="record-title">
        <p class="eyebrow">Search</p>
        <h2>Advanced gene finder</h2>
        <p>Filter the ${total}<em>D. discoideum</em> genes by what's known about them — curated phenotype, human ortholog, disease link, and developmental expression peak. Send hits to your <a class="text-link" href="/tools/basket">basket</a> or export them as CSV.</p>
      </div></header>
      <div class="record-body">
        <div class="finder-controls">
          <input id="finder-text" type="search" placeholder="Symbol or name contains… e.g. kinase, ras, myosin" aria-label="Symbol or name contains" style="${FIELD};min-width:240px;flex:1">
          <label class="finder-check"><input type="checkbox" id="finder-pheno"> Has mutant phenotype</label>
          <label class="finder-check"><input type="checkbox" id="finder-ortholog"> Has human ortholog</label>
          <label class="finder-check"><input type="checkbox" id="finder-disease"> Disease-linked</label>
          <label class="finder-peak">Expression peak
            <select id="finder-peak" style="${FIELD}">
              <option value="">Any</option>
              <option value="exp">Expressed (any stage)</option>
              ${FINDER_STAGES.map((s, i) => `<option value="${i}">${escapeHtml(s)}</option>`).join("")}
            </select>
          </label>
        </div>
        <div class="finder-actions">
          <button type="button" class="ghost-btn" id="finder-reset">Reset</button>
          <button type="button" class="button" id="finder-csv">Export results (CSV)</button>
          <button type="button" class="button" id="finder-basket">Add results to basket</button>
        </div>
        <div data-finder-results><p class="notice muted">Loading gene facets…</p></div>
      </div>
    </article>`;
}

async function initAdvancedFinder() {
  if (!FACETS) {
    try { FACETS = await (await fetch("/assets/gene_facets.json")).json(); }
    catch { FACETS = {}; }
  }
  for (let i = 0; i < 30 && !geneIndex.length; i++) await new Promise((r) => setTimeout(r, 100));
  ["finder-text", "finder-pheno", "finder-ortholog", "finder-disease", "finder-peak"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) { el.addEventListener("input", finderApply); el.addEventListener("change", finderApply); }
  });
  document.getElementById("finder-reset")?.addEventListener("click", () => {
    const t = document.getElementById("finder-text"); if (t) t.value = "";
    ["finder-pheno", "finder-ortholog", "finder-disease"].forEach((id) => { const e = document.getElementById(id); if (e) e.checked = false; });
    const pk = document.getElementById("finder-peak"); if (pk) pk.value = "";
    finderApply();
  });
  document.getElementById("finder-csv")?.addEventListener("click", finderExportCSV);
  document.getElementById("finder-basket")?.addEventListener("click", finderAddAll);
  finderApply();
}

function finderFilter() {
  const text = (document.getElementById("finder-text")?.value || "").trim().toLowerCase();
  const needPheno = document.getElementById("finder-pheno")?.checked;
  const needOrth = document.getElementById("finder-ortholog")?.checked;
  const needDis = document.getElementById("finder-disease")?.checked;
  const peakVal = document.getElementById("finder-peak")?.value || "";
  const peakNum = peakVal !== "" && peakVal !== "exp" ? parseInt(peakVal, 10) : null;
  const out = [];
  for (const g of geneIndex) {
    if (text && !(g.symbol.toLowerCase().includes(text) || (g.name || "").toLowerCase().includes(text))) continue;
    const f = FACETS[g.id];
    const p = f ? f[0] : 0, o = f ? f[1] : 0, d = f ? f[2] : 0, x = f ? f[3] : -1;
    if (needPheno && !p) continue;
    if (needOrth && !o) continue;
    if (needDis && !d) continue;
    if (peakVal === "exp" && x < 0) continue;
    if (peakNum !== null && x !== peakNum) continue;
    out.push({ g, p, o, d, x });
  }
  return out;
}

function finderApply() {
  const el = document.querySelector("[data-finder-results]");
  if (!el) return;
  if (!geneIndex.length) { el.innerHTML = `<p class="notice muted">Loading gene catalog…</p>`; return; }
  finderResults = finderFilter();
  const n = finderResults.length;
  if (!n) { el.innerHTML = `<p class="notice">No genes match these filters.</p>`; return; }
  const shown = finderResults.slice(0, FINDER_MAX);
  el.innerHTML = `
    <p class="finder-count">${n.toLocaleString()} gene${n === 1 ? "" : "s"} match${n === 1 ? "es" : ""}${n > FINDER_MAX ? ` — showing the first ${FINDER_MAX}` : ""}.</p>
    <div style="overflow-x:auto"><table class="finder-table">
      <thead><tr><th>Gene</th><th>Name</th><th>Known for</th><th>Expression peak</th><th aria-label="Add"></th></tr></thead>
      <tbody>
        ${shown.map(({ g, p, o, d, x }) => {
          const chips = [
            p ? '<span class="fchip">phenotype</span>' : "",
            d ? '<span class="fchip fchip-dis">disease</span>' : (o ? '<span class="fchip">ortholog</span>' : ""),
          ].join("");
          return `<tr>
            <td><a class="text-link" href="/gene/${encodeURIComponent(g.symbol)}">${escapeHtml(g.symbol)}</a></td>
            <td>${escapeHtml(g.name || "")}</td>
            <td>${chips || '<span class="muted">—</span>'}</td>
            <td>${x >= 0 ? escapeHtml(FINDER_STAGES[x]) : '<span class="muted">—</span>'}</td>
            <td><button type="button" class="basket-add" title="Add ${escapeHtml(g.symbol)} to basket" aria-label="Add ${escapeHtml(g.symbol)} to basket" data-basket-add data-ddb="${escapeHtml(g.id)}" data-symbol="${escapeHtml(g.symbol)}" data-name="${escapeHtml(g.name || "")}" data-ncbi="${escapeHtml(g.ncbiGene || "")}">＋</button></td>
          </tr>`;
        }).join("")}
      </tbody>
    </table></div>`;
}

function finderExportCSV() {
  if (!finderResults.length) return;
  const esc = (s) => `"${String(s || "").replace(/"/g, '""')}"`;
  const rows = finderResults.map(({ g, p, o, d, x }) =>
    [g.symbol, g.id, g.name, p ? "yes" : "", o ? "yes" : "", d ? "yes" : "", x >= 0 ? FINDER_STAGES[x] : ""].map(esc).join(","));
  basketDownload("symbol,ddb_g,name,phenotype,human_ortholog,disease,expression_peak\n" + rows.join("\n") + "\n", "dicty-gene-finder.csv", "text/csv");
}

function finderAddAll() {
  if (!finderResults.length) return;
  const cap = 200;
  if (finderResults.length > cap && !confirm(`Add the first ${cap} of ${finderResults.length} matching genes to your basket?`)) return;
  finderResults.slice(0, cap).forEach(({ g }) => basketAdd({ ddb: g.id, symbol: g.symbol, name: g.name, ncbiGene: g.ncbiGene }));
}

function initialHydrate() {
  buildSiteIndex();
  renderRecentGenes();
  hydrateFromRoute();
  initHeroVideo();
  loadNews();
  loadRecentPapers();
  cmdkInit();
  hovercardInit();
  basketInit();
  // From here on, in-app navigation scrolls smoothly.
  appReady = true;
  // After first paint, quietly pull in the technique protocol bodies and
  // re-index them so full-text protocol search ("HL5") works. Non-blocking;
  // until it finishes, techniques are still findable by title/category.
  const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  whenIdle(() => { ensureTechniqueContent().then(() => buildSiteIndex()); });
}
if (document.readyState === "complete") {
  initialHydrate();
} else {
  // Wait for first load so section offsets are final before we scroll to one.
  window.addEventListener("load", initialHydrate, { once: true });
}
