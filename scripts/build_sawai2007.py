#!/usr/bin/env python3
"""Build the Sawai/Cox 2007 high-throughput developmental screen dataset.

Source: Sawai S, Guan X-J, Kuspa A, Cox EC. "High-throughput analysis of
spatio-temporal dynamics in Dictyostelium." Genome Biol. 2007;8(7):R144.
PMID 17659086. Open access; supplementary data files are CC BY.

The screen filmed ~2,257 REMI mutant clones through development and scored six
stages per strain. Those strains are already in the Dicty Stock Center catalog
(assets/stock_center.json, imported from the screen's own "dicty_Life" database),
but that import kept only four stages, collapsed the severity scale into free
text, and carried no gene links. This builder restores the full record.

Inputs (place the paper's supplementary files in assets/sources/sawai2007/):
  gb-2007-8-7-r144-S8.xls    per-strain scores, legacy DDB ids, gene names
  gb-2007-8-7-r144-S6.cdt    clustered strain ordering (Java TreeView)
  gb-2007-8-7-r144-S13.xls   per-movie wave features
  gb-2007-8-7-r144-S9.kgg    per-movie k-means group
  ddbmap.txt                 legacy DDB -> DDB_G map (dictyBase DDB-GeneID-UniProt.txt)

Output:
  assets/sawai2007.json

Note on the movies: this builder deliberately does not touch them. The movie
files are keyed by imaging run (e.g. "010504_02"), not by V-strain id, and the
paper ships no run -> strain mapping. Until that key turns up, wave features are
emitted in their own block keyed by run, unjoined. See RUN_KEY_MISSING below.

Usage:
  python3 scripts/build_sawai2007.py
  python3 scripts/build_sawai2007.py --strict   # fail on any validation warning
"""
import argparse
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
SRC = os.path.join(ASSETS, "sources", "sawai2007")

STAGES = ["growth", "wave", "aggregation", "mound", "slug", "culmination"]

# The screen's numeric scale, as used in S8. 2 is wild-type; the paper describes
# progressively stronger deviation down to -2 (stage absent).
SEVERITY = {2.0: "normal", 0.0: "slight", -1.0: "aberrant", -2.0: "abolished"}

RUN_KEY_MISSING = (
    "Wave features are keyed by imaging run (int_id, e.g. '010504_02'). No "
    "run-to-strain mapping exists in the published supplement, so these rows "
    "are not joined to strains. If the source folder supplies a plate index or "
    "movie manifest carrying both keys, add it here."
)


def src(name):
    p = os.path.join(SRC, name)
    if not os.path.exists(p):
        sys.exit(
            f"missing input: {p}\n"
            f"Put the paper's supplementary files in {SRC}/ first.\n"
            "Bundle: https://www.ebi.ac.uk/europepmc/webservices/rest/PMC2323234/supplementaryFiles"
        )
    return p


def read_scores():
    """S8: one row per strain, six stage scores, legacy ids, gene names."""
    import xlrd

    sh = xlrd.open_workbook(src("gb-2007-8-7-r144-S8.xls")).sheet_by_index(0)
    hdr = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    out = []
    for r in range(1, sh.nrows):
        row = {hdr[c]: sh.cell_value(r, c) for c in range(sh.ncols)}
        vid = str(row["V-strain ID"]).strip()
        if not vid:
            continue
        scores = {}
        for s in STAGES:
            raw = row[f"{s}_score"]
            raw = float(raw) if raw != "" else None
            scores[s] = {"score": raw, "call": SEVERITY.get(raw)}
        out.append({
            "v_id": vid,
            "scores": scores,
            "n_runs": int(row["datapoint"]) if row["datapoint"] != "" else 0,
            "legacy_ddb": str(row["dictybase ID"]).strip().split(),
            "gene_names": str(row["gene name"]).strip().split(),
        })
    return out


def read_legacy_map():
    """dictyBase DDB-GeneID-UniProt.txt -> {legacy DDB: DDB_G}."""
    m = {}
    with open(src("ddbmap.txt"), encoding="utf-8", errors="replace") as fh:
        next(fh, None)
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2 and p[0].strip() and p[1].strip():
                m[p[0].strip()] = p[1].strip()
    return m


