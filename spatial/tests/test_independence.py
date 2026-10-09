"""The reusable module must not know about any host site or organism."""
import ast
import pathlib
import re
import subprocess
import sys
import unittest

from _util import B, SPATIAL

REUSABLE = ["py", "js", "schema", "demo", "tests"]
TEXT = {".py", ".js", ".json", ".css", ".html", ".md"}
# assembled from fragments so this file does not match itself
FORBIDDEN = re.compile("|".join([
    "ddb" + r"[_0-9]", "dict" + "y", "discoid" + "eum", "amoeb" + "ozoa", "tink" + "er",
    "wide" + "man", r"\bXP_" + r"\d", "ref" + "seq", "serve" + r"\.py", "/a" + "pi/",
]), re.I)
STDLIB_OK = set(sys.stdlib_module_names) | {"numpy", "spatialprot", "_util"}


def reusable_files():
    for top in REUSABLE:
        for p in sorted((SPATIAL / top).rglob("*")):
            if p.is_file() and p.suffix in TEXT and "__pycache__" not in p.parts:
                yield p


class IndependenceTest(unittest.TestCase):
    def test_no_host_or_organism_specifics_in_reusable_code(self):
        hits = []
        for p in reusable_files():
            for n, line in enumerate(p.read_text(encoding="utf-8").splitlines(), 1):
                if FORBIDDEN.search(line):
                    hits.append(f"{p.relative_to(SPATIAL)}:{n}: {line.strip()[:80]}")
        self.assertEqual(hits, [])

    def test_python_imports_only_stdlib_numpy_and_itself(self):
        bad = []
        for p in reusable_files():
            if p.suffix != ".py":
                continue
            for node in ast.walk(ast.parse(p.read_text(encoding="utf-8"))):
                names = []
                if isinstance(node, ast.Import):
                    names = [a.name for a in node.names]
                elif isinstance(node, ast.ImportFrom) and node.level == 0:
                    names = [node.module]
                bad += [f"{p.name}: {n}" for n in names if n.split(".")[0] not in STDLIB_OK]
        self.assertEqual(bad, [])

    def test_numpy_stays_out_of_the_runtime_core(self):
        core = SPATIAL / "py" / "spatialprot"
        for name in ("__init__", "bundle", "validate", "summary", "jsonschema_lite"):
            self.assertNotIn("numpy", (core / f"{name}.py").read_text(), name)

    def test_javascript_is_dependency_free_and_csp_safe(self):
        for p in sorted((SPATIAL / "js").glob("*.js")):
            src = p.read_text(encoding="utf-8")
            for banned in (r"\beval\(", r"new Function", r"\bimport\s", r"\brequire\(", r"https?://(?!www\.w3\.org)",
                           r"\son[a-z]+=\"", r"document\.write", r"localStorage"):
                self.assertIsNone(re.search(banned, src), f"{p.name}: {banned}")
        for p in list((SPATIAL / "demo").glob("*.html")) + list((SPATIAL / "tests" / "js").glob("*.html")):
            html = p.read_text(encoding="utf-8")
            self.assertIsNone(re.search(r"<script(?![^>]*\bsrc=)", html), f"{p.name}: inline script")
            self.assertIsNone(re.search(r"https?://", html), f"{p.name}: external resource")


class DistributionGuardTest(unittest.TestCase):
    """No bundle that is not cleared for distribution may be tracked by git."""

    def test_tracked_bundles_are_public(self):
        try:
            out = subprocess.run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"],
                                 cwd=SPATIAL.parent, capture_output=True, check=True).stdout.decode()
        except (OSError, subprocess.CalledProcessError):
            self.skipTest("not a git checkout")
        from spatialprot import validate as V
        checked = 0
        for rel in out.split("\0"):
            if rel.endswith(".bundle.json"):
                b = B.load(SPATIAL.parent / rel)
                self.assertEqual(V.errors(V.validate(b, require_public=True)), [], rel)
                checked += 1
        self.assertGreaterEqual(checked, 4)


if __name__ == "__main__":
    unittest.main()
