"""Schema, validator, protein groups and summaries, on synthetic data only."""
import importlib.util
import json
import unittest

from _util import B, FIXTURES, fixture
from spatialprot import EVIDENCE_TYPES, SCHEMA_VERSION, jsonschema_lite, summary, validate as V

ALL = ["alpha", "beta", "beta.derived", "alpha.assignments-only"]


def errs(bundle, **kw):
    return [repr(i) for i in V.errors(V.validate(bundle, **kw))]


class SchemaTest(unittest.TestCase):
    def test_schema_uses_only_supported_keywords_and_version_matches(self):
        schema = json.loads(B.SCHEMA_PATH.read_text())
        self.assertEqual(jsonschema_lite.check(fixture("alpha"), schema), [])
        self.assertTrue(SCHEMA_VERSION.startswith("1.0."))
        self.assertIn("1.0", B.SCHEMA_PATH.name)

    def test_unsupported_keyword_is_refused_not_ignored(self):
        with self.assertRaises(ValueError):
            jsonschema_lite.check({}, {"type": "object", "oneOf": []})

    def test_layer_evidence_types_are_the_declared_ones(self):
        schema = json.loads(B.SCHEMA_PATH.read_text())
        layer_types = schema["$defs"]["layer"]["properties"]["evidence_type"]["enum"]
        self.assertEqual(["measured_profile"] + layer_types, list(EVIDENCE_TYPES))
        self.assertEqual(schema["$defs"]["profiles"]["properties"]["evidence_type"]["const"],
                         "measured_profile")


