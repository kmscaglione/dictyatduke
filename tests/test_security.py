"""Security-hardening regression tests (stdlib unittest)."""
import os
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
os.environ.setdefault("CURATOR_PASSWORD", "test-secret-pw")  # before importing serve
import serve


class SecretTest(unittest.TestCase):
    def test_no_hardcoded_password_in_source(self):
        src = (ROOT / "serve.py").read_text()
        self.assertNotIn("dicty2024curator", src)        # old plaintext gone
        self.assertNotIn("CURATOR_PASSWORD_HASH", src)   # old static-token scheme gone

    def test_password_from_env(self):
        self.assertEqual(serve.CURATOR_PASSWORD, "test-secret-pw")

    def test_sessions_are_random_not_the_password(self):
        # tokens are issued randomly, not derived from the password
        import secrets
        t1, t2 = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        self.assertNotEqual(t1, t2)
        self.assertNotIn(serve.CURATOR_PASSWORD, t1)


class RateLimitTest(unittest.TestCase):
    def test_blocks_after_limit(self):
        store = {}
        ip = "1.2.3.4"
        # first `limit` calls allowed, next blocked
        results = [serve._rate_limited(store, ip, limit=3, window=300) for _ in range(4)]
        self.assertEqual(results, [False, False, False, True])

    def test_per_ip(self):
        store = {}
        self.assertFalse(serve._rate_limited(store, "a", limit=1, window=300))
        self.assertFalse(serve._rate_limited(store, "b", limit=1, window=300))  # different ip ok
        self.assertTrue(serve._rate_limited(store, "a", limit=1, window=300))   # same ip blocked


class UploadGuardTest(unittest.TestCase):
    def test_extension_allowlist_is_restrictive(self):
        self.assertIn(".csv", serve.UPLOAD_EXTS)
        self.assertNotIn(".exe", serve.UPLOAD_EXTS)
        self.assertNotIn(".sh", serve.UPLOAD_EXTS)
        self.assertLessEqual(serve.UPLOAD_MAX_BYTES, 100 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
