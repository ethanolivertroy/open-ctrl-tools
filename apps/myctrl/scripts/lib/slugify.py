"""Slug helpers.

Two deliberately distinct variants exist and both are preserved:

* ``slugify_control_id`` - the Python port of the TypeScript ``slugify`` in
  ``src/data/controls.ts`` (previously duplicated in validate_mappings.py).
  It understands control-ID conventions: ``AC-2(1)`` -> ``ac-2-1``, dots
  become dashes, and leading zeros after a dash are stripped
  (``AC-02`` -> ``ac-2``). Use this whenever a slug must match the site's
  generated control URLs.

* ``slugify_text`` - a generic free-text slug (previously duplicated in
  extract_strm_frameworks.py). It lowercases, drops punctuation, and turns
  whitespace runs into single dashes. It does NOT expand ``(1)`` enhancement
  syntax or strip leading zeros, so it is not URL-compatible with the site's
  control slugs.
"""

import re


def slugify_control_id(control_id: str) -> str:
    """Slugify a control ID exactly like ``slugify`` in src/data/controls.ts."""
    s = control_id.lower()
    s = re.sub(r"\((\d+)\)", r"-\1", s)
    s = re.sub(r"\.", "-", s)
    s = re.sub(r"[^a-z0-9-]", "-", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"^-|-$", "", s)
    s = re.sub(r"-0+(\d)", r"-\1", s)
    return s


def slugify_text(text: str) -> str:
    """Convert free text to a URL-safe slug (lowercase, dash-separated)."""
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s]+", "-", text)
    return text.strip("-")
