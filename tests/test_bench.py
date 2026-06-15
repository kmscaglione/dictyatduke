"""Unit tests for the bench tools (stdlib unittest)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import bench


class CodonTest(unittest.TestCase):
    def test_optimize_protein_uses_dicty_preferred(self):
        r = bench.codon_optimize("MFLIK")
        self.assertFalse(r["input_was_dna"])
        self.assertEqual(r["protein"], "MFLIK")
        # Dicty preferred codons are AT-rich: M=ATG, F=TTT, L=TTA, I=ATT, K=AAA
        self.assertEqual(r["optimized_dna"], "ATGTTTTTAATTAAA")

    def test_dna_input_translates_and_scores_cai(self):
        r = bench.codon_optimize("ATGTTTTTAATTAAA")
        self.assertTrue(r["input_was_dna"])
        self.assertEqual(r["protein"], "MFLIK")
        self.assertIsNotNone(r["input_cai"])
        self.assertTrue(0 < r["input_cai"] <= 1.0001)


class CrisprTest(unittest.TestCase):
    def test_finds_ngg_guides(self):
        # a protospacer (20nt) followed by an NGG PAM
        cds = "AAAAAAAAAAAAAAAAAAAA" + "CGG" + "GGGGCCCCAAAATTTT" * 4
        guides = bench.crispr_guides(cds)
        self.assertTrue(guides)
        g = guides[0]
        self.assertEqual(len(g["protospacer"]), 20)
        self.assertTrue(g["pam"].endswith("GG"))
        self.assertIn(g["strand"], ("+", "-"))

    def test_polyt_penalized(self):
        cds = "TTTTAAAAAAAAAAAAAAAA" + "AGG" + "GCGCGCGC"
        pt = [g for g in bench.crispr_guides(cds) if g["poly_t"]]
        self.assertTrue(pt)  # the TTTT... protospacer is found
        self.assertTrue(all(g["score"] < 1.0 for g in pt))  # and penalized


class PrimerTest(unittest.TestCase):
    def test_designs_valid_pairs(self):
        import random
        random.seed(7)
        cdna = "".join(random.choice("ACGT") for _ in range(800))
        pairs = bench.design_primers(cdna, n=3)
        for p in pairs:
            self.assertGreaterEqual(p["product"], 90)
            self.assertLessEqual(p["product"], 200)
            self.assertTrue(52 <= p["fwd_tm"] <= 64)
            self.assertTrue(52 <= p["rev_tm"] <= 64)
            self.assertEqual(p["forward"], cdna[p["fwd_pos"] - 1:p["fwd_pos"] - 1 + len(p["forward"])])


class RestrictionTest(unittest.TestCase):
    def test_finds_known_site(self):
        seq = "AAAA" + "GAATTC" + "TTTT"   # EcoRI at position 5
        res = bench.restriction_sites(seq)
        eco = next(e for e in res["enzymes"] if e["enzyme"] == "EcoRI")
        self.assertEqual(eco["count"], 1)
        self.assertEqual(eco["positions"], [5])

    def test_noncutter_reported_zero(self):
        res = bench.restriction_sites("ATATATATATATATAT")  # no GC-rich sites
        notI = next(e for e in res["enzymes"] if e["enzyme"] == "NotI")
        self.assertEqual(notI["count"], 0)


class OrfTest(unittest.TestCase):
    def test_finds_forward_orf(self):
        cds = "ATG" + "GCT" * 40 + "TAA"           # Met + 40 Ala + stop
        res = bench.find_orfs("CC" + cds + "CC")
        self.assertTrue(res["orfs"])
        top = res["orfs"][0]
        self.assertEqual(top["strand"], "+")
        self.assertEqual(top["length_aa"], 41)
        self.assertTrue(top["protein"].startswith("MA"))

    def test_translation_matches(self):
        res = bench.find_orfs("ATG" + "AAA" * 35 + "TGA")
        self.assertEqual(res["orfs"][0]["protein"], "M" + "K" * 35)


class ProteinPropsTest(unittest.TestCase):
    def test_basic(self):
        p = bench.protein_props("MKKKDDDE")
        self.assertEqual(p["length"], 8)
        self.assertGreater(p["mw"], 900)
        self.assertIn("pi", p)
        self.assertIn("gravy", p)

    def test_charge(self):
        self.assertGreater(bench.protein_props("KKKKKK")["pi"], 9)
        self.assertLess(bench.protein_props("DDDDDD")["pi"], 5)

    def test_empty(self):
        self.assertIn("error", bench.protein_props("XXX---"))


if __name__ == "__main__":
    unittest.main()
