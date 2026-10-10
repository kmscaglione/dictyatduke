"""Run the browser test page in headless Chrome when one is installed.

No test framework or driver is involved: Chrome loads tests/js/test.html from
a local server and prints the finished page, and this test reads the verdict.
Skipped where no Chrome or Chromium binary is found.
"""
import functools
import html
import http.server
import os
import re
import shutil
import subprocess
import tempfile
import threading
import time
import unittest

from _util import SPATIAL

CANDIDATES = ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser",
              "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "/Applications/Chromium.app/Contents/MacOS/Chromium"]


def find_chrome():
    override = os.environ.get("CHROME_BIN")
    for c in ([override] if override else []) + CANDIDATES:
        path = c if os.path.isabs(c) and os.path.exists(c) else shutil.which(c)
        if path:
            return path
    return None


class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def dump_dom(chrome, url, budget_ms=20000, timeout=90):
    """The page's DOM after its scripts have run. Chrome can linger after
    printing, so the output is read from a file and the process is stopped."""
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "dom.html")
        with open(out, "wb") as fh:
            proc = subprocess.Popen(
                [chrome, "--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
                 "--disable-extensions", f"--user-data-dir={tmp}/profile",
                 f"--virtual-time-budget={budget_ms}", "--dump-dom", url],
                stdout=fh, stderr=subprocess.DEVNULL)
            deadline = time.monotonic() + timeout
            try:
                while proc.poll() is None and time.monotonic() < deadline:
                    time.sleep(0.25)
                    with open(out, "rb") as peek:
                        if b"</html>" in peek.read():
                            break
            finally:
                if proc.poll() is None:
                    proc.kill()
                    proc.wait()
        with open(out, encoding="utf-8", errors="replace") as fh:
            return fh.read()


@unittest.skipUnless(find_chrome(), "no Chrome or Chromium binary found")
class BrowserTest(unittest.TestCase):
    def test_browser_suite_passes(self):
        handler = functools.partial(Quiet, directory=str(SPATIAL))
        srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=srv.serve_forever, daemon=True).start()
        try:
            dom = dump_dom(find_chrome(), f"http://127.0.0.1:{srv.server_address[1]}/tests/js/test.html")
        finally:
            srv.shutdown()
            srv.server_close()
        m = re.search(r'id="summary"[^>]*>([^<]*)', dom)
        self.assertIsNotNone(m, "test page did not render")
        fails = [html.unescape(x) for x in re.findall(r"<li>(FAIL[^<]*)</li>", dom)]
        self.assertEqual(fails, [])
        self.assertRegex(m.group(1), r"^PASSED: (\d+) of \1 tests passed$")
        self.assertGreaterEqual(int(re.search(r"\d+", m.group(1)).group()), 20)


if __name__ == "__main__":
    unittest.main()
