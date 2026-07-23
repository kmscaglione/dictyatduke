import http.server, os, json, uuid, datetime, pathlib, urllib.request, urllib.error, re, ssl
import subprocess, shutil, tempfile, csv, html, gzip, io, secrets, hmac, time, sys, threading, hashlib
import base64, struct
import concurrent.futures
from email import message_from_bytes
from email.utils import parsedate_to_datetime
from urllib.parse import unquote, urlparse, parse_qs, quote

import enrichment
import bench
import msa

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

# Opener for the outbound allowlist proxy that does NOT follow redirects: the
# allowlist is enforced on the original URL only, so a 3xx to an internal address
# would bypass it (SSRF). A refused redirect surfaces as the 3xx itself, which the
# proxy passes through harmlessly (no Location is forwarded to the browser).
class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None
_NOREDIRECT_OPENER = urllib.request.build_opener(
    _NoRedirect, urllib.request.HTTPSHandler(context=SSL_CTX))

ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = pathlib.Path(ROOT) / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "files").mkdir(exist_ok=True)
(UPLOADS_DIR / "submissions").mkdir(exist_ok=True)
(UPLOADS_DIR / "curations").mkdir(exist_ok=True)

CORPUS_PATH = pathlib.Path(ROOT) / "assets" / "dictybase_corpus.json"
STOCK_PATH = pathlib.Path(ROOT) / "assets" / "stock_center.json"
# Durable, gitignored curation overrides (survive `git reset --hard` deploys).
OVERRIDES_PATH = pathlib.Path(ROOT) / "assets" / "curation_overrides.json"
STOCK_OVERRIDES_PATH = pathlib.Path(ROOT) / "assets" / "stock_overrides.json"
CURATION_LOG_PATH = pathlib.Path(ROOT) / "assets" / "curation_log.jsonl"
CURATORS_PATH = pathlib.Path(ROOT) / "assets" / "curators.json"  # named accounts (gitignored)

# Recent-papers feed: cached PubMed results, refreshed at most once a day.
PAPERS_CACHE = pathlib.Path(ROOT) / "cache" / "recent_papers.json"
PAPERS_TTL = 24 * 3600
EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def fetch_pubmed_recent(term="Dictyostelium", n=5):
    """Most recent PubMed papers for `term` via E-utilities (esearch+esummary)."""
    q = (f"{EUTILS}/esearch.fcgi?db=pubmed&term={quote(term)}&sort=pub+date"
         f"&retmax={n}&retmode=json&tool=dictyBase")
    with urllib.request.urlopen(q, timeout=20, context=SSL_CTX) as r:
        ids = json.loads(r.read())["esearchresult"]["idlist"]
    papers = []
    if ids:
        s = f"{EUTILS}/esummary.fcgi?db=pubmed&id={','.join(ids)}&retmode=json&tool=dictyBase"
        with urllib.request.urlopen(s, timeout=20, context=SSL_CTX) as r:
            res = json.loads(r.read()).get("result", {})
        for pid in res.get("uids", []):
            rec = res.get(pid, {})
            doi = next((a["value"] for a in rec.get("articleids", [])
                        if a.get("idtype") == "doi"), "")
            papers.append({
                "pmid": pid,
                "title": (rec.get("title") or "").rstrip(". "),
                "journal": rec.get("source", ""),
                "pubdate": rec.get("pubdate", ""),
                "authors": [a["name"] for a in rec.get("authors", []) if a.get("name")],
                "doi": doi,
                "url": f"https://pubmed.ncbi.nlm.nih.gov/{pid}/",
            })
    return {"updated": datetime.datetime.utcnow().isoformat() + "Z",
            "term": term, "papers": papers}
STATIC_EXTS = {".css", ".js", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".svg",
               ".woff", ".woff2", ".pdf", ".docx", ".gz", ".fna", ".fai", ".gff", ".gtf",
               ".json", ".bedgraph",
               ".tbi",   # .tbi: tabix indexes for the bgzipped browser GFF/track files
               # dictyBase Downloads mirror (assets/dictybase-downloads/): data files
               ".txt", ".zip", ".xls", ".xlsx", ".obo", ".ddb"}
# Text assets worth gzipping on the fly (the JSON data files are multi-MB and
# compress ~85%). NB: genome FASTA/index/annotation (.fna/.fai/.gff/.gtf) are
# deliberately excluded — IGV.js reads them with byte offsets, so on-the-fly
# gzip (which changes Content-Length / can't honor a range) must not touch them.
COMPRESSIBLE_EXTS = {".json", ".js", ".css", ".svg", ".bedgraph"}

# Files/trees that live under ROOT but must NEVER be web-served, regardless of
# extension — the static handler serves anything with a STATIC_EXTS extension
# (incl. .json), so without this guard these gitignored runtime files would leak:
#   curators.json           salted PBKDF2 password hashes for curator accounts
#   *_overrides / log       durable curation state + audit trail
#   uploads/                the submission inbox — files + submitter emails (PII)
# Dotfiles (.gemini_key, .curator_password) are already caught by the SPA
# fallback (no extension) but are blocked here too, belt-and-suspenders.
_BLOCKED_EXACT = {
    "/assets/curators.json",
    "/assets/curation_overrides.json",
    "/assets/stock_overrides.json",
    "/assets/curation_log.jsonl",
}
_BLOCKED_PREFIXES = ("/uploads/",)


def _is_blocked_path(raw):
    """True if `raw` (a URL path, no query) must not be web-served."""
    if raw in _BLOCKED_EXACT or raw.startswith(_BLOCKED_PREFIXES):
        return True
    # any path segment that is a dotfile (e.g. /.curator_password, /.gemini_key)
    return any(seg.startswith(".") for seg in raw.split("/") if seg)

# Cache-busting: stamp local css/js asset URLs in index.html with their mtime
# so browsers always re-fetch a file after it changes, but cache it otherwise.
ASSET_RE = re.compile(r'(href|src)="(/[^"?]+\.(?:css|js))"')

# Version stamp for the static data files: the newest mtime among assets/*.json.
# Injected into index.html so the front-end can request immutable, cache-busted
# /assets/*.json?v=<stamp> URLs. Changes the instant any data file is rebuilt.
def _data_version():
    latest = 0
    try:
        for p in (pathlib.Path(ROOT) / "assets").glob("*.json"):
            try:
                latest = max(latest, int(p.stat().st_mtime))
            except OSError:
                pass
    except OSError:
        pass
    return latest

# Cache of gzip-compressed asset bodies, keyed by (path, mtime), so cold serves
# of the multi-MB JSONs don't re-compress on every request. Bounded by the small
# set of compressible assets; entries for old mtimes are simply never hit again.
_GZIP_CACHE = {}

# Precomputed InterPro domain architecture (assets/domains.json, built by
# scripts/build_domains.py). Served per-gene from memory so clients fetch ~2 KB
# for one gene instead of downloading the whole multi-MB file; reloaded when the
# file changes (mtime-keyed). The live InterPro proxy stays the fallback.
DOMAINS_PATH = pathlib.Path(ROOT) / "assets" / "domains.json"
_DOMAINS_CACHE = {"mtime": None, "genes": {}}


def _load_domains():
    try:
        mtime = DOMAINS_PATH.stat().st_mtime
    except OSError:
        return {}
    if _DOMAINS_CACHE["mtime"] != mtime:
        try:
            _DOMAINS_CACHE["genes"] = json.loads(DOMAINS_PATH.read_text()).get("genes", {})
            _DOMAINS_CACHE["mtime"] = mtime
        except (ValueError, OSError):
            _DOMAINS_CACHE["genes"] = {}
    return _DOMAINS_CACHE["genes"]


# Full GO/literature annotations (assets/gene_annotations.json, ~6.6 MB, keyed by
# DDB_G id). Loaded once into memory and served one gene at a time via
# GET /api/gene-annotations?ddb=... so the gene page fetches a few KB instead of
# the whole file. mtime-reloaded like the domains cache.
GENE_ANNOT_PATH = pathlib.Path(ROOT) / "assets" / "gene_annotations.json"
_GENE_ANNOT_CACHE = {"mtime": None, "genes": {}}

# Per-gene extras + InterPro domains from dictyBase's download files (build_
# dictybase_enrichment.py). Served per-gene like the annotations above, since
# together they are ~10 MB. mtime-reloaded.
GENE_EXTRAS_PATH = pathlib.Path(ROOT) / "assets" / "gene_extras.json"
DICTY_DOMAINS_PATH = pathlib.Path(ROOT) / "assets" / "dictybase_domains.json"
PROMOTERS_PATH = pathlib.Path(ROOT) / "assets" / "promoters.json"
_GENE_EXTRAS_CACHE = {"mtime": None, "genes": {}}
_DICTY_DOMAINS_CACHE = {"mtime": None, "genes": {}}
_PROMOTERS_CACHE = {"mtime": None, "genes": {}}


def _load_mtime_json(path, cache):
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return cache["genes"]
    if cache["mtime"] != mtime:
        try:
            cache["genes"] = json.loads(path.read_text())
            cache["mtime"] = mtime
        except (ValueError, OSError):
            cache["genes"] = {}
    return cache["genes"]

# Citable data-release metadata (assets/data_release.json) — version, date, DOI.
RELEASE_PATH = pathlib.Path(ROOT) / "assets" / "data_release.json"


def _release_meta():
    try:
        return json.loads(RELEASE_PATH.read_text())
    except (ValueError, OSError):
        return {}


def _load_gene_annotations():
    try:
        mtime = GENE_ANNOT_PATH.stat().st_mtime
    except OSError:
        return {}
    if _GENE_ANNOT_CACHE["mtime"] != mtime:
        try:
            _GENE_ANNOT_CACHE["genes"] = json.loads(GENE_ANNOT_PATH.read_text())
            _GENE_ANNOT_CACHE["mtime"] = mtime
        except (ValueError, OSError):
            _GENE_ANNOT_CACHE["genes"] = {}
    return _GENE_ANNOT_CACHE["genes"]


# ------------------------------------------------------------------- SEO -----
# The SPA serves one HTML shell for every route, so without this a crawler sees
# the same generic <title>/meta for /gene/mybB as for the home page and can't
# index gene pages. _serve_index injects per-route <title>, description,
# canonical, OpenGraph and JSON-LD; /robots.txt + /sitemap.xml expose the genes.
SITE_NAME = "dictyBase"
GENE_INDEX_PATH = pathlib.Path(ROOT) / "assets" / "gene_index.json"
_GENE_META = {"mtime": None, "by_symbol": {}, "by_ddb": {}, "records": []}

# Public base URL for absolute canonical/sitemap URLs. Set PUBLIC_BASE_URL in
# the deployment (e.g. https://dicty.example.org); otherwise derived per request
# from the Host header (https assumed, since TLS terminates at the proxy).
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL", "").rstrip("/")
_esc = html.escape  # module-level alias (the `html` name is shadowed in _serve_index)

# Friendly titles/descriptions for the main static routes. Unlisted routes keep
# the index.html defaults. (Values may contain pre-escaped entities.)
_ROUTE_META = {
    "/tools/blast": ("BLAST search",
        "BLAST a nucleotide or protein query against 17 sequenced dictyostelid genomes; D. discoideum hits link to their gene record."),
    "/tools/enrichment": ("GO and phenotype enrichment",
        "Hypergeometric GO-term and phenotype enrichment analysis for a list of Dictyostelium genes, with Benjamini-Hochberg correction."),
    "/tools/geneset": ("Gene set analysis",
        "Interpret a Dictyostelium gene set: GO/phenotype/KEGG enrichment, human-ortholog and disease overlap, developmental expression-peak profile, and a plain-language summary. Free, no account."),
    "/tools/expression": ("Expression compare",
        "Overlay the developmental RNA-seq expression profiles of several Dictyostelium genes across the life cycle."),
    "/tools/lab": ("Lab tools",
        "Design CRISPR guides with genome off-target checking, qPCR primers, and codon-optimize sequences for Dictyostelium."),
    "/tools/api": ("REST API",
        "Public REST API for Dictyostelium gene records, GO terms, strains, BLAST, and enrichment on dictyBase."),
    "/tools/convert": ("Gene ID converter",
        "Convert between Dictyostelium gene symbols, DDB_G ids, UniProt accessions, and NCBI Gene ids in one normalized table."),
    "/tools/sequence": ("Sequence tools",
        "Retrieve genomic DNA by coordinates, run in-silico PCR, and build a multiple sequence alignment across the sequenced dictyostelids and wild isolates."),
    "/education": ("Education",
        "Learn Dictyostelium: an interactive life-cycle stepper, glossary, self-quiz, and downloadable teaching figures."),
    "/start": ("Start here",
        "New to Dictyostelium? Why it is a powerful model organism and how to get started using it in your lab."),
    "/data": ("Data and provenance",
        "Where dictyBase's data comes from: sources, licenses, versioning, and how the site is built."),
    "/downloads": ("dictyBase Downloads",
        "A preserved local mirror of the dictyBase Downloads page: gene information, mutant phenotypes, ontologies, protein data, GO annotations, and literature."),
    "/news": ("News and updates",
        "All dictyBase announcements and data updates, newest first."),
    "/tools": ("All tools",
        "Every dictyBase analysis tool in one place: BLAST, genome browser, enrichment, sequence tools, lab tools, and more."),
    "/cite": ("How to cite",
        "How to cite the dictyBase data release: version, DOI, citation text, and BibTeX, plus the primary data sources to credit."),
    "/community/disease-models": ("Disease models",
        "Browse Dictyostelium genes with human disease-associated orthologs - a starting point for modelling human disease in the amoeba."),
}


def _load_gene_meta():
    try:
        mtime = GENE_INDEX_PATH.stat().st_mtime
    except OSError:
        return _GENE_META
    if _GENE_META["mtime"] != mtime:
        try:
            recs = json.loads(GENE_INDEX_PATH.read_text())
        except (ValueError, OSError):
            recs = []
        by_symbol, by_ddb = {}, {}
        for r in recs:
            if not r:
                continue
            ddb = (r[0] or "").upper()
            sym = r[1] if len(r) > 1 else ""
            if ddb:
                by_ddb[ddb] = r
            if sym:
                by_symbol.setdefault(sym.lower(), r)
            # old/alternate symbols (6th field) resolve to the same record, so a
            # /gene/<old-symbol> link gets the right title and canonical /gene/<symbol>.
            for a in (r[5] if len(r) > 5 else []):
                if a:
                    by_symbol.setdefault(a.lower(), r)
        _GENE_META.update(mtime=mtime, by_symbol=by_symbol, by_ddb=by_ddb, records=recs)
    return _GENE_META


def _clip(s, n=158):
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[:n - 1].rstrip() + "…"


def route_meta(path):
    """(title, description, canonical_path, jsonld|None) for a client route.
    title/description are plain text (caller escapes). None title -> use defaults."""
    parts = [p for p in path.split("/") if p]
    if len(parts) >= 2 and parts[0] == "gene":
        token = unquote(parts[1])
        gm = _load_gene_meta()
        rec = gm["by_symbol"].get(token.lower()) or gm["by_ddb"].get(token.upper())
        if rec:
            ddb = rec[0]
            sym = rec[1] or ddb
            desc = (rec[2] if len(rec) > 2 else "") or ""
            named = bool(sym) and sym.upper() != ddb.upper()
            label = f"{sym} ({ddb})" if named else ddb
            human = desc if desc and desc.lower() != "hypothetical protein" else "Dictyostelium discoideum gene"
            title = f"{label} · Dictyostelium gene · {SITE_NAME}"
            description = _clip(f"{label}: {human}. GO annotations, phenotypes, sequences, "
                               f"orthologs, protein structure, and expression.")
            canon = f"/gene/{sym}" if named else f"/gene/{ddb}"
            jsonld = {
                "@context": "https://schema.org",
                "@type": "Gene",
                "name": sym,
                "identifier": ddb,
                "description": human,
                "isPartOfBioChemEntity": "Dictyostelium discoideum",
            }
            return title, description, canon, jsonld
        # unknown gene token: still give it a sensible title
        return f"{token} · Dictyostelium gene · {SITE_NAME}", None, path, None
    hit = _ROUTE_META.get(path.rstrip("/") or "/")
    if hit:
        return f"{hit[0]} · {SITE_NAME}", hit[1], path, None
    return None, None, path, None


def _base_url(handler):
    if PUBLIC_BASE_URL:
        return PUBLIC_BASE_URL
    host = handler.headers.get("Host", "")
    return f"https://{host}" if host else ""

# Curator BOOTSTRAP-admin password. Read from the CURATOR_PASSWORD env var, OR a
# gitignored `.curator_password` file next to serve.py (same trick as .gemini_key —
# handy on the Duke server where /etc/dicty.env isn't writable by kms205). If
# neither is set, a random one is generated per run and printed to the log. This
# is only the bootstrap login used to create the first named accounts; day-to-day
# logins use the per-person accounts in curators.json.
def _read_curator_password():
    pw = (os.environ.get("CURATOR_PASSWORD") or "").strip()
    if pw:
        return pw
    try:
        return (pathlib.Path(ROOT) / ".curator_password").read_text().strip()
    except OSError:
        return ""


CURATOR_PASSWORD = _read_curator_password()
if not CURATOR_PASSWORD:
    CURATOR_PASSWORD = secrets.token_urlsafe(12)
    print(f"[serve] CURATOR_PASSWORD not set — generated dev password: {CURATOR_PASSWORD}",
          file=sys.stderr)

# --- AI analysis assistant (Google Gemini, free tier) -----------------------
# A public "Ask about this data" tool that proxies a single, bounded prompt to
# the Google Gemini API (free tier via an AI Studio key — no per-token bill).
# It is still a public endpoint with no login, so it is a prime target for abuse
# (free LLM proxy). The caps below exist to stop that AND to stay comfortably
# inside the free-tier request/day quota so it never spills into paid usage.
#
# It is OFF unless GEMINI_API_KEY is set in the environment (like
# CURATOR_PASSWORD, no secret in source). With no key the endpoint returns a
# clean "unavailable" so the UI can hide the tool; the site is otherwise
# unaffected. Set the key + tune the caps in /etc/dicty.env when ready.
#
# NOTE on the free tier: Google MAY use free-tier (unpaid) inputs/outputs to
# improve its models, including human review. The questions here are about
# public gene data so the risk is low, but the UI disclaimer tells users not to
# submit anything sensitive or unpublished.
#
# Gating layers (belt AND suspenders — any one tripping refuses the call):
#   1. Feature flag: no GEMINI_API_KEY  -> disabled.
#   2. Input caps:   question/context length + total prompt-char budget.
#   3. Per-IP rate:  a few calls/min and /day (behind the Apache proxy every
#                    client looks like 127.0.0.1, so this is effectively global
#                    until the X-Forwarded-For change lands — deliberately tight).
#   4. Global caps:  a daily request ceiling AND a daily output-token budget,
#                    both reset at UTC midnight, so a bad day can't blow past the
#                    free-tier quota even if the per-IP limit is bypassed.
def _read_gemini_key():
    """Key from GEMINI_API_KEY env (production: /etc/dicty.env) OR, for easy local
    dev, a gitignored `.gemini_key` file next to serve.py. The file path avoids
    fiddly inline env vars — `pbpaste > .gemini_key` and restart is enough."""
    k = os.environ.get("GEMINI_API_KEY", "").strip()
    if k:
        return k
    try:
        return (pathlib.Path(ROOT) / ".gemini_key").read_text().strip()
    except OSError:
        return ""


GEMINI_API_KEY = _read_gemini_key()
# Free-tier model. gemini-flash-lite-latest is an auto-updating alias for the
# current lightweight flash model — fast, capable enough for this Q&A, on the
# free tier, and reliably available (the heavier flash models often 503 under
# load). Verified working on this account 2026-07-10. Older ids like
# gemini-2.0-flash return 429 (no free quota) and gemini-2.5-* are retired for
# new keys. Override with ANALYZE_MODEL=<id> to use a stronger model.
ANALYZE_MODEL = os.environ.get("ANALYZE_MODEL", "gemini-flash-lite-latest")
ANALYZE_MAX_TOKENS = int(os.environ.get("ANALYZE_MAX_TOKENS", "1200"))   # output cap/call
ANALYZE_Q_MAXCHARS = 2000          # user question hard cap
ANALYZE_CTX_MAXCHARS = 12000       # attached data context hard cap
ANALYZE_PROMPT_MAXCHARS = 14000    # combined ceiling (defense in depth)
ANALYZE_PER_IP_MIN = int(os.environ.get("ANALYZE_PER_IP_MIN", "4"))     # calls / 60s / ip
ANALYZE_PER_IP_DAY = int(os.environ.get("ANALYZE_PER_IP_DAY", "40"))    # calls / day / ip
ANALYZE_GLOBAL_DAY = int(os.environ.get("ANALYZE_GLOBAL_DAY", "1000"))  # calls / day (all)
# Daily *output* token budget across everyone. Free tier isn't billed per token,
# so this is a soft usage guard (abuse + quota headroom), not a dollar ceiling.
ANALYZE_TOKENS_DAY = int(os.environ.get("ANALYZE_TOKENS_DAY", "500000"))
_ANALYZE_MIN = {}                  # ip -> [recent epochs]  (per-minute limiter)
_ANALYZE_DAY = {}                  # ip -> [recent epochs]  (per-day limiter)
_ANALYZE_USAGE = {"day": None, "calls": 0, "out_tokens": 0}   # global daily meter
_ANALYZE_LOCK = threading.Lock()