def read_cluster_order():
    """S6.cdt: the published clustered ordering of strains."""
    order = []
    with open(src("gb-2007-8-7-r144-S6.cdt"), encoding="utf-8", errors="replace") as fh:
        hdr = next(fh).rstrip("\n").split("\t")
        try:
            col = hdr.index("strain_id")
        except ValueError:
            return []
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if len(p) > col and p[col].strip() and p[col].strip() != "strain_id":
                order.append(p[col].strip())
    return order


def read_wave_features():
    """S13 + S9: per-imaging-run quantitative metrics. Not strain-keyed."""
    import xlrd

    sh = xlrd.open_workbook(src("gb-2007-8-7-r144-S13.xls")).sheet_by_index(0)
    hdr = [str(sh.cell_value(0, c)).strip() for c in range(sh.ncols)]
    feats = {}
    for r in range(1, sh.nrows):
        row = {hdr[c]: sh.cell_value(r, c) for c in range(sh.ncols)}
        rid = str(row["int_id"]).strip()
        if not rid:
            continue
        feats[rid] = {
            "t_start": row.get("t_start"),
            "t_end": row.get("t_end"),
            "duration": row.get("t_end-t_start"),
            "frequency": row.get("1/s*"),
            "wavelet_power": row.get("wavelet_power"),
            "spiral_cores": row.get("spiral_core"),
        }

    with open(src("gb-2007-8-7-r144-S9.kgg"), encoding="utf-8", errors="replace") as fh:
        next(fh, None)
        for line in fh:
            p = line.rstrip("\n").split("\t")
            if len(p) >= 2:
                rid = p[0].strip()
                # kgg ids carry an "rp" prefix the feature table does not use.
                rid = rid[2:] if rid.startswith("rp") else rid
                if rid in feats:
                    feats[rid]["kmeans_group"] = int(float(p[1]))
    return feats



# GWDI and Dicty Stock Center labels name the disrupted gene: "yakA-",
# "[DDB_G0278661]-", "DDB_G0284609_RTE-". Strip the null-mutant marker, any
# brackets and the transposable-element suffix to recover the gene token.
def gene_token(label):
    t = str(label or "").strip()
    t = re.sub(r"[+-]$", "", t)
    t = re.sub(r"^\[|\]$", "", t)
    t = re.sub(r"_(RTE|TE|ps\d+)$", "", t)
    return t.strip()


ORDER_CAP = 20  # per gene, per collection; full counts are kept alongside


def build_orderable(site_genes, sym2g, wanted):
    """For each screened gene, the strains a user could actually order.

    Most V-strains from the screen are not in stock, so the practical route to
    a mutant is a different insertion in the same gene. This indexes GWDI and
    the main catalog by gene so the UI can offer those.
    """
    out = {}
    for coll, path in (("gwdi", "stock_gwdi.json"), ("dsc", "stock_center.json")):
        rows = json.load(open(os.path.join(ASSETS, path), encoding="utf-8")).get("strains", [])
        for r in rows:
            tok = gene_token(r.get("label"))
            g = tok if tok in site_genes else sym2g.get(tok.lower())
            if not g or g not in wanted:
                continue
            slot = out.setdefault(g, {"gwdi": [], "dsc": [], "n_gwdi": 0, "n_dsc": 0})
            slot["n_" + coll] += 1
            if len(slot[coll]) < ORDER_CAP:
                slot[coll].append({
                    "id": r.get("id"),
                    "label": r.get("label"),
                    "in_stock": bool(r.get("in_stock")),
                })
    return out



# --- Cox lab working database (Database_Backup/dbbackup_*.txt) ----------------
# The screen's own MySQL `robot` table. This is the only source that ties an
# imaging run to a V-strain, and it also carries plate/well positions, movie
# filenames and the curators' free-text notes, none of which are in the paper.
# Coverage is partial: the surviving dumps are from August 2003 and hold the
# first 8 imaging dates only. The `login` table is deliberately never read; it
# contains a plaintext password and has no place in a published asset.
ROBOT_COLS = [
    "int_id", "strain_id", "strain_id_suffix", "mutagen",
    "wave", "wave_nt", "strm", "strm_nt", "mound", "mound_nt",
    "slug", "slug_nt", "culm", "culm_nt", "image_qual",
    "movielink", "slugmovie", "wavelink", "final_note",
]

