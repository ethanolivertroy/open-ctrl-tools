#!/usr/bin/env python3
"""
Parse DoD Impact Level Excel file and output unified JSON with impact levels.

Usage: python scripts/parse_dod_il.py
Output: src/data/dod-srg.json
"""

import json
import re
from pathlib import Path

try:
    import pandas as pd
except ImportError:
    print("Error: pandas not installed. Run: pip install pandas openpyxl")
    exit(1)

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXCEL_FILE = PROJECT_ROOT / "rev5_ssp_addendum_controls.xlsx"
OUTPUT_FILE = PROJECT_ROOT / "src" / "data" / "dod-srg.json"

# Sheet to impact level mapping
SHEETS = {
    "IL4 Moderate": {
        "level_key": "il4_mod",
        "param_col": "M FedRAMP-Defined Assignment / Selection Parameters ",
    },
    "IL4 High": {
        "level_key": "il4_high",
        "param_col": "H FedRAMP-Defined Assignment / Selection Parameters ",
    },
    " IL5 (NSS)": {
        "level_key": "il5",
        "param_col": None,
    },
    "IL6 (NSS)": {
        "level_key": "il6",
        "param_col": None,
    },
}

# Family name mapping (same as NIST 800-53)
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
    "GRR": "DoD Governance, Risk and Resilience",
    "ACCESS CONTROL": "AC",
    "AWARENESS AND TRAINING": "AT",
    "AUDIT AND ACCOUNTABILITY": "AU",
    "ASSESSMENT, AUTHORIZATION, AND MONITORING": "CA",
    "CONFIGURATION MANAGEMENT": "CM",
    "CONTINGENCY PLANNING": "CP",
    "IDENTIFICATION AND AUTHENTICATION": "IA",
    "INCIDENT RESPONSE": "IR",
    "MAINTENANCE": "MA",
    "MEDIA PROTECTION": "MP",
    "PHYSICAL AND ENVIRONMENTAL PROTECTION": "PE",
    "PLANNING": "PL",
    "PROGRAM MANAGEMENT": "PM",
    "PERSONNEL SECURITY": "PS",
    "PII PROCESSING AND TRANSPARENCY": "PT",
    "RISK ASSESSMENT": "RA",
    "SYSTEM AND SERVICES ACQUISITION": "SA",
    "SYSTEM AND COMMUNICATIONS PROTECTION": "SC",
    "SYSTEM AND INFORMATION INTEGRITY": "SI",
    "SUPPLY CHAIN RISK MANAGEMENT": "SR",
}


def normalize_control_id(raw_id: str) -> str:
    """Normalize control ID: AC-01 -> AC-1, AC-02(01) -> AC-2(1)"""
    if not raw_id or not isinstance(raw_id, str):
        return ""

    raw_id = raw_id.strip()

    # Remove leading zeros after hyphen
    result = re.sub(r'(?<=-)(0+)(\d)', r'\2', raw_id)

    # Remove leading zeros in parentheses
    result = re.sub(r'\((0*)(\d+)\)', lambda m: f"({m.group(2)})", result)

    return result


def get_family_abbrev(family_name: str) -> str:
    """Get family abbreviation from full name."""
    if not family_name:
        return ""
    family_upper = family_name.strip().upper()
    return FAMILY_NAMES.get(family_upper, family_upper[:2])


def clean_text(text) -> str:
    """Clean and normalize text content."""
    if pd.isna(text) or text is None:
        return ""
    return str(text).strip()


def parse_related_controls(raw: str) -> list:
    """Parse related controls string into list."""
    if not raw or pd.isna(raw) or raw == "None." or raw == "None":
        return []

    controls = []
    for ctrl in str(raw).replace(".", ",").split(","):
        ctrl = ctrl.strip()
        if ctrl and ctrl != "None":
            normalized = normalize_control_id(ctrl)
            if normalized:
                controls.append(normalized)
    return controls


