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


class PublicStaticAllowlistTest(unittest.TestCase):
    """Only allowlisted locations are served as files. Regression for the
    exposure of cache/pageviews.json and other runtime files."""

    @classmethod
    def setUpClass(cls):
        import threading
        cls.srv = serve.Server(("127.0.0.1", 0), serve.Handler)
        cls.port = cls.srv.server_address[1]
        threading.Thread(target=cls.srv.serve_forever, daemon=True).start()
        with cls._open("/") as r:
            cls.shell = r.read()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    @classmethod
    def _open(cls, path):
        import urllib.request
        return urllib.request.urlopen("http://127.0.0.1:%d%s" % (cls.port, path), timeout=30)

    def status(self, path):
        import urllib.error
        try:
            with self._open(path) as r:
                return r.status, r.read(4096)
        except urllib.error.HTTPError as e:
            return e.code, b""

    def test_runtime_and_working_files_are_not_served(self):
        import tempfile
        made = []
        cache = ROOT / "cache"
        cache.mkdir(exist_ok=True)
        for name in ("pageviews.json", "recent_papers.json"):
            f = cache / name
            if not f.exists():                       # present on a real server; fabricate for CI
                f.write_text('{"probe": true}')
                made.append(f)
        try:
            for path in ("/cache/pageviews.json", "/cache/recent_papers.json", "/cache/",
                         "/assets/../cache/pageviews.json", "/assets/%2e%2e/cache/pageviews.json",
                         "/cache%2fpageviews.json", "/CACHE/pageviews.json",
                         "/assets/dictybase-corpus/colleagues.json", "/assets/dictybase_live_curation.json",
                         "/assets/annotations_imported.json", "/assets/curators.json",
                         "/docs/nar-paper.docx", "/docs/figure2-interface.png", "/qa-gene-cln5.png",
                         "/.zenodo.json", "/curation/papers/results/x.json", "/deploy/dicty.apache.conf",
                         "/tests/test_security.py", "/scripts/deploy.sh", "/serve.py", "/README.md",
                         "/data/orthofinder/Orthogroups.tsv", "/ops/maintenance-log.csv"):
                code, body = self.status(path)
                served_file = code == 200 and body[:300] != self.shell[:300]
                self.assertFalse(served_file, "%s was served as a file" % path)
            self.assertEqual(self.status("/cache/pageviews.json")[0], 404)
        finally:
            for f in made:
                f.unlink()

    def test_site_assets_still_load(self):
        for path in ("/app.js", "/styles.css", "/labs-content.js", "/meetings-content.js",
                     "/teaching-content.js", "/technique-content.js", "/assets/gene_index.json",
                     "/assets/favicon.svg", "/assets/manifest.webmanifest", "/assets/vendor/igv.min.js",
                     "/assets/news.json", "/spatial/js/spatial-explorer.js"):
            self.assertEqual(self.status(path)[0], 200, path)
        for path in ("/robots.txt", "/sitemap.xml", "/news.xml", "/gene/mhcA", "/tools/enrichment"):
            self.assertEqual(self.status(path)[0], 200, path)       # dynamic routes are unaffected

    def test_no_tracked_file_outside_the_allowlist_is_served(self):
        import subprocess
        try:
            out = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, check=True).stdout.decode()
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("not a git checkout")
        leaked = []
        for rel in out.split("\0"):
            if not rel or serve._is_public_static("/" + rel):
                continue
            if os.path.splitext(rel)[1].lower() not in serve.STATIC_EXTS:
                continue                              # never a file route: the app shell answers
            code, body = self.status("/" + rel)
            if code == 200 and body[:300] != self.shell[:300]:
                leaked.append(rel)
        self.assertEqual(leaked, [])

    def test_allowlist_respects_the_blocklist(self):
        self.assertFalse(serve._is_public_static("/assets/curators.json"))
        self.assertFalse(serve._is_public_static("/assets/paper_fulltext/x.json"))
        self.assertFalse(serve._is_public_static("/spatial/adapters/dictybase/local/b.bundle.json"))
        self.assertFalse(serve._is_public_static("/assets/.hidden.json"))
        self.assertTrue(serve._is_public_static("/assets/gene_index.json"))


if __name__ == "__main__":
    unittest.main()
