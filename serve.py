import http.server, os, json, uuid, datetime, pathlib, urllib.request, urllib.error, re, ssl, hashlib
import subprocess, shutil, tempfile, csv, html, gzip, io
from email import message_from_bytes
from email.utils import parsedate_to_datetime
from urllib.parse import unquote, urlparse, parse_qs

import enrichment

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = pathlib.Path(ROOT) / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "files").mkdir(exist_ok=True)
(UPLOADS_DIR / "submissions").mkdir(exist_ok=True)
(UPLOADS_DIR / "curations").mkdir(exist_ok=True)

CORPUS_PATH = pathlib.Path(ROOT) / "assets" / "dictybase_corpus.json"
STATIC_EXTS = {".css", ".js", ".png", ".jpg", ".jpeg", ".ico", ".svg", ".woff", ".woff2",
               ".pdf", ".docx", ".gz", ".fna", ".fai", ".gff", ".gtf", ".json"}
# Text assets worth gzipping on the fly (the JSON data files are multi-MB and
# compress ~85%). Binary/already-compressed types are served as-is.
COMPRESSIBLE_EXTS = {".json", ".js", ".css", ".svg", ".gff", ".gtf", ".fna", ".fai"}

# Cache-busting: stamp local css/js asset URLs in index.html with their mtime
# so browsers always re-fetch a file after it changes, but cache it otherwise.
ASSET_RE = re.compile(r'(href|src)="(/[^"?]+\.(?:css|js))"')

# Simple curator auth — SHA256 of password
CURATOR_PASSWORD_HASH = hashlib.sha256(b"dicty2024curator").hexdigest()

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
}


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
        for ddb, sym, name, loc, ncbi in rows:
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


