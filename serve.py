import http.server, os, json, uuid, datetime, pathlib, urllib.request, urllib.error, re, ssl
from email import message_from_bytes
from email.policy import HTTP as HTTP_POLICY

SSL_CTX = ssl.create_default_context()
SSL_CTX.check_hostname = False
SSL_CTX.verify_mode = ssl.CERT_NONE

ROOT = os.path.dirname(os.path.abspath(__file__))
UPLOADS_DIR = pathlib.Path(ROOT) / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)
(UPLOADS_DIR / "files").mkdir(exist_ok=True)
(UPLOADS_DIR / "submissions").mkdir(exist_ok=True)

STATIC_EXTS = {".css", ".js", ".png", ".jpg", ".jpeg", ".ico", ".svg", ".woff", ".woff2", ".pdf", ".docx", ".gz", ".fna", ".fai", ".gff", ".gtf", ".json"}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        # Proxy AlphaFold PDB files to add CORS headers
        m = re.match(r"^/api/alphafold/([A-Z0-9]+)$", self.path, re.I)
        if m:
            uniprot = m.group(1).upper()
            try:
                api_url = f"https://alphafold.ebi.ac.uk/api/prediction/{uniprot}"
                with urllib.request.urlopen(api_url, timeout=10, context=SSL_CTX) as r:
                    info = json.loads(r.read())[0]
                pdb_url = info.get("pdbUrl", "")
                if not pdb_url:
                    raise ValueError("No pdbUrl")
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

        _, ext = os.path.splitext(self.path.split("?")[0])
        if ext not in STATIC_EXTS:
            self.path = "/index.html"
        super().do_GET()

    def do_POST(self):
        if self.path != "/api/upload":
            self.send_error(404)
            return
        try:
            content_type = self.headers.get("Content-Type", "")
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # Build a fake email message so email.parser can handle multipart/form-data
            raw = f"Content-Type: {content_type}\r\n\r\n".encode() + body
            msg = message_from_bytes(raw)

            fields = {}
            file_data = None
            file_name = "upload"

            if msg.is_multipart():
                for part in msg.get_payload():
                    disp = part.get("Content-Disposition", "")
                    name = None
                    fname = None
                    for item in disp.split(";"):
                        item = item.strip()
                        if item.startswith('name='):
                            name = item[5:].strip('"')
                        elif item.startswith('filename='):
                            fname = item[9:].strip('"')
                    if name is None:
                        continue
                    payload = part.get_payload(decode=True)
                    if fname:
                        file_data = payload
                        file_name = fname
                    else:
                        fields[name] = payload.decode("utf-8", errors="replace") if payload else ""

            submission_id = str(uuid.uuid4())[:8]
            meta = {
                "id": submission_id,
                "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
                "files": []
            }
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
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        pass

http.server.HTTPServer(("127.0.0.1", 8774), Handler).serve_forever()
