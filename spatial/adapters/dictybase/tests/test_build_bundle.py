"""dictyBase adapter build. Uses tiny in-memory tables; the real supplement is
only read by the last class, which skips when the local bundle is absent."""
import pathlib
import sys
import unittest

HERE = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))
sys.path.insert(0, str(HERE.parents[2] / "py"))
import build_bundle as bb  # noqa: E402
from spatialprot import bundle as B, summary, validate as V  # noqa: E402

SOURCES = [{"name": "tables", "description": "in-memory test tables"}]
P2G = {"XP_1.1": ("DDB_G0000001", "alpha"), "XP_2.1": ("DDB_G0000002", None),
       "XP_3.1": ("DDB_G0000003", None), "XP_4.1": ("DDB_G0000003", None),
       "XP_5.1": ("DDB_G0000005", None), "XP_9.1": ("DDB_G0000009", None)}
TABLES = {
    "svm": [("XP_1.1", "Mitochondria", 0.91, "Mitochondria"),
            ("XP_2.1;XP_3.1", "Cytosol", 0.7000000000000001, "Cytosol"),
            ("XP_3.1;XP_4.1", "Cytosol", 0.30000000000000004, "unknown"),
            ("NP_7.1", "Mitochondria", 0.8, "Mitochondria"),
            ("XP_5.1", "Nucleus", 0.1, "unknown"),
            ("XP_5.1;NP_8.1", "Nucleus", 0.2, "unknown")],
    "markers": [("XP_1.1", "Mitochondria", "Yes"), ("XP_5.1", "Nucleus", "No")],
    "mito": [("XP_1.1", "Overlapping Proteins"), ("XP_9.1", "Mfates ≥ 0.6")],
}


def build():
    return bb.build(TABLES, P2G, {"NP_7.1": "ND4 (mitochondrion)"}, SOURCES, built="2026-01-01")


