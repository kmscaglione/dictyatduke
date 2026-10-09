#!/usr/bin/env python3
"""Serve the spatial/ directory on localhost so the standalone demo and the
browser tests can run without any host site.

    python3 spatial/demo/serve_demo.py [port]
    open http://127.0.0.1:8791/demo/            (demo)
    open http://127.0.0.1:8791/tests/js/test.html   (browser tests)
"""
import functools
import http.server
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]


class Handler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # the same restrictions a strict host would impose: no inline script,
        # no third-party origins
        self.send_header("Content-Security-Policy",
                         "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; object-src 'none'")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8791
    handler = functools.partial(Handler, directory=str(ROOT))
    with http.server.ThreadingHTTPServer(("127.0.0.1", port), handler) as srv:
        print(f"serving {ROOT} at http://127.0.0.1:{port}/demo/")
        srv.serve_forever()
