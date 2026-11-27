#!/usr/bin/env python3
"""Audit framework JSON files for completeness and obvious data quality issues."""

from __future__ import annotations

import json
import re
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = ROOT / "src" / "data"
REPORT_DIR = ROOT / "reports"

PLACEHOLDER_PATTERNS = re.compile(
    r"\b(coming soon|todo|tbd|placeholder|to be added|under construction)\b",
    re.IGNORECASE,
)

KNOWN_CURRENT_VERSIONS = {
    "au-ism": {
        "version": "December 2025",
        "source": "https://www.cyber.gov.au/ism",
    },
    "fedramp-20x-ksi": {
        "version": "0.9.43-beta",
        "source": "https://github.com/FedRAMP/docs/blob/main/FRMR.documentation.json",
    },
    "nist-800-53-r5": {
        "version": "5.2.0",
        "source": "https://csrc.nist.gov/news/2025/nist-releases-revision-to-sp-800-53-controls",
    },
}


def is_framework_file(path: Path) -> bool:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return False
    return isinstance(data, dict) and isinstance(data.get("framework"), dict) and isinstance(data.get("controls"), list)


def text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    return str(value).strip()


def audit_file(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8"))
    framework = data.get("framework", {})
    families = data.get("families", {})
    controls = data.get("controls", [])

    issues: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []

    def issue(code: str, message: str, control_id: str = "") -> None:
        issues.append({"code": code, "message": message, "control_id": control_id})

    def warn(code: str, message: str, control_id: str = "") -> None:
        warnings.append({"code": code, "message": message, "control_id": control_id})

    for key in ("id", "name", "version", "description"):
        value = text(framework.get(key))
        if not value:
            issue("framework_missing_field", f"Missing framework.{key}")
        elif PLACEHOLDER_PATTERNS.search(value):
            issue("framework_placeholder", f"Placeholder-like framework.{key}: {value}")

    framework_id = text(framework.get("id")) or path.stem
    current_version = KNOWN_CURRENT_VERSIONS.get(framework_id)
    if current_version:
        version = text(framework.get("version"))
        expected = current_version["version"]
        if version != expected:
            note = f" {current_version.get('note', '')}".rstrip()
            issue(
                "framework_version_stale",
                f"framework.version is {version!r}; expected {expected!r} per {current_version['source']}.{note}",
            )

    if not isinstance(families, dict) or not families:
        warn("families_missing", "No families dictionary")
    else:
        for family_id, family_name in families.items():
            if PLACEHOLDER_PATTERNS.search(text(family_id)) or PLACEHOLDER_PATTERNS.search(text(family_name)):
                issue("family_placeholder", f"Placeholder family: {family_id} -> {family_name}")

    if not controls:
        issue("controls_empty", "No controls")

    ids = [text(control.get("control_id")) for control in controls if isinstance(control, dict)]
    duplicate_ids = sorted(control_id for control_id, count in Counter(ids).items() if control_id and count > 1)
    for control_id in duplicate_ids:
        issue("duplicate_control_id", f"Duplicate control_id {control_id}", control_id)

    family_counts: Counter[str] = Counter()
    title_lengths: list[int] = []
    description_lengths: list[int] = []
    missing_by_field: Counter[str] = Counter()

    for index, control in enumerate(controls):
        if not isinstance(control, dict):
            issue("control_invalid", f"Control at index {index} is not an object")
            continue

        control_id = text(control.get("control_id")) or f"index:{index}"
        for field in ("control_id", "title", "family", "description"):
            value = text(control.get(field))
            if not value:
                issue("control_missing_field", f"Missing {field}", control_id)
                missing_by_field[field] += 1
            elif PLACEHOLDER_PATTERNS.search(value):
                issue("control_placeholder", f"Placeholder-like {field}: {value}", control_id)

        family = text(control.get("family"))
        if family:
            family_counts[family] += 1
            if families and family not in families:
                warn("family_not_declared", f"Family {family} not declared in families dictionary", control_id)

        title_len = len(text(control.get("title")))
        desc_len = len(text(control.get("description")))
        if title_len:
            title_lengths.append(title_len)
        if desc_len:
            description_lengths.append(desc_len)
        if title_len and title_len < 3:
            warn("title_very_short", f"Very short title: {control.get('title')!r}", control_id)
        if desc_len and desc_len < 20:
            warn("description_very_short", f"Very short description ({desc_len} chars)", control_id)

    undeclared_families = sorted(set(family_counts) - set(families))
    unused_families = sorted(set(families) - set(family_counts))
    for family in unused_families:
        warn("family_unused", f"Declared family {family} has no controls")

    return {
        "file": str(path.relative_to(ROOT)),
        "framework_id": framework_id,
        "name": text(framework.get("name")),
        "version": text(framework.get("version")),
        "control_count": len(controls),
        "family_count": len(families) if isinstance(families, dict) else 0,
        "undeclared_families": undeclared_families,
        "unused_families": unused_families,
        "missing_by_field": dict(missing_by_field),
        "min_title_length": min(title_lengths) if title_lengths else 0,
        "min_description_length": min(description_lengths) if description_lengths else 0,
        "issues": issues,
        "warnings": warnings,
    }


def render_markdown(results: list[dict[str, Any]]) -> str:
    total_controls = sum(result["control_count"] for result in results)
    total_issues = sum(len(result["issues"]) for result in results)
    total_warnings = sum(len(result["warnings"]) for result in results)
    lines = [
        "# Framework Data Audit",
        "",
        f"- Framework files audited: {len(results)}",
        f"- Controls audited: {total_controls:,}",
        f"- Issues: {total_issues:,}",
        f"- Warnings: {total_warnings:,}",
        "",
        "## Framework Summary",
        "",
        "| Framework | Version | Controls | Issues | Warnings |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for result in sorted(results, key=lambda item: (len(item["issues"]) == 0, -len(item["issues"]), item["framework_id"])):
        lines.append(
            f"| `{result['framework_id']}` | {result['version'] or '-'} | "
            f"{result['control_count']:,} | {len(result['issues'])} | {len(result['warnings'])} |"
        )

    flagged = [result for result in results if result["issues"] or result["warnings"]]
    if flagged:
        lines.extend(["", "## Findings", ""])
        for result in flagged:
            lines.append(f"### `{result['framework_id']}`")
            lines.append(f"- File: `{result['file']}`")
            if result["issues"]:
                lines.append("- Issues:")
                for item in result["issues"][:30]:
                    suffix = f" (`{item['control_id']}`)" if item.get("control_id") else ""
                    lines.append(f"  - `{item['code']}`{suffix}: {item['message']}")
                if len(result["issues"]) > 30:
                    lines.append(f"  - ... {len(result['issues']) - 30} more")
            if result["warnings"]:
                lines.append("- Warnings:")
                grouped = defaultdict(int)
                examples: dict[str, str] = {}
                for item in result["warnings"]:
                    grouped[item["code"]] += 1
                    examples.setdefault(item["code"], item["message"])
                for code, count in sorted(grouped.items()):
                    lines.append(f"  - `{code}`: {count} ({examples[code]})")
            lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main() -> int:
    framework_files = sorted(path for path in DATA_DIR.glob("*.json") if is_framework_file(path))
    results = [audit_file(path) for path in framework_files]

    REPORT_DIR.mkdir(exist_ok=True)
    (REPORT_DIR / "framework-data-audit.json").write_text(
        json.dumps(results, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    (REPORT_DIR / "framework-data-audit.md").write_text(render_markdown(results), encoding="utf-8")

    issue_count = sum(len(result["issues"]) for result in results)
    warning_count = sum(len(result["warnings"]) for result in results)
    print(f"Audited {len(results)} framework files with {issue_count} issues and {warning_count} warnings.")
    print(f"Wrote {REPORT_DIR / 'framework-data-audit.md'}")
    return 1 if issue_count else 0


if __name__ == "__main__":
    raise SystemExit(main())
