# Deploying Dicty@Duke to a public host

A practical, ordered checklist for putting the site on a public VM safely. The
application code is already hardened (env-var secret, constant-time auth,
rate-limited login/uploads, throttled BLAST endpoints — see
`tests/test_security.py`); **what remains is infrastructure**: TLS, a firewall,
process supervision, and disk hygiene. Do these in order.

The site is a single Python-stdlib server (`serve.py`) plus static assets and a
few gitignored data dirs (genomes, BLAST DBs). There is no build step.

> **Threat-model recap.** Never expose the Python port (8774) to the internet.
> Put a TLS-terminating reverse proxy in front of it and firewall everything
> else. `serve.py` binds `127.0.0.1` by default — keep it that way.

---

## 0. Provision the VM

- **Size:** ~2 vCPU / 4 GB RAM / 30 GB disk is plenty for the expected ≤10
  concurrent users. BLAST is the only CPU-heavy path and is now capped to 3
  concurrent searches (`BLAST_MAX_CONCURRENT`), so 2 vCPU absorbs it. The
  genomes (~600 MB) + BLAST DBs dominate disk.
- **OS:** Ubuntu 22.04/24.04 LTS assumed below (Debian-family `apt`).
- **DNS:** point an A/AAAA record (e.g. `dicty.yourdomain.org`) at the VM's
  public IP before requesting a cert — Let's Encrypt validates over that name.
- Create a non-root service user to run the app:
  ```bash
  sudo adduser --system --group --home /opt/dicty dicty
  ```

---

## 1. Get the code and runtime data onto the box

Everything below runs as the `dicty` user (`sudo -u dicty -H bash`), in
`/opt/dicty`.

```bash
# Code (private repo — use a deploy key or a PAT)
git clone https://github.com/kmscaglione/dictyatduke.git /opt/dicty/app
cd /opt/dicty/app

# Python 3 only — the server itself is pure stdlib, no pip install needed to run.
python3 --version    # 3.10+ expected
```

**Genomes + BLAST (gitignored — must be regenerated on a fresh host):**

```bash
# 1. Download the genome assemblies (NCBI). Needs network.
python3 scripts/build_data.py          # or the genome-download step it wraps

# 2. Install NCBI BLAST+ (pick the Linux build) and put the 3 binaries on PATH
#    or in ~/.local/blast/  (serve.py looks in both).
curl -LO https://ftp.ncbi.nlm.nih.gov/blast/executables/blast+/LATEST/ncbi-blast-2.17.0+-x64-linux.tar.gz
tar xzf ncbi-blast-2.17.0+-x64-linux.tar.gz
mkdir -p ~/.local/blast && cp ncbi-blast-2.17.0+/bin/{makeblastdb,blastn,tblastn} ~/.local/blast/

# 3. Build the per-species BLAST databases (-> assets/genomes/blastdb/)
python3 scripts/build_blastdb.py

# 4. (Optional but recommended) bgzip+tabix the genome-browser GFFs so IGV
#    byte-ranges instead of downloading 27 MB per open. Needs pysam at BUILD
#    time only (not a runtime dep).
pip install --user pysam
python3 scripts/build_browser_tracks.py
```

> If BLAST+ or the DBs are absent the BLAST endpoints return a clean 503 and the
> rest of the site works — so this step is optional if you don't need the BLAST
> tool live on day one.

**Smoke-test before going further:**

```bash
python3 -m unittest discover -s tests     # expect "OK" (36 tests)
CURATOR_PASSWORD=test PORT=8774 python3 serve.py &
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8774/   # expect 200
kill %1
```

---

## 2. Secrets and environment

The server reads four env vars: `CURATOR_PASSWORD`, `BLAST_MAX_CONCURRENT`
(default 3), `PORT` (default 8774), `HOST` (default 127.0.0.1).

Create a root-owned, locked-down env file (the systemd unit loads it):

```bash
sudo install -o root -g dicty -m 0640 /dev/null /etc/dicty.env
sudo tee /etc/dicty.env >/dev/null <<EOF
CURATOR_PASSWORD=$(python3 -c 'import secrets;print(secrets.token_urlsafe(24))')
BLAST_MAX_CONCURRENT=3
PORT=8774
HOST=127.0.0.1
EOF
```