def parse_sheet(xlsx, sheet_name: str, config: dict) -> dict:
    """Parse a single sheet and return controls with impact level data."""
    print(f"Parsing sheet: {sheet_name}")

    df = pd.read_excel(xlsx, sheet_name=sheet_name)
    print(f"  Found {len(df)} rows")

    # Find the FedRAMP parameters column
    param_col = config.get("param_col")
    if not param_col:
        for col in df.columns:
            if "FedRAMP-Defined" in str(col) and "Parameter" in str(col):
                param_col = col
                break

    # Find DoD parameters column
    dod_param_col = None
    for col in df.columns:
        if "DoD FedRAMP+" in str(col):
            dod_param_col = col
            break

    # Find additional requirements column
    addl_req_col = None
    for col in df.columns:
        if "Additional FedRAMP" in str(col):
            addl_req_col = col
            break

    controls = {}

    for _, row in df.iterrows():
        control_id = normalize_control_id(clean_text(row.get("Control Identifier", "")))
        if not control_id:
            continue

        # Derive family from control_id prefix (e.g., "AC-2" → "AC", "GRR-1" → "GRR")
        family_match = re.match(r'([A-Z]+)-', control_id)
        family = family_match.group(1) if family_match else get_family_abbrev(clean_text(row.get("Family", "")))

        title = clean_text(row.get("Control (or Control Enhancement) Name", ""))
        description = clean_text(row.get("Control Text", ""))
        discussion = clean_text(row.get("Discussion", ""))
        related = parse_related_controls(clean_text(row.get("Related Controls", "")))

        fedramp_params = clean_text(row.get(param_col, "")) if param_col else ""
        dod_params = clean_text(row.get(dod_param_col, "")) if dod_param_col else ""
        addl_reqs = clean_text(row.get(addl_req_col, "")) if addl_req_col else ""

        # Build impact level data
        level_data = {"included": True}
        if fedramp_params:
            level_data["fedramp_parameters"] = fedramp_params
        if dod_params:
            level_data["dod_parameters"] = dod_params
        if addl_reqs:
            level_data["additional_requirements"] = addl_reqs

        controls[control_id] = {
            "control_id": control_id,
            "title": title,
            "family": family,
            "description": description,
            "discussion": discussion if discussion else None,
            "related_controls": related if related else None,
            "level_data": level_data,
        }

    print(f"  Parsed {len(controls)} controls")
    return controls


def main():
    if not EXCEL_FILE.exists():
        print(f"Error: Excel file not found: {EXCEL_FILE}")
        exit(1)

    print(f"Reading: {EXCEL_FILE}")
    xlsx = pd.ExcelFile(EXCEL_FILE)

    # Collect all controls from all sheets
    all_controls = {}  # control_id -> merged control data
    families_found = set()

    for sheet_name, config in SHEETS.items():
        if sheet_name not in xlsx.sheet_names:
            print(f"Warning: Sheet '{sheet_name}' not found, skipping")
            continue

        level_key = config["level_key"]
        sheet_controls = parse_sheet(xlsx, sheet_name, config)

        for control_id, data in sheet_controls.items():
            families_found.add(data["family"])

            if control_id not in all_controls:
                # First time seeing this control
                all_controls[control_id] = {
                    "control_id": control_id,
                    "title": data["title"],
                    "family": data["family"],
                    "description": data["description"],
                    "discussion": data["discussion"],
                    "related_controls": data["related_controls"],
                    "impact_levels": {},
                }

            # Add this impact level's data
            all_controls[control_id]["impact_levels"][level_key] = data["level_data"]

            # Update base control info if we have better data
            if data["description"] and not all_controls[control_id]["description"]:
                all_controls[control_id]["description"] = data["description"]
            if data["title"] and not all_controls[control_id]["title"]:
                all_controls[control_id]["title"] = data["title"]

    # Convert to list and sort
    controls_list = list(all_controls.values())

    # Natural sort by control_id
    def control_sort_key(c):
        cid = c["control_id"]
        match = re.match(r'([A-Z]+)-(\d+)(?:\((\d+)\))?', cid)
        if match:
            family, num, enh = match.groups()
            return (family, int(num), int(enh) if enh else 0)
        return (cid, 0, 0)

    controls_list.sort(key=control_sort_key)

    # Clean up None values
    for control in controls_list:
        if control["discussion"] is None:
            del control["discussion"]
        if control["related_controls"] is None:
            del control["related_controls"]

    # Build families dict
    families = {}
    for fam in sorted(families_found):
        if fam in FAMILY_NAMES:
            families[fam] = FAMILY_NAMES[fam]
        else:
            families[fam] = fam

    # Build output
    output = {
        "framework": {
            "id": "dod-srg",
            "name": "DoD SRG",
            "version": "Rev 5",
            "description": "DoD Cloud Computing Security Requirements Guide - FedRAMP+ controls by Impact Level",
        },
        "families": families,
        "controls": controls_list,
    }

    # Write output
    with open(OUTPUT_FILE, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote: {OUTPUT_FILE}")
    print(f"Total controls: {len(controls_list)}")
    print(f"Families: {len(families)}")

    # Print stats per impact level
    for level_key in ["il4_mod", "il4_high", "il5", "il6"]:
        count = sum(1 for c in controls_list if level_key in c["impact_levels"])
        print(f"  {level_key}: {count} controls")

    print("\nDone!")


if __name__ == "__main__":
    main()
