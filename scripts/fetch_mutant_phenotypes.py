#!/usr/bin/env python3
"""Download dictyBase's curated mutant-phenotype tables and store them as local
hardcopies under assets/dictybase-corpus/mutant-phenotypes/.

These are the "Mutant Phenotypes" bulk files from dictybase.org/Downloads
(area=mutant_phenotypes): every curated mutant with phenotypes, plus the null /
overexpression / multiple / developmental / other partitions. build_data.py's
build_phenotypes() reads the stored copies (it does NOT hit the network), so the
site is reproducible and independent of dictybase.org uptime. Re-run this to
refresh; the files update weekly/monthly upstream.

  python3 scripts/fetch_mutant_phenotypes.py
"""
import pathlib
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEST = ROOT / "assets" / "dictybase-corpus" / "mutant-phenotypes"
BASE = "http://dictybase.org/db/cgi-bin/dictyBase/download/download.pl?area=mutant_phenotypes&ID="
UA = "dictyBase-data-sync/1.0 (+https://dicty.labs.duke.edu)"

# all-mutants(-ddb_g) are the complete curated set; the rest are partitions kept
# as hardcopies for provenance. all-mutants.txt carries the phenotype terms;
# all-mutants-ddb_g.txt is the authoritative strain -> DDB_G map.
FILES = [
    "all-mutants.txt",
    "all-mutants-ddb_g.txt",
    "null-mutants.txt",
    "overexpression-mutants.txt",
    "multiple-mutants.txt",
    "developmental-mutants.txt",
    "other-mutants.txt",
]


def main():
    DEST.mkdir(parents=True, exist_ok=True)
    for name in FILES:
        req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
        data = urllib.request.urlopen(req, timeout=90).read()
        (DEST / name).write_bytes(data)
        print(f"  {name}: {len(data):,} bytes", file=sys.stderr)
    print(f"stored {len(FILES)} files in {DEST}", file=sys.stderr)


if __name__ == "__main__":
    main()
