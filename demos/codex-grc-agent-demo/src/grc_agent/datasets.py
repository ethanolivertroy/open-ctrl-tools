from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from .models import PoamEntry


REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data"

DEFAULT_ORIGINATION_HINTS: dict[str, str] = {
    "AC-2": "shared",
    "IA-5": "service_provider",
    "AU-6": "shared",
    "CM-6": "service_provider",
}


def _load_json(filename: str) -> dict[str, Any]:
    return json.loads((DATA_DIR / filename).read_text())


@lru_cache(maxsize=1)
def _baseline_catalog() -> dict[str, Any]:
    return _load_json("fedramp-baselines.json")


@lru_cache(maxsize=1)
def _control_catalog() -> dict[str, Any]:
    return _load_json("nist-800-53-r5.json")


def _resolve_baseline_key(baseline: str) -> str:
    for key in _baseline_catalog():
        if key.lower() == baseline.lower():
            return key
    raise KeyError(f"Unknown baseline: {baseline}")


def get_baseline_controls(baseline: str) -> list[str]:
    key = _resolve_baseline_key(baseline)
    return list(_baseline_catalog()[key]["controls"])


def get_control_metadata(control_id: str) -> dict[str, Any]:
    catalog = _control_catalog()
    if control_id not in catalog:
        raise KeyError(f"Unknown control id: {control_id}")
    return dict(catalog[control_id])


def get_shared_responsibility_hint(control_id: str) -> str:
    return DEFAULT_ORIGINATION_HINTS.get(control_id, "shared")


def format_poam_entry(
    control_id: str,
    weakness_description: str,
    remediation_plan: str,
    scheduled_completion_date: str,
    source: str = "assessment",
) -> PoamEntry:
    return PoamEntry(
        control_id=control_id,
        weakness_description=weakness_description,
        remediation_plan=remediation_plan,
        scheduled_completion_date=scheduled_completion_date,
        source=source,
    )

