"""Two-factor (TOTP) regression tests for curator sign-in.

This is security code, so it is pinned to the official RFC 6238 test vectors —
if these drift, real authenticator apps (Google Authenticator, 1Password, Authy)
would stop matching. Also covers replay rejection, the clock-skew window, and
single-use backup codes. Stdlib only.
"""
import base64
import os
import pathlib
import sys
import time
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")  # before importing serve
import serve  # noqa: E402

# RFC 6238 Appendix B, SHA-1 rows. Secret is ASCII "12345678901234567890";
# the published codes are 8-digit, so we compare against the last 6.
RFC_SECRET = base64.b32encode(b"12345678901234567890").decode().rstrip("=")
RFC_VECTORS = [
    (59, "94287082"),
    (1111111109, "07081804"),
    (1111111111, "14050471"),
    (1234567890, "89005924"),
    (2000000000, "69279037"),
    (20000000000, "65353130"),
]


class TotpConformanceTest(unittest.TestCase):
    def test_rfc6238_vectors(self):
        for unix_t, eight_digit in RFC_VECTORS:
            counter = unix_t // serve.TOTP_STEP
            self.assertEqual(serve._totp_at(RFC_SECRET, counter), eight_digit[-6:],
                             "RFC 6238 mismatch at T=%d" % unix_t)

    def test_secret_is_valid_base32(self):
        s = serve._totp_new_secret()
        base64.b32decode(s + "=" * (-len(s) % 8))   # must not raise
        self.assertGreaterEqual(len(s), 26)          # >=128 bits of entropy

    def test_otpauth_uri_shape(self):
        uri = serve._otpauth_uri("alice", RFC_SECRET)
        self.assertTrue(uri.startswith("otpauth://totp/"))
        self.assertIn("secret=" + RFC_SECRET, uri)
        self.assertIn("digits=6", uri)
        self.assertIn("period=30", uri)


class TotpVerificationTest(unittest.TestCase):
    NOW = 1111111111

    def code(self, drift=0):
        return serve._totp_at(RFC_SECRET, self.NOW // serve.TOTP_STEP + drift)

    def test_accepts_current_code(self):
        self.assertIsNotNone(serve._totp_check(RFC_SECRET, self.code(), -1, now=self.NOW))

    def test_accepts_adjacent_steps_for_clock_skew(self):
        for drift in (-1, 1):
            self.assertIsNotNone(serve._totp_check(RFC_SECRET, self.code(drift), -1, now=self.NOW),
                                 "drift %d should be inside the window" % drift)

    def test_rejects_outside_window(self):
        for drift in (-2, 2):
            self.assertIsNone(serve._totp_check(RFC_SECRET, self.code(drift), -1, now=self.NOW))

    def test_rejects_replay_of_used_counter(self):
        counter = serve._totp_check(RFC_SECRET, self.code(), -1, now=self.NOW)
        self.assertIsNotNone(counter)
        # same code again, now that the counter is recorded as used
        self.assertIsNone(serve._totp_check(RFC_SECRET, self.code(), counter, now=self.NOW))

    def test_rejects_wrong_and_malformed(self):
        for bad in ("000000", "", "12ab56", "1234567", "12345", None):
            self.assertIsNone(serve._totp_check(RFC_SECRET, bad, -1, now=self.NOW), repr(bad))


class BackupCodeTest(unittest.TestCase):
    def test_codes_are_hashed_not_stored_plaintext(self):
        codes, hashed = serve._new_backup_codes()
        self.assertEqual(len(codes), serve.BACKUP_CODE_COUNT)
        self.assertEqual(len(set(codes)), len(codes))       # all distinct
        for c, h in zip(codes, hashed):
            self.assertNotIn(c, h)                          # hash, not the code
            self.assertEqual(len(h), 64)                    # sha256 hex

    def test_backup_code_is_single_use(self):
        codes, hashed = serve._new_backup_codes()
        accts = {"u": {"backup": list(hashed)}}
        saved = []
        real_save = serve.save_curators
        serve.save_curators = lambda a: saved.append(1)      # don't touch disk
        try:
            self.assertTrue(serve._consume_backup_code(accts, "u", codes[0]))
            self.assertFalse(serve._consume_backup_code(accts, "u", codes[0]))  # burned
            self.assertTrue(serve._consume_backup_code(accts, "u", codes[1]))
            self.assertEqual(len(accts["u"]["backup"]), serve.BACKUP_CODE_COUNT - 2)
        finally:
            serve.save_curators = real_save

    def test_unknown_code_rejected(self):
        _codes, hashed = serve._new_backup_codes()
        accts = {"u": {"backup": list(hashed)}}
        self.assertFalse(serve._consume_backup_code(accts, "u", "not-a-real-code"))


if __name__ == "__main__":
    unittest.main()
