#!/usr/bin/env python3
"""Build go_cc_closure.json: for every accepted compartment GO term, the set of
cellular component terms that are a kind of it or a part of it.

    python3 spatial/adapters/dictybase/build_go_closure.py            # downloads go-basic.obo
    python3 spatial/adapters/dictybase/build_go_closure.py --obo FILE

A gene annotated to "mitochondrial matrix" supports a Mitochondria call only
because the ontology says the matrix is part of the mitochondrion. Only is_a
and part_of are followed. The Gene Ontology is CC BY 4.0.
"""
import argparse
import datetime
import json
import pathlib
import re
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
OBO_URL = "https://current.geneontology.org/ontology/go-basic.obo"


def parse_obo(text):
    """-> (data_version, {id: {"name", "parents": set}}) for live CC terms."""
    version = re.search(r"^data-version:\s*(\S+)", text, re.M)
    terms = {}
    for block in text.split("\n[Term]\n")[1:]:
        block = block.split("\n[Typedef]")[0]
        fields = {}
        for line in block.splitlines():
            key, _, val = line.partition(": ")
            fields.setdefault(key, []).append(val)
        if fields.get("namespace") != ["cellular_component"] or fields.get("is_obsolete") == ["true"]:
            continue
        parents = {v.split(" ! ")[0].strip() for v in fields.get("is_a", [])}
        parents |= {v.split()[1] for v in fields.get("relationship", []) if v.startswith("part_of ")}
        terms[fields["id"][0]] = {"name": fields["name"][0], "parents": parents}
    return (version.group(1) if version else None), terms


def closure(terms, roots):
    children = {}
    for tid, t in terms.items():
        for p in t["parents"]:
            children.setdefault(p, set()).add(tid)
    out = {}
    for root in roots:
        if root not in terms:
            raise SystemExit(f"{root} is not a current cellular component term")
        seen, stack = {root}, [root]
        while stack:
            for c in children.get(stack.pop(), ()):
                if c not in seen:
                    seen.add(c)
                    stack.append(c)
        out[root] = sorted(seen)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--obo")
    ap.add_argument("--out", default=str(HERE / "go_cc_closure.json"))
    args = ap.parse_args()
    if args.obo:
        text = pathlib.Path(args.obo).expanduser().read_text(encoding="utf-8", errors="replace")
    else:
        with urllib.request.urlopen(OBO_URL, timeout=120) as r:
            text = r.read().decode("utf-8", errors="replace")
    version, terms = parse_obo(text)
    mapping = json.loads((HERE / "compartment_go.json").read_text(encoding="utf-8"))["labels"]
    roots = sorted({m["go_id"] for m in mapping.values() if m["status"] == "accepted"})
    for label, m in mapping.items():
        if m["status"] == "accepted" and terms.get(m["go_id"], {}).get("name") != m["go_name"]:
            raise SystemExit(f"{label}: {m['go_id']} is named {terms.get(m['go_id'], {}).get('name')!r}, not {m['go_name']!r}")
    result = {
        "_meta": {"source": OBO_URL, "data_version": version, "license": "CC BY 4.0, Gene Ontology Consortium",
                  "relations": ["is_a", "part_of"], "built": datetime.date.today().isoformat(),
                  "builder": "spatial/adapters/dictybase/build_go_closure.py"},
        "terms": closure(terms, roots),
    }
    pathlib.Path(args.out).write_text(json.dumps(result, separators=(",", ":")) + "\n", encoding="utf-8")
    print(version, {r: len(v) for r, v in result["terms"].items()})


if __name__ == "__main__":
    main()