class BuildTest(unittest.TestCase):
    def test_valid_and_local_only(self):
        b = build()
        self.assertEqual(V.errors(V.validate(b)), [])
        self.assertEqual(b["dataset"]["distribution"]["status"], "local-only")
        self.assertEqual(b["dataset"]["license"]["id"], "CC-BY-NC-ND-4.0")
        self.assertTrue(V.errors(V.validate(b, require_public=True)))
        for key in ("citation", "attribution", "provenance", "mapping"):
            self.assertTrue(b["dataset"][key])
        self.assertNotIn("synthetic", b["dataset"])

    def test_no_measured_data_is_invented(self):
        b = build()
        for key in ("profiles", "embeddings", "fractions"):
            self.assertNotIn(key, b)
        self.assertTrue(all(l["source"] == "author" for l in b["layers"]))

    def test_groups_kept_whole_with_every_gene(self):
        b = build()
        ent = {e["id"]: e for e in b["entities"]}
        self.assertEqual(B.entity_genes(ent["XP_2.1;XP_3.1"]), ["DDB_G0000002", "DDB_G0000003"])
        self.assertEqual(B.entity_genes(ent["XP_3.1;XP_4.1"]), ["DDB_G0000003"])
        self.assertEqual(B.gene_index(b)["DDB_G0000003"], ["XP_2.1;XP_3.1", "XP_3.1;XP_4.1"])
        self.assertEqual(B.entity_mapping_status(ent["XP_5.1;NP_8.1"]), "partial")
        m = b["dataset"]["mapping"]
        self.assertEqual(m["multi_gene_entities"], ["XP_2.1;XP_3.1"])
        self.assertEqual(m["unmapped_entities"], ["NP_7.1"])
        self.assertIn("mapping_note", ent["NP_7.1"])
        self.assertEqual(ent["NP_7.1"]["members"][0]["description"], "ND4 (mitochondrion)")
        covered = {a["entity"] for a in summary.layer(b, "svm")["assignments"]}
        self.assertEqual(covered, {r[0] for r in TABLES["svm"]})

    def test_scores_and_classes_are_verbatim(self):
        b = build()
        svm = summary.layer(b, "svm")
        got = {a["entity"]: a for a in svm["assignments"]}
        label = {c["id"]: c["label"] for c in b["compartments"]}
        for group, klass, score, pred in TABLES["svm"]:
            a = got[group]
            self.assertEqual(a["score"], score)
            self.assertEqual(repr(a["score"]), repr(score))
            self.assertEqual(label[a["compartment"]], klass)       # class kept even below threshold
            self.assertEqual(a["status"], "below_threshold" if pred == "unknown" else "assigned")
        import json
        back = {a["entity"]: a["score"] for a in summary.layer(json.loads(B.dumps(b)), "svm")["assignments"]}
        self.assertEqual(back, {r[0]: r[2] for r in TABLES["svm"]})
        self.assertEqual(svm["score"]["name"], "svm.scores")
        self.assertEqual(svm["score"]["interpretation"], "unspecified")
        text = (svm["label"] + svm["score"]["description"]).lower()
        self.assertNotIn("%", text)
        self.assertNotIn("confidence score", text)

    def test_threshold_only_recorded_when_the_data_bear_it_out(self):
        thr = summary.layer(build(), "svm")["score"]["threshold"]
        self.assertEqual((thr["basis"], thr["rule"]), ("observed_in_data", "score >= value"))
        odd = dict(TABLES, svm=[("XP_1.1", "Mitochondria", 0.1, "Mitochondria"),
                                ("XP_5.1", "Nucleus", 0.9, "unknown")])
        odd["mito"] = []
        self.assertNotIn("threshold", summary.layer(bb.build(odd, P2G, {}, SOURCES), "svm")["score"])

    def test_undetected_compendium_entries_are_flagged_and_out_of_background(self):
        b = build()
        ent = {e["id"]: e for e in b["entities"]}
        self.assertIs(ent["XP_9.1"]["detected"], False)
        self.assertNotIn("DDB_G0000009", summary.detected_genes(b))
        mito = {a["entity"]: a for a in summary.layer(b, "mito-compendium")["assignments"]}
        self.assertEqual(mito["XP_9.1"]["attributes"]["evidence"], "Mfates ≥ 0.6")

    def test_layers_keep_their_evidence_types(self):
        self.assertEqual({l["id"]: l["evidence_type"] for l in build()["layers"]},
                         {"svm": "computational_assignment", "markers": "curated_annotation",
                          "mito-compendium": "curated_annotation"})

    def test_inconsistent_source_rows_stop_the_build(self):
        bad = dict(TABLES, svm=TABLES["svm"] + [("XP_9.1", "Cytosol", 0.9, "Nucleus")])
        with self.assertRaises(SystemExit):
            bb.build(bad, P2G, {}, SOURCES)
        with self.assertRaises(SystemExit):
            bb.build(dict(TABLES, markers=[("XP_404.1", "Nucleus", "Yes")]), P2G, {}, SOURCES)

    def test_gff_parser(self):
        import tempfile
        row = "chr1\tRefSeq\tCDS\t1\t9\t.\t+\t0\tID=cds-XP_1.1;Dbxref=dictyBase:DDB0000001,GenBank:XP_1.1,dictyBase:DDB_G0000001,GeneID:1;product=actin%2C alpha;protein_id=XP_1.1\n"
        with tempfile.NamedTemporaryFile("w", suffix=".gff", delete=False) as fh:
            fh.write("##gff-version 3\n" + row + row.replace("CDS", "exon"))
        self.assertEqual(bb.protein_gene_map(fh.name), {"XP_1.1": ("DDB_G0000001", "actin, alpha")})
        pathlib.Path(fh.name).unlink()


@unittest.skipUnless(bb.DEFAULT_OUT.exists(), "local bundle not built (it is never committed)")
class LocalBundleTest(unittest.TestCase):
    """Facts about the real local bundle, derived from it rather than typed in."""

    @classmethod
    def setUpClass(cls):
        cls.b = B.load(bb.DEFAULT_OUT)

    def test_valid_but_not_distributable(self):
        self.assertEqual(V.errors(V.validate(self.b)), [])
        self.assertTrue(V.errors(V.validate(self.b, require_public=True)))

    def test_every_published_row_is_present(self):
        detected = [e for e in self.b["entities"] if e.get("detected", True)]
        svm = summary.layer(self.b, "svm")["assignments"]
        self.assertEqual(len(svm), len(detected))
        st = B.mapping_stats(detected, "detected")
        self.assertEqual(st["entities_mapped"] + st["entities_partial"] + st["entities_unmapped"], len(detected))
        self.assertGreater(st["entities_unmapped"], 0)
        self.assertGreater(st["entities_multi_gene"], 0)
        self.assertIn(f"{st['entities_unmapped']} have no gene mapping", self.b["dataset"]["mapping"]["notes"])
        self.assertIn(f"{st['entities_multi_gene']} span more than one gene", self.b["dataset"]["mapping"]["notes"])

    def test_not_tracked_by_git(self):
        import subprocess
        out = subprocess.run(["git", "ls-files", "--", str(bb.DEFAULT_OUT.parent)], cwd=bb.REPO,
                             capture_output=True, text=True).stdout
        self.assertEqual(out.strip(), "")
        ignored = subprocess.run(["git", "check-ignore", "-q", str(bb.DEFAULT_OUT)], cwd=bb.REPO).returncode
        self.assertEqual(ignored, 0)


if __name__ == "__main__":
    unittest.main()
