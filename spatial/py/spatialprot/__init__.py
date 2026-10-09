"""spatialprot: organism-independent tools for spatial proteomics bundles.

The core (bundle, validate, summary) is stdlib only. `analysis` needs NumPy and
is meant for offline builds, never for a web server's request path.
"""

__version__ = "0.1.0"
SCHEMA_NAME = "spatial-proteomics-bundle"
SCHEMA_VERSION = "1.0.0"

EVIDENCE_TYPES = (
    "measured_profile",          # fraction abundance profiles (the experiment)
    "computational_assignment",  # a classifier or clustering run on measured profiles
    "sequence_prediction",       # predicted from sequence alone
    "curated_annotation",        # asserted by a curator or by the authors as reference
)
