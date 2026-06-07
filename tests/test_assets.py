"""Schema/integrity checks for the data assets the site loads at runtime.

A malformed asset (e.g. a bad ai_curation.json from a seed script, or a broken
monthly GAF refresh) can silently break the SPA. These stdlib-only checks catch
that in CI before it ships. Run: python3 -m unittest discover tests
"""
import json
import os
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
GO_RE = re.compile(r"^GO:\d{7}$")


def load(name):
    return json.loads((ASSETS / name).read_text())


class GeneIndexTest(unittest.TestCase):
    def test_shape(self):
        idx = load("gene_index.json")
        self.assertIsInstance(idx, list)
        self.assertGreater(len(idx), 10000)
        for row in idx[:500]:
            self.assertGreaterEqual(len(row), 2)
            self.assertIsInstance(row[0], str)


class GoAnnotationsTest(unittest.TestCase):
    def test_shape(self):
        go = load("go_annotations.json")
        self.assertIsInstance(go, dict)
        for ddb, rows in list(go.items())[:500]:
            self.assertTrue(ddb.startswith("DDB"))
            for r in rows:
                self.assertTrue(GO_RE.match(r[0]), f"bad GO id {r[0]}")
                self.assertIn(r[1], ("P", "F", "C"))


class AiCurationTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.ai = load("ai_curation.json")
        cls.real_go = {r[0] for rows in load("go_annotations.json").values()
                       for r in rows}

    def test_entries_well_formed(self):
        for key, entry in self.ai.items():
            if key.startswith("_"):
                continue
            self.assertEqual(key, key.lower(), f"{key} not lowercased")
            self.assertIsInstance(entry.get("summary"), str)
            self.assertTrue(entry["summary"].strip(), f"{key} empty summary")
            self.assertIsInstance(entry.get("go"), list)
            if "basis" in entry:
                self.assertIn(entry["basis"], ("family", "annotation"))
            for row in entry["go"]:
                self.assertEqual(len(row), 3, f"{key} bad GO row {row}")
                gid, aspect, name = row
                self.assertTrue(GO_RE.match(gid), f"{key} bad GO id {gid}")
                self.assertIn(aspect, ("P", "F", "C"))
                self.assertIsInstance(name, str)

    def test_no_invented_go_ids(self):
        """Every AI-suggested GO id must exist in the real Dicty GAF -- the core
        guarantee of the seed/family scripts."""
        offenders = []
        for key, entry in self.ai.items():
            if key.startswith("_"):
                continue
            for gid, _, _ in entry.get("go", []):
                if gid not in self.real_go:
                    offenders.append((key, gid))
        self.assertEqual(offenders, [], f"GO ids not in Dicty GAF: {offenders[:10]}")

    def test_has_meta(self):
        self.assertIn("_meta", self.ai)
        self.assertEqual(self.ai["_meta"]["layer"], "AI curation")


class OrthologDiseaseTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        path = ASSETS / "ortholog_disease.json"
        cls.od = load("ortholog_disease.json") if path.exists() else None

    def test_structure(self):
        if self.od is None:
            self.skipTest("ortholog_disease.json not built")
        dis_re = re.compile(r"^(OMIM|ORPHA|DECIPHER):")
        for key, entry in list(self.od.items())[:1000]:
            if key.startswith("_"):
                continue
            self.assertTrue(key.startswith("DDB_G"), f"bad gene key {key}")
            self.assertIsInstance(entry.get("orthologs"), list)
            for o in entry["orthologs"]:
                self.assertTrue(o["human_symbol"], "empty human_symbol")
                self.assertNotIn(".", o["human_symbol"])  # no RefSeq ids
                for d in o["diseases"]:
                    self.assertTrue(dis_re.match(d["id"]), f"bad disease id {d['id']}")

    def test_known_disease_gene(self):
        if self.od is None:
            self.skipTest("ortholog_disease.json not built")
        # cln5 (DDB_G0275299) -> human CLN5 -> neuronal ceroid lipofuscinosis
        e = self.od.get("DDB_G0275299")
        self.assertIsNotNone(e, "cln5 ortholog entry missing")
        syms = {o["human_symbol"] for o in e["orthologs"]}
        self.assertIn("CLN5", syms)


class TestGeneFacets(unittest.TestCase):
    """gene_facets.json powers the advanced finder: {ddb: [pheno, ortholog, disease, peak]}."""

    @classmethod
    def setUpClass(cls):
        path = ASSETS / "gene_facets.json"
        cls.facets = load("gene_facets.json") if path.exists() else None

    def test_structure(self):
        if self.facets is None:
            self.skipTest("gene_facets.json not built")
        self.assertGreater(len(self.facets), 1000)
        for key, v in list(self.facets.items())[:2000]:
            self.assertTrue(key.startswith("DDB_G"), f"bad gene key {key}")
            self.assertEqual(len(v), 4, f"{key} should have 4 facet values")
            self.assertIn(v[0], (0, 1))
            self.assertIn(v[1], (0, 1))
            self.assertIn(v[2], (0, 1))
            self.assertTrue(-1 <= v[3] <= 6, f"{key} peak stage {v[3]} out of range")
            # disease implies an ortholog exists
            if v[2]:
                self.assertEqual(v[1], 1, f"{key} disease without ortholog")
            # only genes with at least one facet are stored
            self.assertTrue(v[0] or v[1] or v[2] or v[3] >= 0, f"{key} has no facet")


if __name__ == "__main__":
    unittest.main()
