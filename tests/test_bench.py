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


if __name__ == "__main__":
    unittest.main()
