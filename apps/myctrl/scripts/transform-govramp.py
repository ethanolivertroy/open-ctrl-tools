#!/usr/bin/env python3
"""
Transform GovRAMP data by enriching the existing SCF-sourced govramp.json
with baseline levels (Low/Moderate), core control designation, human-readable
titles and family names from the official GovRAMP XLSX files.

Sources:
- StateRAMP-Baseline-Requirements-for-Authorized.xlsx (Low & Moderate baselines)
- GovRAMP-Core-Controls.xlsx (60 prioritized core controls)
- Existing src/data/govramp.json (SCF-sourced control catalog)

Usage:
  python scripts/transform-govramp.py
"""

import json
import re
import os
import openpyxl

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
RAW_DIR = os.path.join(SCRIPT_DIR, "data", "raw")
OUTPUT_PATH = os.path.join(PROJECT_ROOT, "src", "data", "govramp.json")

BASELINE_XLSX = os.path.join(RAW_DIR, "StateRAMP-Baseline-Requirements-for-Authorized.xlsx")
CORE_XLSX = os.path.join(RAW_DIR, "GovRAMP-Core-Controls.xlsx")

# NIST 800-53 family abbreviation -> full name
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
    "PT": "Personally Identifiable Information Processing and Transparency",
    "RA": "Risk Assessment",
    "SA": "System and Services Acquisition",
    "SC": "System and Communications Protection",
    "SI": "System and Information Integrity",
    "SR": "Supply Chain Risk Management",
}


def normalize_control_id(raw_id: str) -> str:
    """
    Normalize XLSX control IDs to match the JSON format.
    XLSX: 'AC-1', 'AC-2 (1)', 'AC-2 (7)'
    JSON: 'AC-01', 'AC-02(01)', 'AC-02(07)'
    """
    raw_id = raw_id.strip()

    # Match pattern: FAMILY-NUMBER optional (ENHANCEMENT)
    m = re.match(r'^([A-Z]{2})-(\d+)\s*(?:\((\d+)\))?$', raw_id)
    if not m:
        return raw_id

    family = m.group(1)
    number = int(m.group(2))
    enhancement = m.group(3)

    if enhancement:
        return f"{family}-{number:02d}({int(enhancement):02d})"
    else:
        return f"{family}-{number:02d}"


def parse_baseline_sheet(wb, sheet_name: str) -> dict:
    """
    Parse a baseline sheet and return a dict of control_id -> {
        title, description, discussion, parameters, requirements
    }
    """
    ws = wb[sheet_name]
    controls = {}

    for row in ws.iter_rows(min_row=3, max_row=ws.max_row, values_only=True):
        raw_id = row[4]  # Column E: ID
        if not raw_id or not str(raw_id).strip():
            continue

        ctrl_id = normalize_control_id(str(raw_id).strip())
        title = str(row[5] or "").strip()          # Column F: Control Name
        description = str(row[6] or "").strip()     # Column G: NIST Description
        discussion = str(row[7] or "").strip()      # Column H: NIST Discussion
        parameters = str(row[8] or "").strip()      # Column I: Parameters
        requirements = str(row[9] or "").strip()    # Column J: Requirements/Guidance

        controls[ctrl_id] = {
            "title": title,
            "description": description,
            "discussion": discussion if discussion and discussion != "None" else None,
            "parameters": parameters if parameters and parameters.strip() and parameters != "None" else None,
            "requirements": requirements if requirements and requirements.strip() and requirements != "None" else None,
        }

    return controls


def parse_core_controls(wb) -> set:
    """Parse core controls sheet and return set of normalized control IDs."""
    ws = wb["GovRAMP Mod Core Controls"]
    core_ids = set()

    for row in ws.iter_rows(min_row=3, max_row=ws.max_row, values_only=True):
        raw_id = row[4]  # Column E: ID
        if raw_id and str(raw_id).strip():
            core_ids.add(normalize_control_id(str(raw_id).strip()))

    return core_ids


def main():
    # Load existing govramp.json
    with open(OUTPUT_PATH, "r") as f:
        existing = json.load(f)

    print(f"Loaded {len(existing['controls'])} existing controls")

    # Parse baseline XLSX
    baseline_wb = openpyxl.load_workbook(BASELINE_XLSX)
    low_controls = parse_baseline_sheet(baseline_wb, "Low Impact_Authorized")
    mod_controls = parse_baseline_sheet(baseline_wb, "Mod Impact_Authorized")
    print(f"Parsed baselines: {len(low_controls)} Low, {len(mod_controls)} Moderate")

    # Parse core controls XLSX
    core_wb = openpyxl.load_workbook(CORE_XLSX)
    core_ids = parse_core_controls(core_wb)
    print(f"Parsed {len(core_ids)} core controls")

    # Build enriched controls
    enriched_controls = []
    matched_low = 0
    matched_mod = 0
    matched_core = 0

    for ctrl in existing["controls"]:
        ctrl_id = ctrl["control_id"]

        # Determine baselines
        is_low = ctrl_id in low_controls
        is_mod = ctrl_id in mod_controls
        if is_low:
            matched_low += 1
        if is_mod:
            matched_mod += 1

        baselines = {
            "low": {"included": is_low},
            "moderate": {"included": is_mod},
        }

        # Core control status
        is_core = ctrl_id in core_ids
        if is_core:
            matched_core += 1

        # Get best available title and description
        # Prefer moderate baseline data (more controls), fall back to low
        source = mod_controls.get(ctrl_id) or low_controls.get(ctrl_id)

        title = ctrl["title"]
        description = ctrl["description"]
        discussion = None

        if source:
            if source["title"] and source["title"] != ctrl_id:
                title = source["title"]
            if source["description"]:
                description = source["description"]
            discussion = source.get("discussion")

        enriched = {
            "control_id": ctrl_id,
            "title": title,
            "family": ctrl["family"],
            "description": description,
            "baselines": baselines,
            "core_control": is_core,
        }

        if discussion:
            enriched["discussion"] = discussion

        enriched_controls.append(enriched)

    print(f"\nMatched: {matched_low} Low, {matched_mod} Moderate, {matched_core} Core")

    # Update families with human-readable names
    families = {}
    for abbr in existing.get("families", {}):
        families[abbr] = FAMILY_NAMES.get(abbr, abbr)

    # Build output
    output = {
        "framework": {
            "id": "govramp",
            "name": "GovRAMP",
            "version": "Rev 5",
            "description": "Government Risk and Authorization Management Program - Security Baselines for State and Local Government Cloud Services"
        },
        "families": families,
        "controls": enriched_controls,
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"\nWrote {len(enriched_controls)} enriched controls to {OUTPUT_PATH}")

    # Summary stats
    low_count = sum(1 for c in enriched_controls if c["baselines"].get("low", {}).get("included", False))
    mod_count = sum(1 for c in enriched_controls if c["baselines"].get("moderate", {}).get("included", False))
    core_count = sum(1 for c in enriched_controls if c["core_control"])
    print(f"  Low baseline: {low_count} controls")
    print(f"  Moderate baseline: {mod_count} controls")
    print(f"  Core controls: {core_count} controls")


if __name__ == "__main__":
    main()
