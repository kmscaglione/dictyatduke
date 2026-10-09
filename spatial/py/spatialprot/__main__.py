"""Command line: python -m spatialprot {validate,summarize,derive} ..."""
import argparse
import json
import sys

from . import bundle as _bundle, summary, validate as _validate


def main(argv=None):
    ap = argparse.ArgumentParser(prog="spatialprot")
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("validate", help="check a bundle against the schema and its semantic rules")
    v.add_argument("bundle")
    v.add_argument("--require-public", action="store_true",
                   help="also fail unless the bundle is cleared for distribution")
    s = sub.add_parser("summarize", help="print dataset, mapping and per-layer counts")
    s.add_argument("bundle")
    d = sub.add_parser("derive", help="add a computed PCA embedding (and nearest-centroid layer) from measured profiles")
    d.add_argument("bundle")
    d.add_argument("out")
    d.add_argument("--markers", help="id of the curated marker layer to build centroids from")
    args = ap.parse_args(argv)

    b = _bundle.load(args.bundle)
    if args.cmd == "validate":
        issues = _validate.validate(b, require_public=args.require_public)
        for i in issues:
            print(i)
        bad = _validate.errors(issues)
        print(f"{'INVALID' if bad else 'valid'}: {len(bad)} error(s), {len(issues) - len(bad)} warning(s)")
        return 1 if bad else 0
    if args.cmd == "summarize":
        ds = b["dataset"]
        out = {"dataset": ds["id"], "organism": ds["organism"]["name"],
               "license": ds["license"]["id"], "distribution": ds["distribution"]["status"],
               "mapping": {k: v for k, v in ds["mapping"].items() if not isinstance(v, list)},
               "has_profiles": bool(b.get("profiles")),
               "embeddings": [e["id"] for e in b.get("embeddings", [])],
               "layers": {l["id"]: {"evidence_type": l["evidence_type"], "source": l["source"],
                                    **summary.layer_counts(b, l["id"])} for l in b["layers"]}}
        print(json.dumps(out, indent=2, ensure_ascii=False))
        return 0
    from . import analysis
    try:
        out = analysis.derive(b, args.markers)
    except analysis.NoProfiles as e:
        print(f"refused: {e}", file=sys.stderr)
        return 2
    bad = _validate.errors(_validate.validate(out))
    if bad:
        for i in bad:
            print(i, file=sys.stderr)
        return 1
    _bundle.dump(out, args.out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
