#!/usr/bin/env bash
#
# Off-box backup of the durable curator state.
#
# The curation overrides (curation_overrides.json, stock_overrides.json,
# curators.json, curation_log.jsonl) live only on the production VM under
# uploads/curator_state/ and are gitignored, so a disk/VM loss would lose them.
# This script copies them into a SEPARATE private git repo and pushes, giving a
# versioned, off-machine, restorable history. Curation is small text, so git is
# a good fit.
#
# Runs as the deploy user (no root needed). Intended for a nightly user cron:
#
#   30 3 * * *  /srv/web/dicty.labs.duke.edu/html/scripts/backup_curation.sh >> "$HOME/curation-backup.log" 2>&1
#
# One-time setup (see docs/OPERATIONS.md "Curation backup"):
#   1. Create a PRIVATE repo, e.g.  gh repo create <you>/dicty-curation-backup --private
#   2. Clone it to the path below (default: $HOME/dicty-curation-backup) with a
#      remote that can push non-interactively (token in URL, gh, or SSH key).
#   3. Add the cron line above.
#
# Override paths via the environment if your layout differs:
#   CURATION_STATE_DIR   default: <repo>/uploads/curator_state
#   CURATION_BACKUP_REPO default: $HOME/dicty-curation-backup

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${CURATION_STATE_DIR:-$HERE/uploads/curator_state}"
BACKUP_REPO="${CURATION_BACKUP_REPO:-$HOME/dicty-curation-backup}"
STAMP="$(date -u +%Y-%m-%dT%H:%MZ)"

log() { printf '%s  %s\n' "$STAMP" "$*"; }

if [ ! -d "$STATE_DIR" ]; then
  log "ERROR: state dir not found: $STATE_DIR"; exit 1
fi
if [ ! -d "$BACKUP_REPO/.git" ]; then
  log "ERROR: backup repo not a git clone: $BACKUP_REPO (see setup in this script's header)"; exit 1
fi

# The durable files worth keeping. Skip the transient .tmp/.bak siblings.
FILES=(curation_overrides.json stock_overrides.json curators.json curation_log.jsonl)

cd "$BACKUP_REPO"
git pull --quiet --ff-only 2>/dev/null || true   # stay current; ignore if offline

copied=0
for f in "${FILES[@]}"; do
  if [ -r "$STATE_DIR/$f" ]; then
    cp -f "$STATE_DIR/$f" "$BACKUP_REPO/$f"
    copied=$((copied + 1))
  fi
done

if [ "$copied" -eq 0 ]; then
  log "WARNING: no readable state files under $STATE_DIR (permission? nothing curated yet?)"
fi

# A tiny manifest makes each backup self-describing and forces a commit even if
# only counts changed in a way git might otherwise see as identical whitespace.
python3 - "$BACKUP_REPO" "$STAMP" <<'PY' 2>/dev/null || true
import json, os, sys
repo, stamp = sys.argv[1], sys.argv[2]
def count(fn):
    p = os.path.join(repo, fn)
    if not os.path.exists(p): return None
    try:
        d = json.load(open(p))
        g = d.get("genes", d)  # gene_researchers-style vs flat override map
        return len(g) if isinstance(g, dict) else len(d)
    except Exception:
        return "n/a"
man = {"backed_up": stamp,
       "gene_overrides": count("curation_overrides.json"),
       "stock_overrides": count("stock_overrides.json"),
       "curator_accounts": count("curators.json")}
json.dump(man, open(os.path.join(repo, "MANIFEST.json"), "w"), indent=2)
PY

git add -A
if git diff --cached --quiet; then
  log "no curation changes to back up"
  exit 0
fi

git -c user.name="curation-backup" -c user.email="curation-backup@localhost" \
    commit --quiet -m "curation backup $STAMP"
if git push --quiet 2>/dev/null; then
  log "backed up $copied file(s) and pushed"
else
  log "committed locally but PUSH FAILED — check the backup repo's remote/auth"
  exit 2
fi
