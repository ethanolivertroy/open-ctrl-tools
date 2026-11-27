"""Bidirectional crosswalk builders and writer.

Consolidates the ``defaultdict(list)`` forward/reverse mapping pattern that
was duplicated across generate_crosswalk.py, generate_pci_crosswalk.py,
generate_soc2_crosswalk.py, and parse_nist_iso_crosswalk.py.
"""

from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Iterable

from .io import save_json

Mapping = dict[str, list[str]]


def build_bidirectional(pairs: Iterable[tuple[str, str]]) -> tuple[Mapping, Mapping]:
    """Build deduplicated forward and reverse mappings from (a, b) pairs."""
    fwd: dict[str, list[str]] = defaultdict(list)
    rev: dict[str, list[str]] = defaultdict(list)
    for a, b in pairs:
        if b not in fwd[a]:
            fwd[a].append(b)
        if a not in rev[b]:
            rev[b].append(a)
    return dict(fwd), dict(rev)


def build_reverse(forward: Mapping) -> Mapping:
    """Build the reverse of a forward mapping, deduplicating targets."""
    rev: dict[str, list[str]] = defaultdict(list)
    for src, targets in forward.items():
        for target in targets:
            if src not in rev[target]:
                rev[target].append(src)
    return dict(rev)


def sort_values(
    mapping: Mapping, key: Callable[[str], Any] | None = None
) -> Mapping:
    """Sort each value list, preserving the mapping's key order."""
    return {k: sorted(v, key=key) for k, v in mapping.items()}


def sort_mapping(
    mapping: Mapping, value_key: Callable[[str], Any] | None = None
) -> Mapping:
    """Sort both the keys and each value list of a mapping."""
    return {k: sorted(mapping[k], key=value_key) for k in sorted(mapping)}


def total_mappings(forward: Mapping) -> int:
    """Total number of (a, b) links in a forward mapping."""
    return sum(len(v) for v in forward.values())


def write_crosswalk(
    path: str | Path,
    metadata: dict,
    mappings: dict[str, Any],
    *,
    indent: int = 2,
    ensure_ascii: bool = True,
) -> Path:
    """Write a crosswalk JSON of the form {"metadata": ..., **mappings}."""
    return save_json(
        path,
        {"metadata": metadata, **mappings},
        indent=indent,
        ensure_ascii=ensure_ascii,
    )
