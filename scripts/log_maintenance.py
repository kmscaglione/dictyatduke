#!/usr/bin/env python3
"""Prospective maintenance-time tracker for the running resource.

Records post-launch operator effort in ops/maintenance-log.csv, categorized so
the paper can report measured maintenance hours by type over a stated window.

Categories (use one of these):
  bug fix | data update | server admin | feature | community content

Usage:
  # add an entry (minutes is an integer)
  python3 scripts/log_maintenance.py add "bug fix" 20 "fix ORCID form clearing"
  python3 scripts/log_maintenance.py add "data update" 15 "monthly external refresh" --date 2026-10-01

  # print a summary (totals by category + overall hours, and by month)
  python3 scripts/log_maintenance.py summary
"""
import csv, os, sys, datetime, collections

LOG = os.path.join(os.path.dirname(__file__), "..", "ops", "maintenance-log.csv")
CATS = {"bug fix", "data update", "server admin", "feature", "community content"}
FIELDS = ["date", "category", "minutes", "description"]


def add(args):
    if len(args) < 3:
        sys.exit('usage: add "<category>" <minutes> "<description>" [--date YYYY-MM-DD]')
    category, minutes, description = args[0], args[1], args[2]
    date = datetime.date.today().isoformat()
    if "--date" in args:
        date = args[args.index("--date") + 1]
    if category not in CATS:
        print(f"warning: '{category}' is not a standard category {sorted(CATS)}", file=sys.stderr)
    int(minutes)  # validate
    exists = os.path.exists(LOG)
    os.makedirs(os.path.dirname(LOG), exist_ok=True)
    with open(LOG, "a", newline="") as f:
        w = csv.writer(f)
        if not exists:
            w.writerow(FIELDS)
        w.writerow([date, category, minutes, description])
    print(f"logged: {date} | {category} | {minutes} min | {description}")


def summary(_args):
    if not os.path.exists(LOG):
        sys.exit("no log yet")
    rows = list(csv.DictReader(open(LOG)))
    by_cat = collections.Counter()
    by_month = collections.Counter()
    total = 0
    for r in rows:
        m = int(r["minutes"])
        by_cat[r["category"]] += m
        by_month[r["date"][:7]] += m
        total += m
    print(f"maintenance entries: {len(rows)}  |  total: {total} min ({total/60:.1f} h)")
    print("by category:")
    for k, v in by_cat.most_common():
        print(f"  {v/60:5.1f} h  {k}")
    print("by month:")
    for k in sorted(by_month):
        print(f"  {by_month[k]/60:5.1f} h  {k}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "summary"
    {"add": add, "summary": summary}.get(cmd, summary)(sys.argv[2:])