ANALYZE_SYSTEM = (
    "You are the dictyBase AI analysis assistant, an expert in Dictyostelium "
    "discoideum genetics, cell biology, and the model-organism literature. "
    "dictyBase is a community resource for Dictyostelium researchers. Help the "
    "user interpret the gene, protein, phenotype, or dataset they ask about. "
    "Be concise, specific, and grounded in established Dictyostelium biology; "
    "when a claim is uncertain or would need experimental confirmation, say so. "
    "If the question is outside Dictyostelium biology or the provided data, say "
    "you can't help with that rather than guessing. These are AI-generated "
    "notes, not curated facts — do not fabricate gene IDs, citations, or "
    "numbers you were not given."
)


def _analyze_reserve(ip, now):
    """Atomically check every gate and, if all pass, record the call. Returns
    (ok, http_code, message). Token budget is checked here (pre-call) against
    the running meter; the actual output tokens are added after the API returns."""
    with _ANALYZE_LOCK:
        today = time.strftime("%Y-%m-%d", time.gmtime(now))
        if _ANALYZE_USAGE["day"] != today:                 # UTC-midnight rollover
            _ANALYZE_USAGE.update(day=today, calls=0, out_tokens=0)
        # per-IP: minute + day
        mins = [t for t in _ANALYZE_MIN.get(ip, []) if now - t < 60]
        days = [t for t in _ANALYZE_DAY.get(ip, []) if now - t < 86400]
        if len(mins) >= ANALYZE_PER_IP_MIN or len(days) >= ANALYZE_PER_IP_DAY:
            _ANALYZE_MIN[ip], _ANALYZE_DAY[ip] = mins, days
            return False, 429, "Rate limit reached — please wait a bit before asking again."
        # global: request count + token budget
        if _ANALYZE_USAGE["calls"] >= ANALYZE_GLOBAL_DAY or \
           _ANALYZE_USAGE["out_tokens"] >= ANALYZE_TOKENS_DAY:
            return False, 503, "The AI assistant has reached its daily limit. Try again tomorrow."
        mins.append(now); days.append(now)
        _ANALYZE_MIN[ip], _ANALYZE_DAY[ip] = mins, days
        _ANALYZE_USAGE["calls"] += 1
        return True, 200, ""


def _analyze_record_tokens(out_tokens):
    with _ANALYZE_LOCK:
        _ANALYZE_USAGE["out_tokens"] += int(out_tokens or 0)


def _analyze_generate(question, context):
    """Single generateContent call to the Google Gemini API via stdlib urllib
    (serve.py has no third-party deps). Returns (text, out_tokens). Raises on
    transport/HTTP error; returns a friendly note if the model declines/blocks."""
    user = question if not context else f"{question}\n\n--- Data context ---\n{context}"
    payload = {
        "system_instruction": {"parts": [{"text": ANALYZE_SYSTEM}]},
        "contents": [{"role": "user", "parts": [{"text": user}]}],
        "generationConfig": {"maxOutputTokens": ANALYZE_MAX_TOKENS, "temperature": 0.4},
    }
    # Key goes in the header (x-goog-api-key), never the URL, so it can't leak
    # into logs/referers.
    url = (f"https://generativelanguage.googleapis.com/v1beta/models/"
           f"{ANALYZE_MODEL}:generateContent")
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode(),
        headers={"content-type": "application/json", "x-goog-api-key": GEMINI_API_KEY},
        method="POST")
    with urllib.request.urlopen(req, timeout=60, context=SSL_CTX) as r:
        data = json.loads(r.read())
    cands = data.get("candidates") or []
    parts = (cands[0].get("content", {}).get("parts", []) if cands else [])
    text = "".join(p.get("text", "") for p in parts).strip()
    usage = data.get("usageMetadata") or {}
    out_tokens = usage.get("candidatesTokenCount", 0)
    if not text:
        # Blocked prompt, safety stop, or an empty candidate — give a clean note
        # rather than a blank box (finishReason / blockReason explain why).
        reason = ((cands[0].get("finishReason") if cands else None)
                  or (data.get("promptFeedback") or {}).get("blockReason") or "")
        text = ("I can't help with that request." if reason
                else "No answer was generated — please try rephrasing.")
    return text, out_tokens


# Login issues a random, expiring session token (NOT derived from the password),
# kept server-side. In-memory: tokens reset on restart (fine for one process).
_SESSIONS = {}            # token -> expiry epoch
SESSION_TTL = 8 * 3600    # 8 hours
_LOGIN_FAILS = {}         # ip -> [recent failed-attempt epochs]
_UPLOAD_HITS = {}         # ip -> [recent upload epochs]
_BLAST_HITS = {}          # ip -> [recent BLAST-family request epochs]
_PROXY_HITS = {}          # ip -> [recent outbound-proxy request epochs]

# Allowlisted, cached GET proxy for the public bio APIs the gene record reads
# from the browser (NCBI E-utilities, UniProt, EBI QuickGO, STRING, OMA, RCSB).
# Proxying them server-side adds caching, hides the user's IP/query from those
# upstreams, dodges CORS, and lets us rate-limit. https + host allowlist ONLY —
# this is not an open relay.
_PROXY_HOSTS = {
    "eutils.ncbi.nlm.nih.gov", "rest.uniprot.org", "www.ebi.ac.uk",
    "string-db.org", "omabrowser.org", "search.rcsb.org", "data.rcsb.org",
}
_EXT_CACHE = {}                    # url -> (expiry_epoch, status, ctype, body bytes)
_EXT_CACHE_TTL = 6 * 3600
_EXT_CACHE_MAX = 600               # cap entries; oldest evicted first
_EXT_CACHE_MAX_BYTES = 2_000_000   # don't cache huge payloads

# Privacy-respecting, first-party pageview counts: cookieless, no IP/User-Agent
# stored, no per-hit timestamps — just {route-bucket: count}. Dynamic id segments
# are bucketed (/gene/<x> -> /gene/:id) to bound the keyspace and to never store
# arbitrary user input. Persisted to cache/pageviews.json.
PAGEVIEWS_PATH = pathlib.Path(ROOT) / "cache" / "pageviews.json"
# counts: {route-bucket: total}. days: {YYYY-MM-DD (UTC): total} for "today"/trend.
# referrers: {source-label: entries} — where a visit came from, bucketed to the
# source site only (no full URLs, no query strings), counted once per entry.
_PAGEVIEWS = {"counts": {}, "days": {}, "referrers": {}, "since": None, "updated": None}
_PV_DAYS_KEEP = 400        # cap the day keyspace (~13 months); prune older on write
_PV_REF_CAP = 200          # cap distinct referrer buckets; overflow -> "Other"
_PAGEVIEWS_LOADED = False
_PV_LOCK = threading.Lock()
_HIT_HITS = {}                     # ip -> recent /api/hit epochs (limiter only; not stored)
_GWDI_HITS = {}                    # ip -> recent /api/stock-gwdi epochs (rate limiter)
# Top-level route segments the SPA actually serves; anything else buckets to /other.
_PV_HEADS = {"gene", "strain", "go", "organisms", "research", "community", "tools",
             "search", "education", "start", "research-areas", "data", "cite", "index.html"}


def _bucket_path(path):
    """Collapse a request path to a bounded analytics bucket (no raw ids/input)."""
    parts = [p for p in (path or "/").split("?")[0].split("/") if p]
    if not parts:
        return "/"
    head = parts[0]
    if head not in _PV_HEADS:
        return "/other"
    if head in ("gene", "strain", "go"):
        return f"/{head}/:id"
    if head == "organisms":
        return "/organisms/:slug"
    if head == "research" and len(parts) > 1 and parts[1] == "techniques":
        return "/research/techniques/:slug"
    if head in ("tools", "community", "search", "research") and len(parts) > 1:
        seg = re.sub(r"[^a-z0-9-]", "", parts[1].lower())[:40]
        return f"/{head}/{seg}"
    return "/" + head


# Map common referrer hosts to friendly source labels. Bounds the keyspace and
# avoids storing arbitrary/attacker-controlled hostnames verbatim.
_REF_SOURCES = [
    (("t.co", "twitter.com", "x.com"), "Twitter/X"),
    (("facebook.com",), "Facebook"),
    (("mail.google.com",), "Gmail"),
    (("outlook.com", "outlook.office.com", "outlook.office365.com", "outlook.live.com"), "Outlook"),
    (("scholar.google.com",), "Google Scholar"),
    (("google.com", "google.co.uk", "google.ca", "google.de"), "Google"),
    (("bing.com",), "Bing"),
    (("duckduckgo.com",), "DuckDuckGo"),
    (("linkedin.com", "lnkd.in"), "LinkedIn"),
    (("reddit.com",), "Reddit"),
    (("news.ycombinator.com",), "Hacker News"),
    (("bsky.app",), "Bluesky"),
    (("wikipedia.org",), "Wikipedia"),
    (("slack.com",), "Slack"),
    (("teams.microsoft.com",), "MS Teams"),
]


def _bucket_referrer(ref, self_host=None):
    """Collapse a referrer URL to a bounded, friendly source label. Only the
    source site is ever derived — never the full URL, path, or query string."""
    if not ref:
        return "Direct / email"
    try:
        host = (urlparse(ref).hostname or "").lower().lstrip(".")
    except ValueError:
        return "Other"
    if host.startswith("www."):
        host = host[4:]
    if not host:
        return "Direct / email"
    if self_host and (host == self_host or host.endswith("." + self_host)):
        return "Internal"
    for hosts, label in _REF_SOURCES:
        if any(host == h or host.endswith("." + h) for h in hosts):
            return label
    if host == "duke.edu" or host.endswith(".duke.edu"):
        return "Duke (other)"
    return re.sub(r"[^a-z0-9.-]", "", host)[:40] or "Other"


def _load_pageviews():
    global _PAGEVIEWS_LOADED
    if _PAGEVIEWS_LOADED:
        return
    try:
        if PAGEVIEWS_PATH.exists():
            d = json.loads(PAGEVIEWS_PATH.read_text())
            if isinstance(d, dict):
                _PAGEVIEWS["counts"] = d.get("counts", {}) or {}
                _PAGEVIEWS["days"] = d.get("days", {}) or {}
                _PAGEVIEWS["referrers"] = d.get("referrers", {}) or {}
                _PAGEVIEWS["since"] = d.get("since")
                _PAGEVIEWS["updated"] = d.get("updated")
    except (ValueError, OSError):
        pass
    _PAGEVIEWS_LOADED = True


def _save_pageviews():
    try:
        PAGEVIEWS_PATH.parent.mkdir(exist_ok=True)
        _PAGEVIEWS["updated"] = datetime.datetime.utcnow().isoformat() + "Z"
        if not _PAGEVIEWS["since"]:
            _PAGEVIEWS["since"] = _PAGEVIEWS["updated"]
        PAGEVIEWS_PATH.write_text(json.dumps(_PAGEVIEWS))
    except OSError:
        pass

# Concurrency cap for the CPU-heavy BLAST endpoints. Each blastn/tblastn pins a
# core for seconds (cross-species/conservation tblastn = vs 9 genomes), so a
# handful of concurrent requests can exhaust the box. A bounded semaphore limits
# how many run at once; requests that can't get a slot quickly get a 503 rather
# than piling up. Tune with BLAST_MAX_CONCURRENT.
BLAST_MAX_CONCURRENT = int(os.environ.get("BLAST_MAX_CONCURRENT", "3"))
_BLAST_SEM = threading.BoundedSemaphore(BLAST_MAX_CONCURRENT)
BLAST_SLOT_WAIT = 2.0     # seconds to wait for a free slot before giving up

# Async BLAST jobs. The heavy multi-genome searches (cross-species comparison,
# conservation, "all species" BLAST) are the one operation that pins a core for
# seconds. Run synchronously they hold a request thread the whole time and 503
# under contention. Instead the front-end submits them to this bounded worker
# pool and polls /api/job — work queues gracefully (no 503, no held threads) and
# concurrency stays capped at BLAST_MAX_CONCURRENT. Single-genome BLAST stays
# synchronous (it's fast). State is in-process (single worker); see the
# multi-worker note in docs/deployment.md.
_BLAST_POOL = concurrent.futures.ThreadPoolExecutor(
    max_workers=BLAST_MAX_CONCURRENT, thread_name_prefix="blast-job")
_JOBS = {}                # job_id -> {status, code, result, error, created}
_JOBS_LOCK = threading.Lock()
JOB_TTL = 600             # seconds a finished job's result is retained
MAX_JOBS = 2000           # hard cap so a flood can't grow the registry unbounded


def submit_job(fn):
    """Queue fn() (returns (http_code, payload)) on the BLAST pool; returns a
    job id to poll via /api/job. Prunes expired/old jobs first."""
    now = time.time()
    jid = secrets.token_urlsafe(12)
    with _JOBS_LOCK:
        for k in [k for k, v in _JOBS.items() if now - v["created"] > JOB_TTL]:
            _JOBS.pop(k, None)
        if len(_JOBS) >= MAX_JOBS:                      # evict oldest under flood
            for k in sorted(_JOBS, key=lambda k: _JOBS[k]["created"])[:len(_JOBS) - MAX_JOBS + 1]:
                _JOBS.pop(k, None)
        _JOBS[jid] = {"status": "queued", "code": None, "result": None,
                      "error": None, "created": now}

    def _run():
        with _JOBS_LOCK:
            if jid in _JOBS:
                _JOBS[jid]["status"] = "running"
        try:
            code, payload = fn()
            with _JOBS_LOCK:
                if jid in _JOBS:
                    _JOBS[jid].update(status="done", code=code, result=payload)
        except Exception as e:
            with _JOBS_LOCK:
                if jid in _JOBS:
                    _JOBS[jid].update(status="error", error=str(e))

    _BLAST_POOL.submit(_run)
    return jid


def job_snapshot(jid):
    with _JOBS_LOCK:
        j = _JOBS.get(jid)
        return dict(j) if j else None

# The outbound-proxy endpoints (AlphaFold, InterPro /api/domains) make slow
# third-party calls that each tie up a worker thread for 10-25s. Per-IP rate
# limiting alone doesn't bound *global* concurrency, so under load many users
# could pile up slow upstream calls and exhaust threads (and hammer EBI/NCBI).
# A global semaphore caps how many run at once; overflow gets a fast 503.
PROXY_MAX_CONCURRENT = int(os.environ.get("PROXY_MAX_CONCURRENT", "8"))
_PROXY_SEM = threading.BoundedSemaphore(PROXY_MAX_CONCURRENT)
PROXY_SLOT_WAIT = 2.0

# Public unauthenticated write endpoints (/api/upload, /api/curator/submit) are
# unused by the frontend — the community forms email instead — and are disabled
# for the public launch to remove the disk-fill / queue-flood / hostile-file
# surface. Set True (and add per-tenant limits) only if you wire up in-app
# submission later. See _handle_upload / _handle_curation_submit.
ACCEPT_PUBLIC_SUBMISSIONS = False

# Upload guardrails (the /api/upload endpoint is public community submission).
UPLOAD_MAX_BYTES = 50 * 1024 * 1024
UPLOAD_EXTS = {".csv", ".tsv", ".txt", ".xlsx", ".xls", ".fasta", ".fa", ".fna",
               ".gff", ".gff3", ".gtf", ".bed", ".bedgraph", ".wig", ".json",
               ".gz", ".zip", ".pdf"}


def _rate_limited(store, ip, limit, window):
    """True if `ip` has >= `limit` events in the last `window` seconds; records now."""
    now = time.time()
    hits = [t for t in store.get(ip, []) if now - t < window]
    store[ip] = hits
    if len(hits) >= limit:
        return True
    hits.append(now)
    return False

# --- Local BLAST against the bundled dictyostelid genomes ---
BLAST_DB_DIR = pathlib.Path(ROOT) / "assets" / "genomes" / "blastdb"
BLAST_BIN_DIR = pathlib.Path(os.path.expanduser("~/.local/blast"))
BLAST_PROGRAMS = {"blastn", "tblastn"}
# species id -> label. Keys MUST match the DB names built by scripts/build_blastdb.py
BLAST_DBS = {
    "d-discoideum-ax4": "D. discoideum AX4",
    "d-purpureum": "D. purpureum",
    "d-firmibasis": "D. firmibasis",
    "c-fasciculata-sh3": "C. fasciculata SH3",
    "c-polycephalum": "C. polycephalum",
    "s-polycarpum": "S. polycarpum",
    "h-pallidum-pn500": "H. pallidum PN500",
    "h-pallidum-new": "H. pallidum (2026)",
    "p-violaceum": "P. violaceum",
    # Ahmed et al. 2025 (PNAS) — new species reps (join the comparative set)
    "d-citrinum": "D. citrinum GS8b",
    "d-dimigraforme": "D. dimigraforme Ar5b",
    # Ahmed et al. 2025 — wild isolates (individually searchable, NOT in "all")
    "dd-ax2-214": "D. discoideum AX2-214",
    "dd-cr116c": "D. discoideum CR116C",
    "dd-ot3a": "D. discoideum OT3A",
    "dd-m4b": "D. cf. discoideum M4B",
    "dd-s6b": "D. cf. discoideum S6B",
    "dc-cf3b": "D. citrinum Cf3b",
}
# Wild isolates from Ahmed et al. 2025: conspecific D. discoideum strains (plus a
# 2nd D. citrinum). Individually BLAST-able/browsable, but excluded from the
# cross-species "all" search so it stays one-assembly-per-species.
BLAST_ISOLATE_DBS = {"dd-ax2-214", "dd-cr116c", "dd-ot3a", "dd-m4b", "dd-s6b", "dc-cf3b"}
# The cross-species comparative set = everything except the wild isolates.
BLAST_SPECIES_DBS = [d for d in BLAST_DBS if d not in BLAST_ISOLATE_DBS]


def blast_bin(program):
    """Locate a BLAST+ binary (bundled dir first, then PATH)."""
    p = BLAST_BIN_DIR / program
    return str(p) if p.exists() else shutil.which(program)


# Lazy interval index for mapping a D. discoideum genome hit back to its gene.
_GENE_INTERVALS = None


def gene_intervals():
    global _GENE_INTERVALS
    if _GENE_INTERVALS is not None:
        return _GENE_INTERVALS
    idx = {}
    try:
        rows = json.loads((pathlib.Path(ROOT) / "assets" / "gene_index.json").read_text())
        for ddb, sym, name, loc, ncbi, *_ in rows:
            if ":" not in loc:
                continue
            chrom, span = loc.split(":", 1)
            a, b = span.replace(",", "").split("-")
            idx.setdefault(chrom, []).append((int(a), int(b), sym, ddb, ncbi))
        for c in idx:
            idx[c].sort()
    except Exception:
        pass
    _GENE_INTERVALS = idx
    return idx


def gene_for_hit(accession, sstart, send):
    lo, hi = sorted((int(sstart), int(send)))
    mid = (lo + hi) // 2
    for a, b, sym, ddb, ncbi in gene_intervals().get(accession, []):
        if a <= mid <= b:
            return {"symbol": sym, "ddb": ddb, "ncbi": ncbi}
    return None