# robot's own stage columns, mapped onto the six published stage names.
ROBOT_STAGE = {"wave": "wave", "strm": "aggregation", "mound": "mound",
               "slug": "slug", "culm": "culmination"}


def _sql_values(body):
    """Split one MySQL VALUES tuple into fields, honouring quotes and escapes."""
    out, cur, quoted, i = [], "", False, 0
    while i < len(body):
        c = body[i]
        if quoted:
            if c == "\\":
                cur += body[i + 1] if i + 1 < len(body) else ""
                i += 2
                continue
            if c == "'":
                quoted = False
                i += 1
                continue
            cur += c
        else:
            if c == "'":
                quoted = True
            elif c == ",":
                out.append(cur)
                cur = ""
            elif body[i:i + 4] == "NULL":
                i += 4
                continue
        i += 1
    out.append(cur)
    return out


def read_robot():
    """Every robot row we can find, keyed by imaging run. Later dumps win."""
    db = os.path.join(SRC, "db")
    if not os.path.isdir(db):
        return {}
    rows = {}
    for name in sorted(os.listdir(db)):
        if not name.startswith("dbbackup") or not name.endswith(".txt"):
            continue
        with open(os.path.join(db, name), encoding="utf-8", errors="replace") as fh:
            for line in fh:
                if not line.startswith("INSERT INTO robot VALUES ("):
                    continue
                body = line.strip()[len("INSERT INTO robot VALUES ("):]
                body = body[:body.rfind(")")]
                v = _sql_values(body)
                if len(v) < len(ROBOT_COLS):
                    continue
                r = dict(zip(ROBOT_COLS, v))
                if r["int_id"]:
                    rows[r["int_id"]] = r
    return rows


# The complete `robot` table, exported to CSV by the Cox/Sawai lab (2026) and
# sent by Satoshi Sawai. This is the full run->strain->movie key the August-2003
# SQL dumps only covered the first 8 dates of: 4,091 imaging runs across all 77
# dates. Columns are the robot table's, in order, with one extra image-density
# note column (16) between image_qual and the movie link that the SQL schema
# folded into image_qual. No header row.
ROBOT_CSV = "uni-robot_dump.csv"
# CSV column index (0-based) -> robot field. Established empirically: cols 4..13
# are the five stage call/note pairs, 14 image_qual, 15 a density note (dropped),
# 16 movie, 17 slug movie, 18 wavelet, 19 final note.
ROBOT_CSV_COLS = {
    0: "int_id", 1: "strain_id", 2: "strain_id_suffix", 3: "mutagen",
    4: "wave", 5: "wave_nt", 6: "strm", 7: "strm_nt", 8: "mound", 9: "mound_nt",
    10: "slug", 11: "slug_nt", 12: "culm", 13: "culm_nt", 14: "image_qual",
    16: "movielink", 17: "slugmovie", 18: "wavelink", 19: "final_note",
}


def read_robot_csv():
    """The full robot table from uni-robot_dump.csv, keyed by imaging run.

    Same shape as read_robot() so runs_by_strain() consumes either. Rows without
    an int_id, or too short to reach the movie columns, are skipped."""
    import csv
    p = os.path.join(SRC, ROBOT_CSV)
    if not os.path.exists(p):
        return {}
    rows = {}
    with open(p, encoding="utf-8", errors="replace", newline="") as fh:
        for rec in csv.reader(fh):
            if len(rec) <= max(ROBOT_CSV_COLS):
                continue
            r = {field: rec[i].strip().strip('"') for i, field in ROBOT_CSV_COLS.items()}
            if r["int_id"]:
                rows[r["int_id"]] = r
    return rows


