"""Canonical filesystem locations for the data pipeline.

Replaces the ``Path(__file__).parent.parent`` math previously repeated in
every script under scripts/.
"""

from pathlib import Path

# scripts/lib/paths.py -> scripts/lib -> scripts -> repo root
REPO_ROOT = Path(__file__).resolve().parent.parent.parent

# Generated framework/crosswalk JSON consumed by the Astro site.
DATA_DIR = REPO_ROOT / "src" / "data"

# Raw upstream inputs (Excel/CSV downloads). Mostly gitignored; see MANIFEST.md.
RAW_DIR = REPO_ROOT / "scripts" / "data" / "raw"

RAW_MANIFEST = RAW_DIR / "MANIFEST.md"


def require_raw_input(filename: str) -> Path:
    """Return the path to a raw input file, or raise a helpful error.

    Raw inputs (e.g. *.xlsx) are gitignored and may be absent on a fresh
    checkout. Raise FileNotFoundError pointing at the manifest instead of
    letting pandas/openpyxl fail with an opaque error.
    """
    path = RAW_DIR / filename
    if not path.exists():
        raise FileNotFoundError(
            f"Raw input file not found: {path}\n"
            f"Raw inputs are not committed to git. See {RAW_MANIFEST} "
            f"for where to download '{filename}'."
        )
    return path
