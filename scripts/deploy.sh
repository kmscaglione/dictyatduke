#!/usr/bin/env bash
# Guarded deploy for dictyBase v2 — run ON THE SERVER, from the web root.
#
# Replaces the bare "git reset --hard && restart" with a version that refuses to
# ship a broken build: it validates the data, restarts, smoke-tests the running
# server, and automatically rolls back to the previous commit if anything fails.
#
#   ./scripts/deploy.sh              # pull origin/master, validate, restart, verify
#   ./scripts/deploy.sh --dry-run    # run the checks only; no git, no restart
#
# Config (env):
#   DICTY_BASE_URL     where to smoke-test        (default http://localhost:8774)
#   DICTY_RESTART_CMD  how to restart the service (default "sudo systemctl restart dicty")
#   DICTY_BRANCH       branch to deploy           (default master)
#
# Notes: the restart needs sudo for `systemctl restart dicty`. A rollback restores
# the previous commit AND restarts on it, so the running service always matches
# the checked-out tree. Exit 0 = deployed & verified; non-zero = aborted/rolled back.
set -u

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || { echo "[deploy] cannot cd to repo root" >&2; exit 2; }

BASE_URL="${DICTY_BASE_URL:-http://localhost:8774}"
RESTART_CMD="${DICTY_RESTART_CMD:-sudo systemctl restart dicty}"
BRANCH="${DICTY_BRANCH:-master}"
PY="$(command -v python3 || true)"
DRY_RUN=0
[ "${1:-}" = "--dry-run" ] && DRY_RUN=1

log()  { printf '\n[deploy] %s\n' "$*"; }
warn() { printf '\n[deploy] %s\n' "$*" >&2; }

[ -n "$PY" ] || { warn "python3 not found"; exit 2; }

# ---- dry-run: just prove the checks pass, touch nothing ----
if [ "$DRY_RUN" = "1" ]; then
  log "DRY RUN — no git changes, no restart"
  log "data self-check"
  "$PY" scripts/check_data.py || { warn "check_data.py failed"; exit 1; }
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" 2>/dev/null || echo 000)"
  if [ "$code" = "200" ]; then
    log "server is up at $BASE_URL — running smoke tests"
    "$PY" scripts/test_api.py "$BASE_URL" || { warn "test_api.py failed"; exit 1; }
  else
    log "no server at $BASE_URL (HTTP $code) — skipping smoke tests"
  fi
  log "DRY RUN OK"
  exit 0
fi

# ---- real deploy ----
prev="$(git rev-parse HEAD)"
restarted=0
log "current commit: $(git rev-parse --short HEAD)"

rollback() {
  warn "FAILED: $1"
  warn "rolling back to ${prev:0:9}"
  git reset --hard "$prev" >/dev/null 2>&1 || warn "git rollback failed — MANUAL FIX NEEDED"
  if [ "$restarted" = "1" ]; then
    warn "restarting on rolled-back code"
    $RESTART_CMD || warn "rollback restart failed — CHECK THE SERVICE"
  fi
  exit 1
}

log "fetching origin/$BRANCH"
git fetch origin "$BRANCH" || { warn "git fetch failed"; exit 1; }
git reset --hard "origin/$BRANCH" || { warn "git reset failed"; exit 1; }
log "checked out $(git rev-parse --short HEAD)"

# 1) validate data BEFORE touching the running service
log "data self-check"
"$PY" scripts/check_data.py || rollback "check_data.py failed"

# 2) restart
log "restarting: $RESTART_CMD"
restarted=1
$RESTART_CMD || rollback "restart command failed"

# 3) wait for the server to come back up
log "waiting for $BASE_URL/api/health"
up=0
for _ in $(seq 1 30); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" 2>/dev/null || echo 000)"
  [ "$code" = "200" ] && { up=1; break; }
  sleep 1
done
[ "$up" = "1" ] || rollback "server did not become healthy within 30s"

# 4) smoke-test the live server (endpoints, data, and the security regressions)
log "API smoke tests"
"$PY" scripts/test_api.py "$BASE_URL" || rollback "API smoke tests failed"

log "SUCCESS: deployed and verified $(git rev-parse --short HEAD)"
