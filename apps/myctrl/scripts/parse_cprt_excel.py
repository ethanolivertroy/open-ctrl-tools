#!/usr/bin/env python3
"""
Parse NIST CPRT Excel file and output JSON for the app.

Usage: python scripts/parse_cprt_excel.py
Output: src/data/nist-800-53-r5.json
"""

import json
import re
from pathlib import Path

try:
    from openpyxl import load_workbook
except ImportError:
    print("Error: openpyxl not installed. Run: pip install openpyxl")
    exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXCEL_FILE = SCRIPT_DIR / "data" / "raw" / "nist-official" / "cprt_SP_800_53_5_2_0_01-03-2026.xlsx"
OUTPUT_FILE = PROJECT_ROOT / "src" / "data" / "nist-800-53-r5.json"

# Family name mapping
FAMILY_NAMES = {
    "AC": "Access Control",
    "AT": "Awareness and Training",
    "AU": "Audit and Accountability",
    "CA": "Assessment, Authorization, and Monitoring",
    "CM": "Configuration Management",
    "CP": "Contingency Planning",
    "IA": "Identification and Authentication",
    "IR": "Incident Response",
    "MA": "Maintenance",
    "MP": "Media Protection",
    "PE": "Physical and Environmental Protection",
    "PL": "Planning",
    "PM": "Program Management",
    "PS": "Personnel Security",
    "PT": "PII Processing and Transparency",
    "RA": "Risk Assessment",
    "SA": "System and Services Acquisition",
    "SC": "System and Communications Protection",
    "SI": "System and Information Integrity",
    "SR": "Supply Chain Risk Management",
}


def normalize_control_id(raw_id: str) -> str:
    """
    Normalize control ID from Excel format to app format.
    AC-01 -> AC-1
    AC-02(01) -> AC-2(1)
    """
    if not raw_id:
        return ""

    # Pattern: XX-NN or XX-NN(MM)
    # Remove leading zeros from numbers
    def remove_leading_zeros(match):
        return match.group(0).lstrip('0') or '0'

    # First handle the main control number (after the hyphen)
    result = re.sub(r'(?<=-)(0+)(\d)', r'\2', raw_id)

    # Then handle enhancement numbers in parentheses
    result = re.sub(r'\((0*)(\d+)\)', lambda m: f"({m.group(2)})", result)

    return result


def parse_related_controls(raw: str) -> list[str]:
    """Parse comma-separated related controls and normalize IDs."""
    if not raw or not isinstance(raw, str):
        return []

    controls = []
    for ctrl in raw.split(","):
        ctrl = ctrl.strip()
        if ctrl:
            # Normalize each related control ID
            normalized = normalize_control_id(ctrl)
            if normalized:
                controls.append(normalized)
    return controls


def is_enhancement(control_id: str) -> bool:
    """Check if control ID is an enhancement (has parenthetical number)."""
    return "(" in control_id and ")" in control_id


def get_parent_control(control_id: str) -> str:
    """Get parent control ID from enhancement ID."""
    # AC-2(1) -> AC-2
    match = re.match(r'^([A-Z]+-\d+)', control_id)
    return match.group(1) if match else ""


def get_family_from_id(control_id: str) -> str:
    """Extract family abbreviation from control ID."""
    # AC-2 -> AC, AC-2(1) -> AC
    match = re.match(r'^([A-Z]+)-', control_id)
    return match.group(1) if match else ""


def main():
    print(f"Loading Excel file: {EXCEL_FILE}")

    if not EXCEL_FILE.exists():
        print(f"Error: Excel file not found at {EXCEL_FILE}")
        exit(1)

    wb = load_workbook(EXCEL_FILE, read_only=True, data_only=True)
    sheet = wb.active

    controls = []
    enhancements_map = {}  # parent_id -> [enhancement_ids]

    # Skip header row
    rows = list(sheet.iter_rows(min_row=2, values_only=True))
    print(f"Processing {len(rows)} rows...")

    for row in rows:
        if not row or not row[1]:  # Skip empty rows
            continue

        # Excel columns (0-indexed):
        # 0: Control Family
        # 1: Control Identifier
        # 2: Control Name
        # 3: Control Statement
        # 4: Discussion
        # 5: Related Controls
        # 6: Privacy Baseline
        # 7: Security Baseline - Low
        # 8: Security Baseline - Moderate
        # 9: Security Baseline - High
        # 10: Reference

        raw_id = str(row[1] or "").strip()
        title = str(row[2] or "").strip()
        description = str(row[3] or "").strip()
        discussion = str(row[4] or "").strip()
        related_raw = str(row[5] or "").strip()
        privacy = str(row[6] or "").strip().lower() == "x"
        low = str(row[7] or "").strip().lower() == "x"
        moderate = str(row[8] or "").strip().lower() == "x"
        high = str(row[9] or "").strip().lower() == "x"

        control_id = normalize_control_id(raw_id)

        if not control_id:
            continue

        # Derive family from control ID (more reliable than Excel column with merged cells)
        family = get_family_from_id(control_id)

        # Track enhancements for parent controls
        if is_enhancement(control_id):
            parent = get_parent_control(control_id)
            if parent not in enhancements_map:
                enhancements_map[parent] = []
            enhancements_map[parent].append(control_id)

        control = {
            "control_id": control_id,
            "title": title.title() if title.isupper() else title,  # Convert ALL CAPS to Title Case
            "family": family,
            "description": description,
            "supplemental_guidance": discussion if discussion else None,
            "baseline_low": low,
            "baseline_moderate": moderate,
            "baseline_high": high,
            "baseline_privacy": privacy,
            "related_controls": parse_related_controls(related_raw),
            "enhancements": [],  # Will be populated after
        }

        controls.append(control)

    # Add enhancement lists to parent controls
    for control in controls:
        cid = control["control_id"]
        if cid in enhancements_map:
            control["enhancements"] = sorted(enhancements_map[cid])

    # Sort controls by family and ID
    def sort_key(c):
        # Extract family and number for sorting
        match = re.match(r'^([A-Z]+)-(\d+)(?:\((\d+)\))?$', c["control_id"])
        if match:
            family = match.group(1)
            num = int(match.group(2))
            enhancement = int(match.group(3)) if match.group(3) else 0
            return (family, num, enhancement)
        return (c["control_id"], 0, 0)

    controls.sort(key=sort_key)

    # Build output
    output = {
        "framework": {
            "id": "nist-800-53-r5",
            "name": "NIST SP 800-53",
            "version": "5.2.0",
            "description": "Security and Privacy Controls for Information Systems and Organizations"
        },
        "families": FAMILY_NAMES,
        "controls": controls
    }

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    # Stats
    base_controls = sum(1 for c in controls if not is_enhancement(c["control_id"]))
    enhancements = sum(1 for c in controls if is_enhancement(c["control_id"]))
    low_count = sum(1 for c in controls if c["baseline_low"])
    moderate_count = sum(1 for c in controls if c["baseline_moderate"])
    high_count = sum(1 for c in controls if c["baseline_high"])
    privacy_count = sum(1 for c in controls if c["baseline_privacy"])

    print(f"\nOutput written to: {OUTPUT_FILE}")
    print(f"\nStatistics:")
    print(f"  Total controls: {len(controls)}")
    print(f"  Base controls: {base_controls}")
    print(f"  Enhancements: {enhancements}")
    print(f"  Low baseline: {low_count}")
    print(f"  Moderate baseline: {moderate_count}")
    print(f"  High baseline: {high_count}")
    print(f"  Privacy baseline: {privacy_count}")


if __name__ == "__main__":
    main()
