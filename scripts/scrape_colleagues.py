#!/usr/bin/env python3
"""Preserve the dictyBase colleague / researcher directory before dictybase.org
goes dark. ~2,952 people, each at colleagueUpdate?id=N, with name, institution,
address, phones, email, research interests, keywords, PI flag, and associated
gene loci. Not part of any bulk download and not reconstructable once gone.

Resumable: records already captured are skipped. Output:
  assets/dictybase-corpus/colleagues.json  { "<id>": { field: value, ... }, ... }

  python3 scripts/scrape_colleagues.py
"""
import html
import json
import os
import re
import ssl
import sys
import time
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "assets", "dictybase-corpus", "colleagues.json")
CGI = "http://dictybase.org/db/cgi-bin/dictyBase/colleague"
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
_CTX = ssl.create_default_context()
_CTX.check_hostname = False
_CTX.verify_mode = ssl.CERT_NONE
SKIP = {"query", "submit", "genes_only", "continue", "reset", ".cgifields", "update"}


def fetch(url, data=None):
    req = urllib.request.Request(url, data=data, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45, context=_CTX) as r:
        return r.read().decode("utf-8", "replace")


def all_ids():
    html_ = fetch(f"{CGI}/colleagueSearch",
                  data=b"update=1&lname=*&Submit=Search")
    ids = sorted({int(m) for m in re.findall(r"colleagueUpdate\?id=(\d+)", html_)})
    return ids


def parse(t, cid):
    rec = {"id": cid}
    for m in re.finditer(r"<input\b([^>]*)>", t, re.I):
        a = dict(re.findall(r'([\w.\-]+)\s*=\s*"([^"]*)"', m.group(1)))
        name, typ = a.get("name"), (a.get("type") or "text").lower()
        if not name or name in SKIP or typ in ("submit", "reset", "button", "image", "file"):
            continue
        if typ in ("radio", "checkbox"):
            if re.search(r"\bchecked\b", m.group(1), re.I) and a.get("value", "").strip():
                rec[name] = html.unescape(a["value"]).strip()
        else:
            v = html.unescape(a.get("value", "")).strip()
            if v:
                rec[name] = v
    for m in re.finditer(r'<select\b[^>]*name="([^"]+)"[^>]*>(.*?)</select>', t, re.S | re.I):
        if m.group(1) in SKIP:
            continue
        opt = (re.search(r'<option[^>]*\bselected\b[^>]*value="([^"]*)"', m.group(2), re.I)
               or re.search(r'<option[^>]*value="([^"]*)"[^>]*\bselected\b', m.group(2), re.I))
        if opt and opt.group(1).strip():
            rec[m.group(1)] = html.unescape(opt.group(1)).strip()
    for m in re.finditer(r'<textarea\b[^>]*name="([^"]+)"[^>]*>(.*?)</textarea>', t, re.S | re.I):
        v = html.unescape(m.group(2)).strip()
        if m.group(1) not in SKIP and v:
            rec[m.group(1)] = v
    return rec


def main():
    out = {}
    if os.path.exists(OUT):
        with open(OUT) as fh:
            out = json.load(fh)
    ids = all_ids()
    print(f"{len(ids)} colleague ids (range {ids[0]}-{ids[-1]}); "
          f"{len(out)} already captured", file=sys.stderr)
    done = fresh = 0
    for cid in ids:
        if str(cid) in out:
            continue
        try:
            rec = parse(fetch(f"{CGI}/colleagueUpdate?id={cid}"), cid)
        except Exception as e:  # noqa: BLE001
            print(f"  ! id={cid}: {e}", file=sys.stderr)
            continue
        # keep only records that actually carry a name (skip empty/removed ids)
        if rec.get("lname") or rec.get("fname"):
            out[str(cid)] = rec
            fresh += 1
        done += 1
        if done % 100 == 0:
            with open(OUT, "w") as fh:
                json.dump(out, fh, ensure_ascii=False, indent=0)
            print(f"  ...{done} fetched, {len(out)} kept", file=sys.stderr)
        time.sleep(0.12)
    with open(OUT, "w") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=0)
    print(f"\ndone: {len(out)} colleague records ({fresh} new this run) -> "
          f"{os.path.relpath(OUT)}", file=sys.stderr)


if __name__ == "__main__":
    main()
