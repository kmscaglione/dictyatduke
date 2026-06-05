import http.server, os, json, uuid, datetime, pathlib, urllib.request, urllib.error, re, ssl, hashlib
from email import message_from_bytes

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

# Simple curator auth — SHA256 of password
CURATOR_PASSWORD_HASH = hashlib.sha256(b"dicty2024curator").hexdigest()

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
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

        _, ext = os.path.splitext(self.path.split("?")[0])
        if ext not in STATIC_EXTS:
            self.path = "/index.html"
        super().do_GET()

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
        else:
            self.send_error(404)

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

    def log_message(self, fmt, *args):
        pass

http.server.HTTPServer(("127.0.0.1", 8774), Handler).serve_forever()
