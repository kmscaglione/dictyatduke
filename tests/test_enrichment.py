"""Unit tests for the GO-enrichment engine (stdlib unittest, no deps)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import enrichment


class HypergeomTest(unittest.TestCase):
    def test_known_values(self):
        # X ~ Hypergeometric(M=10, n=5, N=5)
        self.assertAlmostEqual(enrichment.hypergeom_sf(5, 10, 5, 5), 1 / 252, places=6)
        self.assertAlmostEqual(enrichment.hypergeom_sf(3, 10, 5, 5), 0.5, places=6)

    def test_edges(self):
        self.assertEqual(enrichment.hypergeom_sf(0, 100, 10, 10), 1.0)   # P(X>=0)
        self.assertEqual(enrichment.hypergeom_sf(11, 100, 10, 10), 0.0)  # impossible
        # survival function is non-increasing in k
        vals = [enrichment.hypergeom_sf(k, 200, 40, 30) for k in range(0, 20)]
        self.assertTrue(all(a >= b - 1e-12 for a, b in zip(vals, vals[1:])))

    def test_bh_monotone_and_bounded(self):
        q = enrichment._bh([0.001, 0.01, 0.5, 0.9])
        self.assertTrue(all(0 <= x <= 1 for x in q))
        self.assertGreaterEqual(q[0], 0.001)  # q >= p for the smallest


class ResolveGenesTest(unittest.TestCase):
    def test_symbol_and_unknown(self):
        matched, unmatched = enrichment.resolve_genes(["mhcA", "__nope__"])
        self.assertEqual(len(matched), 1)
        self.assertTrue(next(iter(matched)).startswith("DDB"))
        self.assertEqual(unmatched, ["__nope__"])

    def test_case_insensitive_and_dedup(self):
        matched, _ = enrichment.resolve_genes(["mhcA", "MHCA", "mhca"])
        self.assertEqual(len(matched), 1)


class EnrichTest(unittest.TestCase):
    def test_cytoskeleton_set(self):
        genes = ["abpA", "abpC", "corA", "ctxA", "ctxB", "fimA",
                 "myoB", "racE", "limE", "forH", "arpB", "cofA"]
        r = enrichment.enrich(genes, min_study=3)
        self.assertGreater(r["study_n"], 8)
        self.assertEqual(r["unmatched"], [])
        # an actin term should top the list and clear FDR
        top = r["results"][0]
        self.assertLess(top["q_value"], 0.05)
        ids = {t["id"] for t in r["results"]}
        self.assertIn("GO:0015629", ids)  # actin cytoskeleton
        # results sorted by ascending p-value
        ps = [t["p_value"] for t in r["results"]]
        self.assertEqual(ps, sorted(ps))

    def test_empty_input(self):
        r = enrichment.enrich([], min_study=2)
        self.assertEqual(r["study_n"], 0)
        self.assertEqual(r["results"], [])


class PhenotypeEnrichTest(unittest.TestCase):
    def test_shared_phenotype(self):
        import json
        import pathlib
        ph = json.loads((pathlib.Path(enrichment.ASSETS) / "phenotypes.json").read_text())
        term_genes = {}
        for ddb, rows in ph.items():
            for r in rows:
                t = (r[0] or "").strip() if r else ""
                if t:
                    term_genes.setdefault(t, set()).add(ddb)
        # take the most-shared phenotype and enrich on exactly its gene set
        term, genes = max(term_genes.items(), key=lambda kv: len(kv[1]))
        genes = sorted(genes)
        r = enrichment.enrich_phenotypes(genes, min_study=2)
        self.assertGreaterEqual(r["study_n"], 3)
        hits = {x["term"]: x for x in r["results"]}
        self.assertIn(term, hits)
        self.assertLess(hits[term]["q_value"], 0.05)  # perfect enrichment is significant

    def test_empty_input(self):
        r = enrichment.enrich_phenotypes([], min_study=2)
        self.assertEqual(r["study_n"], 0)
        self.assertEqual(r["results"], [])


class KeggEnrichTest(unittest.TestCase):
    def test_shared_pathway(self):
        kg = enrichment._load_kegg()
        # take the largest pathway and enrich on its gene set -> should top out
        pid, genes = max(kg["term_genes"].items(), key=lambda kv: len(kv[1]))
        r = enrichment.enrich_kegg(sorted(genes), min_study=2)
        self.assertGreaterEqual(r["study_n"], 3)
        hits = {x["id"]: x for x in r["results"]}
        self.assertIn(pid, hits)
        self.assertTrue(hits[pid].get("term"))
        self.assertLess(hits[pid]["q_value"], 0.05)


class CoexpressionTest(unittest.TestCase):
    def test_self_excluded_and_sorted(self):
        cx = enrichment._load_coexp()
        ddb = next(iter(cx["vecs"]))  # any gene with a non-flat profile
        r = enrichment.coexpression(ddb, n=10)
        ids = [x["ddb"] for x in r["results"]]
        self.assertNotIn(ddb, ids)                      # self excluded
        rs = [x["r"] for x in r["results"]]
        self.assertEqual(rs, sorted(rs, reverse=True))  # descending r
        self.assertTrue(all(-1.0001 <= x <= 1.0001 for x in rs))

    def test_unknown_gene(self):
        self.assertEqual(enrichment.coexpression("DDB_G9999999")["results"], [])

    def test_expression_profiles(self):
        r = enrichment.expression_profiles(["mhcA", "__nope__"])
        # Rosengarten 2015 filter-development course: 19 time points.
        self.assertEqual(len(r["timepoints"]), 19)
        self.assertTrue(r["series"])
        s = r["series"][0]
        self.assertEqual(len(s["values"]), len(r["timepoints"]))
        self.assertIn("symbol", s)
        self.assertIn("__nope__", r["unmatched"])


class CustomBackgroundTest(unittest.TestCase):
    """A detected-proteome style universe passed as background_genes."""
    GENES = ["abpA", "abpC", "corA", "ctxA", "ctxB", "fimA",
             "myoB", "racE", "limE", "forH", "arpB", "cofA"]

    def test_default_path_unchanged(self):
        # omitting the argument and passing None are the same call, and neither
        # adds keys: existing callers see the result they always saw
        a = enrichment.enrich(self.GENES, min_study=3)
        b = enrichment.enrich(self.GENES, min_study=3, background_genes=None)
        self.assertEqual(a, b)
        self.assertEqual(set(a), {"study_n", "study_resolved", "unmatched",
                                  "background", "background_n", "results"})

    def test_whole_annotated_set_as_custom_background_matches_default(self):
        st = enrichment._load()
        base = enrichment.enrich(self.GENES, min_study=3)
        cust = enrichment.enrich(self.GENES, min_study=3, background_genes=sorted(st["annotated"]))
        self.assertTrue(cust["background_custom"])
        self.assertEqual(cust["background_n"], base["background_n"])
        self.assertEqual(cust["results"], base["results"])
        self.assertEqual(cust["study_outside_background"], [])

    def test_restricted_universe_recomputes_counts(self):
        st = enrichment._load()
        study, _ = enrichment.resolve_genes(self.GENES)
        study &= st["annotated"]
        dropped = sorted(study)[0]
        others = [d for d in sorted(st["annotated"]) if d not in study][:1500]
        universe = [d for d in study if d != dropped] + others + ["__nope__"]
        r = enrichment.enrich(self.GENES, min_study=2, background_genes=universe)
        self.assertEqual(r["background_n"], len(universe) - 1)
        self.assertEqual(r["background_requested_n"], len(universe))
        self.assertEqual(r["background_unmatched_n"], 1)
        self.assertEqual(r["study_outside_background"], [dropped])
        self.assertEqual(r["study_n"], len(study) - 1)
        self.assertNotIn(dropped, r["study_resolved"])
        uni = set(universe)
        for t in r["results"]:
            # every count is taken inside the universe, and p is the hypergeometric tail
            self.assertEqual(t["pop_n"], r["background_n"])
            self.assertEqual(t["pop_count"], len(st["term_genes"][t["id"]] & uni))
            self.assertTrue(set(t["genes"]) <= uni)
            self.assertAlmostEqual(
                t["p_value"],
                enrichment.hypergeom_sf(t["study_count"], t["pop_n"], t["pop_count"], t["study_n"]))

    def test_symbols_and_case_resolve_like_gene_lists(self):
        matched, missing = enrichment.resolve_background(["mhcA", "MHCA", "ddb_g0286355", "", "__nope__"])
        self.assertEqual(matched, {"DDB_G0286355"})
        self.assertEqual(missing, 1)

    def test_genome_mode_keeps_unannotated_universe_members(self):
        st = enrichment._load()
        unannotated = sorted(st["all_ddb"] - st["annotated"])[:50]
        study, _ = enrichment.resolve_genes(self.GENES)
        universe = sorted(study) + unannotated
        ann = enrichment.enrich(self.GENES, background_genes=universe)
        gen = enrichment.enrich(self.GENES, background="genome", background_genes=universe)
        self.assertEqual(gen["background_n"] - ann["background_n"], 50)

    def test_empty_universe_is_safe(self):
        r = enrichment.enrich(self.GENES, background_genes=[])
        self.assertEqual((r["study_n"], r["background_n"], r["results"]), (0, 0, []))


if __name__ == "__main__":
    unittest.main()


class OtherSetsWithBackgroundTest(unittest.TestCase):
    """KEGG pathways, InterPro entries and GO complex terms against a custom universe."""

    def setUp(self):
        self.kegg = enrichment._load_kegg()
        self.dom = enrichment._load_domains()

    def check(self, fn, sets):
        term = max(sets["term_genes"], key=lambda t: len(sets["term_genes"][t]) if 5 <= len(sets["term_genes"][t]) <= 60 else 0)
        genes = sorted(sets["term_genes"][term])
        default = fn(genes)
        self.assertNotIn("background_custom", default)                 # result keys unchanged without a universe
        self.assertEqual(default["background_n"], len(sets["annotated"]))
        whole = fn(genes, background_genes=sorted(sets["annotated"]))
        self.assertEqual([(r["id"], r["p_value"], r["q_value"]) for r in whole["results"]],
                         [(r["id"], r["p_value"], r["q_value"]) for r in default["results"]])
        # a smaller universe: population and term sizes are recounted inside it
        others = [g for g in sorted(sets["annotated"]) if g not in set(genes)][:300]
        universe = set(genes[: len(genes) // 2 + 1]) | set(others)
        small = fn(genes, background_genes=sorted(universe) + ["DDB_G9999999"])
        self.assertEqual(small["background_n"], len(universe))
        self.assertEqual((small["background_requested_n"], small["background_unmatched_n"]), (len(universe) + 1, 1))
        self.assertEqual(set(small["study_resolved"]), set(genes) & universe)   # study genes outside it are dropped
        row = next(r for r in small["results"] if r["id"] == term)
        self.assertEqual((row["study_count"], row["pop_count"], row["pop_n"]),
                         (len(set(genes) & universe), len(sets["term_genes"][term] & universe), len(universe)))
        self.assertAlmostEqual(row["p_value"], enrichment.hypergeom_sf(row["study_count"], row["pop_n"], row["pop_count"], small["study_n"]))
        self.assertTrue(all(0 <= r["q_value"] <= 1 and r["q_value"] >= r["p_value"] - 1e-12 for r in small["results"]))
        self.assertEqual(fn(["__nope__"], background_genes=sorted(universe))["results"], [])

    def test_kegg(self):
        self.check(enrichment.enrich_kegg, self.kegg)

    def test_domains(self):
        self.check(enrichment.enrich_domains, self.dom)
        self.assertTrue(all(t.startswith("IPR") for t in self.dom["term_genes"]))
        self.assertGreater(len(self.dom["annotated"]), 4000)

    def test_complex_terms_restrict_the_go_test(self):
        ids = enrichment.complex_terms()
        self.assertIn("GO:0000502", ids)            # proteasome complex
        self.assertIn("GO:0032991", ids)
        self.assertNotIn("GO:0005739", ids)         # mitochondrion is not a complex
        self.assertGreater(len(ids), 1000)
        st = enrichment._load()
        genes = sorted(st["term_genes"]["GO:0000502"])
        full = enrichment.enrich(genes)
        only = enrichment.enrich(genes, restrict_terms=ids)
        self.assertTrue(only["results"] and all(r["id"] in ids for r in only["results"]))
        self.assertLess(len(only["results"]), len(full["results"]))
        self.assertEqual((only["study_n"], only["background_n"]), (full["study_n"], full["background_n"]))
        p = {r["id"]: r["p_value"] for r in full["results"]}
        self.assertTrue(all(r["p_value"] == p[r["id"]] for r in only["results"]))   # same test, fewer hypotheses
