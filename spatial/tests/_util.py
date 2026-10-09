import copy
import pathlib
import sys

SPATIAL = pathlib.Path(__file__).resolve().parents[1]
FIXTURES = SPATIAL / "tests" / "fixtures"
sys.path.insert(0, str(SPATIAL / "py"))

from spatialprot import bundle as B  # noqa: E402

_cache = {}


def fixture(name):
    """A fresh deep copy of a committed fixture bundle."""
    if name not in _cache:
        _cache[name] = B.load(FIXTURES / f"{name}.bundle.json")
    return copy.deepcopy(_cache[name])
