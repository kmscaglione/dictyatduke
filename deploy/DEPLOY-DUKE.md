# Deploying Dicty@Duke on dicty.labs.duke.edu (Apache + systemd)

Concrete steps for this server. Path assumed: `/srv/web/dicty.labs.duke.edu/html`.
General background is in `../docs/deployment.md`; this file is the Duke-specific
recipe. Run everything on the server over SSH (`ssh kms205@dicty.labs.duke.edu`).

## Architecture
Apache (TLS) ──reverse proxy──> serve.py on 127.0.0.1:8774 (systemd service).
serve.py serves the whole app — SPA, /api/*, sitemap, etc. Apache just terminates
TLS and forwards. Do **not** point Apache at the files directly (see the vhost
comment for why).

## 1. Get the code
```bash
cd /srv/web/dicty.labs.duke.edu
git clone https://gitlab.oit.duke.edu/kms205/dictyatduke.git html   # if html is empty/absent
#   Username: kms205   Password: your GitLab token
```
Result: the app lives in `/srv/web/dicty.labs.duke.edu/html` (contains
`serve.py`, `index.html`, `app.js`, `assets/`, …).

## 2. Secrets
```bash
sudo sh -c 'printf "CURATOR_PASSWORD=%s\n" "$(openssl rand -base64 24)" > /etc/dicty.env'
sudo chmod 600 /etc/dicty.env
sudo chown dicty:dicty /etc/dicty.env      # the service user (see step 4)
```

## 3. Genome data (needed for Genome browser / BLAST / Downloads)
`assets/genomes/` (~600 MB) is gitignored, so the clone doesn't include it.
Requires NCBI BLAST+ and pysam (build-time only). On the server:
```bash
cd /srv/web/dicty.labs.duke.edu/html
# Download the bundled assemblies (see scripts/ + downloads_manifest.json), then:
python3 scripts/fetch_paper_genomes.py        # the Ahmed 2025 isolate genomes
python3 scripts/build_blastdb.py              # needs makeblastdb on PATH (~/.local/blast)
python3 scripts/build_browser_tracks.py       # needs: pip install --user pysam
```
The site runs without this — only the genome browser, local BLAST, cross-species,
synteny, variation, and genome downloads need it. Everything else works from the
committed JSON.

## 4. Run serve.py as a service
```bash
# Create the service account if it doesn't exist (or reuse an OIT web user):
sudo useradd --system --home /srv/web/dicty.labs.duke.edu/html --shell /usr/sbin/nologin dicty
sudo chown -R dicty:dicty /srv/web/dicty.labs.duke.edu/html

sudo cp deploy/dicty.service /etc/systemd/system/dicty.service
# >>> edit User=/Group= and the BLAST_/PROXY_ caps for this box first <<<
sudo systemctl daemon-reload
sudo systemctl enable --now dicty
systemctl status dicty                 # should be active (running)
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8774/   # expect 200
```

## 5. Apache front
```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/dicty.apache.conf /etc/apache2/sites-available/dicty.conf
# >>> edit SSLCertificate* paths to OIT's cert locations <<<
sudo a2ensite dicty
sudo apache2ctl configtest && sudo systemctl reload apache2
```
(RHEL/CentOS: modules are usually built in; drop the conf in
`/etc/httpd/conf.d/dicty.conf` and `systemctl reload httpd`.)

Then visit https://dicty.labs.duke.edu — gene search, records, and tools should
all work.

## 6. Updating later
```bash
cd /srv/web/dicty.labs.duke.edu/html
sudo -u dicty git pull
sudo systemctl restart dicty           # only needed for serve.py changes;
                                       # app.js/index.html/JSON are read live.
```

## Notes
- **Single process only** — never run multiple serve.py workers (in-memory state).
- **Rate limiting behind the proxy** — serve.py sees 127.0.0.1 for all clients,
  so per-IP throttles become global. Fine for an internal site; ask for the
  X-Forwarded-For change to restore per-client limits.
- **CDN** — if this is ever fronted by a CDN, see `../docs/cdn-setup.md`; the app
  already emits immutable/edge-cacheable headers.
