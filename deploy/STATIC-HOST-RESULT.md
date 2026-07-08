# Static-host trial result — dictyBase needs a backend VM

**Date:** 2026-06-30
**Host tested:** `web-staticsites-01.oit.duke.edu` (OIT shared static hosting)
**Site:** `https://dicty.labs.duke.edu`, DocumentRoot `/srv/web/dicty.labs.duke.edu/html`
**Verdict:** The static-site host **cannot** serve this application. A dedicated VM
(or container) that can run a long-lived backend process behind the reverse proxy
is required.

## What the app is
dictyBase is **not** a static site. It is a single-page app served by a small
Python backend (`serve.py`, Python 3 standard library only — no third-party
runtime deps). The backend does work that a static DocumentRoot cannot:

- Serves all `/api/*` endpoints (gene records, search, BLAST, enrichment, ID
  mapping, sequence/region retrieval, etc.).
- Renders the SPA shell for every deep link (`/gene/<symbol>`, `/tools/<x>`,
  `/strain/<id>`) and injects per-route SEO `<head>` tags.
- Generates `/sitemap.xml` and `/robots.txt` dynamically (~14k gene URLs).
- Serves byte-range genome reads, on-the-fly gzip, and cache headers.
- Spawns NCBI BLAST+ subprocesses for sequence search / conservation / synteny.

## Test performed (2026-06-30, on web-staticsites-01)
Ran `serve.py` locally on `127.0.0.1:8774` and compared the same requests
against the public static host.

| Request | `serve.py` backend running | Public static host |
| --- | --- | --- |
| `/` (home) | 200 | 200 (serves `index.html`) |
| `/api/version` | **200** (valid JSON) | **404** |
| `/gene/rasG` (deep link) | **200** | **404** |
| `/sitemap.xml` | **200** | **404** |
| `/robots.txt` | **200** | (n/a) |

The application is fully functional **with** its backend; on the static host
everything except literal files on disk returns **404**. The home page returns
200 only because `index.html` happens to exist — but search results, gene
records, BLAST, and every other feature depend on `/api/*`, which has no server
to answer it.

## Why the obvious workaround doesn't rescue it
Adding a SPA-fallback rewrite (serve `index.html` for unmatched paths) would stop
the deep-link 404s, but it does **not** help: every dynamic feature still calls
`/api/*`, which has no backend on a static host, so gene records, search,
BLAST, enrichment, sitemap, and per-route SEO all remain broken. A running
backend process is mandatory, and the static-hosting platform does not allow one.

## Structural blockers on the static host
- Vhost is OIT-generated static hosting: `/etc/httpd/conf.d/25-dicty.labs.duke.edu-https.conf`
  (`DocumentRoot`, no proxy).
- `/etc/systemd/system` and `/etc/httpd/conf.d` are **root-only** — a site owner
  cannot install the backend service or a reverse-proxy vhost.
- Even if a backend process were started by hand, a shared static-hosting host
  is not the place to run a persistent application service.

## What we need provisioned
A small VM (or container) we can administer, running the backend as a service
behind Apache/httpd (or nginx) reverse-proxying to `127.0.0.1:8774`. Deploy
artifacts are already in the repo: `deploy/dicty.service` (systemd unit),
`deploy/dicty.apache.conf` (reverse-proxy vhost), and `deploy/DEPLOY-DUKE.md`
(step-by-step), with general notes in `docs/deployment.md`.

**Suggested spec** (sized for ~50 concurrent users with headroom; BLAST is the
only heavy operation and runs as out-of-process subprocesses):

- **OS:** AlmaLinux/RHEL 9 is fine (matches the current box).
- **CPU/RAM:** ~8 vCPU / 16 GB. (Smaller, e.g. 4 vCPU / 8 GB, is workable for low
  traffic; BLAST concurrency caps scale to the core count.)
- **Disk:** ~80–100 GB SSD (app + ~600 MB–1 GB of genome assemblies/BLAST DBs).
- **Access we need:** ability to install/manage a systemd service and the
  reverse-proxy vhost (or have OIT configure the proxy to our backend port),
  `sudo` on the box, and outbound HTTPS (the backend proxies a few NCBI/EBI/
  UniProt calls).
- **Runtime deps:** none beyond system `python3`. Genome features additionally
  need NCBI BLAST+ on the host (build-time: `pysam` to index browser tracks).
- **Process model:** **single process** — session/rate-limit/BLAST-queue state is
  in-memory, so do not run multiple workers.
- **TLS + DNS:** keep `dicty.labs.duke.edu` (or a chosen name) pointed at the new
  host with a cert, same as today.

Once that VM exists, bringing the site up is the four steps in
`deploy/DEPLOY-DUKE.md` (clone → secret → `systemctl enable --now dicty` →
reverse-proxy vhost), plus the one-time `setsebool -P httpd_can_network_connect 1`
for SELinux.
