# Deploying dictyBase on dicty.labs.duke.edu (Apache + systemd)

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

### Optional: the AI analysis assistant ("Ask AI" tool)
The `/tools/ai` tool proxies a single, heavily-gated prompt to the **Google
Gemini API (free tier)** — no per-token bill. It is **off** unless
`GEMINI_API_KEY` is set — with no key the endpoint returns a clean "not enabled"
and the tool/card stay hidden, so the rest of the site is unaffected. Get a free
key at https://aistudio.google.com/apikey, then add it (and, optionally, override
the caps) to `/etc/dicty.env` and restart the service:
```bash
# append to /etc/dicty.env (keep the file 600 / owned by the service user):
GEMINI_API_KEY=AIza...                  # required to enable the tool (AI Studio, free)
# ANALYZE_MODEL=gemini-2.0-flash        # default; gemini-2.5-flash = stronger (also free tier)
# ANALYZE_GLOBAL_DAY=1000               # daily request ceiling (all users)
# ANALYZE_TOKENS_DAY=500000             # daily output-token soft cap (quota headroom)
# ANALYZE_PER_IP_MIN=4  ANALYZE_PER_IP_DAY=40   # per-IP throttles
```
Gating is layered (feature flag → input-size caps → per-IP rate → global daily
request + token caps), all reset at UTC midnight, to stay inside the free-tier
quota even under abuse. **Free-tier caveat:** Google may use free-tier inputs to
improve its models (the UI disclaimer warns users not to submit sensitive or
unpublished data); if that's a concern, use a paid/Workspace key or a different
provider. **Proxy caveat:** serve.py sees `127.0.0.1` for every client, so the
per-IP limits are effectively global until the X-Forwarded-For change lands (see
the Notes at the bottom) — the defaults are deliberately tight for that reason.
Bump `ANALYZE_PER_IP_*` once real client IPs are passed through.

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

## 5. Apache/httpd front

**On this box (AlmaLinux 9 + httpd, verified 2026-06-30):** there is already an
OIT-managed vhost for the site
(`/etc/httpd/conf.d/25-dicty.labs.duke.edu-https.conf`, with `DocumentRoot`).
Do **not** add a second vhost (`dicty.apache.conf` would collide — duplicate
ServerName on :443). Instead:

1. Fold the proxy directives from `deploy/dicty.httpd-proxy.conf` into that
   existing `<VirtualHost *:443>`. Modules (proxy, proxy_http, headers) are
   already loaded; `mod_ssl` is installed.
2. Flip the SELinux boolean (enforcing on this host — without it httpd can't
   reach the backend and every request 503s):
   ```bash
   sudo setsebool -P httpd_can_network_connect 1
   ```
3. Reload: `sudo apachectl configtest && sudo systemctl reload httpd`

`DocumentRoot` can stay set (OIT tooling expects it) — the `ProxyPass /` takes
precedence, so it's bypassed and all requests reach serve.py.

**Debian/apache2 or a from-scratch host instead?** Use the standalone vhost:
```bash
sudo a2enmod proxy proxy_http headers rewrite ssl
sudo cp deploy/dicty.apache.conf /etc/apache2/sites-available/dicty.conf
# >>> edit SSLCertificate* paths to the cert locations <<<
sudo a2ensite dicty
sudo apache2ctl configtest && sudo systemctl reload apache2
```

Then visit https://dicty.labs.duke.edu — gene search, records, and tools should
all work.

## 6. Updating later

First push the commits from your Mac to **GitLab** (the remote this box pulls
from): `git push gitlab master`.

Then, on the server, **force-match GitLab** — this is a deploy mirror, so always
fetch + hard-reset. Do **not** use `git pull`: the local branch diverges from the
rewritten history and `pull` stops with "Need to specify how to reconcile
divergent branches". (Pull as `kms205`, not `dicty` — that service user was never
created on this box; the checkout is owned by `kms205`.)

```bash
cd /srv/web/dicty.labs.duke.edu/html
git fetch origin master && git reset --hard origin/master
sudo systemctl restart dicty           # only needed for serve.py changes;
                                       # app.js/index.html/JSON/styles.css are read live.
```

`git reset --hard` discards anything local — which is what you want here, since
nothing is ever edited on the server directly.

## Notes
- **Single process only** — never run multiple serve.py workers (in-memory state).
- **Rate limiting behind the proxy** — serve.py sees 127.0.0.1 for all clients,
  so per-IP throttles become global. Fine for an internal site; ask for the
  X-Forwarded-For change to restore per-client limits.
- **CDN** — if this is ever fronted by a CDN, see `../docs/cdn-setup.md`; the app
  already emits immutable/edge-cacheable headers.
