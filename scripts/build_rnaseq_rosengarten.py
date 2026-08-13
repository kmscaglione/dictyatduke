#!/usr/bin/env python3
"""Build assets/rnaseq_rosengarten.json — the developmental RNA-seq time course
from Rosengarten et al. 2015, replacing the older Parikh time course.

Source: Rosengarten RD, Santhanam B, Fuller D, Katoh-Kurasawa M, Loomis WF,
Zupan B, Shaulsky G. "Leaps and lulls in the developmental transcriptome of
Dictyostelium discoideum." BMC Genomics 2015;16:294. doi:10.1186/s12864-015-1491-7
Data: NCBI GEO GSE61914 (processed, per-sample, already keyed by DDB_G id).

We use the FILTER-DEVELOPMENT (FD) condition — the developmental time course,
the direct analog of the Parikh developmental series — not the cAMP-in-suspension
condition. For each of the 19 time points we average the two biological
replicates' normalized ("_nor") values.

Output: { ddb_g: { "<hour>": value, ... }, "_meta": {...} }

Usage:
  python3 scripts/build_rnaseq_rosengarten.py                 # download from GEO
  python3 scripts/build_rnaseq_rosengarten.py --tar FILE      # use a local GSE61914_RAW.tar
Stdlib only.
"""
import datetime
import gzip
import io
import json
import pathlib
import re
import sys
import tarfile
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
OUT = ASSETS / "rnaseq_rosengarten.json"
GEO_URL = "https://ftp.ncbi.nlm.nih.gov/geo/series/GSE61nnn/GSE61914/suppl/GSE61914_RAW.tar"
UA = "dictyBase-data-sync/1.0 (+https://www.dicty.org)"
# Filter-development normalized files: GSM..._FDrep{1,2}_hr{NN}_nor.txt.gz
FD_RE = re.compile(r"_FDrep([12])_hr(\d+)_nor\.txt\.gz$")


def _read_tar_bytes(local):
    if local:
        return pathlib.Path(local).read_bytes()
    print(f"  downloading {GEO_URL}")
    req = urllib.request.Request(GEO_URL, headers={"User-Agent": UA})
    return urllib.request.urlopen(req, timeout=180).read()


def main():
    local = sys.argv[sys.argv.index("--tar") + 1] if "--tar" in sys.argv else None
    raw = _read_tar_bytes(local)

    # gene -> hour -> [rep values]
    data = {}
    hours = set()
    with tarfile.open(fileobj=io.BytesIO(raw)) as tar:
        for m in tar.getmembers():
            mm = FD_RE.search(m.name)
            if not mm:
                continue
            hour = int(mm.group(2))
            hours.add(hour)
            fh = tar.extractfile(m)
            text = gzip.decompress(fh.read()).decode("utf-8", "replace")
            for line in text.splitlines():
                ddb, _, val = line.partition("\t")
                if not ddb.startswith("DDB_G"):
                    continue          # skips the header row too
                try:
                    v = float(val)
                except ValueError:
                    continue
                data.setdefault(ddb, {}).setdefault(hour, []).append(v)

    hours = sorted(hours)
    print(f"  time points ({len(hours)}): {hours}")
    genes = {}
    for ddb, byhour in data.items():
        prof = {}
        for h in hours:
            vals = byhour.get(h)
            if vals:
                prof[str(h)] = round(sum(vals) / len(vals), 3)
        if prof:
            genes[ddb] = prof

    genes["_meta"] = {
        "description": ("Developmental RNA-seq time course (filter development), "
                        "normalized expression averaged over 2 biological replicates, keyed by DDB_G id."),
        "source": {
            "name": "Rosengarten et al. 2015, BMC Genomics 16:294",
            "experiment": "Filter-development time course (FD)",
            "geo": "GSE61914",
            "doi": "10.1186/s12864-015-1491-7",
            "license": "See publication / GEO",
        },
        "timepoints_hours": hours,
        "values": "author-normalized read counts ('_nor'), mean of replicates rep1 + rep2",
        "genes": len(genes),
        "built": datetime.datetime.utcnow().strftime("%Y-%m-%d"),
    }
    OUT.write_text(json.dumps(genes, separators=(",", ":")))
    print(f"  wrote {OUT.relative_to(ROOT)}  ({len(genes) - 1} genes, "
          f"{OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