class FixtureTest(unittest.TestCase):
    def test_all_fixtures_valid_public_and_synthetic(self):
        for name in ALL:
            b = fixture(name)
            self.assertEqual(errs(b, require_public=True), [], name)
            self.assertTrue(b["dataset"]["synthetic"], name)

    def test_fixtures_are_reproducible(self):
        spec = importlib.util.spec_from_file_location("make_fixtures", FIXTURES / "make_fixtures.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        for name, bundle in mod.build_all().items():
            self.assertEqual(B.dumps(bundle), (FIXTURES / name).read_text(encoding="utf-8"), name)

    def test_expected_answers_for_the_javascript_tests_are_current(self):
        spec = importlib.util.spec_from_file_location("make_fixtures", FIXTURES / "make_fixtures.py")
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        want = json.loads(json.dumps(mod.expected(mod.build_all())))
        self.assertEqual(want, json.loads((FIXTURES / "expected.json").read_text()))

    def test_the_two_organisms_really_differ(self):
        a, b = fixture("alpha"), fixture("beta")
        self.assertNotEqual(a["dataset"]["organism"]["name"], b["dataset"]["organism"]["name"])
        self.assertNotEqual(a["dataset"]["id_namespaces"], b["dataset"]["id_namespaces"])
        self.assertNotEqual(len(a["fractions"]), len(b["fractions"]))
        self.assertNotEqual(len(a["compartments"]), len(b["compartments"]))
        self.assertFalse({c["id"] for c in a["compartments"]} & {c["id"] for c in b["compartments"]})

    def test_assignments_only_variant_has_no_measured_data(self):
        b = fixture("alpha.assignments-only")
        for key in ("profiles", "embeddings", "fractions"):
            self.assertNotIn(key, b)


class ProteinGroupTest(unittest.TestCase):
    def test_parse_group_keeps_every_member(self):
        self.assertEqual(B.parse_group("A.1; B.2 ;C.3"), ["A.1", "B.2", "C.3"])
        self.assertEqual(B.parse_group("A.1"), ["A.1"])

    def test_multi_gene_group_is_not_collapsed(self):
        b = fixture("alpha")
        multi = [e for e in b["entities"] if len(B.entity_genes(e)) > 1]
        self.assertEqual(len(multi), 4)
        self.assertEqual([e["id"] for e in multi], b["dataset"]["mapping"]["multi_gene_entities"])
        idx = B.gene_index(b)
        for e in multi:
            for g in B.entity_genes(e):
                self.assertIn(e["id"], idx[g])

    def test_gene_in_two_groups_is_many_to_many(self):
        b = fixture("alpha")
        shared = {g: ids for g, ids in B.gene_index(b).items() if len(ids) > 1}
        self.assertEqual(len(shared), 1)
        gene, ids = next(iter(shared.items()))
        got = summary.gene_summary(b, gene)
        self.assertEqual([x["entity"] for x in got], ids)
        self.assertTrue(all(x["assignments"] for x in got))

    def test_isoforms_of_one_gene_count_once(self):
        b = fixture("alpha")
        iso = [e for e in b["entities"] if len(e["members"]) == 2 and len(B.entity_genes(e)) == 1
               and B.entity_mapping_status(e) == "mapped"]
        self.assertEqual(len(iso), 2)

    def test_unmapped_and_partial_groups_are_kept_and_listed(self):
        b = fixture("alpha")
        m = b["dataset"]["mapping"]
        self.assertEqual((m["entities_unmapped"], m["entities_partial"]), (3, 1))
        self.assertEqual(len(m["unmapped_entities"]), 3)
        ids = {e["id"] for e in b["entities"]}
        self.assertTrue(set(m["unmapped_entities"]) <= ids)
        covered = {a["entity"] for a in summary.layer(b, "classifier")["assignments"]}
        self.assertTrue(set(m["unmapped_entities"]) <= covered)   # still carry their results
        self.assertEqual(m["entities_mapped"] + m["entities_partial"] + m["entities_unmapped"],
                         m["entities_total"])

    def test_detected_background_excludes_undetected_groups(self):
        b = fixture("alpha")
        genes = summary.detected_genes(b)
        self.assertEqual(len(genes), b["dataset"]["mapping"]["genes_total"])
        target = next(e for e in b["entities"] if len(B.entity_genes(e)) == 1
                      and len(B.gene_index(b)[B.entity_genes(e)[0]]) == 1)
        target["detected"] = False
        self.assertEqual(len(summary.detected_genes(b)), len(genes) - 1)


class ValidatorTest(unittest.TestCase):
    def test_structural_errors(self):
        b = fixture("alpha")
        del b["dataset"]["license"]
        b["layers"][0]["evidence_type"] = "measured_profile"   # only `profiles` may be that
        b["surprise"] = 1
        e = "\n".join(errs(b))
        self.assertIn("missing required property 'license'", e)
        self.assertIn("unexpected property 'surprise'", e)
        self.assertIn("evidence_type", e)

    def test_provenance_and_attribution_are_mandatory(self):
        for key in ("provenance", "attribution", "citation", "mapping", "distribution"):
            b = fixture("beta")
            del b["dataset"][key]
            self.assertTrue(errs(b), key)
        b = fixture("beta")
        b["dataset"]["provenance"]["sources"] = []
        self.assertTrue(errs(b))

    def test_mapping_statistics_must_match_entities(self):
        b = fixture("alpha")
        b["dataset"]["mapping"]["entities_unmapped"] = 0
        self.assertIn("mapping.entities_unmapped", "\n".join(errs(b)))
        b = fixture("alpha")
        b["dataset"]["mapping"]["multi_gene_entities"].pop()
        self.assertIn("mapping.multi_gene_entities", "\n".join(errs(b)))
        b = fixture("alpha")
        b["entities"][0]["members"][0]["gene"] = None            # silently dropping a mapping
        self.assertTrue(errs(b))

    def test_restricted_license_cannot_be_public(self):
        b = fixture("alpha")
        b["dataset"]["license"]["redistribution"] = "restricted"
        self.assertIn("distribution.status", "\n".join(errs(b)))
        b["dataset"]["distribution"] = {"status": "local-only", "reason": "pending"}
        self.assertEqual(errs(b), [])
        self.assertIn("not cleared for distribution", "\n".join(errs(b, require_public=True)))

    def test_references_must_resolve(self):
        b = fixture("alpha")
        b["layers"][1]["assignments"][0]["entity"] = "nope"
        b["layers"][1]["assignments"][1]["compartment"] = "nope"
        e = "\n".join(errs(b))
        self.assertIn("unknown entity", e)
        self.assertIn("unknown compartment", e)

    def test_duplicate_ids_and_double_assignment(self):
        b = fixture("alpha")
        b["entities"].append(b["entities"][0])
        self.assertIn("duplicate id", "\n".join(errs(b)))
        b = fixture("alpha")
        b["layers"][0]["assignments"].append(b["layers"][0]["assignments"][0])
        self.assertIn("assigned twice", "\n".join(errs(b)))

    def test_probability_label_needs_a_stated_basis(self):
        b = fixture("alpha")
        clf = summary.layer(b, "classifier")
        self.assertEqual(clf["score"]["interpretation"], "unspecified")
        clf["score"]["interpretation"] = "probability"
        self.assertIn("interpretation_basis", "\n".join(errs(b)))
        clf["score"]["interpretation_basis"] = "Methods, section 2."
        self.assertEqual(errs(b), [])

    def test_status_must_agree_with_declared_threshold(self):
        b = fixture("alpha")
        a = next(x for x in summary.layer(b, "classifier")["assignments"] if x["status"] == "below_threshold")
        a["status"] = "assigned"
        self.assertIn("disagrees with the declared threshold", "\n".join(errs(b)))

    def test_profile_shape_and_values(self):
        b = fixture("alpha")
        first = b["entities"][0]["id"]
        b["profiles"]["values"][first] = b["profiles"]["values"][first][:-1]
        self.assertIn("expected 8 values", "\n".join(errs(b)))
        b = fixture("alpha")
        b["profiles"]["values"]["ghost"] = [0.0] * 8
        self.assertIn("unknown entity", "\n".join(errs(b)))
        b = fixture("alpha")
        del b["fractions"]
        self.assertIn("non-empty 'fractions'", "\n".join(errs(b)))

    def test_computed_objects_need_measured_profiles(self):
        b = fixture("beta.derived")
        del b["profiles"]
        self.assertIn("computed embedding needs the measured profiles", "\n".join(errs(b)))
        b = fixture("alpha")
        b["layers"][0]["source"] = "computed"                   # a curated layer cannot be computed
        self.assertIn("cannot be a curated annotation", "\n".join(errs(b)))

    def test_nan_cannot_be_written(self):
        b = fixture("alpha")
        b["layers"][1]["assignments"][0]["score"] = float("nan")
        self.assertIn("score must be finite", "\n".join(errs(b)))
        with self.assertRaises(ValueError):
            B.dumps(b)


class SummaryTest(unittest.TestCase):
    def test_scores_round_trip_exactly(self):
        b = fixture("alpha")
        again = json.loads(B.dumps(b))
        self.assertEqual([a["score"] for a in summary.layer(b, "classifier")["assignments"]],
                         [a["score"] for a in summary.layer(again, "classifier")["assignments"]])
        self.assertEqual(B.dumps(again), B.dumps(b))

    def test_layer_counts_separate_calls_from_below_threshold(self):
        b = fixture("alpha")
        c = summary.layer_counts(b, "classifier")
        assigned = sum(v["assigned"] for v in c["compartments"].values())
        below = sum(v["below_threshold"] for v in c["compartments"].values())
        self.assertEqual(assigned + below, 80)
        self.assertEqual(assigned, 40)          # median cutoff: the upper half

    def test_concordance_counts_only_mutual_calls(self):
        b = fixture("alpha")
        c = summary.concordance(b, "classifier", "markers")
        self.assertEqual(c["n_shared"], 12)
        self.assertLessEqual(c["n_agree"], c["n_both_assigned"])
        self.assertEqual(sum(n for row in c["table"].values() for n in row.values()), c["n_both_assigned"])
        self.assertEqual(c["n_agree"], sum(row.get(k, 0) for k, row in c["table"].items()))

    def test_evidence_types_stay_in_their_own_layers(self):
        b = fixture("alpha")
        self.assertEqual({l["id"]: l["evidence_type"] for l in b["layers"]},
                         {"markers": "curated_annotation", "classifier": "computational_assignment",
                          "targeting": "sequence_prediction"})
        self.assertEqual(b["profiles"]["evidence_type"], "measured_profile")
        rows = summary.gene_summary(b, B.entity_genes(b["entities"][0])[0])[0]["assignments"]
        self.assertEqual(len({r["layer"] for r in rows}), len(rows))   # one row per layer, never merged


if __name__ == "__main__":
    unittest.main()
