import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import msa


class TestMSA(unittest.TestCase):
    def test_identical(self):
        a = msa.align(["MKVL", "MKVL", "MKVL"])
        self.assertEqual(a, ["MKVL", "MKVL", "MKVL"])
        self.assertEqual(msa.percent_identity(a), 100.0)

    def test_equal_length_and_gaps(self):
        a = msa.align(["MKVLAA", "MKVAA", "MKVLAA"])
        self.assertEqual(len({len(r) for r in a}), 1)          # all rows same length
        self.assertTrue(any("-" in r for r in a))               # a gap was introduced
        # every row, with gaps removed, recovers its input
        self.assertEqual(a[0].replace("-", ""), "MKVLAA")
        self.assertEqual(a[1].replace("-", ""), "MKVAA")

    def test_single_and_empty(self):
        self.assertEqual(msa.align([]), [])
        self.assertEqual(msa.align(["MKVL"]), ["MKVL"])

    def test_seq_count_cap(self):
        a = msa.align(["MKVL"] * (msa.MAX_SEQS + 5))
        self.assertLessEqual(len(a), msa.MAX_SEQS)

    def test_length_cap(self):
        a = msa.align(["A" * (msa.MAX_LEN + 50), "A" * (msa.MAX_LEN + 50)])
        self.assertLessEqual(len(a[0]), msa.MAX_LEN)

    def test_consensus(self):
        a = ["MKVL", "MKVL", "MRVL"]
        self.assertEqual(msa.consensus(a), "MKVL")

    def test_dna(self):
        a = msa.align(["ACGTACGT", "ACGTACGT", "ACGAACGT"])
        self.assertEqual(len({len(r) for r in a}), 1)


if __name__ == "__main__":
    unittest.main()