# --- Per-gene sequence extraction (genomic / cDNA / protein) from genome + GFF ---
GENE_GFF = pathlib.Path(ROOT) / "assets" / "genomes" / "D_discoideum_AX4.gff"
GENOME_FASTA = pathlib.Path(ROOT) / "assets" / "genomes" / "D_discoideum_AX4_refseq.fna"
_REVCOMP = str.maketrans("ACGTUacgtuN", "TGCAAtgcaaN")
_CODON = {}
for _i, _aa in enumerate("FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG"):
    _b = "TCAG"
    _CODON[_b[_i // 16] + _b[(_i // 4) % 4] + _b[_i % 4]] = _aa


def _translate(seq):
    seq = seq.upper().replace("U", "T")
    return "".join(_CODON.get(seq[i:i + 3], "X") for i in range(0, len(seq) - 2, 3))


_GENE_MODELS = None


def gene_models():
    global _GENE_MODELS
    if _GENE_MODELS is not None:
        return _GENE_MODELS
    models = {}
    try:
        with open(GENE_GFF) as fh:
            for line in fh:
                if line.startswith("#"):
                    continue
                f = line.rstrip("\n").split("\t")
                if len(f) < 9 or f[2] not in ("exon", "CDS"):
                    continue
                m = re.search(r"locus_tag=([^;]+)", f[8])
                if not m or not m.group(1).startswith("DDB_G"):
                    continue
                g = models.setdefault(m.group(1), {"chrom": f[0], "strand": f[6], "exon": [], "CDS": []})
                g[f[2]].append((int(f[3]), int(f[4])))
    except Exception:
        pass
    _GENE_MODELS = models
    return models


_GENOME_SEQ = None


def genome_seq():
    global _GENOME_SEQ
    if _GENOME_SEQ is not None:
        return _GENOME_SEQ
    seq, cur, buf = {}, None, []
    try:
        with open(GENOME_FASTA) as fh:
            for line in fh:
                if line.startswith(">"):
                    if cur:
                        seq[cur] = "".join(buf)
                    cur = line[1:].split()[0]
                    buf = []
                else:
                    buf.append(line.strip())
        if cur:
            seq[cur] = "".join(buf)
    except Exception:
        pass
    _GENOME_SEQ = seq
    return seq


def extract_sequence(ddb, typ):
    g = gene_models().get(ddb)
    if not g:
        return None
    chrom = genome_seq().get(g["chrom"])
    if not chrom:
        return None
    if typ == "genomic":
        if not g["exon"]:
            return None
        a = min(s for s, e in g["exon"]); b = max(e for s, e in g["exon"])
        out = chrom[a - 1:b]
    elif typ == "cdna":
        if not g["exon"]:
            return None
        out = "".join(chrom[s - 1:e] for s, e in sorted(g["exon"]))
    elif typ == "protein":
        if not g["CDS"]:
            return None
        out = "".join(chrom[s - 1:e] for s, e in sorted(g["CDS"]))
    else:
        return None
    if g["strand"] == "-":
        out = out.translate(_REVCOMP)[::-1]
    if typ == "protein":
        out = _translate(out)
        if out.endswith("*"):
            out = out[:-1]
    return out


# --- Public read API: lazy loaders over the local curated data ---
ASSETS = pathlib.Path(ROOT) / "assets"
_API = {}


def _load_json(name):
    if name not in _API:
        try:
            _API[name] = json.loads((ASSETS / name).read_text())
        except Exception:
            _API[name] = {}
    return _API[name]


# --- Durable curation via override files -----------------------------------
# Curation (gene summaries, strains, plasmids) is edited through the web portal
# and must SURVIVE code deploys, which run `git reset --hard`. reset --hard wipes
# tracked files but LEAVES untracked/gitignored ones — so curation is written to
# gitignored override files (never tracked), not to the base data files. The base
# files stay in git as the seed; serve.py merges the overrides over them in memory
# at read time. Result: fully web-based curation, live immediately, never lost on
# a deploy, and the terminal is only ever needed for code. Every write keeps a
# .bak and appends to an audit log (curation_log.jsonl) for rollback/history.
_STOCK_BLOB = None   # cached merged stock catalog bytes, served at /assets/stock_center.json


def _read_json_file(path, default):
    try:
        return json.loads(pathlib.Path(path).read_text())
    except (OSError, ValueError):
        return default


def _atomic_write_json(path, obj):
    """Serialize-first (raises before touching disk if unencodable), back up the
    current good file to <name>.bak, write a temp file, then atomic os.replace()."""
    blob = json.dumps(obj, separators=(",", ":"), ensure_ascii=False)
    p = pathlib.Path(path)
    if p.exists():
        try:
            shutil.copyfile(p, str(p) + ".bak")
        except OSError:
            pass
    tmp = str(p) + ".tmp"
    with open(tmp, "w") as fh:
        fh.write(blob)
    os.replace(tmp, p)


def apply_gene_overrides():
    """Merge curation_overrides.json over the base corpus into the in-process
    cache, so every reader (via _load_json) sees curated edits. Re-run after each
    save. The base file on disk is never modified."""
    base = _read_json_file(CORPUS_PATH, {})
    for ddb, fields in _read_json_file(OVERRIDES_PATH, {}).items():
        base[ddb] = {**base.get(ddb, {}), **fields}
    _API["dictybase_corpus.json"] = base


def apply_stock_overrides():
    """Merge stock_overrides.json over the base catalog (added/edited entries by
    id, plus a deleted set) into the in-process cache AND the served blob."""
    global _STOCK_BLOB
    base = _read_json_file(STOCK_PATH, {"strains": [], "plasmids": []})
    ov = _read_json_file(STOCK_OVERRIDES_PATH, {})
    deleted = ov.get("deleted", {})
    for key in ("strains", "plasmids"):
        by_id = {e["id"]: e for e in base.get(key, []) if isinstance(e, dict) and e.get("id")}
        for eid, entry in (ov.get(key) or {}).items():
            by_id[eid] = entry
        for eid in (deleted.get(key) or []):
            by_id.pop(eid, None)
        base[key] = sorted(by_id.values(),
                           key=lambda e: (e.get("label") or e.get("name") or e.get("id") or "").lower())
    base.setdefault("_meta", {}).setdefault("counts", {})
    base["_meta"]["counts"]["strains"] = len(base.get("strains", []))
    base["_meta"]["counts"]["plasmids"] = len(base.get("plasmids", []))
    _API["stock_center.json"] = base
    _STOCK_BLOB = json.dumps(base, separators=(",", ":"), ensure_ascii=False).encode()


def _log_curation(kind, action, item_id, curator):
    try:
        line = json.dumps({"ts": datetime.datetime.utcnow().isoformat() + "Z",
                           "type": kind, "action": action, "id": item_id,
                           "curator": curator or "Curator"})
        with open(CURATION_LOG_PATH, "a") as fh:
            fh.write(line + "\n")
    except OSError:
        pass


def save_gene_override(ddb, fields, curator):
    ov = _read_json_file(OVERRIDES_PATH, {})
    ov[ddb] = fields
    _atomic_write_json(OVERRIDES_PATH, ov)
    apply_gene_overrides()
    _log_curation("gene", "edit", ddb, curator)


def save_stock_override(kind, sid, entry, curator, delete=False):
    key = "strains" if kind == "strain" else "plasmids"
    ov = _read_json_file(STOCK_OVERRIDES_PATH, {})
    ov.setdefault(key, {})
    ov.setdefault("deleted", {}).setdefault("strains", [])
    ov["deleted"].setdefault("plasmids", [])
    if delete:
        ov[key].pop(sid, None)
        if sid not in ov["deleted"][key]:
            ov["deleted"][key].append(sid)
    else:
        ov[key][sid] = entry
        if sid in ov["deleted"][key]:
            ov["deleted"][key].remove(sid)
    _atomic_write_json(STOCK_OVERRIDES_PATH, ov)
    apply_stock_overrides()
    _log_curation(kind, "delete" if delete else "edit", sid, curator)


# --- Named curator accounts (username + password + display name + admin) ----
# Stored in curators.json (gitignored, durable). Passwords are salted PBKDF2
# hashes — the file never holds a readable password. The env CURATOR_PASSWORD
# remains a bootstrap admin login so you can always get in to create accounts.
def _hash_pw(password, salt=None):
    salt = salt or secrets.token_hex(16)
    h = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 200_000).hex()
    return salt, h


def _verify_pw(password, salt, expected):
    try:
        _, h = _hash_pw(password, salt)
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(h, expected)


# --- Two-factor auth for curator accounts: TOTP (RFC 6238), stdlib only ------
# Standard authenticator-app codes (Google Authenticator, 1Password, Authy, …):
# SHA-1, 6 digits, 30s step, accepted within +/-1 step for clock skew. The
# per-account base32 secret lives in curators.json (which is never web-served,
# see _is_blocked_path). The counter of the last accepted code is remembered so
# a code cannot be replayed inside its validity window. Single-use backup codes
# (stored as hashes) prevent lockout if a curator loses their phone.
TOTP_STEP = 30
TOTP_DIGITS = 6
TOTP_WINDOW = 1          # +/- one 30s step
BACKUP_CODE_COUNT = 10


def _totp_new_secret():
    return base64.b32encode(secrets.token_bytes(20)).decode().rstrip("=")


def _totp_at(secret, counter):
    key = base64.b32decode(secret.upper() + "=" * (-len(secret) % 8))
    mac = hmac.new(key, struct.pack(">Q", counter), hashlib.sha1).digest()
    off = mac[-1] & 0x0F
    num = struct.unpack(">I", mac[off:off + 4])[0] & 0x7FFFFFFF
    return str(num % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def _totp_check(secret, code, last_counter=-1, now=None):
    """Return the matched counter, or None. A counter <= last_counter is a
    replay of an already-used code and is rejected."""
    code = (code or "").strip().replace(" ", "").replace("-", "")
    if not (code.isdigit() and len(code) == TOTP_DIGITS):
        return None
    base = int((now if now is not None else time.time()) // TOTP_STEP)
    for drift in range(-TOTP_WINDOW, TOTP_WINDOW + 1):
        counter = base + drift
        if counter <= last_counter:
            continue
        try:
            if hmac.compare_digest(_totp_at(secret, counter), code):
                return counter
        except Exception:
            return None
    return None


def _otpauth_uri(username, secret, issuer="dictyBase"):
    """otpauth:// URI an authenticator app can take (paste or QR)."""
    label = quote(f"{issuer}:{username}")
    return (f"otpauth://totp/{label}?secret={secret}&issuer={quote(issuer)}"
            f"&algorithm=SHA1&digits={TOTP_DIGITS}&period={TOTP_STEP}")


def _new_backup_codes(n=BACKUP_CODE_COUNT):
    """Return (plaintext codes shown once, hashes to store)."""
    codes = ["-".join(secrets.token_hex(2) for _ in range(4)) for _ in range(n)]
    return codes, [hashlib.sha256(c.encode()).hexdigest() for c in codes]


def _consume_backup_code(accts, username, code):
    """Single-use recovery code: verify and burn it. True if accepted."""
    acct = accts.get(username) or {}
    want = hashlib.sha256((code or "").strip().lower().encode()).hexdigest()
    remaining = list(acct.get("backup") or [])
    for i, h in enumerate(remaining):
        if hmac.compare_digest(h, want):
            remaining.pop(i)
            acct["backup"] = remaining
            accts[username] = acct
            save_curators(accts)
            return True
    return False


def load_curators():
    d = _read_json_file(CURATORS_PATH, {})
    return d if isinstance(d, dict) else {}


def save_curators(accts):
    _atomic_write_json(CURATORS_PATH, accts)


def api_gene_rows():
    """ddb -> {ddb,symbol,name,location,ncbiGene}; plus a lowercase symbol->ddb map."""
    if "_rows" not in _API:
        rows, sym = {}, {}
        try:
            for ddb, symbol, name, loc, ncbi, *rest in _load_json("gene_index.json"):
                aliases = rest[0] if rest else []
                rows[ddb] = {"ddb": ddb, "symbol": symbol, "name": name, "location": loc,
                             "ncbiGene": ncbi, "synonyms": aliases}
                sym.setdefault(symbol.lower(), ddb)
                for a in aliases:               # old symbols resolve too (e.g. grlL -> far1)
                    sym.setdefault(a.lower(), ddb)
        except Exception:
            pass
        _API["_rows"], _API["_sym"] = rows, sym
    return _API["_rows"], _API["_sym"]


def resolve_gene(token):
    rows, sym = api_gene_rows()
    token = (token or "").strip()
    if token in rows:
        return token
    return sym.get(token.lower())


def api_go_inverse():
    if "_go_inv" not in _API:
        inv = {}
        rows, _ = api_gene_rows()
        for ddb, annots in _load_json("go_annotations.json").items():
            for go, aspect, ev, pmid in annots:
                inv.setdefault(go, []).append({
                    "ddb": ddb, "symbol": rows.get(ddb, {}).get("symbol", ddb),
                    "aspect": aspect, "evidence": ev, "pmid": pmid})
        _API["_go_inv"] = inv
    return _API["_go_inv"]


def api_phenotype_index():
    """lowercased phenotype term -> {term, genes:[{ddb,symbol}]} (one row per gene)."""
    if "_pheno_idx" not in _API:
        rows, _ = api_gene_rows()
        idx = {}
        for ddb, entries in _load_json("phenotypes.json").items():
            symbol = rows.get(ddb, {}).get("symbol", ddb)
            for entry in entries:
                term = (entry[0] if entry else "").strip()
                if not term:
                    continue
                bucket = idx.setdefault(term.lower(), {"term": term, "_seen": set(), "genes": []})
                if ddb not in bucket["_seen"]:
                    bucket["_seen"].add(ddb)
                    bucket["genes"].append({"ddb": ddb, "symbol": symbol})
        for bucket in idx.values():
            bucket.pop("_seen", None)
            bucket["genes"].sort(key=lambda g: g["symbol"].lower())
        _API["_pheno_idx"] = idx
    return _API["_pheno_idx"]


def api_strains():
    if "_strains" not in _API:
        sg, sp = {}, {}
        src = ASSETS / "dictybase-corpus"
        try:
            with open(src / "strain_genes.tsv") as fh:
                for row in csv.reader(fh, delimiter="\t"):
                    if len(row) >= 2:
                        sg[row[0].strip()] = row[1].strip()
        except Exception:
            pass
        try:
            with open(src / "strain_phenotype.tsv") as fh:
                for row in csv.reader(fh, delimiter="\t"):
                    if len(row) < 2:
                        continue
                    sp.setdefault(row[0].strip(), []).append({
                        "phenotype": html.unescape((row[1] if len(row) > 1 else "").strip()),
                        "condition": html.unescape((row[2] if len(row) > 2 else "").strip()),
                        "pmid": (row[4] if len(row) > 4 else "").strip(),
                        "note": html.unescape((row[5] if len(row) > 5 else "").strip()),
                    })
        except Exception:
            pass
        by_gene = {}
        for strain, gene in sg.items():
            by_gene.setdefault(gene, []).append(strain)
        _API["_strains"] = {"gene": sg, "pheno": sp, "by_gene": by_gene}
    return _API["_strains"]


def strip_markup(text):
    """dictyBase wiki markup -> plain text (for API consumers)."""
    if not text:
        return ""
    s = re.sub(r"\[(\S+)\s+([^\]]*)\]", lambda m: m.group(2).strip(), str(text))
    s = re.sub(r"''(.+?)''", r"\1", s)
    s = re.sub(r"<br\s*/?>", " ", s)
    return s.strip()


def assemble_gene(ddb):
    rows, _ = api_gene_rows()
    g = dict(rows[ddb])
    entry = _load_json("dictybase_corpus.json").get(ddb, {})
    g["summary"] = strip_markup(entry.get("summary"))
    g["curator"] = entry.get("curator")
    g["go"] = [{"id": go, "aspect": a, "evidence": ev, "pmid": p}
               for go, a, ev, p in _load_json("go_annotations.json").get(ddb, [])]
    g["phenotypes"] = [{"phenotype": t, "condition": c, "pmid": p, "note": n}
                       for t, c, p, n in _load_json("phenotypes.json").get(ddb, [])]
    seen, pmids = set(), []
    for m in re.finditer(r"pubmed/(\d+)", str(entry.get("summary", ""))):
        if m.group(1) not in seen:
            seen.add(m.group(1)); pmids.append(m.group(1))
    g["references"] = pmids
    g["sequences"] = {t: f"/api/sequence?ddb={ddb}&type={t}&symbol={g['symbol']}"
                      for t in ("genomic", "cdna", "protein")}
    g["strains"] = api_strains()["by_gene"].get(ddb, [])
    return g

def run_blast(program, database, query):
    """Pure BLAST compute shared by the sync handler and the async worker.
    Returns (http_code, payload_dict). No request/`self` state — safe to call
    from a pool thread."""
    if program not in BLAST_PROGRAMS:
        return 400, {"error": "Unsupported program."}
    if database == "all":
        db_ids = list(BLAST_SPECIES_DBS)
    elif database in BLAST_DBS:
        db_ids = [database]
    else:
        return 400, {"error": "Unknown database."}
    query = (query or "").strip()
    if not query:
        return 400, {"error": "Empty query sequence."}
    if not query.startswith(">"):
        query = ">query\n" + query
    binpath = blast_bin(program)
    if not binpath:
        return 503, {"error": "BLAST is not installed on the server. See README (P6)."}
    missing = [d for d in db_ids if not (BLAST_DB_DIR / (d + ".nsq")).exists()
               and not (BLAST_DB_DIR / (d + ".nin")).exists()]
    if missing:
        return 503, {"error": "BLAST databases not built. Run scripts/build_blastdb.py."}
    db_arg = " ".join(str(BLAST_DB_DIR / d) for d in db_ids)
    qf = tempfile.NamedTemporaryFile("w", suffix=".fa", delete=False)
    try:
        qf.write(query)
        qf.close()
        cmd = [binpath, "-query", qf.name, "-db", db_arg,
               "-outfmt", "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore qseq sseq",
               "-max_target_seqs", "50", "-evalue", "1e-3"]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
    except subprocess.TimeoutExpired:
        return 504, {"error": "BLAST timed out (try a shorter query or one genome)."}
    finally:
        try:
            os.unlink(qf.name)
        except OSError:
            pass
    if proc.returncode != 0:
        return 500, {"error": "BLAST failed.", "detail": (proc.stderr or "")[:400]}
    hits = []
    for line in proc.stdout.splitlines():
        f = line.split("\t")
        if len(f) < 14:
            continue
        acc = re.sub(r"^[a-z]+\|", "", f[1]).strip("|")
        hit = {"subject": acc, "identity": float(f[2]), "length": int(f[3]),
               "qstart": int(f[6]), "qend": int(f[7]),
               "sstart": int(f[8]), "send": int(f[9]),
               "evalue": f[10], "bitscore": float(f[11]),
               "qseq": f[12], "sseq": f[13]}
        g = gene_for_hit(acc, f[8], f[9])
        if g:
            hit["gene"] = g
        hits.append(hit)
    return 200, {"program": program, "databases": db_ids, "count": len(hits), "hits": hits}


def run_conservation(ddb):
    """Pure conservation compute (one tblastn vs the species set, query-anchored).
    Returns (http_code, payload_dict). Safe to call from a pool thread."""
    ddb = (ddb or "").strip().upper()
    if not re.match(r"^DDB_G\d+$", ddb):
        return 400, {"error": "bad or missing ddb"}
    prot = (extract_sequence(ddb, "protein") or "").strip().replace("*", "")
    if not prot:
        return 404, {"error": "no protein for this gene"}
    L = len(prot)
    binpath = blast_bin("tblastn")
    if not binpath:
        return 503, {"error": "BLAST unavailable"}
    # Species set only — conspecific wild isolates would skew per-residue conservation.
    db_arg = " ".join(str(BLAST_DB_DIR / d) for d in BLAST_SPECIES_DBS)
    qf = tempfile.NamedTemporaryFile("w", suffix=".fa", delete=False)
    try:
        qf.write(">q\n" + prot + "\n")
        qf.close()
        cmd = [binpath, "-query", qf.name, "-db", db_arg,
               "-outfmt", "6 sseqid bitscore qstart qend qseq sseq",
               "-max_target_seqs", "20", "-evalue", "1e-5"]
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=90)
    except subprocess.TimeoutExpired:
        return 504, {"error": "conservation search timed out"}
    finally:
        try:
            os.unlink(qf.name)
        except OSError:
            pass
    best = {}  # best HSP per subject sequence
    for line in proc.stdout.splitlines():
        f = line.split("\t")
        if len(f) < 6:
            continue
        sid, bs = f[0], float(f[1])
        if sid not in best or bs > best[sid][0]:
            best[sid] = (bs, int(f[2]), f[4], f[5])
    cons, cov, used = [0] * L, [0] * L, 0
    for _sid, (bs, qstart, qseq, sseq) in sorted(best.items(), key=lambda kv: -kv[1][0])[:12]:
        used += 1
        p = qstart - 1
        for a, b in zip(qseq, sseq):
            if a == "-":
                continue
            if 0 <= p < L:
                cov[p] += 1
                if a.upper() == b.upper():
                    cons[p] += 1
            p += 1
    frac = [round(cons[i] / cov[i], 3) if cov[i] else 0.0 for i in range(L)]
    return 200, {"length": L, "homologs": used, "conservation": frac}


def _uniprot_for(ddb):
    return (_load_json("uniprot_map.json").get("map", {}).get(ddb) or {}).get("acc", "")


def _idmap_reverse():
    """Cached reverse lookups for the batch ID converter: UniProt acc -> ddb and
    NCBI gene id -> ddb. Built once from the gene index + uniprot map."""
    if "_idrev" not in _API:
        rows, _sym = api_gene_rows()
        by_uniprot, by_ncbi = {}, {}
        for ddb, info in _load_json("uniprot_map.json").get("map", {}).items():
            acc = (info or {}).get("acc")
            if acc:
                by_uniprot.setdefault(acc.upper(), ddb)
        for ddb, r in rows.items():
            if r.get("ncbiGene"):
                by_ncbi.setdefault(str(r["ncbiGene"]), ddb)
        _API["_idrev"] = {"uniprot": by_uniprot, "ncbi": by_ncbi}
    return _API["_idrev"]


def resolve_ids(tokens):
    """Resolve mixed gene identifiers (symbol / DDB_G id / UniProt acc / NCBI
    gene id) to a normalized cross-reference row each."""
    rows, sym = api_gene_rows()
    rev = _idmap_reverse()
    out = []
    for raw in tokens:
        t = (raw or "").strip()
        if not t:
            continue
        ddb = None
        tu = t.upper()
        if re.match(r"^DDB_G\d+$", tu):
            ddb = tu if tu in rows else None
        elif t.lower() in sym:
            ddb = sym[t.lower()]
        elif tu in rev["uniprot"]:
            ddb = rev["uniprot"][tu]
        elif t.isdigit() and t in rev["ncbi"]:
            ddb = rev["ncbi"][t]
        if ddb and ddb in rows:
            r = rows[ddb]
            out.append({"input": t, "found": True, "ddb": ddb, "symbol": r["symbol"],
                        "name": r["name"], "uniprot": _uniprot_for(ddb),
                        "ncbiGene": r["ncbiGene"], "location": r["location"]})
        else:
            out.append({"input": t, "found": False})
    return out


# Genes ordered along each chromosome, for the neighborhood/synteny view.
def _chrom_order():
    if "_chrom_order" not in _API:
        models = _load_json("gene_models.json")
        by_chrom = {}
        for ddb, m in models.items():
            by_chrom.setdefault(m.get("chrom", ""), []).append((m.get("start", 0), ddb))
        index = {}  # ddb -> (chrom, position-in-chrom)
        for chrom, lst in by_chrom.items():
            lst.sort()
            for i, (_s, ddb) in enumerate(lst):
                index[ddb] = (chrom, i)
        _API["_chrom_lists"] = {c: [d for _s, d in lst] for c, lst in by_chrom.items()}
        _API["_chrom_order"] = index
    return _API["_chrom_order"], _API["_chrom_lists"]


def gene_neighborhood(ddb, k=5):
    ddb = (ddb or "").strip().upper()
    rows, _sym = api_gene_rows()
    models = _load_json("gene_models.json")
    index, lists = _chrom_order()
    if ddb not in index:
        return 404, {"error": "gene not on a placed contig"}
    chrom, pos = index[ddb]
    order = lists[chrom]
    lo, hi = max(0, pos - k), min(len(order), pos + k + 1)
    genes = []
    for d in order[lo:hi]:
        m = models.get(d, {})
        r = rows.get(d, {})
        genes.append({"ddb": d, "symbol": r.get("symbol") or d, "name": r.get("name", ""),
                      "strand": m.get("strand", "+"), "start": m.get("start"),
                      "end": m.get("end"), "target": d == ddb})
    return 200, {"ddb": ddb, "chrom": chrom, "genes": genes}


def run_variation(ddb):
    """Amino-acid variation of a gene's protein across the Ahmed et al. 2025 wild
    isolates: tblastn the reference protein vs each isolate assembly, compare the
    best HSP to the query, and report identity + substitutions. (code, payload)."""
    ddb = (ddb or "").strip().upper()
    if not re.match(r"^DDB_G\d+$", ddb):
        return 400, {"error": "bad or missing ddb"}
    prot = (extract_sequence(ddb, "protein") or "").strip().replace("*", "")
    if not prot:
        return 404, {"error": "no protein for this gene"}
    L = len(prot)
    binpath = blast_bin("tblastn")
    if not binpath:
        return 503, {"error": "BLAST unavailable"}
    qf = tempfile.NamedTemporaryFile("w", suffix=".fa", delete=False)
    isolates = []
    try:
        qf.write(">q\n" + prot + "\n")
        qf.close()
        for db in [d for d in BLAST_DBS if d in BLAST_ISOLATE_DBS]:
            label = BLAST_DBS[db]
            if not (BLAST_DB_DIR / (db + ".nsq")).exists():
                continue
            cmd = [binpath, "-query", qf.name, "-db", str(BLAST_DB_DIR / db),
                   "-outfmt", "6 pident length qstart qend qseq sseq bitscore",
                   "-max_target_seqs", "5", "-evalue", "1e-5"]
            try:
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
            except subprocess.TimeoutExpired:
                continue
            best = None
            for line in proc.stdout.splitlines():
                f = line.split("\t")
                if len(f) < 7:
                    continue
                bs = float(f[6])
                if best is None or bs > best[6]:
                    best = (float(f[0]), int(f[1]), int(f[2]), int(f[3]), f[4], f[5], bs)
            if not best:
                isolates.append({"id": db, "label": label, "found": False})
                continue
            pident, alnlen, qstart, _qend, qseq, sseq, _bs = best
            subs = []
            p = qstart
            for a, b in zip(qseq, sseq):
                if a != "-":
                    if b != "-" and b.upper() != a.upper() and b.upper() != "X":
                        subs.append({"pos": p, "ref": a.upper(), "alt": b.upper()})
                    p += 1
            isolates.append({"id": db, "label": label, "found": True,
                             "identity": round(pident, 1),
                             "coverage": round(100.0 * alnlen / L, 1),
                             "n_subs": len(subs), "subs": subs[:80]})
    finally:
        try:
            os.unlink(qf.name)
        except OSError:
            pass
    return 200, {"ddb": ddb, "length": L, "isolates": isolates}


def bulk_tsv(dataset):
    """Generate a TSV dump of a dataset for the bulk-download page. Returns
    (filename, text) or (None, None) for an unknown dataset."""
    rows, _sym = api_gene_rows()
    out = []
    if dataset == "genes":
        out.append("ddb_g\tsymbol\tname\tlocation\tncbi_gene\tuniprot")
        for ddb, r in rows.items():
            out.append("\t".join(str(x) for x in [ddb, r["symbol"], r["name"],
                       r["location"], r["ncbiGene"], _uniprot_for(ddb)]))
    elif dataset == "go":
        out.append("ddb_g\tsymbol\tgo_id\taspect\tevidence\tpmid")
        annots = _load_json("go_annotations.json")
        for ddb, entries in annots.items():
            sym = rows.get(ddb, {}).get("symbol", "")
            for e in entries:
                go, aspect, ev, pmid = (list(e) + ["", "", "", ""])[:4]
                out.append("\t".join(str(x) for x in [ddb, sym, go, aspect, ev, pmid]))
    elif dataset == "phenotypes":
        out.append("ddb_g\tsymbol\tphenotype\tpmid")
        ph = _load_json("phenotypes.json")
        for ddb, entries in ph.items():
            sym = rows.get(ddb, {}).get("symbol", "")
            for e in entries:
                term = e[0] if isinstance(e, (list, tuple)) else e
                pmid = e[2] if isinstance(e, (list, tuple)) and len(e) > 2 else ""
                out.append("\t".join(str(x) for x in [ddb, sym, term, pmid]))
    elif dataset == "orthologs":
        out.append("ddb_g\tsymbol\thuman_ortholog\trelationship\tdisease")
        od = _load_json("ortholog_disease.json")
        for ddb, info in od.items():
            if not isinstance(info, dict):
                continue
            sym = info.get("symbol") or rows.get(ddb, {}).get("symbol", "")
            for orth in info.get("orthologs", []):
                human = orth.get("human_symbol", "")
                rel = orth.get("relationship", "")
                diseases = orth.get("diseases", []) or []
                dis = "; ".join(d.get("name", "") if isinstance(d, dict) else str(d) for d in diseases)
                out.append("\t".join(str(x) for x in [ddb, sym, human, rel, dis]))
    else:
        return None, None
    return f"dictyatduke_{dataset}.tsv", "\n".join(out) + "\n"


# Genome FASTA per genome id (matches the BLAST/browser ids). AX4 uses the
# RefSeq assembly (NC_ contigs match gene coordinates); the rest use the
# _browser.fna built by scripts/fetch/build. Used by the region + in-silico PCR
# tools, which need whole-contig sequence (not just per-gene).
GENOME_FILES = {
    "d-discoideum-ax4": "D_discoideum_AX4_refseq.fna",
    "d-purpureum": "D_purpureum_browser.fna",
    "d-firmibasis": "D_firmibasis_browser.fna",
    "c-fasciculata-sh3": "C_fasciculata_SH3_browser.fna",
    "c-polycephalum": "C_polycephalum_browser.fna",
    "s-polycarpum": "S_polycarpum_browser.fna",
    "h-pallidum-pn500": "H_pallidum_PN500_browser.fna",
    "h-pallidum-new": "H_pallidum_new_browser.fna",
    "p-violaceum": "P_violaceum_browser.fna",
    "d-citrinum": "D_citrinum_GS8b_browser.fna",
    "d-dimigraforme": "D_dimigraforme_Ar5b_browser.fna",
    "dd-ax2-214": "Dd_AX2-214_browser.fna",
    "dd-cr116c": "Dd_CR116C_browser.fna",
    "dd-ot3a": "Dd_OT3A_browser.fna",
    "dd-m4b": "Dd_M4B_browser.fna",
    "dd-s6b": "Dd_S6B_browser.fna",
    "dc-cf3b": "D_citrinum_Cf3b_browser.fna",
}
_GENOME_CACHE = {}          # gid -> {chrom: seq}; tiny LRU (each genome ~30 MB)
_GENOME_CACHE_ORDER = []


def load_genome(gid):
    if gid == "d-discoideum-ax4":
        return genome_seq()                      # already cached separately
    if gid in _GENOME_CACHE:
        return _GENOME_CACHE[gid]
    fn = GENOME_FILES.get(gid)
    if not fn:
        return {}
    seq, cur, buf = {}, None, []
    try:
        with open(pathlib.Path(ROOT) / "assets" / "genomes" / fn) as fh:
            for line in fh:
                if line.startswith(">"):
                    if cur:
                        seq[cur] = "".join(buf)
                    cur = line[1:].split()[0]
                    buf = []
                else:
                    buf.append(line.strip())
        if cur:
            seq[cur] = "".join(buf)
    except OSError:
        return {}
    _GENOME_CACHE[gid] = seq
    _GENOME_CACHE_ORDER.append(gid)
    while len(_GENOME_CACHE_ORDER) > 3:
        _GENOME_CACHE.pop(_GENOME_CACHE_ORDER.pop(0), None)
    return seq


_COMP = str.maketrans("ACGTUNRYKMSWBDHVacgtunrykmswbdhv",
                      "TGCAANYRMKSWVHDBtgcaanyrmkswvhdb")


def revcomp(s):
    return s.translate(_COMP)[::-1]


def extract_region(gid, chrom, start, end, strand, flank):
    if gid not in GENOME_FILES:
        return 400, {"error": "unknown genome"}
    seq = load_genome(gid)
    if not seq:
        return 503, {"error": "genome not available on the server"}
    if chrom not in seq:
        return 404, {"error": f"contig '{chrom}' not found", "contigs": list(seq.keys())[:25]}
    c = seq[chrom]
    try:
        start, end = int(start), int(end)
        flank = max(0, min(100000, int(flank or 0)))
    except (TypeError, ValueError):
        return 400, {"error": "coordinates must be integers"}
    if end < start:
        return 400, {"error": "end must be >= start"}
    a, b = max(1, start - flank), min(len(c), end + flank)
    sub = c[a - 1:b].upper()
    if strand == "-":
        sub = revcomp(sub)
    return 200, {"genome": gid, "chrom": chrom, "start": a, "end": b,
                 "strand": strand or "+", "length": len(sub), "seq": sub}


def _amplicons(chrom, u, left, rightsite, label_l, label_r, maxsize, strand, acc):
    i = u.find(left)
    while i != -1 and len(acc) < 50:
        j = u.find(rightsite, i + len(left))
        if j != -1:
            end = j + len(rightsite)
            size = end - i
            if size <= maxsize:
                amp = u[i:end]
                acc.append({"chrom": chrom, "start": i + 1, "end": end, "size": size,
                            "strand": strand, "fwd": label_l, "rev": label_r,
                            "seq": amp if len(amp) <= 4000 else amp[:2000] + "…" + amp[-2000:]})
        i = u.find(left, i + 1)


def run_ispcr(gid, fwd, rev, maxsize):
    """Perfect-match in-silico PCR: find amplicons bounded by the two primers."""
    if gid not in GENOME_FILES:
        return 400, {"error": "unknown genome"}
    fwd = re.sub(r"[^ACGT]", "", (fwd or "").upper())
    rev = re.sub(r"[^ACGT]", "", (rev or "").upper())
    if len(fwd) < 10 or len(rev) < 10:
        return 400, {"error": "both primers must be at least 10 nt of A/C/G/T"}
    try:
        maxsize = max(50, min(20000, int(maxsize or 4000)))
    except (TypeError, ValueError):
        maxsize = 4000
    seq = load_genome(gid)
    if not seq:
        return 503, {"error": "genome not available on the server"}
    products = []
    rcF, rcR = revcomp(fwd), revcomp(rev)
    for chrom, cseq in seq.items():
        u = cseq.upper()
        _amplicons(chrom, u, fwd, rcR, "fwd", "rev", maxsize, "+", products)   # fwd → ...← rev
        _amplicons(chrom, u, rev, rcF, "rev", "fwd", maxsize, "-", products)   # other strand
        if len(products) >= 50:
            break
    products.sort(key=lambda p: p["size"])
    return 200, {"genome": gid, "count": len(products), "products": products[:50]}


def _parse_fasta(text):
    """Parse FASTA into [(name, seq)]; tolerates bare sequences (one per line)."""
    text = (text or "").strip()
    if not text:
        return []
    if not text.lstrip().startswith(">"):
        return [(f"seq{i+1}", s.strip()) for i, s in enumerate(text.splitlines()) if s.strip()]
    out, name, buf = [], None, []
    for line in text.splitlines():
        if line.startswith(">"):
            if name is not None:
                out.append((name, "".join(buf)))
            name = line[1:].strip() or f"seq{len(out)+1}"
            buf = []
        else:
            buf.append(line.strip())
    if name is not None:
        out.append((name, "".join(buf)))
    return [(n, s) for n, s in out if s]


def run_align(fasta_text):
    recs = _parse_fasta(fasta_text)
    if len(recs) < 2:
        return 400, {"error": "Provide at least two sequences (FASTA)."}
    if len(recs) > msa.MAX_SEQS:
        recs = recs[:msa.MAX_SEQS]
    names = [n for n, _ in recs]
    aligned = msa.align([s for _, s in recs])
    return 200, {"count": len(aligned), "length": len(aligned[0]) if aligned else 0,
                 "identity": msa.percent_identity(aligned),
                 "consensus": msa.consensus(aligned),
                 "rows": [{"name": names[i], "seq": aligned[i]} for i in range(len(aligned))]}


_PEAK_STAGES = ["0 h", "4 h", "8 h", "12 h", "16 h", "20 h", "24 h"]


def _sig(results, cap=10):
    """Top significant enrichment rows (q <= 0.05); fall back to the top few."""
    rows = results or []
    sig = [r for r in rows if r.get("q_value", 1) <= 0.05]
    return (sig or rows[:5])[:cap]


def _geneset_summary(n, go_sig, ph_sig, kegg_sig, with_orth, with_dis, peak_hist, no_peak):
    parts = [f"Your set of {n} recognized gene{'s' if n != 1 else ''}"]
    themes = []
    if kegg_sig:
        themes.append("KEGG pathways including " + kegg_sig[0]["term"])
    if go_sig:
        themes.append(f"{len(go_sig)} over-represented GO term{'s' if len(go_sig) != 1 else ''}")
    if themes:
        parts[0] += " is enriched for " + " and ".join(themes)
    if ph_sig:
        parts.append("Shared mutant phenotypes include " + ph_sig[0]["term"])
    if any(peak_hist):
        top_i = max(range(7), key=lambda i: peak_hist[i])
        if peak_hist[top_i]:
            parts.append(f"Developmental expression most often peaks at {_PEAK_STAGES[top_i]} "
                         f"({peak_hist[top_i]} of {n})")
    if with_dis:
        parts.append(f"{with_dis} of {n} have a human ortholog linked to disease")
    elif with_orth:
        parts.append(f"{with_orth} of {n} have a human ortholog")
    return ". ".join(parts) + "."


def geneset_report(tokens):
    """Deterministic interpretation of a gene set: enrichment (GO / phenotype /
    KEGG), human-ortholog & disease counts, developmental expression-peak
    profile, notable genes, and a plain-language summary. No external API.

    Accepts gene symbols, DDB_G ids, UniProt accessions, and NCBI Gene ids —
    the latter two are translated to DDB_G ids up front so the enrichment engine
    (symbol/DDB-keyed) can use them."""
    rev = _idmap_reverse()
    tokens = [(rev["uniprot"].get(t.strip().upper()) or rev["ncbi"].get(t.strip())
               or t) for t in tokens]
    matched, unmatched = enrichment.resolve_genes(tokens)
    matched = sorted(matched)
    if not matched:
        return 200, {"matched_n": 0, "unmatched": unmatched,
                     "summary": "None of those identifiers matched a Dictyostelium gene."}
    go = enrichment.enrich(tokens)
    pheno = enrichment.enrich_phenotypes(tokens)
    kegg = enrichment.enrich_kegg(tokens)
    facets = _load_json("gene_facets.json")
    od = _load_json("ortholog_disease.json")
    rows, _sym = api_gene_rows()
    with_orth = with_dis = no_peak = 0
    peak_hist = [0] * 7
    for ddb in matched:
        f = facets.get(ddb) or [0, 0, 0, -1]
        if len(f) > 1 and f[1]:
            with_orth += 1
        if len(f) > 2 and f[2]:
            with_dis += 1
        peak = f[3] if len(f) > 3 else -1
        if isinstance(peak, int) and 0 <= peak < 7:
            peak_hist[peak] += 1
        else:
            no_peak += 1
    notable = []
    for ddb in matched:
        info = od.get(ddb)
        if not isinstance(info, dict):
            continue
        hit = None
        for orth in info.get("orthologs", []):
            for d in (orth.get("diseases") or []):
                dis = d.get("name") if isinstance(d, dict) else str(d)
                if dis:
                    hit = (orth.get("human_symbol", ""), dis)
                    break
            if hit:
                break
        if hit:
            sym = info.get("symbol") or rows.get(ddb, {}).get("symbol", ddb)
            notable.append({"ddb": ddb, "symbol": sym, "human": hit[0], "disease": hit[1]})
        if len(notable) >= 15:
            break
    go_sig, ph_sig, kegg_sig = _sig(go.get("results")), _sig(pheno.get("results")), _sig(kegg.get("results"))
    summary = _geneset_summary(len(matched), go_sig, ph_sig, kegg_sig,
                               with_orth, with_dis, peak_hist, no_peak)
    keep_go = lambda r: {"id": r["id"], "aspect": r.get("aspect"), "fold": r.get("fold_enrichment"),
                         "study_count": r.get("study_count"), "q": round(r.get("q_value", 1), 4)}
    keep_t = lambda r: {"id": r.get("id"), "term": r.get("term"), "fold": r.get("fold_enrichment"),
                        "study_count": r.get("study_count"), "q": round(r.get("q_value", 1), 4)}
    return 200, {
        "matched_n": len(matched), "unmatched": unmatched[:50],
        "summary": summary,
        "go": [keep_go(r) for r in go_sig],
        "phenotype": [keep_t(r) for r in ph_sig],
        "kegg": [keep_t(r) for r in kegg_sig],
        "orthologs": {"with_ortholog": with_orth, "with_disease": with_dis, "total": len(matched)},
        "expression": {"stages": _PEAK_STAGES, "hist": peak_hist, "no_peak": no_peak},
        "notable": notable,
    }


# Read-only GET endpoints safe to cache at a CDN edge. Data changes only on a
# (infrequent) rebuild or a curation edit, so a short edge TTL with
# stale-while-revalidate offloads the vast majority of reads with at most a few
# minutes' staleness. Write/auth/analysis endpoints (blast, enrichment, login,
# upload, hit, stats) are deliberately absent and stay uncached.
API_CACHEABLE_PREFIXES = (
    "/api/gene", "/api/sequence", "/api/search", "/api/phenotype-search",
    "/api/go/", "/api/strain/", "/api/data-status", "/api/version",
    "/api/recent-papers", "/api/coexpression", "/api/expression", "/api/domains",
    "/api/neighborhood", "/api/region", "/api/ispcr", "/api/protein-props",
)
API_CACHE_CONTROL = "public, max-age=60, s-maxage=300, stale-while-revalidate=600"


class Handler(http.server.SimpleHTTPRequestHandler):
    # HTTP/1.1 enables connection keep-alive (every response below sets a
    # correct Content-Length, so the stdlib reuses the socket instead of a fresh
    # TCP/TLS handshake per request). Idle keep-alive sockets time out at 30s.
    protocol_version = "HTTP/1.1"
    timeout = 30

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def handle_one_request(self):
        # Reset per-request flags before each request on a kept-alive connection
        # so state (e.g. the index's no-cache) can't leak to the next response.
        self._no_cache = False
        self._code = 200
        super().handle_one_request()

    def send_response(self, code, message=None):
        self._code = code  # captured so end_headers only caches success responses
        super().send_response(code, message)

    def do_GET(self):
        # Per-gene sequence download (genomic / cDNA / protein FASTA)
        if self.path.startswith("/api/sequence?"):
            self._handle_sequence()
            return

        # Public read API
        if self.path.startswith("/api/gene-card"):
            self._handle_gene_card()
            return
        if self.path.startswith("/api/gene-annotations"):
            self._handle_gene_annotations()
            return
        if self.path.startswith("/api/gene-extras"):
            self._handle_gene_extras()
            return
        if self.path.startswith("/api/promoter"):
            self._handle_promoter()
            return
        if self.path.startswith("/api/gene/"):
            self._handle_api_gene(unquote(self.path[len("/api/gene/"):].split("?")[0]))
            return
        if self.path.startswith("/api/search"):
            self._handle_api_search()
            return
        if self.path.startswith("/api/phenotype-search"):
            self._handle_api_phenotype_search()
            return
        if self.path.startswith("/api/go/"):
            self._handle_api_go(unquote(self.path[len("/api/go/"):].split("?")[0]))
            return
        if self.path.startswith("/api/strain/"):
            self._handle_api_strain(unquote(self.path[len("/api/strain/"):].split("?")[0]))
            return
        if self.path.startswith("/api/data-status"):
            self._handle_api_status()
            return
        if self.path.startswith("/api/neighborhood"):
            self._handle_neighborhood()
            return
        if self.path.startswith("/api/bulk"):
            self._handle_bulk()
            return
        if self.path.startswith("/api/region"):
            self._handle_region()
            return
        if self.path.startswith("/api/ispcr"):
            self._handle_ispcr()
            return
        if self.path.startswith("/api/protein-props"):
            self._handle_protein_props()
            return
        if self.path.startswith("/api/variation"):
            ddb = parse_qs(urlparse(self.path).query).get("ddb", [""])[0]
            if "async=1" in (urlparse(self.path).query or ""):
                jid = submit_job(lambda: run_variation(ddb))
                self.send_json(202, {"job_id": jid})
            elif self._acquire_blast_slot():
                try:
                    code, payload = run_variation(ddb)
                    self.send_json(code, payload)
                finally:
                    _BLAST_SEM.release()
            return
        if self.path.startswith("/api/version"):
            meta = _release_meta()
            stamp = _data_version()
            meta["data_updated"] = (datetime.datetime.utcfromtimestamp(stamp).strftime("%Y-%m-%d")
                                    if stamp else "")
            meta["ai_assistant"] = bool(GEMINI_API_KEY)   # lets the UI hide the tool if off
            self.send_json(200, meta)
            return
        if self.path.startswith("/api/health"):
            # Lightweight uptime check: 200 only if serve.py is up AND the core
            # gene index loads with content. Not in API_CACHEABLE_PREFIXES, so it
            # is served no-cache — every check truly hits the origin.
            try:
                genes = _load_json("gene_index.json")
                ok = isinstance(genes, list) and len(genes) > 0
            except Exception:
                ok = False
            self.send_json(200 if ok else 503, {"status": "ok" if ok else "degraded"})
            return
        if self.path.startswith("/api/stock-gwdi"):
            self._handle_stock_gwdi()
            return
        if self.path.startswith("/api/recent-papers"):
            self._handle_recent_papers()
            return
        if self.path.startswith("/api/domains"):
            self._handle_domains()   # gates the live-fetch path internally
            return
        if self.path.startswith("/api/coexpression"):
            self._handle_coexpression()
            return
        if self.path.startswith("/api/expression"):
            self._handle_expression()
            return
        if self.path.startswith("/api/job"):
            self._handle_job_status()
            return
        if self.path.startswith("/api/conservation"):
            if "async=1" in (urlparse(self.path).query or ""):
                self._handle_conservation_async()       # pool-bounded, pollable
            elif self._acquire_blast_slot():
                try:
                    self._handle_conservation()
                finally:
                    _BLAST_SEM.release()
            return
        if self.path.startswith("/api/crispr"):
            if self._acquire_blast_slot():
                try:
                    self._handle_crispr()
                finally:
                    _BLAST_SEM.release()
            return
        if self.path.startswith("/api/primers"):
            self._handle_primers()
            return
        if self.path.startswith("/api/ext"):
            self._handle_ext_proxy()   # gates the live-fetch path internally
            return

        # AlphaFold proxy
        m = re.match(r"^/api/alphafold/([A-Z0-9]+)$", self.path, re.I)
        if m:
            if not self._acquire_proxy_slot():
                return
            uniprot = m.group(1).upper()
            try:
                with urllib.request.urlopen(f"https://alphafold.ebi.ac.uk/api/prediction/{uniprot}", timeout=10, context=SSL_CTX) as r:
                    info = json.loads(r.read())[0]
                pdb_url = info.get("pdbUrl", "")
                if not pdb_url: raise ValueError("No pdbUrl")
                with urllib.request.urlopen(pdb_url, timeout=15, context=SSL_CTX) as r:
                    pdb_data = r.read()
                self.send_response(200)
                self.send_header("Content-Type", "chemical/x-pdb")
                self.send_header("Content-Length", str(len(pdb_data)))
                self.send_header("Access-Control-Allow-Origin", "*")
                self.end_headers()
                self.wfile.write(pdb_data)
            except Exception as e:
                self.send_error(404, str(e))
            finally:
                _PROXY_SEM.release()
            return

        # Aggregate pageview stats (curator-only; aggregate counts, no PII)
        if self.path.startswith("/api/stats"):
            if not self._auth(self._parse_token()):
                self.send_json(401, {"error": "Unauthorized"})
                return
            with _PV_LOCK:
                _load_pageviews()
                counts = dict(sorted(_PAGEVIEWS["counts"].items(), key=lambda kv: -kv[1]))
                days = dict(sorted(_PAGEVIEWS.get("days", {}).items()))
                referrers = dict(sorted(_PAGEVIEWS.get("referrers", {}).items(), key=lambda kv: -kv[1]))
                today = datetime.datetime.utcnow().strftime("%Y-%m-%d")
                self.send_json(200, {"since": _PAGEVIEWS["since"], "updated": _PAGEVIEWS["updated"],
                                     "total": sum(counts.values()), "counts": counts,
                                     "days": days, "today": days.get(today, 0),
                                     "referrers": referrers})
            return

        # Curator dashboard API — list pending curations
        if self.path == "/api/curator/queue":
            token = self._parse_token()
            if not self._auth(token):
                self.send_json(401, {"error": "Unauthorized"})
                return
            items = []
            for f in sorted((UPLOADS_DIR / "curations").glob("*.json")):
                try:
                    items.append(json.loads(f.read_text()))
                except: pass
            self.send_json(200, items)
            return

        # Curator dashboard API — raw corpus entry for a gene, to seed the edit
        # form (returns the summary WITH markup, unlike the public gene record).
        if self.path.startswith("/api/curator/entry"):
            if not self._auth(self._parse_token()):
                self.send_json(401, {"error": "Unauthorized"})
                return
            ddb = (parse_qs(urlparse(self.path).query).get("ddb") or [""])[0].strip()
            e = _load_json("dictybase_corpus.json").get(ddb, {})
            self.send_json(200, {"ddb": ddb, "summary": e.get("summary", ""),
                                 "note": e.get("note", ""), "curator": e.get("curator", ""),
                                 "pmids": e.get("curator_pmids", ""),
                                 "curator_date": e.get("curator_date", "")})
            return

        # Curator dashboard API — look up a strain/plasmid to seed the edit form.
        # ?type=strain|plasmid & (id=DBS…/DBP… for an exact entry, OR q=text to
        # search label/name/summary and return up to 15 matches to pick from).
        if self.path.startswith("/api/curator/stock-entry"):
            if not self._auth(self._parse_token()):
                self.send_json(401, {"error": "Unauthorized"})
                return
            q = parse_qs(urlparse(self.path).query)
            kind = (q.get("type") or [""])[0].strip()
            sid = (q.get("id") or [""])[0].strip()
            term = (q.get("q") or [""])[0].strip().lower()
            key = "strains" if kind == "strain" else "plasmids"
            arr = _load_json("stock_center.json").get(key, [])
            if sid:
                entry = next((e for e in arr if isinstance(e, dict) and e.get("id") == sid), None)
                self.send_json(200, {"found": entry is not None, "entry": entry or {}})
                return
            matches = []
            if term:
                for e in arr:
                    if not isinstance(e, dict):
                        continue
                    hay = " ".join(str(e.get(f, "")) for f in
                                   ("id", "label", "name", "summary", "description", "genotype")).lower()
                    if term in hay:
                        matches.append({"id": e.get("id"),
                                        "label": e.get("label") or e.get("name") or e.get("id")})
                        if len(matches) >= 15:
                            break
            self.send_json(200, {"matches": matches})
            return

        # Curator dashboard API — list curator accounts (admin only, no passwords).
        if self.path == "/api/curator/2fa":
            self._handle_2fa_status()
            return
        if self.path == "/api/curator/accounts":
            self._handle_accounts_list()
            return

        # Curator dashboard API — download a snapshot of all durable curation
        # (gene overrides + stock overrides + the audit log) for backup.
        if self.path.startswith("/api/curator/backup"):
            if not self._auth(self._parse_token()):
                self.send_json(401, {"error": "Unauthorized"})
                return
            try:
                log_lines = CURATION_LOG_PATH.read_text().splitlines() if CURATION_LOG_PATH.exists() else []
            except OSError:
                log_lines = []
            bundle = {
                "exported": datetime.datetime.utcnow().isoformat() + "Z",
                "gene_overrides": _read_json_file(OVERRIDES_PATH, {}),
                "stock_overrides": _read_json_file(STOCK_OVERRIDES_PATH, {}),
                "log": [json.loads(x) for x in log_lines if x.strip()],
            }
            body = json.dumps(bundle, indent=2).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Disposition", "attachment; filename=dicty-curation-backup.json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return

        raw = self.path.split("?")[0]
        # Secrets, curator accounts, override/audit state, and the upload inbox
        # live under ROOT but must never be served — 404 before any file handler.
        if _is_blocked_path(raw):
            self.send_error(404, "Not Found")
            return
        _, ext = os.path.splitext(raw)
        ext = ext.lower()   # case-insensitive: serve .JPG the same as .jpg
        # The stock catalog is served with curator overrides merged in (durable
        # web edits), not as the raw file on disk.
        if raw == "/assets/stock_center.json" and _STOCK_BLOB is not None:
            body = _STOCK_BLOB
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-cache, must-revalidate")
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return
        if raw == "/robots.txt":
            return self._serve_robots()
        if raw == "/sitemap.xml":
            return self._serve_sitemap()
        if raw == "/news.xml":
            return self._serve_news_feed()
        # Serve the SPA shell (with cache-busted asset URLs) for the root, an
        # explicit index.html, or any non-static client route. Real static
        # files fall through to the default handler.
        if raw in ("/", "/index.html") or ext not in STATIC_EXTS:
            return self._serve_index()
        # On-the-fly gzip for large text assets when the client accepts it,
        # preserving Last-Modified / If-Modified-Since 304 revalidation. Skip
        # ranged requests — gzip can't serve a byte range, and IGV reads the
        # indexed FASTA (.fna) by Range, so those must fall through to the
        # default handler (which answers 206 uncompressed).
        if (ext in COMPRESSIBLE_EXTS and "Range" not in self.headers
                and "gzip" in self.headers.get("Accept-Encoding", "")):
            if self._serve_gzipped(raw):
                return
        # Range-capable static serving. The stdlib handler ignores Range and
        # returns the whole file (200), so IGV.js would download the entire
        # 35 MB FASTA and 2.5 MB bgzipped GFF on every open. Honoring Range lets
        # it byte-range into the .fna (via .fai) and the bgzipped+tabixed
        # .gff.gz/.bedgraph.gz (via .tbi) and fetch only the on-screen window.
        if self._serve_static_ranged():
            return
        super().do_GET()

    # Content types for files the stdlib guesser doesn't know / gets wrong.
    _STATIC_CTYPES = {
        ".gz": "application/gzip", ".tbi": "application/octet-stream",
        ".fna": "text/plain", ".fai": "text/plain", ".gff": "text/plain",
        ".gtf": "text/plain", ".bedgraph": "text/plain",
        ".obo": "text/plain", ".ddb": "text/plain", ".txt": "text/plain",
    }

    def _serve_static_ranged(self):
        """Serve a static file, honoring a single `Range: bytes=start-end`
        header with a 206 response. Returns False (without writing) to fall
        through to the default handler — e.g. file missing or a malformed/
        unsatisfiable range."""
        fs_path = self.translate_path(self.path)
        if not os.path.isfile(fs_path):
            return False
        try:
            st = os.stat(fs_path)
            size = st.st_size
            _, ext = os.path.splitext(fs_path)
            ctype = self._STATIC_CTYPES.get(ext) or self.guess_type(fs_path)
            last_mod = self.date_time_string(int(st.st_mtime))

            rng = self.headers.get("Range")
            start, end = 0, size - 1
            partial = False
            if rng and rng.startswith("bytes="):
                spec = rng[6:].split(",")[0].strip()  # first range only
                s, _, e = spec.partition("-")
                try:
                    if s == "":            # suffix range: bytes=-N (last N bytes)
                        start = max(0, size - int(e))
                    else:
                        start = int(s)
                        end = int(e) if e else size - 1
                    end = min(end, size - 1)
                    if start > end or start >= size:
                        raise ValueError
                    partial = True
                except (ValueError, TypeError):
                    # Unsatisfiable/malformed — fall back to full content (200).
                    start, end, partial = 0, size - 1, False

            length = end - start + 1
            self.send_response(206 if partial else 200)
            self.send_header("Content-Type", ctype)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", str(length))
            if partial:
                self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
            self.send_header("Last-Modified", last_mod)
            self.end_headers()
            if self.command == "HEAD":
                return True
            with open(fs_path, "rb") as f:
                f.seek(start)
                remaining = length
                while remaining > 0:
                    chunk = f.read(min(65536, remaining))
                    if not chunk:
                        break
                    self.wfile.write(chunk)
                    remaining -= len(chunk)
            return True
        except (BrokenPipeError, ConnectionResetError):
            return True  # client (IGV) closed the range early — not an error
        except Exception:
            return False

    def _serve_gzipped(self, raw):
        """Serve a static text file gzip-compressed. Returns False to fall
        through to the default handler (e.g. file missing)."""
        fs_path = self.translate_path(self.path)
        if not os.path.isfile(fs_path):
            return False
        try:
            st = os.stat(fs_path)
            # honor conditional requests so unchanged files still cost a 304
            ims = self.headers.get("If-Modified-Since")
            if ims:
                try:
                    since = parsedate_to_datetime(ims).timestamp()
                    if int(st.st_mtime) <= int(since):
                        self.send_response(304)
                        self.end_headers()
                        return True
                except (TypeError, ValueError):
                    pass
            key = (fs_path, int(st.st_mtime))
            body = _GZIP_CACHE.get(key)
            if body is None:
                with open(fs_path, "rb") as f:
                    body = gzip.compress(f.read(), compresslevel=6)
                _GZIP_CACHE[key] = body
            self.send_response(200)
            ctype = self.guess_type(fs_path)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Vary", "Accept-Encoding")
            self.send_header("Last-Modified", self.date_time_string(int(st.st_mtime)))
            self.end_headers()
            if self.command != "HEAD":
                self.wfile.write(body)
            return True
        except Exception:
            return False

    def _serve_index(self):
        try:
            html = (pathlib.Path(ROOT) / "index.html").read_text()
            def stamp(m):
                attr, ref = m.group(1), m.group(2)
                try:
                    v = int((pathlib.Path(ROOT) / ref.lstrip("/")).stat().st_mtime)
                except OSError:
                    return m.group(0)
                return f'{attr}="{ref}?v={v}"'
            html = ASSET_RE.sub(stamp, html)
            # Inject the data-asset version (max mtime of assets/*.json). app.js
            # appends ?v=<this> to its /assets/*.json fetches so they cache
            # immutably; this index.html is no-cache, so the value is always
            # current and a data rebuild auto-busts the cached JSONs.
            html = html.replace(
                "</head>", f'<script>window.__ASSET_V="{_data_version()}";</script></head>', 1)

            # Per-route SEO metadata so crawlers index each gene/tool page
            # distinctly (the body is still client-rendered; this is the head).
            path = self.path.split("?")[0]
            title, desc, canon, jsonld = route_meta(path)
            base = _base_url(self)
            head = []
            if title:
                html = re.sub(r"<title>.*?</title>", f"<title>{_esc(title)}</title>",
                              html, count=1, flags=re.S)
                for attr in ('property="og:title"', 'name="twitter:title"'):
                    html = re.sub(r'(<meta ' + re.escape(attr) + r' content=").*?(">)',
                                  lambda m: m.group(1) + _esc(title) + m.group(2),
                                  html, count=1, flags=re.S)
            if desc:
                for attr in ('name="description"', 'property="og:description"',
                             'name="twitter:description"'):
                    html = re.sub(r'(<meta ' + re.escape(attr) + r' content=").*?(">)',
                                  lambda m: m.group(1) + _esc(desc) + m.group(2),
                                  html, count=1, flags=re.S)
            if base and canon:
                head.append(f'<link rel="canonical" href="{_esc(base + canon)}">')
                head.append(f'<meta property="og:url" content="{_esc(base + canon)}">')
            if jsonld:
                if base:
                    jsonld["url"] = base + canon
                blob = json.dumps(jsonld, ensure_ascii=False).replace("</", "<\\/")
                head.append(f'<script type="application/ld+json">{blob}</script>')
            if head:
                html = html.replace("</head>", "\n".join(head) + "\n</head>", 1)
            body = html.encode()
            self._no_cache = True
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error(500, str(e))

    def _serve_robots(self):
        base = _base_url(self)
        lines = ["User-agent: *", "Allow: /", "Disallow: /api/"]
        if base:
            lines.append(f"Sitemap: {base}/sitemap.xml")
        body = ("\n".join(lines) + "\n").encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=86400")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    # Cached sitemap body, keyed by (gene_index mtime, base url).
    _SITEMAP_CACHE = {}

    def _serve_news_feed(self):
        """Atom feed of the news items (assets/news.json), for subscribers."""
        base = _base_url(self) or ""
        try:
            items = (json.loads((ASSETS / "news.json").read_text()) or {}).get("items", [])
        except (OSError, ValueError):
            items = []
        updated = (items[0]["date"] if items and items[0].get("date") else "1970-01-01") + "T00:00:00Z"
        parts = ['<?xml version="1.0" encoding="UTF-8"?>',
                 '<feed xmlns="http://www.w3.org/2005/Atom">',
                 "<title>dictyBase — News &amp; updates</title>",
                 f'<link href="{_esc(base)}/news"/>',
                 f'<link rel="self" type="application/atom+xml" href="{_esc(base)}/news.xml"/>',
                 f"<id>{_esc(base)}/news</id>",
                 f"<updated>{updated}</updated>"]
        for it in items:
            link = base + (it.get("link") or "/news")
            ident = base + "/news#" + quote((it.get("title") or "")[:80])
            when = (it.get("date") or "1970-01-01") + "T00:00:00Z"
            body = it.get("body", "")
            if it.get("paper"):
                body += f" (paper: {it['paper']})"
            parts += ["<entry>",
                      f"<title>{_esc(it.get('title', ''))}</title>",
                      f'<link href="{_esc(link)}"/>',
                      f"<id>{_esc(ident)}</id>",
                      f"<updated>{when}</updated>",
                      (f"<category term=\"{_esc(it['tag'])}\"/>" if it.get("tag") else ""),
                      f"<summary>{_esc(body)}</summary>",
                      "</entry>"]
        parts.append("</feed>")
        body = ("\n".join(p for p in parts if p)).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/atom+xml; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()
        self.wfile.write(body)

    def _serve_sitemap(self):
        base = _base_url(self)
        gm = _load_gene_meta()
        key = (gm["mtime"], base)
        xml = Handler._SITEMAP_CACHE.get(key)
        if xml is None:
            urls = ["/", "/start", "/education", "/data", "/cite", "/news", "/tools",
                    "/tools/blast", "/tools/enrichment", "/tools/expression",
                    "/tools/lab", "/tools/sequence", "/tools/convert", "/tools/geneset",
                    "/tools/downloads", "/tools/api", "/tools/genome-browser",
                    "/community/disease-models", "/search/advanced"]
            parts = ['<?xml version="1.0" encoding="UTF-8"?>',
                     '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
            for u in urls:
                parts.append(f"<url><loc>{_esc(base + u)}</loc></url>")
            for r in gm["records"]:
                if not r:
                    continue
                ddb = r[0]
                sym = r[1] if len(r) > 1 else ""
                token = sym if (sym and sym.upper() != (ddb or "").upper()) else ddb
                if not token:
                    continue
                parts.append(f"<url><loc>{_esc(base + '/gene/' + quote(token))}</loc></url>")
            parts.append("</urlset>")
            xml = ("\n".join(parts)).encode()
            Handler._SITEMAP_CACHE.clear()
            Handler._SITEMAP_CACHE[key] = xml
        accepts_gzip = "gzip" in self.headers.get("Accept-Encoding", "")
        self.send_response(200)
        self.send_header("Content-Type", "application/xml; charset=utf-8")
        self.send_header("Cache-Control", "public, max-age=86400")
        if accepts_gzip:
            body = gzip.compress(xml, compresslevel=6)
            self.send_header("Content-Encoding", "gzip")
            self.send_header("Vary", "Accept-Encoding")
        else:
            body = xml
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def do_POST(self):
        if self.path == "/api/upload":
            self._handle_upload()
        elif self.path == "/api/curator/login":
            self._handle_login()
        elif self.path == "/api/curator/logout":
            self._handle_logout()
        elif self.path == "/api/curator/submit":
            self._handle_curation_submit()
        elif self.path == "/api/curator/approve":
            self._handle_curation_approve()
        elif self.path == "/api/curator/reject":
            self._handle_curation_reject()
        elif self.path == "/api/curator/edit":
            self._handle_curation_edit()
        elif self.path == "/api/curator/stock-edit":
            self._handle_stock_edit()
        elif self.path == "/api/curator/stock-delete":
            self._handle_stock_delete()
        elif self.path == "/api/curator/accounts":
            self._handle_accounts_save()
        elif self.path == "/api/curator/accounts/delete":
            self._handle_accounts_delete()
        elif self.path == "/api/curator/2fa/setup":
            self._handle_2fa_setup()
        elif self.path == "/api/curator/2fa/enable":
            self._handle_2fa_enable()
        elif self.path == "/api/curator/2fa/disable":
            self._handle_2fa_disable()
        elif self.path.startswith("/api/blast?") and "async=1" in urlparse(self.path).query:
            self._handle_blast_async()                   # pool-bounded, pollable
        elif self.path == "/api/blast":
            if self._acquire_blast_slot():
                try:
                    self._handle_blast()
                finally:
                    _BLAST_SEM.release()
        elif self.path == "/api/idmap":
            self._handle_idmap()
        elif self.path == "/api/geneset-report":
            self._handle_geneset()
        elif self.path == "/api/align":
            self._handle_align()
        elif self.path == "/api/enrichment":
            self._handle_enrichment()
        elif self.path == "/api/codon-optimize":
            self._handle_codon()
        elif self.path == "/api/restriction":
            self._handle_seq_tool(bench.restriction_sites)
        elif self.path == "/api/orf":
            self._handle_seq_tool(bench.find_orfs)
        elif self.path == "/api/hit":
            self._handle_hit()
        elif self.path == "/api/analyze":
            self._handle_analyze()
        else:
            self.send_error(404)

    def _handle_analyze(self):
        """Public, heavily-gated Gemini proxy for the "Ask AI about this" tool.
        Disabled unless GEMINI_API_KEY is set. Every gate lives in
        _analyze_reserve(); see the config block for the abuse model."""
        if not GEMINI_API_KEY:
            self.send_json(503, {"error": "The AI assistant is not enabled on this server.",
                                 "disabled": True})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > 64 * 1024:
                self.send_json(400, {"error": "Empty or oversized request."})
                return
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid request."})
            return
        question = (body.get("question") or "").strip()[:ANALYZE_Q_MAXCHARS]
        context = (body.get("context") or "").strip()[:ANALYZE_CTX_MAXCHARS]
        if len(question) < 3:
            self.send_json(400, {"error": "Please enter a question."})
            return
        if len(question) + len(context) > ANALYZE_PROMPT_MAXCHARS:
            context = context[:max(0, ANALYZE_PROMPT_MAXCHARS - len(question))]
        ip = self.client_address[0]
        ok, code, msg = _analyze_reserve(ip, time.time())
        if not ok:
            self.send_json(code, {"error": msg})
            return
        try:
            text, out_tokens = _analyze_generate(question, context)
            _analyze_record_tokens(out_tokens)
        except urllib.error.HTTPError as e:
            # Log Gemini's own error message (it names the exact problem: bad key,
            # unknown model, quota, etc.). The body describes the error and does
            # NOT echo the API key, so it's safe to log.
            try:
                gmsg = ((json.loads(e.read() or b"{}").get("error") or {})
                        .get("message", ""))[:300]
            except Exception:
                gmsg = ""
            print(f"[analyze] Gemini HTTPError {e.code}: {gmsg}", file=sys.stderr)
            self.send_json(502, {"error": "The AI assistant is temporarily unavailable."})
            return
        except Exception as e:
            print(f"[analyze] error: {e}", file=sys.stderr)
            self.send_json(502, {"error": "The AI assistant is temporarily unavailable."})
            return
        self.send_json(200, {"answer": text, "model": ANALYZE_MODEL})

    def _handle_hit(self):
        """Cookieless, no-PII pageview beacon. The IP is used only to rate-limit
        (never stored); only the bucketed route path is counted."""
        if _rate_limited(_HIT_HITS, self.client_address[0], limit=120, window=60):
            self.send_response(204)
            self.end_headers()
            return
        path = "/"
        # ref is present (possibly "") only on the first pageview of a visit, so
        # the source is attributed once per entry, not on every SPA navigation.
        ref_present, ref = False, ""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if 0 < length <= 2000:
                data = json.loads(self.rfile.read(length) or b"{}")
                if isinstance(data, dict):
                    path = data.get("path") or "/"
                    if "ref" in data:
                        ref_present, ref = True, (data.get("ref") or "")
        except (ValueError, json.JSONDecodeError):
            path = "/"
        bucket = _bucket_path(path)
        day = datetime.datetime.utcnow().strftime("%Y-%m-%d")
        self_host = (self.headers.get("Host") or "").split(":")[0].lower()
        with _PV_LOCK:
            _load_pageviews()
            _PAGEVIEWS["counts"][bucket] = _PAGEVIEWS["counts"].get(bucket, 0) + 1
            days = _PAGEVIEWS["days"]
            days[day] = days.get(day, 0) + 1
            if len(days) > _PV_DAYS_KEEP:
                for k in sorted(days)[:-_PV_DAYS_KEEP]:
                    days.pop(k, None)
            if ref_present:
                rb = _bucket_referrer(ref, self_host)
                refs = _PAGEVIEWS["referrers"]
                if rb not in refs and len(refs) >= _PV_REF_CAP:
                    rb = "Other"
                refs[rb] = refs.get(rb, 0) + 1
            _save_pageviews()
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()

    def _handle_stock_gwdi(self):
        """Search the GWDI insertion bank (~21.5k strains) server-side against the
        locally-hosted assets/stock_gwdi.json. Kept as a search (not bundled to the
        client) because the bank is large and found by gene — but the data is ours."""
        if _rate_limited(_GWDI_HITS, self.client_address[0], limit=120, window=60):
            self.send_json(429, {"strains": [], "error": "rate limited"})
            return
        q = (parse_qs(urlparse(self.path).query).get("q") or [""])[0].strip().lower()
        if len(q) < 2:
            self.send_json(200, {"strains": []})
            return
        data = _load_json("stock_gwdi.json")          # cached by mtime
        strains = data.get("strains", []) if isinstance(data, dict) else []
        out = []
        for s in strains:
            if q in s.get("label", "").lower() or q in s.get("summary", "").lower():
                out.append(s)
                if len(out) >= 150:
                    break
        self.send_json(200, {"strains": out})

    def _send_proxy_bytes(self, status, ctype, body, cached=False):
        self.send_response(status)
        self.send_header("Content-Type", ctype or "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "public, max-age=1800")
        self.send_header("X-Proxy-Cache", "HIT" if cached else "MISS")
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def _handle_ext_proxy(self):
        """Allowlisted, cached GET proxy for the public bio APIs the gene record
        reads (NCBI/UniProt/EBI-QuickGO/STRING/OMA/RCSB). https + host allowlist
        only — not an open relay. Serves a short-TTL in-memory cache first, then
        rate/concurrency-gated upstream fetch; passes upstream errors through."""
        target = (parse_qs(urlparse(self.path).query).get("url") or [""])[0]
        if not target:
            self.send_json(400, {"error": "Missing url parameter"})
            return
        u = urlparse(target)
        if u.scheme != "https" or u.hostname not in _PROXY_HOSTS:
            self.send_json(403, {"error": "Host not allowed"})
            return
        now = time.time()
        hit = _EXT_CACHE.get(target)
        if hit and hit[0] > now:
            self._send_proxy_bytes(hit[1], hit[2], hit[3], cached=True)
            return
        if not self._acquire_proxy_slot():
            return
        try:
            req = urllib.request.Request(target, headers={
                "User-Agent": "dictyBase/1.0 (https://dictyatduke; mailto:dictybase@duke.edu)",
                "Accept": "application/json",
            })
            with _NOREDIRECT_OPENER.open(req, timeout=20) as r:
                body = r.read()
                ctype = r.headers.get("Content-Type", "application/json")
                status = getattr(r, "status", 200) or 200
            if len(body) <= _EXT_CACHE_MAX_BYTES:
                if len(_EXT_CACHE) >= _EXT_CACHE_MAX:
                    _EXT_CACHE.pop(next(iter(_EXT_CACHE)))
                _EXT_CACHE[target] = (now + _EXT_CACHE_TTL, status, ctype, body)
            self._send_proxy_bytes(status, ctype, body)
        except urllib.error.HTTPError as e:
            # Pass the upstream status + body through (e.g. a real 404 from RCSB)
            try:
                body = e.read()
            except Exception:
                body = b""
            ctype = e.headers.get("Content-Type", "application/json") if e.headers else "application/json"
            self._send_proxy_bytes(e.code, ctype, body)
        except Exception as e:
            self.send_json(502, {"error": "Upstream fetch failed", "detail": str(e)[:200]})
        finally:
            _PROXY_SEM.release()

    def _handle_codon(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200000:
                self.send_json(413, {"error": "Sequence too large"})
                return
            body = json.loads(self.rfile.read(length) or b"{}")
            seq = (body.get("seq") or "").strip()
            organism = body.get("organism") or "dicty"
            if not seq:
                self.send_json(400, {"error": "Provide a 'seq' (protein or DNA)"})
                return
            self.send_json(200, bench.codon_optimize(seq, organism))
        except (ValueError, json.JSONDecodeError) as e:
            self.send_json(400, {"error": f"Bad request: {e}"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_seq_tool(self, fn):
        """Shared handler for the sequence-in/JSON-out Lab tools (restriction
        sites, ORF finder): read {seq}, run `fn(seq)`, return its dict."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200000:
                self.send_json(413, {"error": "Sequence too large"})
                return
            seq = (json.loads(self.rfile.read(length) or b"{}").get("seq") or "").strip()
            if not seq:
                self.send_json(400, {"error": "Provide a DNA 'seq'"})
                return
            self.send_json(200, fn(seq))
        except (ValueError, json.JSONDecodeError) as e:
            self.send_json(400, {"error": f"Bad request: {e}"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_primers(self):
        q = parse_qs(urlparse(self.path).query)
        ddb = (q.get("ddb", [""])[0] or "").strip().upper()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "bad or missing ddb"})
            return
        try:
            seq = extract_sequence(ddb, "cdna")
            if not seq:
                self.send_json(404, {"error": "no transcript for this gene"})
                return
            self.send_json(200, {"ddb": ddb, "length": len(seq),
                                 "primers": bench.design_primers(seq)})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_crispr(self):
        q = parse_qs(urlparse(self.path).query)
        ddb = (q.get("ddb", [""])[0] or "").strip().upper()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "bad or missing ddb"})
            return
        try:
            seq = extract_sequence(ddb, "cdna")
            if not seq:
                self.send_json(404, {"error": "no transcript for this gene"})
                return
            guides = bench.crispr_guides(seq)
            self._crispr_offtargets(guides)
            guides.sort(key=lambda g: (g.get("off_targets", 0), -g["score"]))
            self.send_json(200, {"ddb": ddb, "length": len(seq), "guides": guides})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _crispr_offtargets(self, guides):
        """Annotate each guide with a genome off-target count (best-effort, one
        blastn-short pass against the AX4 genome)."""
        if not guides:
            return
        binpath = blast_bin("blastn")
        db = BLAST_DB_DIR / "d-discoideum-ax4"
        if not binpath or not (BLAST_DB_DIR / "d-discoideum-ax4.nsq").exists():
            return
        fa = "".join(f">g{i}\n{g['protospacer']}\n" for i, g in enumerate(guides))
        qf = tempfile.NamedTemporaryFile("w", suffix=".fa", delete=False)
        try:
            qf.write(fa)
            qf.close()
            cmd = [binpath, "-query", qf.name, "-db", str(db), "-task", "blastn-short",
                   "-outfmt", "6 qseqid pident length", "-word_size", "7",
                   "-evalue", "10", "-dust", "no", "-max_target_seqs", "100"]
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=45)
        finally:
            try:
                os.unlink(qf.name)
            except OSError:
                pass
        counts = {}
        for line in proc.stdout.splitlines():
            f = line.split("\t")
            if len(f) >= 3 and float(f[1]) >= 85 and int(f[2]) >= 17:
                counts[f[0]] = counts.get(f[0], 0) + 1
        for i, g in enumerate(guides):
            g["off_targets"] = max(0, counts.get(f"g{i}", 1) - 1)

    def _handle_recent_papers(self):
        """Recent Dictyostelium PubMed papers, cached up to a day; serves stale
        on fetch failure."""
        try:
            if (PAPERS_CACHE.exists()
                    and time.time() - PAPERS_CACHE.stat().st_mtime < PAPERS_TTL):
                self.send_json(200, json.loads(PAPERS_CACHE.read_text()))
                return
            data = fetch_pubmed_recent()
            PAPERS_CACHE.parent.mkdir(exist_ok=True)
            PAPERS_CACHE.write_text(json.dumps(data))
            self.send_json(200, data)
        except Exception:
            if PAPERS_CACHE.exists():  # stale-but-available fallback
                self.send_json(200, json.loads(PAPERS_CACHE.read_text()))
            else:
                self.send_json(502, {"error": "PubMed is unavailable right now."})

    def _handle_expression(self):
        q = parse_qs(urlparse(self.path).query)
        genes = [g for g in re.split(r"[\s,]+", (q.get("genes", [""])[0] or "").strip()) if g][:30]
        if not genes:
            self.send_json(400, {"error": "provide a 'genes' list"})
            return
        try:
            self.send_json(200, enrichment.expression_profiles(genes))
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_conservation(self):
        """Per-residue protein conservation across the species set, run
        synchronously (the async variant is _handle_conservation_async)."""
        try:
            ddb = parse_qs(urlparse(self.path).query).get("ddb", [""])[0] or ""
            code, payload = run_conservation(ddb)
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_coexpression(self):
        """GET /api/coexpression?ddb=DDB_G...&n= -> co-expressed genes."""
        q = parse_qs(urlparse(self.path).query)
        ddb = (q.get("ddb", [""])[0] or "").strip().upper()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "bad or missing ddb"})
            return
        try:
            n = max(1, min(int(q.get("n", ["12"])[0]), 50))
        except ValueError:
            n = 12
        try:
            self.send_json(200, enrichment.coexpression(ddb, n=n))
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_domains(self):
        """GET /api/domains -> {length, domains:[...]}.

        Two modes:
          ?ddb=DDB_G... -> served from the precomputed domains.json (in-memory,
                           fast, no external call); 404 if that gene isn't cached.
          ?acc=UNIPROT  -> live InterPro proxy (the fallback); rate/concurrency
                           gated like the other outbound proxies."""
        q = parse_qs(urlparse(self.path).query)
        ddb = (q.get("ddb", [""])[0] or "").strip().upper()
        if ddb:
            if not re.match(r"^DDB_G\d+$", ddb):
                self.send_json(400, {"error": "bad ddb"})
                return
            rec = _load_domains().get(ddb)
            if rec is None:
                self.send_json(404, {"error": "gene not in domain cache"})
                return
            self.send_json(200, {"length": rec.get("length"),
                                 "domains": rec.get("domains", [])})
            return
        acc = (q.get("acc", [""])[0] or "").strip()
        if not re.match(r"^[A-Za-z0-9]+$", acc):
            self.send_json(400, {"error": "bad or missing accession"})
            return
        if not self._acquire_proxy_slot():
            return
        base = "https://www.ebi.ac.uk/interpro/api"
        try:
            with urllib.request.urlopen(f"{base}/protein/uniprot/{acc}", timeout=20, context=SSL_CTX) as r:
                length = json.loads(r.read()).get("metadata", {}).get("length")
            with urllib.request.urlopen(f"{base}/entry/all/protein/uniprot/{acc}/?page_size=100", timeout=25, context=SSL_CTX) as r:
                data = json.loads(r.read())
            domains = []
            for res in data.get("results", []):
                md = res.get("metadata", {})
                for prot in res.get("proteins", []):
                    for loc in prot.get("entry_protein_locations", []):
                        for fr in loc.get("fragments", []):
                            if fr.get("start") is None or fr.get("end") is None:
                                continue
                            domains.append({
                                "db": md.get("source_database"),
                                "accession": md.get("accession"),
                                "name": md.get("name"),
                                "type": md.get("type"),
                                "start": fr["start"], "end": fr["end"],
                            })
            self.send_json(200, {"length": length, "domains": domains})
        except urllib.error.HTTPError as e:
            self.send_json(404 if e.code == 404 else 502, {"error": f"InterPro: {e}"})
        except Exception as e:
            self.send_json(502, {"error": str(e)})
        finally:
            _PROXY_SEM.release()

    def _handle_enrichment(self):
        """POST {genes:[...], background?, min_study?} -> GO enrichment."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 1_000_000:
                self.send_json(413, {"error": "Gene list too large"})
                return
            payload = json.loads(self.rfile.read(length) or b"{}")
            genes = payload.get("genes") or []
            if isinstance(genes, str):
                genes = re.split(r"[\s,]+", genes)
            genes = [g for g in genes if g][:5000]
            if not genes:
                self.send_json(400, {"error": "Provide a non-empty 'genes' list"})
                return
            min_study = max(1, min(int(payload.get("min_study", 2)), 50))
            if payload.get("set") == "phenotype":
                result = enrichment.enrich_phenotypes(genes, min_study=min_study)
            elif payload.get("set") == "kegg":
                result = enrichment.enrich_kegg(genes, min_study=min_study)
            else:
                background = "genome" if payload.get("background") == "genome" else "annotated"
                result = enrichment.enrich(genes, background=background, min_study=min_study)
            self.send_json(200, result)
        except (ValueError, json.JSONDecodeError) as e:
            self.send_json(400, {"error": f"Bad request: {e}"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _parse_token(self):
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer "): return auth[7:]
        return ""

    def _session(self, token):
        """Return the session dict {exp, name, admin, username} if the token is
        valid and unexpired, else None."""
        s = _SESSIONS.get(token)
        if not s:
            return None
        if time.time() > s.get("exp", 0):
            _SESSIONS.pop(token, None)
            return None
        return s

    def _auth(self, token):
        return self._session(token) is not None

    def _session_name(self):
        s = self._session(self._parse_token())
        return (s or {}).get("name") or "Curator"

    def _session_username(self):
        """The named-account username for this session ("" for bootstrap admin)."""
        s = self._session(self._parse_token())
        return (s or {}).get("username") or ""

    # --- Two-factor enrollment (named accounts only) ------------------------
    def _handle_2fa_status(self):
        if not self._auth(self._parse_token()):
            self.send_json(401, {"error": "Unauthorized"})
            return
        user = self._session_username()
        acct = load_curators().get(user) or {}
        self.send_json(200, {"account": bool(acct), "username": user,
                             "enabled": bool(acct.get("totp")),
                             "backup_remaining": len(acct.get("backup") or [])})

    def _handle_2fa_setup(self):
        """Mint a fresh secret to show the curator. Not active until verified."""
        if not self._auth(self._parse_token()):
            self.send_json(401, {"error": "Unauthorized"})
            return
        user = self._session_username()
        if not user or user not in load_curators():
            self.send_json(400, {"error": "Two-factor is only available for named curator accounts. "
                                          "Create one from Accounts, then sign in as that account."})
            return
        secret = _totp_new_secret()
        self.send_json(200, {"secret": secret, "otpauth": _otpauth_uri(user, secret)})

    def _handle_2fa_enable(self):
        if not self._auth(self._parse_token()):
            self.send_json(401, {"error": "Unauthorized"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 4096)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Bad request"})
            return
        user = self._session_username()
        accts = load_curators()
        acct = accts.get(user)
        if not acct:
            self.send_json(400, {"error": "Two-factor is only available for named curator accounts."})
            return
        secret = (body.get("secret") or "").strip()
        if not secret or _totp_check(secret, body.get("code")) is None:
            self.send_json(400, {"error": "That code didn't match. Check the app's clock and try again."})
            return
        codes, hashed = _new_backup_codes()
        acct.update(totp=secret, totp_last=-1, backup=hashed)
        accts[user] = acct
        save_curators(accts)
        _log_curation("account", "2fa-enable", user, self._session_name())
        self.send_json(200, {"ok": True, "backup_codes": codes})

    def _handle_2fa_disable(self):
        if not self._auth(self._parse_token()):
            self.send_json(401, {"error": "Unauthorized"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 4096)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Bad request"})
            return
        user = self._session_username()
        accts = load_curators()
        acct = accts.get(user)
        if not acct:
            self.send_json(400, {"error": "No named account for this session."})
            return
        # Re-authenticate before removing a security control.
        if not _verify_pw(body.get("password") or "", acct.get("salt", ""), acct.get("pw", "")):
            self.send_json(401, {"error": "Password incorrect."})
            return
        for k in ("totp", "totp_last", "backup"):
            acct.pop(k, None)
        accts[user] = acct
        save_curators(accts)
        _log_curation("account", "2fa-disable", user, self._session_name())
        self.send_json(200, {"ok": True})

    def _is_admin(self):
        s = self._session(self._parse_token())
        return bool(s and s.get("admin"))

    def _handle_login(self):
        ip = self.client_address[0]
        if _rate_limited(_LOGIN_FAILS, ip, limit=5, window=300):
            self.send_json(429, {"error": "Too many attempts. Wait a few minutes."})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 4096)
            body = json.loads(self.rfile.read(length) or b"{}")
            username = (body.get("username") or "").strip()
            password = body.get("password", "")
            if not isinstance(password, str):
                self.send_json(400, {"error": "Bad request"})
                return
            name = admin = None
            accts = load_curators()
            acct = accts.get(username) if username else None
            if acct and _verify_pw(password, acct.get("salt", ""), acct.get("pw", "")):
                # Password is right. If this account has 2FA enrolled, a valid
                # TOTP (or a single-use backup code) is also required.
                if acct.get("totp"):
                    code = (body.get("code") or "").strip()
                    if not code:
                        self.send_json(401, {"error": "Two-factor code required",
                                             "totp_required": True})
                        return
                    counter = _totp_check(acct["totp"], code, int(acct.get("totp_last", -1)))
                    if counter is not None:
                        acct["totp_last"] = counter      # burn this counter (no replay)
                        accts[username] = acct
                        save_curators(accts)
                    elif not _consume_backup_code(accts, username, code):
                        self.send_json(401, {"error": "Invalid two-factor code",
                                             "totp_required": True})
                        return
                name, admin = acct.get("name") or username, bool(acct.get("admin"))
            elif CURATOR_PASSWORD and hmac.compare_digest(password, CURATOR_PASSWORD):
                # Bootstrap admin (env password) — always admin, so you can create
                # the first named accounts.
                name, admin = (username or "Admin"), True
            if name is None:
                self.send_json(401, {"error": "Wrong username or password"})
                return
            _LOGIN_FAILS.pop(ip, None)  # clear on success
            token = secrets.token_urlsafe(32)
            _SESSIONS[token] = {"exp": time.time() + SESSION_TTL, "name": name,
                                "admin": admin, "username": username or "admin"}
            self.send_json(200, {"token": token, "name": name, "admin": admin,
                                 "expires_in": SESSION_TTL})
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Bad request"})
        except Exception:
            self.send_json(500, {"error": "Login failed"})

    def _handle_logout(self):
        _SESSIONS.pop(self._parse_token(), None)
        self.send_json(200, {"ok": True})

    # --- Curator account management (admin only) --------------------------
    def _handle_accounts_list(self):
        if not self._is_admin():
            self.send_json(403, {"error": "Admin access required."})
            return
        accts = load_curators()
        out = [{"username": u, "name": a.get("name", u), "admin": bool(a.get("admin")),
                "totp": bool(a.get("totp"))}
               for u, a in sorted(accts.items())]
        self.send_json(200, {"accounts": out})

    def _handle_accounts_save(self):
        if not self._is_admin():
            self.send_json(403, {"error": "Admin access required."})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 8192)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid request"})
            return
        username = (body.get("username") or "").strip().lower()
        name = (body.get("name") or "").strip()[:80]
        password = body.get("password") or ""
        admin = bool(body.get("admin"))
        if not re.match(r"^[a-z0-9._-]{2,40}$", username):
            self.send_json(400, {"error": "Username must be 2–40 chars: letters, numbers, . _ -"})
            return
        if not name:
            self.send_json(400, {"error": "A display name is required."})
            return
        accts = load_curators()
        existing = accts.get(username, {})
        if password:
            if len(password) < 6:
                self.send_json(400, {"error": "Password must be at least 6 characters."})
                return
            existing["salt"], existing["pw"] = _hash_pw(password)
        elif "pw" not in existing:
            self.send_json(400, {"error": "A password is required for a new account."})
            return
        existing["name"] = name
        existing["admin"] = admin
        accts[username] = existing
        save_curators(accts)
        _log_curation("account", "save", username, self._session_name())
        self.send_json(200, {"ok": True, "username": username, "created": username not in accts})

    def _handle_accounts_delete(self):
        if not self._is_admin():
            self.send_json(403, {"error": "Admin access required."})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 2048)
            username = (json.loads(self.rfile.read(length) or b"{}").get("username") or "").strip().lower()
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid request"})
            return
        accts = load_curators()
        if username not in accts:
            self.send_json(404, {"error": "No such account."})
            return
        if accts[username].get("admin") and sum(1 for a in accts.values() if a.get("admin")) <= 1:
            self.send_json(400, {"error": "Can't remove the last admin account."})
            return
        accts.pop(username, None)
        save_curators(accts)
        _log_curation("account", "delete", username, self._session_name())
        self.send_json(200, {"ok": True})

    def _handle_curation_submit(self):
        """Community submission of a gene curation."""
        if not ACCEPT_PUBLIC_SUBMISSIONS:   # disabled for public launch
            self.send_json(404, {"error": "Not found"})
            return
        try:
            if _rate_limited(_UPLOAD_HITS, self.client_address[0], limit=20, window=3600):
                self.send_json(429, {"error": "Submission limit reached. Try again later."})
                return
            length = min(int(self.headers.get("Content-Length", 0)), 65536)
            body = json.loads(self.rfile.read(length) or b"{}")
            curation_id = str(uuid.uuid4())[:8]
            entry = {
                "id": curation_id,
                "status": "pending",
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                "gene": body.get("gene", "").strip(),
                "ddb": body.get("ddb", "").strip(),
                "submitter_name": body.get("submitter_name", "").strip(),
                "submitter_email": body.get("submitter_email", "").strip(),
                "summary": body.get("summary", "").strip(),
                "evidence": body.get("evidence", "").strip(),
                "pmids": body.get("pmids", "").strip(),
                "note": body.get("note", "").strip(),
            }
            if not entry["gene"] or not entry["summary"]:
                self.send_json(400, {"error": "gene and summary are required"})
                return
            (UPLOADS_DIR / "curations" / f"{curation_id}.json").write_text(json.dumps(entry, indent=2))
            self.send_json(200, {"ok": True, "id": curation_id})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_curation_approve(self):
        """Curator approves a pending curation — merges it into the corpus."""
        try:
            token = self._parse_token()
            if not self._auth(token):
                self.send_json(401, {"error": "Unauthorized"})
                return
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            curation_id = body.get("id", "")
            curator_name = self._session_name()   # verified from the login, not self-typed
            curation_file = UPLOADS_DIR / "curations" / f"{curation_id}.json"
            if not curation_file.exists():
                self.send_json(404, {"error": "Curation not found"})
                return
            entry = json.loads(curation_file.read_text())
            ddb = entry.get("ddb", "").strip()
            if not ddb:
                self.send_json(400, {"error": "No DDB ID — cannot merge without a DDB_G identifier"})
                return
            # Merge into the durable curation override (survives deploys).
            base = _load_json("dictybase_corpus.json").get(ddb, {})
            fields = {k: base[k] for k in ("summary", "curator", "curator_date",
                                           "note", "curator_pmids") if k in base}
            fields["summary"] = entry["summary"]
            fields["curator"] = curator_name
            fields["curator_date"] = datetime.datetime.utcnow().strftime("%d-%b-%Y").upper()
            if entry.get("pmids"):
                fields["curator_pmids"] = entry["pmids"]
            save_gene_override(ddb, fields, curator_name)
            # Mark approved
            entry["status"] = "approved"
            entry["approved_by"] = curator_name
            entry["approved_at"] = datetime.datetime.utcnow().isoformat() + "Z"
            curation_file.write_text(json.dumps(entry, indent=2))
            self.send_json(200, {"ok": True, "ddb": ddb})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_curation_reject(self):
        try:
            token = self._parse_token()
            if not self._auth(token):
                self.send_json(401, {"error": "Unauthorized"})
                return
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            curation_id = body.get("id", "")
            curation_file = UPLOADS_DIR / "curations" / f"{curation_id}.json"
            if not curation_file.exists():
                self.send_json(404, {"error": "Not found"})
                return
            entry = json.loads(curation_file.read_text())
            entry["status"] = "rejected"
            entry["rejection_note"] = body.get("note", "")
            curation_file.write_text(json.dumps(entry, indent=2))
            self.send_json(200, {"ok": True})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_curation_edit(self):
        """Curator edits a gene's curation DIRECTLY (no submit→approve dance).
        The canonical curation path for the single-curator workflow. Auth required;
        saved to the durable gene override (gitignored, survives deploys) via
        save_gene_override() — atomic + .bak + audit log, live immediately."""
        if not self._auth(self._parse_token()):
            self.send_json(401, {"error": "Unauthorized"})
            return
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 65536)
            body = json.loads(self.rfile.read(length) or b"{}")
        except (ValueError, json.JSONDecodeError):
            self.send_json(400, {"error": "Invalid request"})
            return
        ddb = (body.get("ddb") or "").strip()
        summary = (body.get("summary") or "").strip()
        note = (body.get("note") or "").strip()
        pmids = (body.get("pmids") or "").strip()
        curator = self._session_name()   # verified from the login, not self-typed
        # Validate BEFORE touching the corpus — a bad edit must never land.
        if not ddb.startswith("DDB_G"):
            self.send_json(400, {"error": "A valid DDB_G… identifier is required."})
            return
        if len(summary) < 2:
            self.send_json(400, {"error": "Summary is empty — refusing to blank the gene. "
                                          "Enter a summary (or use Reject to remove a submission)."})
            return
        if len(summary) > 20000 or len(note) > 4000 or len(pmids) > 2000:
            self.send_json(400, {"error": "A field is too long."})
            return
        try:
            date = datetime.datetime.utcnow().strftime("%d-%b-%Y").upper()
            fields = {"summary": summary, "curator": curator, "curator_date": date,
                      "note": note, "curator_pmids": pmids}   # WYSIWYG: empty clears
            save_gene_override(ddb, fields, curator)           # durable override + log
            self.send_json(200, {"ok": True, "ddb": ddb, "curator_date": date})
        except Exception as ex:
            print(f"[curate] edit error: {ex}", file=sys.stderr)
            self.send_json(500, {"error": "Save failed — the previous version is intact."})

    # --- Stock Center curation (strains + plasmids) -----------------------
    def _stock_body(self):
        """Read + auth-check a stock edit/delete request. Returns (body, error).
        On error, error is a (code, message) tuple and body is None."""
        if not self._auth(self._parse_token()):
            return None, (401, "Unauthorized")
        try:
            length = min(int(self.headers.get("Content-Length", 0)), 65536)
            return json.loads(self.rfile.read(length) or b"{}"), None
        except (ValueError, json.JSONDecodeError):
            return None, (400, "Invalid request")

    def _handle_stock_edit(self):
        """Curator adds or updates one strain or plasmid in stock_center.json.
        `type` is 'strain' or 'plasmid'; matching is by `id` (DBS…/DBP…). Marked
        with `edited_date` so a re-fetch (build_stock_center.py) won't clobber it."""
        body, err = self._stock_body()
        if err:
            self.send_json(err[0], {"error": err[1]})
            return
        kind = (body.get("type") or "").strip()
        sid = (body.get("id") or "").strip()
        name = (body.get("name") or body.get("label") or "").strip()
        if kind not in ("strain", "plasmid"):
            self.send_json(400, {"error": "type must be 'strain' or 'plasmid'."})
            return
        prefix = "DBS" if kind == "strain" else "DBP"
        if not sid.startswith(prefix):
            self.send_json(400, {"error": f"A valid {prefix}… id is required for a {kind}."})
            return
        if not name:
            self.send_json(400, {"error": "A label/name is required."})
            return
        # Build the entry from allowed fields only (cap lengths).
        entry = {"id": sid, "in_stock": bool(body.get("in_stock")),
                 "edited_date": datetime.datetime.utcnow().strftime("%d-%b-%Y").upper()}
        def field(k, maxlen=6000):
            v = (body.get(k) or "").strip()
            return v[:maxlen]
        if kind == "strain":
            entry["label"] = name[:200]
            for k in ("summary", "genotype", "phenotype"):
                v = field(k)
                if v:
                    entry[k] = v
            names = body.get("names")
            if isinstance(names, str):
                names = [n.strip() for n in names.split(",")]
            names = [n[:120] for n in (names or []) if isinstance(n, str) and n.strip()]
            if names:
                entry["names"] = names[:20]
        else:
            entry["name"] = name[:200]
            for k in ("description", "depositor", "genbank"):
                v = field(k)
                if v:
                    entry[k] = v
        try:
            key = "strains" if kind == "strain" else "plasmids"
            current = _load_json("stock_center.json").get(key, [])
            created = not any(isinstance(e, dict) and e.get("id") == sid for e in current)
            save_stock_override(kind, sid, entry, self._session_name())   # durable override + log
            self.send_json(200, {"ok": True, "id": sid, "created": created,
                                 "edited_date": entry["edited_date"]})
        except Exception as ex:
            print(f"[stock] edit error: {ex}", file=sys.stderr)
            self.send_json(500, {"error": "Save failed — the previous catalog is intact."})

    def _handle_stock_delete(self):
        """Curator removes one strain or plasmid by id."""
        body, err = self._stock_body()
        if err:
            self.send_json(err[0], {"error": err[1]})
            return
        kind = (body.get("type") or "").strip()
        sid = (body.get("id") or "").strip()
        if kind not in ("strain", "plasmid") or not sid:
            self.send_json(400, {"error": "type and id are required."})
            return
        try:
            key = "strains" if kind == "strain" else "plasmids"
            current = _load_json("stock_center.json").get(key, [])
            if not any(isinstance(e, dict) and e.get("id") == sid for e in current):
                self.send_json(404, {"error": "Not found in the catalog."})
                return
            save_stock_override(kind, sid, None, self._session_name(), delete=True)
            self.send_json(200, {"ok": True, "id": sid})
        except Exception as ex:
            print(f"[stock] delete error: {ex}", file=sys.stderr)
            self.send_json(500, {"error": "Delete failed — the previous catalog is intact."})

    def _handle_api_status(self):
        def updated(fname):
            try:
                return datetime.datetime.utcfromtimestamp((ASSETS / fname).stat().st_mtime).strftime("%Y-%m-%d")
            except OSError:
                return None
        def cnt(fname):
            d = _load_json(fname)
            if isinstance(d, list):
                return len(d)
            if isinstance(d, dict):
                keys = [k for k in d if not str(k).startswith("_")]
                # unwrap a single {_meta, <wrapper>: {...}} container (uniprot_map, domains)
                if len(keys) == 1 and isinstance(d[keys[0]], (dict, list)):
                    return len(d[keys[0]])
                return len(keys)
            return None
        rows, _ = api_gene_rows()
        sc = _load_json("stock_center.json")
        stock_n = (len(sc.get("strains", [])) + len(sc.get("plasmids", []))) if isinstance(sc, dict) else None
        # Complete data-source registry (this /data page is the canonical attribution
        # surface). Every source that carries an attribution/share-alike term is
        # named with its license + a link. Keep this list in sync when a data layer
        # is added — CC BY / CC BY-SA sources MUST appear here.
        datasets = [
            {"label": "Curated gene summaries", "source": "dictyBase (Basu et al. 2015)",
             "license": "CC BY-NC 4.0", "url": "https://dictybase.dev",
             "records": cnt("dictybase_corpus.json"), "updated": updated("dictybase_corpus.json")},
            {"label": "Gene catalog", "source": "NCBI RefSeq — D. discoideum AX4",
             "license": "Public domain (NCBI)", "url": "https://www.ncbi.nlm.nih.gov/refseq/",
             "records": len(rows), "updated": updated("gene_index.json")},
            {"label": "GO annotations", "source": "GO Consortium GAF",
             "license": "CC BY 4.0", "url": "https://geneontology.org",
             "records": cnt("go_annotations.json"), "updated": updated("go_annotations.json")},
            {"label": "Phenotypes", "source": "dictyBase mutant-strain curation",
             "license": "CC BY-NC 4.0", "url": "https://dictybase.dev",
             "records": cnt("phenotypes.json"), "updated": updated("phenotypes.json")},
            {"label": "Genome assemblies", "source": "NCBI Datasets; wild isolates Ahmed et al. 2025 (PNAS)",
             "license": "CC BY 4.0", "url": "https://www.ncbi.nlm.nih.gov/datasets/",
             "records": cnt("downloads_manifest.json"), "updated": updated("downloads_manifest.json")},
            {"label": "Protein IDs & cross-references", "source": "UniProt",
             "license": "CC BY 4.0", "url": "https://www.uniprot.org",
             "records": cnt("uniprot_map.json"), "updated": updated("uniprot_map.json")},
            {"label": "Human orthologs", "source": "OMA Browser & InParanoiDB 9",
             "license": "OMA CC BY-SA 2.5; InParanoiDB 9 CC BY-SA 4.0", "url": "https://omabrowser.org",
             "records": cnt("ortholog_disease.json"), "updated": updated("ortholog_disease.json")},
            {"label": "Human disease associations", "source": "OMIM & Orphanet (via HPO annotations)",
             "license": "Orphanet CC BY 4.0; OMIM terms (omim.org/help/agreement)", "url": "https://hpo.jax.org",
             "records": None, "updated": updated("ortholog_disease.json")},
            {"label": "Protein domains", "source": "InterPro / Pfam (EMBL-EBI)",
             "license": "CC0 1.0", "url": "https://www.ebi.ac.uk/interpro/",
             "records": cnt("domains.json"), "updated": updated("domains.json")},
            {"label": "Pathways", "source": "KEGG (Kanehisa Laboratories)",
             "license": "KEGG terms — academic use", "url": "https://www.kegg.jp",
             "records": cnt("kegg_pathways.json"), "updated": updated("kegg_pathways.json")},
            {"label": "Developmental expression", "source": "Rosengarten et al. 2015 RNA-seq (GEO GSE61914)",
             "license": "See publication", "url": "https://doi.org/10.1186/s12864-015-1491-7",
             "records": None, "updated": updated("rnaseq_rosengarten.json")},
            {"label": "Protein structures", "source": "AlphaFold DB (EMBL-EBI / DeepMind)",
             "license": "CC BY 4.0", "url": "https://alphafold.ebi.ac.uk",
             "records": None, "updated": None},
            {"label": "Proteomics", "source": "Banu et al. 2026; Williams et al. 2026",
             "license": "See publications", "url": "",
             "records": None, "updated": updated("proteomics_data.json")},
            {"label": "Stock catalog", "source": "dictyBase / Dicty Stock Center",
             "license": "CC BY 4.0", "url": "https://dictybase.dev",
             "records": stock_n, "updated": updated("stock_center.json")},
        ]
        self.send_json(200, {"datasets": datasets})

    def _handle_api_gene(self, token):
        ddb = resolve_gene(token)
        if not ddb:
            self.send_json(404, {"error": "gene not found", "query": token})
            return
        self.send_json(200, assemble_gene(ddb))

    def _handle_gene_annotations(self):
        """One gene's full GO/literature annotations by DDB_G id, served from the
        in-memory map so the gene page fetches ~a few KB instead of the 6.6 MB
        whole-file. Returns {} (200) for a gene with no annotations."""
        ddb = (parse_qs(urlparse(self.path).query).get("ddb", [""])[0]).strip()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "ddb (DDB_G…) required"})
            return
        self.send_json(200, _load_gene_annotations().get(ddb, {}))

    def _handle_gene_extras(self):
        """One gene's dictyBase enrichment (literature, curation status, alt
        transcripts, dictyBase orthologs, myristoylation, phospho, MW) plus its
        InterPro domains, by DDB_G id. Served per-gene from the in-memory maps."""
        ddb = (parse_qs(urlparse(self.path).query).get("ddb", [""])[0]).strip()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "ddb (DDB_G…) required"})
            return
        out = dict(_load_mtime_json(GENE_EXTRAS_PATH, _GENE_EXTRAS_CACHE).get(ddb, {}))
        out["domains"] = _load_mtime_json(DICTY_DOMAINS_PATH, _DICTY_DOMAINS_CACHE).get(ddb, [])
        self.send_json(200, out)

    def _handle_promoter(self):
        """A gene's 5' flanking (promoter) sequence by DDB_G id."""
        ddb = (parse_qs(urlparse(self.path).query).get("ddb", [""])[0]).strip()
        if not re.match(r"^DDB_G\d+$", ddb):
            self.send_json(400, {"error": "ddb (DDB_G…) required"})
            return
        seq = _load_mtime_json(PROMOTERS_PATH, _PROMOTERS_CACHE).get(ddb, "")
        self.send_json(200, {"ddb": ddb, "length": len(seq), "sequence": seq})

    def _handle_gene_card(self):
        """Compact gene summary for hovercards: name, trimmed summary, facet flags."""
        q = parse_qs(urlparse(self.path).query)
        ddb = resolve_gene((q.get("id", [""])[0]).strip())
        if not ddb:
            self.send_json(404, {"error": "gene not found"})
            return
        rows, _ = api_gene_rows()
        g = rows.get(ddb, {})
        summary = strip_markup(_load_json("dictybase_corpus.json").get(ddb, {}).get("summary"))
        if len(summary) > 240:
            cut = summary[:240]
            sp = cut.rfind(" ")
            summary = (cut[:sp] if sp > 120 else cut).rstrip() + "…"
        od = _load_json("ortholog_disease.json").get(ddb) or {}
        orths = od.get("orthologs", []) if isinstance(od, dict) else []
        human = []
        for o in orths:
            hs = o.get("human_symbol")
            if hs and hs not in human:
                human.append(hs)
        self.send_json(200, {
            "ddb": ddb,
            "symbol": g.get("symbol", ddb),
            "name": g.get("name", ""),
            "summary": summary,
            "human": human[:4],
            "phenotype": ddb in _load_json("phenotypes.json"),
            "ortholog": bool(orths),
            "disease": any(o.get("diseases") for o in orths),
            "ncbiGene": g.get("ncbiGene"),
        })

    def _handle_api_search(self):
        q = parse_qs(urlparse(self.path).query)
        term = (q.get("q", [""])[0]).strip().lower()
        try:
            limit = min(max(int(q.get("limit", ["25"])[0]), 1), 200)
        except ValueError:
            limit = 25
        if not term:
            self.send_json(400, {"error": "q parameter required"})
            return
        rows, _ = api_gene_rows()
        matches = []
        for ddb, g in rows.items():
            sym = g["symbol"].lower()
            if term in sym or term in ddb.lower() or term in (g["name"] or "").lower():
                rank = 0 if sym == term else (1 if sym.startswith(term) else 2)
                matches.append((rank, g["symbol"], {"ddb": ddb, "symbol": g["symbol"], "name": g["name"]}))
        matches.sort(key=lambda m: (m[0], m[1].lower()))
        results = [m[2] for m in matches[:limit]]
        self.send_json(200, {"query": term, "count": len(results), "results": results})

    def _handle_api_phenotype_search(self):
        q = parse_qs(urlparse(self.path).query)
        term = (q.get("q", [""])[0]).strip().lower()
        try:
            limit = min(max(int(q.get("limit", ["40"])[0]), 1), 200)
        except ValueError:
            limit = 40
        if not term:
            self.send_json(400, {"error": "q parameter required"})
            return
        idx = api_phenotype_index()
        matches = [v for key, v in idx.items() if term in key]
        # Most-annotated phenotypes first; exact-ish (term starts with query) ranks above substring.
        matches.sort(key=lambda v: (0 if v["term"].lower().startswith(term) else 1, -len(v["genes"]), v["term"].lower()))
        results = [{"term": v["term"], "genes": v["genes"]} for v in matches[:limit]]
        self.send_json(200, {"query": term, "totalTerms": len(matches), "count": len(results), "terms": results})

    def _handle_api_go(self, goid):
        if not re.match(r"^GO:\d{7}$", goid):
            self.send_json(400, {"error": "GO id must look like GO:0003674"})
            return
        genes = api_go_inverse().get(goid, [])
        self.send_json(200, {"id": goid, "count": len(genes), "genes": genes})

    def _handle_api_strain(self, sid):
        st = api_strains()
        gene = st["gene"].get(sid)
        phenos = st["pheno"].get(sid, [])
        if gene is None and not phenos:
            self.send_json(404, {"error": "strain not found", "strain": sid})
            return
        rows, _ = api_gene_rows()
        gene_obj = {"ddb": gene, "symbol": rows.get(gene, {}).get("symbol")} if gene else None
        self.send_json(200, {"strain": sid, "gene": gene_obj, "phenotypes": phenos})

    def _handle_sequence(self):
        """Return a gene's genomic / cDNA / protein sequence as a FASTA download."""
        try:
            from urllib.parse import urlparse, parse_qs
            q = parse_qs(urlparse(self.path).query)
            ddb = (q.get("ddb", [""])[0]).strip()
            typ = (q.get("type", [""])[0]).strip()
            symbol = (q.get("symbol", [ddb])[0]).strip().replace("\n", "") or ddb
            if typ not in ("genomic", "cdna", "protein"):
                self.send_error(400, "type must be genomic, cdna, or protein")
                return
            if not re.match(r"^DDB_G\d+$", ddb):
                self.send_error(400, "invalid gene id")
                return
            seq = extract_sequence(ddb, typ)
            if not seq:
                self.send_error(404, "Sequence not available for this gene")
                return
            label = {"genomic": "genomic", "cdna": "cDNA", "protein": "protein"}[typ]
            wrapped = "\n".join(seq[i:i + 60] for i in range(0, len(seq), 60))
            fasta = f">{symbol} {ddb} {label} | dictyBase\n{wrapped}\n".encode()
            fname = "".join(c for c in f"{symbol}_{typ}.fasta" if c.isalnum() or c in "._-")
            self.send_response(200)
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
            self.send_header("Content-Length", str(len(fasta)))
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(fasta)
        except Exception as e:
            self.send_error(500, str(e))

    def _acquire_blast_slot(self):
        """Rate-limit (per IP) and concurrency-gate a CPU-heavy BLAST request.

        Sends the error response and returns False if rejected. On True the
        caller MUST release `_BLAST_SEM` exactly once (use try/finally)."""
        ip = self.client_address[0]
        if _rate_limited(_BLAST_HITS, ip, limit=20, window=60):
            self.send_json(429, {"error": "Too many sequence searches from your "
                                          "address. Wait a minute and retry."})
            return False
        if not _BLAST_SEM.acquire(timeout=BLAST_SLOT_WAIT):
            self.send_json(503, {"error": "Server is busy running other sequence "
                                          "searches. Please retry in a few seconds."})
            return False
        return True

    def _acquire_proxy_slot(self):
        """Rate-limit (per IP) and concurrency-gate an outbound-proxy request
        (AlphaFold/InterPro): they make slow third-party calls that tie up a
        worker thread and, unthrottled, let a client drive this server to hammer
        (and get banned by) NCBI/EBI.

        Sends the error response and returns False if rejected. On True the
        caller MUST release `_PROXY_SEM` exactly once (use try/finally)."""
        if _rate_limited(_PROXY_HITS, self.client_address[0], limit=30, window=60):
            self.send_json(429, {"error": "Too many requests. Slow down a moment."})
            return False
        if not _PROXY_SEM.acquire(timeout=PROXY_SLOT_WAIT):
            self.send_json(503, {"error": "Busy fetching external data. Retry shortly."})
            return False
        return True

    def _read_blast_body(self):
        """Parse + size-check a BLAST request body. Returns the dict, or None
        after having sent an error response."""
        length = int(self.headers.get("Content-Length", 0))
        if length > 200000:
            self.send_json(413, {"error": "Query too large (200 KB max)."})
            return None
        return json.loads(self.rfile.read(length))

    def _handle_blast(self):
        """Run a local blastn/tblastn synchronously against the bundled genomes.

        Security: program + database come from server allowlists; the user
        sequence is written to a temp file and passed via -query (never a shell),
        with a size cap and a timeout. No user value reaches a shell or a path.
        """
        try:
            body = self._read_blast_body()
            if body is None:
                return
            code, payload = run_blast(body.get("program", "blastn"),
                                      body.get("database", "d-discoideum-ax4"),
                                      body.get("query") or "")
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_blast_async(self):
        """Submit a BLAST to the worker pool; returns a job id to poll at
        /api/job. Used by the front-end for the heavy multi-genome searches so
        they neither hold a request thread nor 503 under contention."""
        try:
            body = self._read_blast_body()
            if body is None:
                return
            program = body.get("program", "blastn")
            database = body.get("database", "d-discoideum-ax4")
            query = body.get("query") or ""
            jid = submit_job(lambda: run_blast(program, database, query))
            self.send_json(202, {"job_id": jid})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_conservation_async(self):
        try:
            ddb = (parse_qs(urlparse(self.path).query).get("ddb", [""])[0] or "")
            jid = submit_job(lambda: run_conservation(ddb))
            self.send_json(202, {"job_id": jid})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_job_status(self):
        """Poll an async job. 200 with {status: queued|running|done|error}; when
        done, the original handler's status code + payload are echoed."""
        jid = parse_qs(urlparse(self.path).query).get("id", [""])[0]
        j = job_snapshot(jid)
        if not j:
            self.send_json(404, {"error": "unknown or expired job"})
            return
        out = {"status": j["status"]}
        if j["status"] == "done":
            out["code"] = j["code"]
            out["result"] = j["result"]
        elif j["status"] == "error":
            out["error"] = j["error"]
        self.send_json(200, out)

    def _handle_idmap(self):
        """Batch ID converter: POST {ids:[...]} -> normalized cross-ref rows."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200000:
                self.send_json(413, {"error": "Too many ids (200 KB max)."})
                return
            body = json.loads(self.rfile.read(length)) if length else {}
            ids = body.get("ids") or []
            if isinstance(ids, str):
                ids = re.split(r"[\s,;]+", ids)
            ids = [i for i in ids if i][:2000]
            results = resolve_ids(ids)
            self.send_json(200, {"count": len(results),
                                 "found": sum(1 for r in results if r["found"]),
                                 "results": results})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_geneset(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 1_000_000:
                self.send_json(413, {"error": "Gene list too large"})
                return
            payload = json.loads(self.rfile.read(length) or b"{}")
            genes = payload.get("genes") or []
            if isinstance(genes, str):
                genes = re.split(r"[\s,;]+", genes)
            genes = [g for g in genes if g][:5000]
            if not genes:
                self.send_json(400, {"error": "Provide a non-empty 'genes' list"})
                return
            code, payload = geneset_report(genes)
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_neighborhood(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            ddb = q.get("ddb", [""])[0]
            try:
                k = max(1, min(15, int(q.get("k", ["5"])[0])))
            except ValueError:
                k = 5
            code, payload = gene_neighborhood(ddb, k)
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_bulk(self):
        """Stream a TSV dump of a dataset as a download."""
        try:
            dataset = parse_qs(urlparse(self.path).query).get("dataset", [""])[0]
            fname, text = bulk_tsv(dataset)
            if not fname:
                self.send_json(400, {"error": "Unknown dataset. Use genes|go|phenotypes|orthologs."})
                return
            data = text.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/tab-separated-values; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{fname}"')
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "public, max-age=300, s-maxage=3600")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(data)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_region(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            code, payload = extract_region(
                q.get("genome", ["d-discoideum-ax4"])[0], q.get("chrom", [""])[0],
                q.get("start", ["0"])[0], q.get("end", ["0"])[0],
                q.get("strand", ["+"])[0], q.get("flank", ["0"])[0])
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_ispcr(self):
        try:
            q = parse_qs(urlparse(self.path).query)
            code, payload = run_ispcr(q.get("genome", ["d-discoideum-ax4"])[0],
                                      q.get("fwd", [""])[0], q.get("rev", [""])[0],
                                      q.get("maxsize", ["4000"])[0])
            self.send_json(code, payload)
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_protein_props(self):
        try:
            ddb = (parse_qs(urlparse(self.path).query).get("ddb", [""])[0] or "").strip().upper()
            if not re.match(r"^DDB_G\d+$", ddb):
                self.send_json(400, {"error": "bad or missing ddb"})
                return
            prot = (extract_sequence(ddb, "protein") or "").strip()
            if not prot:
                self.send_json(404, {"error": "no protein for this gene"})
                return
            self.send_json(200, bench.protein_props(prot))
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_align(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 500000:
                self.send_json(413, {"error": "Input too large (500 KB max)."})
                return
            body = json.loads(self.rfile.read(length)) if length else {}
            text = body.get("fasta") or body.get("sequences") or ""
            jid = submit_job(lambda: run_align(text))   # pure-Python but can be slow; queue it
            self.send_json(202, {"job_id": jid})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_upload(self):
        if not ACCEPT_PUBLIC_SUBMISSIONS:   # disabled for public launch
            self.send_json(404, {"error": "Not found"})
            return
        try:
            ip = self.client_address[0]
            if _rate_limited(_UPLOAD_HITS, ip, limit=10, window=3600):
                self.send_json(429, {"error": "Upload limit reached. Try again later."})
                return
            content_type = self.headers.get("Content-Type", "")
            length = int(self.headers.get("Content-Length", 0))
            if length <= 0 or length > UPLOAD_MAX_BYTES:
                self.send_json(413, {"error": f"File too large (max {UPLOAD_MAX_BYTES // (1024 * 1024)} MB)."})
                return
            body = self.rfile.read(length)
            raw = f"Content-Type: {content_type}\r\n\r\n".encode() + body
            msg = message_from_bytes(raw)
            fields = {}
            file_data = None
            file_name = "upload"
            if msg.is_multipart():
                for part in msg.get_payload():
                    disp = part.get("Content-Disposition", "")
                    name = fname = None
                    for item in disp.split(";"):
                        item = item.strip()
                        if item.startswith('name='): name = item[5:].strip('"')
                        elif item.startswith('filename='): fname = item[9:].strip('"')
                    if name is None: continue
                    payload = part.get_payload(decode=True)
                    if fname:
                        file_data = payload
                        file_name = fname
                    else:
                        fields[name] = payload.decode("utf-8", errors="replace") if payload else ""
            submission_id = str(uuid.uuid4())[:8]
            meta = {"id": submission_id, "timestamp": datetime.datetime.utcnow().isoformat() + "Z", "files": []}
            meta.update(fields)
            if file_data:
                ext = os.path.splitext(file_name)[1].lower()
                if ext not in UPLOAD_EXTS:
                    self.send_json(415, {"error": f"File type '{ext or 'unknown'}' not accepted."})
                    return
                # sanitize -> alnum/._- only, so no path separators survive
                safe = "".join(c for c in f"{submission_id}_{file_name}" if c.isalnum() or c in "._-")
                (UPLOADS_DIR / "files" / safe).write_bytes(file_data)
                meta["files"].append(safe)
            (UPLOADS_DIR / "submissions" / f"{submission_id}.json").write_text(json.dumps(meta, indent=2))
            self.send_json(200, {"ok": True, "id": submission_id})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        # Baseline security headers on every response (belt-and-suspenders with
        # anything the Apache/TLS front adds; HSTS is set at the TLS terminator).
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "SAMEORIGIN")
        self.send_header("Referrer-Policy", "strict-origin-when-cross-origin")
        # HTML is always revalidated so new asset versions are picked up;
        # mtime-stamped css/js can be cached aggressively (URL changes on edit);
        # any unversioned css/js still revalidates to avoid staleness.
        raw = self.path.split("?")[0]
        query = self.path.split("?", 1)[1] if "?" in self.path else ""
        if getattr(self, "_no_cache", False) or raw == "/" or raw.endswith(".html"):
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif raw.endswith((".css", ".js")):
            if "v=" in query:
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            else:
                self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif raw.endswith(".json"):
            # Data JSONs are versioned (?v=<data stamp>) by the fetch wrapper in
            # app.js, so a changed file gets a new URL — cache it hard (and let a
            # CDN cache it too). Unversioned hits (news.json, direct/curl) keep
            # revalidating so no one reads a stale corpus/index.
            if "v=" in query:
                self.send_header("Cache-Control", "public, max-age=31536000, immutable")
            else:
                self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif (self.command == "GET" and getattr(self, "_code", 200) < 300
              and raw.startswith(API_CACHEABLE_PREFIXES)):
            self.send_header("Cache-Control", API_CACHE_CONTROL)
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

# Threaded so a slow proxied/external call (e.g. the AlphaFold proxy) never
# blocks other requests on the single-threaded server.
class Server(http.server.ThreadingHTTPServer):
    # stdlib default listen backlog is only 5 — far too small, so bursts of
    # simultaneous new connections get refused. 256 absorbs realistic spikes.
    request_queue_size = 256
    daemon_threads = True          # don't let worker threads block shutdown
    allow_reuse_address = True

def main():
    port = int(os.environ.get("PORT", "8774"))
    host = os.environ.get("HOST", "127.0.0.1")
    # Merge any durable curation overrides over the base data before serving, so
    # the very first request already reflects curated edits.
    apply_gene_overrides()
    apply_stock_overrides()
    Server((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
