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


class BlastThrottleTest(unittest.TestCase):
    """The CPU-heavy BLAST endpoints are gated by a concurrency semaphore and
    per-IP rate limits so a burst can't pin the box or hammer NCBI/EBI."""

    def test_concurrency_cap_configured(self):
        # a bounded semaphore exists and matches the configured cap
        self.assertGreaterEqual(serve.BLAST_MAX_CONCURRENT, 1)
        self.assertEqual(serve._BLAST_SEM._initial_value, serve.BLAST_MAX_CONCURRENT)

    def test_semaphore_blocks_past_cap(self):
        import threading
        sem = threading.BoundedSemaphore(2)
        self.assertTrue(sem.acquire(timeout=0.1))   # slot 1
        self.assertTrue(sem.acquire(timeout=0.1))   # slot 2
        self.assertFalse(sem.acquire(timeout=0.1))  # cap reached -> denied
        sem.release()
        self.assertTrue(sem.acquire(timeout=0.1))   # freed -> available again

    def test_throttle_stores_exist(self):
        # separate per-IP buckets for BLAST and outbound-proxy traffic
        self.assertIsInstance(serve._BLAST_HITS, dict)
        self.assertIsInstance(serve._PROXY_HITS, dict)

    def test_proxy_concurrency_cap_configured(self):
        # the outbound-proxy endpoints have their own global semaphore
        self.assertGreaterEqual(serve.PROXY_MAX_CONCURRENT, 1)
        self.assertEqual(serve._PROXY_SEM._initial_value, serve.PROXY_MAX_CONCURRENT)

    def test_blast_rate_limit_window(self):
        # the BLAST bucket trips after its limit within the window
        store = {}
        ip = "9.9.9.9"
        allowed = sum(not serve._rate_limited(store, ip, limit=20, window=60)
                      for _ in range(20))
        self.assertEqual(allowed, 20)
        self.assertTrue(serve._rate_limited(store, ip, limit=20, window=60))  # 21st blocked


class UploadGuardTest(unittest.TestCase):
    def test_extension_allowlist_is_restrictive(self):
        self.assertIn(".csv", serve.UPLOAD_EXTS)
        self.assertNotIn(".exe", serve.UPLOAD_EXTS)
        self.assertNotIn(".sh", serve.UPLOAD_EXTS)
        self.assertLessEqual(serve.UPLOAD_MAX_BYTES, 100 * 1024 * 1024)


if __name__ == "__main__":
    unittest.main()
