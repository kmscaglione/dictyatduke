# Putting a CDN (Cloudflare) in front

This offloads the heavy static assets (the multi-MB gene JSONs, genomes, JS/CSS,
images) to Cloudflare's edge, so the origin (your laptop/VM) barely serves them.
It's the single biggest concurrency win and it's free.

## How the caching works (so edge caching is safe)

The app is built so the CDN can cache hard **without ever serving stale data**:

- **Data JSONs** (`/assets/*.json`) are requested by the front-end as
  `/assets/x.json?v=<stamp>`, where `<stamp>` is the newest mtime among
  `assets/*.json`, injected into `index.html` (which is itself always
  revalidated). serve.py serves the versioned URL with
  `Cache-Control: public, max-age=31536000, immutable`.
  → When you rebuild data (curation merge, GAF refresh, news post), the stamp
  changes, the URL changes, and browsers + CDN fetch the new version. **No cache
  purge is ever required for data updates.**
- **JS/CSS** are already mtime-stamped (`/app.js?v=<mtime>`) and `immutable`.
- **`index.html`** is `no-cache` (always revalidated) — so it always hands out
  the current `__ASSET_V` and asset versions.
- **Read-only `/api/*` GET endpoints** (`/api/gene*`, `/api/sequence`,
  `/api/search`, `/api/phenotype-search`, `/api/go/*`, `/api/strain/*`,
  `/api/data-status`, `/api/version`, `/api/recent-papers`, `/api/coexpression`,
  `/api/expression`, `/api/domains`) now send
  `Cache-Control: public, max-age=60, s-maxage=300, stale-while-revalidate=600`
  on **2xx GET** responses, so the edge serves them for ~5 min (≤5 min staleness
  for a live curation edit — acceptable) and absorbs the bulk of read traffic.
  Error responses (4xx/5xx) and non-GET methods are never cached.
- **Write/analysis `/api/*` endpoints** (`/api/blast`, `/api/enrichment`,
  `/api/login`, `/api/upload`, `/api/hit`, `/api/stats`, the external proxies)
  send no public cache header and stay origin-only.
- Unversioned direct hits (e.g. `curl /assets/x.json` with no `?v=`) stay
  `no-cache` — only the front-end's versioned requests are cacheable.

So edge caching is correct by construction: cached entries are immutable, and
new data simply has a new key.

## Cloudflare setup

You can front the origin two ways:

- **Cloudflare Tunnel** (recommended for a laptop/home host): a *named* tunnel
  gives a stable hostname + TLS, keeps the box behind NAT, and routes through
  Cloudflare's network (so the CDN sits in front automatically). Replace the
  ephemeral `cloudflared tunnel --url ...` quick tunnel with a named one.
- **Orange-cloud DNS** (if the origin has a public IP/domain): point an
  `A`/`CNAME` record at the origin with the proxy (orange cloud) **on**.

Then, in the Cloudflare dashboard:

1. **Cache Rule** — cache the assets aggressively, respecting our headers:
   - *When*: URI Path starts with `/assets/`
   - *Then*: **Cache eligibility = Eligible for cache**; **Edge TTL = Use
     cache-control header if present** (our versioned assets say 1 year);
     **Browser TTL = Respect origin**.
   - This makes the edge serve `/assets/*` from cache, hitting your origin only
     on the first request per version.
2. **Read APIs follow origin headers; everything else bypasses:**
   - URI Path starts with `/api/` → **Cache eligibility = Eligible**, **Edge TTL
     = Use cache-control header if present**. The read endpoints carry an
     `s-maxage`, so they cache; write/analysis endpoints send none and Cloudflare
     leaves them uncached. (POSTs are never cached regardless.)
   - `index.html` / `/` is `no-cache` from origin, so Cloudflare won't cache it.
3. **Compression**: leave Cloudflare's Brotli **on** — it compresses at the
   edge. (The origin also gzip-caches; either way the client gets compressed
   bytes.)
4. **Range requests**: leave default on — the genome browser relies on byte
   ranges into `/assets/genomes/*` (`.fna`, `.gff.gz`), which Cloudflare
   supports on cacheable responses.

## After a data rebuild

Nothing to do for the CDN — the `?v=` stamp changes automatically. (You only
need to commit the regenerated `assets/*.json`; on a multi-worker origin restart
the workers, but the cache keys take care of freshness.)

## Verifying it's working

After fronting with Cloudflare, check an asset shows an edge hit:

```bash
curl -sI "https://<your-host>/assets/gene_annotations.json?v=<stamp>" | grep -i "cf-cache-status\|cache-control"
# cf-cache-status: HIT   (after the first request)  ← origin is now offloaded
```
