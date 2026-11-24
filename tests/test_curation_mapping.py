"""Paper-curation queue: DDPHENO mapping of AI phenotypes, and the curator's
"add to GO / add phenotype" trail.

Both drafting routes (the server's own AI draft and the Claude Code batch
import) must give every phenotype the same shape: the observation in plain
words plus a DDPHENO term, or an explicit no_term flag. Nothing is silently
dropped. Author submissions keep the AI's mapping for entries they left as
drafted. Stdlib only; runs against a temporary drafts file, never the real one.
"""
import json
import os
import pathlib
import sys
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")  # before importing serve
import serve  # noqa: E402


class MapPhenotypeTest(unittest.TestCase):
    def test_valid_id_takes_the_ontology_name(self):
        m = serve.map_phenotype({"phenotype": "more lysosomal enzymes secreted",
                                 "ddpheno_id": "ddpheno:0000433", "ddpheno_term": "wrong name"})
        self.assertEqual(m["ddpheno_id"], "DDPHENO:0000433")
        self.assertEqual(m["ddpheno_term"], "increased secretion of lysosomal enzymes")
        self.assertNotIn("no_term", m)

    def test_term_name_and_synonym_resolve(self):
        m = serve.map_phenotype({"phenotype": "x", "ddpheno_term": "aberrant proteasomal protein catabolic process"})
        self.assertEqual(m["ddpheno_id"], "DDPHENO:0000810")
        m = serve.map_phenotype({"phenotype": "Aberrant  spore pigmentation"})   # a synonym
        self.assertEqual(m["ddpheno_id"], "DDPHENO:0000001")

    def test_older_phenotype_id_field_still_read(self):
        self.assertEqual(serve.map_phenotype({"phenotype": "x", "phenotype_id": "DDPHENO:0000433"})["ddpheno_id"],
                         "DDPHENO:0000433")

    def test_no_term_is_flagged_not_dropped(self):
        m = serve.map_phenotype({"phenotype": "something no ontology covers"})
        self.assertTrue(m["no_term"])
        self.assertEqual(m["ddpheno_note"], "No suitable DDPHENO term")

    def test_invented_id_is_named_in_the_flag(self):
        m = serve.map_phenotype({"phenotype": "x", "ddpheno_id": "DDPHENO:9999999"})
        self.assertTrue(m["no_term"])
        self.assertIn("DDPHENO:9999999", m["ddpheno_note"])

    def test_clean_phenotypes_keeps_everything(self):
        rows = serve.clean_phenotypes([
            {"gene": "cln5", "phenotype": "secretes more lysosomal enzymes", "ddpheno_id": "DDPHENO:0000433",
             "support": "quote"},
            {"gene": "cln5", "phenotype": "an unmappable observation", "negative": True},
            "not a dict", {"gene": "x", "phenotype": ""},
        ])
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["phenotype"], "secretes more lysosomal enzymes")   # observation kept
        self.assertEqual(rows[0]["support"], "quote")
        self.assertTrue(rows[1]["no_term"] and rows[1]["negative"])

    def test_server_route_uses_the_same_shape(self):
        rows = serve._normalize_phenotypes([{"gene": "g", "phenotype": "no ontology term for this"}])
        self.assertEqual(len(rows), 1)                  # used to be dropped
        self.assertTrue(rows[0]["no_term"])


class DraftStoreTest(unittest.TestCase):
    """Import, author submission and the added-record trail on a temp store."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.real_path = serve.PAPER_DRAFTS_PATH
        serve.PAPER_DRAFTS_PATH = pathlib.Path(self.tmp.name) / "drafts.json"
        serve.PAPER_DRAFTS_PATH.write_text(json.dumps({"drafts": [
            {"pmid": "123", "token": "tok", "title": "t", "status": "sent", "genes": []}]}))

    def tearDown(self):
        serve.PAPER_DRAFTS_PATH = self.real_path
        self.tmp.cleanup()

    def draft(self):
        return serve._load_paper_drafts()["drafts"][0]

    def test_import_maps_and_flags(self):
        serve.import_curation_results([{"pmid": "123", "phenotypes": [
            {"gene": "cln5", "phenotype": "elevated lysosomal enzyme secretion", "ddpheno_id": "DDPHENO:0000433"},
            {"gene": "cln5", "phenotype": "free text the ontology lacks", "ddpheno_id": ""},
        ]}])
        ph = self.draft()["ai"]["phenotypes"]
        self.assertEqual(ph[0]["ddpheno_term"], "increased secretion of lysosomal enzymes")
        self.assertTrue(ph[1]["no_term"])

    def test_bundle_carries_the_ontology(self):
        b = serve.paper_export_bundle()
        self.assertGreater(len(b["phenotype_ontology"]), 500)
        self.assertTrue(all(t["id"].startswith("DDPHENO:") for t in b["phenotype_ontology"]))
        self.assertIn("ddpheno_id", b["instructions"])

    def test_author_submission_keeps_or_clears_mapping(self):
        serve.import_curation_results([{"pmid": "123", "phenotypes": [
            {"gene": "cln5", "phenotype": "elevated lysosomal enzyme secretion", "ddpheno_id": "DDPHENO:0000433"},
            {"gene": "cln5", "phenotype": "free text the ontology lacks"},
        ]}])
        serve.paper_session_submit("tok", {"curation": {"phenotypes": [
            {"gene": "cln5", "phenotype": "Elevated lysosomal enzyme  secretion"},   # as drafted
            {"gene": "cln5", "phenotype": "free text the ontology lacks"},           # as drafted, no term
            {"gene": "cln5", "phenotype": "author rewrote this entirely"},           # new wording
            {"gene": "cln5", "phenotype": "aberrant spore color"},                   # exact DDPHENO name
        ]}})
        ph = self.draft()["submission"]["phenotypes"]
        self.assertEqual(ph[0]["ddpheno_id"], "DDPHENO:0000433")
        self.assertTrue(ph[1].get("no_term"))
        self.assertNotIn("ddpheno_id", ph[2])          # unmapped, and NOT claimed as "no term"
        self.assertNotIn("no_term", ph[2])
        self.assertEqual(ph[3]["ddpheno_id"], "DDPHENO:0000001")

    def test_added_record_survives_resubmission(self):
        cur = {"go": [{"gene": "cln5", "term": "phagocytosis", "aspect": "P", "go_id": "GO:0006909"}]}
        serve.paper_session_submit("tok", {"curation": cur})
        key = serve.annotate_submission(self.draft()["submission"])["go"][0]["key"]
        self.assertTrue(serve.record_submission_added("123", key, "GO:0006909 phagocytosis, IMP", "Bob"))
        self.assertFalse(serve.record_submission_added("123", "go:nonexistent", "x", "Bob"))
        serve.paper_session_submit("tok", {"curation": cur})          # unchanged resubmission
        item = serve.annotate_submission(self.draft()["submission"])["go"][0]
        self.assertEqual(item["added"][0]["what"], "GO:0006909 phagocytosis, IMP")


if __name__ == "__main__":
    unittest.main()
