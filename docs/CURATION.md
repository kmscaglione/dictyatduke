# How to curate (web portal — no terminal needed)

Curation means editing a gene's **curated summary / note / PMIDs**, and adding or
updating **strains and plasmids**. It's all done in the browser through the
curator dashboard, and **edits go live on the site immediately** — no deploy, no
terminal, no git. Only code changes need the terminal (and only you do those).

## How it works (so you can trust it)

Curator edits are saved to **durable override files on the server**
(`assets/curation_overrides.json`, `assets/stock_overrides.json`) that are
*gitignored* — so a code deploy (`git reset --hard`) leaves them completely
alone. The site merges those overrides over the base data every time it serves a
page, so your edits show up instantly and **survive every deploy**. Every save
also writes a `.bak` and appends to an audit log (`assets/curation_log.jsonl`),
and you can pull a full snapshot anytime with **Download backup**.

You never touch a data file by hand — the dashboard is the only thing that writes
curation, and it validates and writes safely (atomic, with a backup).

---

## Curating

### 1. Open the dashboard
Go to **https://dicty.labs.duke.edu/tools/curate** (unlisted — not in any menu).
Sign in with your **username and password**. Your edits are automatically
attributed to your account name (no typing your name — it's taken from the login,
so it can't be faked).

**Accounts (admin):** each curator has their own login. If you're an **admin**,
a **Curators** panel appears where you add a person (username, full name,
password, and an admin checkbox) or remove one. Passwords are stored hashed, not
in plain text. The `CURATOR_PASSWORD` set on the server is a **bootstrap admin
login** — use it the first time to create the named accounts (including your own),
then everyone signs in with their own username. Only admins can manage accounts;
regular curators can curate but can't add/remove people.

**Two-factor authentication (recommended).** Under **Two-factor authentication**
on the dashboard you can require a code from your phone at sign-in, so a stolen
password alone can't reach curation.

1. Click **Enable two-factor**. A **setup key** appears.
2. In your authenticator app (Google Authenticator, 1Password, Authy, …) add an
   account using *"enter a setup key"* and paste it.
3. Type the 6-digit code the app shows and click **Verify & enable**.
4. **Save the 10 backup codes it gives you.** Each works once, in place of your
   phone, and they are shown only that one time. Keep them somewhere safe and
   separate from your password.

After that, signing in asks for the 6-digit code (a backup code also works). To
turn it off, enter your password and click **Turn off**.

Notes: codes rotate every 30 seconds and a used code can't be reused. If your
phone's clock drifts badly the code won't match — enable automatic time on the
phone. The `CURATOR_PASSWORD` bootstrap login has **no** two-factor on purpose:
it's the break-glass way back in if someone loses both their phone and their
backup codes, so keep it strong and off your laptop.

### 2. Edit a gene
- Type a **gene symbol or DDB_G id** (e.g. `mhcA`) and click **Load** — the
  current summary, note, and PMIDs fill in.
- Edit the **Summary** (dictyBase markup supported — cheatsheet below), the
  optional **note**, and comma-separated **PMIDs**.
- Click **Save curation**. It's live on the gene page right away. Done.

### 3. Add or update a strain / plasmid
In the **Strains & plasmids** section:
- Pick **Strain** or **Plasmid**, then **Find** by name or paste a `DBS…`/`DBP…`
  id — or click **+ Add new**.
- Edit the fields (toggle **In stock**, genotype, description, …) and **Save**.
  **Delete** removes an entry. All live immediately.

### 4. Review community submissions
The **Community submissions** section lists anything sent through the public
[/community/annotations](/community/annotations) form. **Approve → corpus** applies
one (needs a DDB_G id); **Reject** dismisses it. Approvals are saved the same
durable way.

### 5. Back up whenever you like
Click **Download backup** for a single JSON file with every gene + stock edit and
the full edit log. Keep one before big changes if you want a restore point.

That's the whole workflow. There is **no publish step and no cadence** — curate
when you have something, and it's already public.

---

## Summary markup cheatsheet

The summary field accepts dictyBase wiki markup, rendered to safe HTML:

| You type | Result |
|---|---|
| `[/gene/DDB_G0286355 mhcA]` | in-app link to a gene |
| `[/ontology/go/GO:0003774 motor activity]` | GO term link |
| `[https://pubmed.ncbi.nlm.nih.gov/12345678 label]` | PubMed link |
| `''italic text''` | *italic* |
| `<br />` | line break |

Anything else is shown as plain text (HTML is escaped), so a stray `<` or `&`
can't break the page.

---

## The one thing to know about the terminal

You (and only you) still use the terminal to deploy **code** changes to the
server. That's safe for curation: `git reset --hard` resets tracked code files
but **never touches** the gitignored override files, so a deploy can't wipe
curation. Curators never need the terminal at all.

Two safety notes for maintainers:
- **Base data rebuilds are safe.** `scripts/build_data.py` (gene summaries) and
  `scripts/build_stock_center.py` (catalog) regenerate the *base* files from
  source; curator edits live in the separate override files and are merged on
  top, so a rebuild never overwrites them.
- **Backups:** every save keeps a `.bak` of the override file; the edit log is
  append-only; and Download backup gives you a full snapshot on demand. To move
  curation to a new server, copy the two `*_overrides.json` files and the log.

---

## Where the code lives (for maintainers)

- Dashboard UI: `renderCuratePage()` / `initCurate()` / `initStockCurate()` /
  `loadCurQueue()` in `app.js` (route `/tools/curate`).
- `serve.py`: writes go to gitignored overrides via `save_gene_override()` /
  `save_stock_override()` (atomic + `.bak` + audit log); `apply_gene_overrides()`
  / `apply_stock_overrides()` merge them over the base data in memory at read
  time (and at startup). Endpoints: `POST /api/curator/{edit,stock-edit,
  stock-delete,approve,reject}`, `GET /api/curator/{entry,stock-entry,queue,
  backup}`, `POST /api/curator/login`. The stock catalog is served merged at
  `/assets/stock_center.json`.