def api_gene_rows():
    """ddb -> {ddb,symbol,name,location,ncbiGene}; plus a lowercase symbol->ddb map."""
    if "_rows" not in _API:
        rows, sym = {}, {}
        try:
            for ddb, symbol, name, loc, ncbi in _load_json("gene_index.json"):
                rows[ddb] = {"ddb": ddb, "symbol": symbol, "name": name, "location": loc, "ncbiGene": ncbi}
                sym.setdefault(symbol.lower(), ddb)
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

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Per-gene sequence download (genomic / cDNA / protein FASTA)
        if self.path.startswith("/api/sequence?"):
            self._handle_sequence()
            return

        # Public read API
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
        if self.path.startswith("/api/domains"):
            self._handle_domains()
            return

        # AlphaFold proxy
        m = re.match(r"^/api/alphafold/([A-Z0-9]+)$", self.path, re.I)
        if m:
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

        raw = self.path.split("?")[0]
        _, ext = os.path.splitext(raw)
        # Serve the SPA shell (with cache-busted asset URLs) for the root, an
        # explicit index.html, or any non-static client route. Real static
        # files fall through to the default handler.
        if raw in ("/", "/index.html") or ext not in STATIC_EXTS:
            return self._serve_index()
        # On-the-fly gzip for large text assets when the client accepts it,
        # preserving Last-Modified / If-Modified-Since 304 revalidation.
        if ext in COMPRESSIBLE_EXTS and "gzip" in self.headers.get("Accept-Encoding", ""):
            if self._serve_gzipped(raw):
                return
        super().do_GET()

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
            with open(fs_path, "rb") as f:
                body = gzip.compress(f.read(), compresslevel=6)
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
            body = ASSET_RE.sub(stamp, html).encode()
            self._no_cache = True
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except Exception as e:
            self.send_error(500, str(e))

    def do_POST(self):
        if self.path == "/api/upload":
            self._handle_upload()
        elif self.path == "/api/curator/login":
            self._handle_login()
        elif self.path == "/api/curator/submit":
            self._handle_curation_submit()
        elif self.path == "/api/curator/approve":
            self._handle_curation_approve()
        elif self.path == "/api/curator/reject":
            self._handle_curation_reject()
        elif self.path == "/api/blast":
            self._handle_blast()
        elif self.path == "/api/enrichment":
            self._handle_enrichment()
        else:
            self.send_error(404)

    def _handle_domains(self):
        """GET /api/domains?acc=UNIPROT -> {length, domains:[...]}.

        Proxies the InterPro REST API (server-side: handles SSL + avoids CORS)
        for protein length and domain/family architecture."""
        q = parse_qs(urlparse(self.path).query)
        acc = (q.get("acc", [""])[0] or "").strip()
        if not re.match(r"^[A-Za-z0-9]+$", acc):
            self.send_json(400, {"error": "bad or missing accession"})
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
            background = "genome" if payload.get("background") == "genome" else "annotated"
            min_study = max(1, min(int(payload.get("min_study", 2)), 50))
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

    def _auth(self, token):
        return token == CURATOR_PASSWORD_HASH

    def _handle_login(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
            pw = body.get("password", "")
            h = hashlib.sha256(pw.encode()).hexdigest()
            if h == CURATOR_PASSWORD_HASH:
                self.send_json(200, {"token": CURATOR_PASSWORD_HASH})
            else:
                self.send_json(401, {"error": "Wrong password"})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_curation_submit(self):
        """Community submission of a gene curation."""
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length))
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
            curator_name = body.get("curator_name", "Curator")
            curation_file = UPLOADS_DIR / "curations" / f"{curation_id}.json"
            if not curation_file.exists():
                self.send_json(404, {"error": "Curation not found"})
                return
            entry = json.loads(curation_file.read_text())
            ddb = entry.get("ddb", "").strip()
            if not ddb:
                self.send_json(400, {"error": "No DDB ID — cannot merge without a DDB_G identifier"})
                return
            # Merge into corpus
            corpus = json.loads(CORPUS_PATH.read_text()) if CORPUS_PATH.exists() else {}
            if ddb not in corpus: corpus[ddb] = {}
            corpus[ddb]["summary"] = entry["summary"]
            corpus[ddb]["curator"] = curator_name
            corpus[ddb]["curator_date"] = datetime.datetime.utcnow().strftime("%d-%b-%Y").upper()
            if entry.get("pmids"):
                corpus[ddb]["curator_pmids"] = entry["pmids"]
            CORPUS_PATH.write_text(json.dumps(corpus, separators=(",", ":")))
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

    def _handle_api_status(self):
        def updated(fname):
            try:
                return datetime.datetime.utcfromtimestamp((ASSETS / fname).stat().st_mtime).strftime("%Y-%m-%d")
            except OSError:
                return None
        rows, _ = api_gene_rows()
        datasets = [
            {"key": "summaries", "label": "Curated gene summaries", "source": "dictyBase (Basu et al. 2015)",
             "updated": updated("dictybase_corpus.json"), "records": len(_load_json("dictybase_corpus.json"))},
            {"key": "gene_index", "label": "Gene catalog", "source": "NCBI RefSeq — D. discoideum AX4 GFF",
             "updated": updated("gene_index.json"), "records": len(rows)},
            {"key": "go", "label": "GO annotations", "source": "GO Consortium GAF (current.geneontology.org)",
             "updated": updated("go_annotations.json"), "records": len(_load_json("go_annotations.json"))},
            {"key": "phenotypes", "label": "Phenotypes", "source": "dictyBase mutant-strain curation",
             "updated": updated("phenotypes.json"), "records": len(_load_json("phenotypes.json"))},
            {"key": "genomes", "label": "Genome assemblies", "source": "NCBI Datasets",
             "updated": updated("downloads_manifest.json"), "records": len(_load_json("downloads_manifest.json"))},
        ]
        self.send_json(200, {"datasets": datasets})

    def _handle_api_gene(self, token):
        ddb = resolve_gene(token)
        if not ddb:
            self.send_json(404, {"error": "gene not found", "query": token})
            return
        self.send_json(200, assemble_gene(ddb))

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
            fasta = f">{symbol} {ddb} {label} | Dicty@Duke\n{wrapped}\n".encode()
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

    def _handle_blast(self):
        """Run a local blastn/tblastn against the bundled dictyostelid genomes.

        Security: program + database come from server allowlists; the user
        sequence is written to a temp file and passed via -query (never a shell),
        with a size cap and a timeout. No user value reaches a shell or a path.
        """
        try:
            length = int(self.headers.get("Content-Length", 0))
            if length > 200000:
                self.send_json(413, {"error": "Query too large (200 KB max)."})
                return
            body = json.loads(self.rfile.read(length))
            program = body.get("program", "blastn")
            database = body.get("database", "d-discoideum-ax4")
            query = (body.get("query") or "").strip()

            if program not in BLAST_PROGRAMS:
                self.send_json(400, {"error": "Unsupported program."})
                return
            if database == "all":
                db_ids = list(BLAST_DBS.keys())
            elif database in BLAST_DBS:
                db_ids = [database]
            else:
                self.send_json(400, {"error": "Unknown database."})
                return
            if not query:
                self.send_json(400, {"error": "Empty query sequence."})
                return
            if not query.startswith(">"):
                query = ">query\n" + query

            binpath = blast_bin(program)
            if not binpath:
                self.send_json(503, {"error": "BLAST is not installed on the server. See README (P6)."})
                return
            missing = [d for d in db_ids if not (BLAST_DB_DIR / (d + ".nsq")).exists()
                       and not (BLAST_DB_DIR / (d + ".nin")).exists()]
            if missing:
                self.send_json(503, {"error": "BLAST databases not built. Run scripts/build_blastdb.py."})
                return

            db_arg = " ".join(str(BLAST_DB_DIR / d) for d in db_ids)
            qf = tempfile.NamedTemporaryFile("w", suffix=".fa", delete=False)
            try:
                qf.write(query)
                qf.close()
                cmd = [binpath, "-query", qf.name, "-db", db_arg,
                       "-outfmt", "6 qseqid sseqid pident length mismatch gapopen qstart qend sstart send evalue bitscore",
                       "-max_target_seqs", "50", "-evalue", "1e-3"]
                proc = subprocess.run(cmd, capture_output=True, text=True, timeout=40)
            finally:
                try:
                    os.unlink(qf.name)
                except OSError:
                    pass

            if proc.returncode != 0:
                self.send_json(500, {"error": "BLAST failed.", "detail": (proc.stderr or "")[:400]})
                return

            hits = []
            for line in proc.stdout.splitlines():
                f = line.split("\t")
                if len(f) < 12:
                    continue
                acc = re.sub(r"^[a-z]+\|", "", f[1]).strip("|")
                hit = {
                    "subject": acc,
                    "identity": float(f[2]), "length": int(f[3]),
                    "qstart": int(f[6]), "qend": int(f[7]),
                    "sstart": int(f[8]), "send": int(f[9]),
                    "evalue": f[10], "bitscore": float(f[11]),
                }
                g = gene_for_hit(acc, f[8], f[9])
                if g:
                    hit["gene"] = g
                hits.append(hit)
            self.send_json(200, {"program": program, "databases": db_ids,
                                 "count": len(hits), "hits": hits})
        except subprocess.TimeoutExpired:
            self.send_json(504, {"error": "BLAST timed out (try a shorter query or one genome)."})
        except Exception as e:
            self.send_json(500, {"error": str(e)})

    def _handle_upload(self):
        try:
            content_type = self.headers.get("Content-Type", "")
            length = int(self.headers.get("Content-Length", 0))
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
            # Data files change as curation is updated — revalidate (cheap 304s)
            # so viewers never read a stale corpus/index from cache.
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass

# Threaded so a slow proxied/external call (e.g. the AlphaFold proxy) never
# blocks other requests on the single-threaded server.
def main():
    port = int(os.environ.get("PORT", "8774"))
    host = os.environ.get("HOST", "127.0.0.1")
    http.server.ThreadingHTTPServer((host, port), Handler).serve_forever()


if __name__ == "__main__":
    main()