- **Save the generated `CURATOR_PASSWORD`** in your password manager — it's the
  only way into the curator dashboard. If you don't set it, the server prints a
  random one to its log on each start (fine for dev, not for prod).
- Keep `HOST=127.0.0.1` so the Python process is unreachable except via the
  reverse proxy.

---

## 3. Run it under a process supervisor (systemd)

`serve.py` is a long-running process with **in-memory session/rate-limit/
semaphore state** — it must run as a **single process** (do not fork workers;
the state wouldn't be shared) and must auto-restart on crash or reboot.

```ini
# /etc/systemd/system/dicty.service
[Unit]
Description=Dicty@Duke (serve.py)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dicty
Group=dicty
WorkingDirectory=/opt/dicty/app
EnvironmentFile=/etc/dicty.env
ExecStart=/usr/bin/python3 serve.py
Restart=always
RestartSec=2

# Resource ceilings — BLAST can spike CPU; keep it from starving the box.
CPUQuota=180%
MemoryMax=2G
TasksMax=256

# Sandboxing — the process only needs to read its dir and write uploads/cache.
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/opt/dicty/app/uploads /opt/dicty/app/cache
ProtectKernelTunables=true
ProtectControlGroups=true
RestrictAddressFamilies=AF_INET AF_INET6 AF_UNIX

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dicty
systemctl status dicty            # active (running)
journalctl -u dicty -f            # live logs
```

> `PrivateTmp=true` gives the process a private `/tmp` — BLAST's temp query
> files (`tempfile.NamedTemporaryFile`) land there, which is fine and tidier.
> `ProtectSystem=strict` makes the whole FS read-only except the two
> `ReadWritePaths`; if you add a writable dir later, list it here.

---

## 4. TLS + reverse proxy (Caddy)

Caddy is the least-effort option: it auto-provisions and renews a Let's Encrypt
certificate and reverse-proxies to the local Python process. It also lets us add
the security headers the stdlib server doesn't send.

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy
```

```caddyfile
# /etc/caddy/Caddyfile
dicty.yourdomain.org {
	encode gzip zstd
	reverse_proxy 127.0.0.1:8774

	# Security headers serve.py doesn't set.
	header {
		X-Content-Type-Options nosniff
		X-Frame-Options SAMEORIGIN
		Referrer-Policy strict-origin-when-cross-origin
		-Server
	}

	# Reject absurd request bodies at the edge (uploads are capped at 50 MB
	# in serve.py; give a little headroom for multipart overhead).
	request_body {
		max_size 60MB
	}

	log {
		output file /var/log/caddy/dicty-access.log
		format console
	}
}
```

```bash
sudo mkdir -p /var/log/caddy && sudo chown caddy:caddy /var/log/caddy
sudo systemctl reload caddy
journalctl -u caddy -f            # watch the cert get issued on first hit
```

> **Why not a Content-Security-Policy header?** The front-end loads several
> third parties (jsdelivr for Chart.js/IGV, 3Dmol from pitt.edu, YouTube embed,
> AlphaFold/NCBI/UniProt/EBI XHRs). A correct CSP is doable but must enumerate
> all of them; ship without it first, then tighten once the allowlist is
> verified in the browser console. `X-Frame-Options`/`nosniff` are the high-value
> easy wins.

---

## 5. Firewall — only 22, 80, 443

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp        # ACME http-01 challenge + http->https redirect
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose      # confirm 8774 is NOT listed
```

Port **8774 must never appear** — the only path to the app is through Caddy on
443. Double-check with `sudo ss -tlnp` that `python3` is listening on
`127.0.0.1:8774`, not `0.0.0.0:8774`.

---

## 6. Disk hygiene for public uploads

`/api/upload` is public (size-capped 50 MB, type-allowlisted, rate-limited
10/hr/IP) but has **no total-disk cap** — many IPs over time could fill the
disk. Prune old uploads on a timer:

```ini
# /etc/systemd/system/dicty-prune.service
[Service]
Type=oneshot
ExecStart=/usr/bin/find /opt/dicty/app/uploads/files /opt/dicty/app/uploads/submissions -type f -mtime +30 -delete
User=dicty
```
```ini
# /etc/systemd/system/dicty-prune.timer
[Timer]
OnCalendar=daily
Persistent=true
[Install]
WantedBy=timers.target
```
```bash
sudo systemctl daemon-reload && sudo systemctl enable --now dicty-prune.timer
```

> Keep `uploads/curations/` (real community submissions) out of the prune — the
> command above only touches `files/` and `submissions/`. Curations are reviewed
> via the curator dashboard and committed to the repo.

Also cap Caddy's access log so it can't grow unbounded (systemd-journald and
logrotate handle the rest):

```bash
echo '/var/log/caddy/*.log { weekly rotate 8 compress missingok notifempty }' | sudo tee /etc/logrotate.d/caddy-dicty
```

---

## 7. (Optional) CDN in front

For higher scale, put Cloudflare in front per **`docs/cdn-setup.md`** — the
multi-MB data JSONs are versioned-immutable (`?v=<mtime>`) so the edge caches
them hard with no stale-data risk, offloading ~90% of origin bytes. Not needed
at ≤10 users, but it's the cheapest scale lever when you want it.

---

## 8. Post-deploy verification

Run through these from your laptop (not the VM):

- [ ] `https://dicty.yourdomain.org/` loads with a valid padlock (cert issued).
- [ ] `http://dicty.yourdomain.org/` redirects to `https://` (Caddy default).
- [ ] A gene page renders (e.g. `/gene/mybB`) and the GO/Orthologs tabs load.
- [ ] BLAST tool returns hits (or a clean 503 if you skipped the DB build).
- [ ] `curl -sI https://dicty.yourdomain.org/ | grep -i x-frame` shows the header.
- [ ] `curl https://dicty.yourdomain.org:8774/` **fails/times out** (port closed).
- [ ] Curator login works with the `CURATOR_PASSWORD` you saved.
- [ ] Fire 25 quick BLAST requests → you get some `429`s (rate limit live).
- [ ] `sudo reboot`, then confirm `dicty` and `caddy` came back up on their own.

---

## 9. Updating after first deploy

```bash
sudo -u dicty -H bash -c 'cd /opt/dicty/app && git pull'
sudo systemctl restart dicty        # picks up serve.py changes
# Front-end (app.js/index.html) is read per-request — no restart needed for those.
# After a data rebuild, the ?v= stamp auto-busts caches (and the CDN) — no purge.
```

---

## Appendix A — Running off a macOS laptop (Cloudflare Tunnel + launchd)

Viable for the ≤10-user scale without a VM. The laptop never exposes a port —
the Cloudflare Tunnel dials out, so no inbound firewall holes and TLS is handled
by Cloudflare.

1. **Keep it awake:** run the server under `caffeinate -dimsu` (or set
   Energy Saver to never sleep on AC).
2. **Persistent tunnel** (not the ephemeral quick tunnel): create a named tunnel
   bound to a hostname you own —
   ```bash
   cloudflared tunnel login
   cloudflared tunnel create dicty
   cloudflared tunnel route dns dicty dicty.yourdomain.org
   # config.yml: tunnel: <id>; ingress: - hostname: dicty.yourdomain.org
   #             service: http://127.0.0.1:8774 ; - service: http_status:404
   ```
3. **Auto-start both** with launchd `.plist` agents (or `cloudflared service
   install`): one runs `caffeinate -dimsu /usr/bin/python3 serve.py` with the
   `CURATOR_PASSWORD` env var set, the other runs `cloudflared tunnel run dicty`.
   Set `KeepAlive=true` so they relaunch on crash/reboot.
4. The security headers/body-size limits from §4 can be set in the Cloudflare
   dashboard (Transform Rules) instead of Caddy.

The trade-offs vs a VM: home ISP uptime/IP, the laptop must stay on, and a
single machine is your whole availability story. Fine for a beta; move to a VM
before it's anyone's primary database.
