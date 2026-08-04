#!/usr/bin/env python3
"""Back up the durable curator-written data to a timestamped tarball.

Everything a curator creates lives under uploads/ and exists on exactly one VM
with no managed database: named accounts + password hashes (curator_state/
curators.json), GO/phenotype/nomenclature overrides, the AI paper-curation
queue, fetched full text, and public submissions. If that disk goes, it is gone.
This makes a compressed, verified snapshot and prunes old ones.

    python3 scripts/backup_data.py                 # make one backup, keep 14
    python3 scripts/backup_data.py --keep 30
    python3 scripts/backup_data.py --list
    python3 scripts/backup_data.py --dry-run

Destination (first that is writable):
    $DICTY_BACKUP_DIR  ->  <repo>/../dictybase-backups  ->  /tmp/dictybase-backups
Point DICTY_BACKUP_DIR at a different disk or a mounted volume for real
durability, and run it from cron (e.g. daily). Every run verifies the tarball it
just wrote actually opens and is non-empty, and exits non-zero if not, so a
silently-broken backup can't pass unnoticed. Standard library only.
"""
import argparse
import datetime
import os
import sys
import tarfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# What to snapshot: the writable curator data. cache/ is regenerable, so it is
# opt-in (--with-cache) rather than part of the default set.
SOURCES = ["uploads"]
CACHE = ["cache"]


def pick_backup_dir():
    candidates = [
        os.environ.get("DICTY_BACKUP_DIR"),
        os.path.join(os.path.dirname(ROOT), "dictybase-backups"),
        "/tmp/dictybase-backups",
    ]
    for c in candidates:
        if not c:
            continue
        try:
            os.makedirs(c, exist_ok=True)
            t = os.path.join(c, ".wtest")
            with open(t, "w") as fh:
                fh.write("ok")
            os.unlink(t)
            return c
        except OSError:
            continue
    return None


def existing_backups(dest):
    return sorted(f for f in os.listdir(dest)
                  if f.startswith("dictybase-data-") and f.endswith(".tar.gz"))


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--keep", type=int, default=14, help="how many backups to retain (default 14)")
    ap.add_argument("--with-cache", action="store_true", help="also include cache/ (regenerable)")
    ap.add_argument("--list", action="store_true", help="list existing backups and exit")
    ap.add_argument("--dry-run", action="store_true", help="show what would happen, write nothing")
    args = ap.parse_args()

    dest = pick_backup_dir()
    if not dest:
        print("ERROR: no writable backup directory (set DICTY_BACKUP_DIR).")
        return 1
    print(f"backup dir: {dest}")

    if args.list:
        for f in existing_backups(dest):
            p = os.path.join(dest, f)
            print(f"  {f}  ({os.path.getsize(p) // 1024} KB)")
        return 0

    sources = [s for s in (SOURCES + (CACHE if args.with_cache else []))
               if os.path.isdir(os.path.join(ROOT, s))]
    if not sources:
        print("nothing to back up (uploads/ absent — has any curation happened yet?)")
        return 0

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    name = f"dictybase-data-{stamp}.tar.gz"
    out = os.path.join(dest, name)

    if args.dry_run:
        print(f"PLAN  write {name} from: {', '.join(sources)}")
        old = existing_backups(dest)
        prune = old[:-args.keep] if args.keep and len(old) >= args.keep else []
        for f in prune:
            print(f"PLAN  prune {f}")
        return 0

    with tarfile.open(out, "w:gz") as tar:
        for s in sources:
            tar.add(os.path.join(ROOT, s), arcname=s)

    # Verify the archive we just wrote actually opens and has members.
    try:
        with tarfile.open(out, "r:gz") as tar:
            members = tar.getmembers()
        if not members:
            raise ValueError("archive is empty")
    except (tarfile.TarError, ValueError, OSError) as e:
        print(f"ERROR: backup verification FAILED ({e}); leaving {name} for inspection.")
        return 1
    print(f"wrote {name}  ({os.path.getsize(out) // 1024} KB, {len(members)} entries) — verified OK")

    # Retention: keep the newest N, delete the rest.
    old = existing_backups(dest)
    prune = old[:-args.keep] if args.keep and len(old) > args.keep else []
    for f in prune:
        try:
            os.unlink(os.path.join(dest, f))
            print(f"pruned {f}")
        except OSError as e:
            print(f"could not prune {f}: {e}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