def runs_by_strain(robot):
    """Group robot rows under the V-strain they were imaging."""
    out = {}
    for rid, r in robot.items():
        sid = (r.get("strain_id") or "").strip()
        if not sid:
            continue
        notes = {}
        calls = {}
        for col, stage in ROBOT_STAGE.items():
            call = (r.get(col) or "").strip()
            note = (r.get(col + "_nt") or "").strip().strip('"')
            if call:
                calls[stage] = call
            if note:
                notes[stage] = note
        out.setdefault(sid, []).append({
            "run": rid,
            "plate_well": (r.get("strain_id_suffix") or "").strip(),
            "movie": (r.get("movielink") or "").strip(),
            "slug_movie": (r.get("slugmovie") or "").strip(),
            "wavelet": (r.get("wavelink") or "").strip(),
            "quality": (r.get("image_qual") or "").strip(),
            "calls": calls,
            "notes": notes,
            "final_note": (r.get("final_note") or "").strip().strip('"'),
        })
    for v in out.values():
        v.sort(key=lambda x: x["run"])
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--strict", action="store_true",
                    help="exit non-zero if any validation check reports a problem")
    ap.add_argument("--have", metavar="DIR",
                    help="only reference movies whose file (.mov or .mp4) exists somewhere "
                         "under DIR; blank the rest. Keeps the data in step with the movies "
                         "actually available, so no gene page shows a player that 404s. The "
                         "robot table names every movie the screen made, but the archive on "
                         "hand may hold only a subset.")
    args = ap.parse_args()

    have = None
    if args.have:
        d0 = os.path.expanduser(args.have)
        have = set()
        for root, _dirs, files in os.walk(d0):
            for f in files:
                if f.lower().endswith((".mov", ".mp4")):
                    have.add(os.path.splitext(f)[0])
        if not have:
            sys.exit(f"--have {d0}: found no .mov/.mp4 files there")

    strains = read_scores()
    # The complete CSV export supersedes the partial August-2003 SQL dumps; where
    # a run appears in both, the CSV wins.
    robot = read_robot()
    robot.update(read_robot_csv())
    runs = runs_by_strain(robot)
    legacy = read_legacy_map()
    order = read_cluster_order()
    waves = read_wave_features()

    site_genes = {r[0] for r in json.load(
        open(os.path.join(ASSETS, "gene_index.json"), encoding="utf-8"))}

    stock = json.load(open(os.path.join(ASSETS, "stock_center.json"), encoding="utf-8"))
    by_label = {s.get("label"): s.get("id") for s in stock.get("strains", [])
                if s.get("label")}
    stock_flag = {s.get("label"): bool(s.get("in_stock")) for s in stock.get("strains", [])
                  if s.get("label")}

    gi = json.load(open(os.path.join(ASSETS, "gene_index.json"), encoding="utf-8"))
    sym2g = {}
    for r in gi:
        if r[1]:
            sym2g.setdefault(r[1].lower(), r[0])
        for alias in (r[5] or []):
            sym2g.setdefault(alias.lower(), r[0])

    problems = []
    unresolved_legacy = set()
    genes_hit = set()

    for s in strains:
        # legacy DDB -> DDB_G, keeping only ids that exist in this build
        ddbg = []
        for old in s["legacy_ddb"]:
            new = legacy.get(old)
            if new is None:
                unresolved_legacy.add(old)
            elif new in site_genes:
                ddbg.append(new)
                genes_hit.add(new)
            else:
                unresolved_legacy.add(old)
        s["ddb_g"] = ddbg
        s["dbs_id"] = by_label.get(s["v_id"])
        s["in_stock"] = stock_flag.get(s["v_id"], False)
        s["runs"] = runs.get(s["v_id"], [])
        if have is not None:
            for r in s["runs"]:
                for k in ("movie", "slug_movie"):
                    if r.get(k) and os.path.splitext(os.path.basename(r[k]))[0] not in have:
                        r[k] = ""
        s["affected"] = sorted(
            st for st in STAGES
            if s["scores"][st]["score"] is not None and s["scores"][st]["score"] < 2.0
        )
        s.pop("legacy_ddb")

    # ---- validation: derive everything, hard-fail on anything fabricated ----
    n = len(strains)
    if n < 2000:
        problems.append(f"only {n} strains parsed from S8; expected ~2257")

    bad = [g for s in strains for g in s["ddb_g"] if g not in site_genes]
    if bad:
        problems.append(f"{len(bad)} emitted DDB_G ids are not in gene_index.json")

    dupes = n - len({s["v_id"] for s in strains})
    if dupes:
        problems.append(f"{dupes} duplicate V-strain ids")

    linked = [s for s in strains if s["ddb_g"]]
    in_stock = [s for s in strains if s["dbs_id"]]
    affected = [s for s in strains if s["affected"]]

    order = [v for v in order if v in {s["v_id"] for s in strains}]

    orderable = build_orderable(site_genes, sym2g, genes_hit)
    n_order_strains = sum(v["n_gwdi"] + v["n_dsc"] for v in orderable.values())

    out = {
        "_meta": {
            "dataset": "Sawai/Cox 2007 high-throughput developmental screen",
            "citation": "Sawai S, Guan X-J, Kuspa A, Cox EC. Genome Biol. 2007;8(7):R144.",
            "pmid": "17659086",
            "doi": "10.1186/gb-2007-8-7-r144",
            "license": "CC BY (Genome Biology open access)",
            "provenance": "high-throughput screen; not dictyBase expert curation",
            "stages": STAGES,
            "severity_scale": {str(k): v for k, v in SEVERITY.items()},
            "counts": {
                "strains": n,
                "with_gene_link": len(linked),
                "distinct_genes": len(genes_hit),
                "with_defect": len(affected),
                "matched_stock_center": len(in_stock),
                "wave_feature_runs": len(waves),
                "screen_strains_in_stock": sum(1 for s in strains if s["in_stock"]),
                "genes_with_orderable": len(orderable),
                "orderable_strains": n_order_strains,
                "robot_rows": len(robot),
                "strains_with_runs": sum(1 for s in strains if s["runs"]),
                "runs_with_movie": sum(1 for s in strains for r in s["runs"] if r["movie"]),
            },
            "movies": {
                "status": "mapping-complete",
                "note": ("Imaging run to strain mapping comes from the Cox lab's `robot` "
                         "table, exported in full and provided by Satoshi Sawai (2026), "
                         "covering all 77 imaging dates. Movie references are limited to the "
                         "files currently in hand (built with --have), so no page links a "
                         "clip that is not served; dates still to be recovered from the "
                         "archive are simply left without a movie until then."),
            },
        },
        "strains": strains,
        "cluster_order": order,
        "wave_features_by_run": waves,
        "orderable_by_gene": orderable,
    }

    path = os.path.join(ASSETS, "sawai2007.json")
    json.dump(out, open(path, "w", encoding="utf-8"),
              ensure_ascii=False, separators=(",", ":"))

    print(f"wrote {os.path.relpath(path, ROOT)}")
    print(f"  strains                 {n}")
    print(f"  linked to a site gene   {len(linked)}  ({len(genes_hit)} distinct genes)")
    print(f"  with >=1 stage defect   {len(affected)}")
    print(f"  matched in stock center {len(in_stock)}")
    print(f"  cluster ordering        {len(order)} strains")
    print(f"  wave features (by run)  {len(waves)}  [unjoined: see _meta.movies.note]")
    print(f"  screen strains in stock {sum(1 for s in strains if s['in_stock'])}")
    print(f"  genes w/ orderable alt  {len(orderable)}  ({n_order_strains} strains)")
    print(f"  robot rows (run->strain){len(robot):>5}")
    print(f"  strains with a run      {sum(1 for s in strains if s['runs'])}")
    print(f"  runs carrying a movie   {sum(1 for s in strains for r in s['runs'] if r['movie'])}")
    if unresolved_legacy:
        print(f"  legacy ids unresolved   {len(unresolved_legacy)}")

    if problems:
        print("\nVALIDATION:", file=sys.stderr)
        for p in problems:
            print(f"  - {p}", file=sys.stderr)
        if args.strict:
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
