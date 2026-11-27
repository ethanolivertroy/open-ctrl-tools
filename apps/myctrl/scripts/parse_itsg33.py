#!/usr/bin/env python3
"""
Parse ITSG-33 Annex 4A Excel file and generate JSON data.

Source: scripts/itsg33-ann4a-eng.xls (official CSE spreadsheet)
Output: src/data/itsg-33.json
"""

import json
import re
import pandas as pd
from pathlib import Path

# File paths
SCRIPT_DIR = Path(__file__).parent
INPUT_FILE = SCRIPT_DIR / "itsg33-ann4a-eng.xls"
OUTPUT_FILE = SCRIPT_DIR.parent / "src" / "data" / "itsg-33.json"

# Family names (same as NIST 800-53)
FAMILY_NAMES = {
    "AC": "Access Control",
    "AT": "Awareness and Training",
    "AU": "Audit and Accountability",
    "CA": "Security Assessment and Authorization",
    "CM": "Configuration Management",
    "CP": "Contingency Planning",
    "IA": "Identification and Authentication",
    "IR": "Incident Response",
    "MA": "Maintenance",
    "MP": "Media Protection",
    "PE": "Physical and Environmental Protection",
    "PL": "Planning",
    "PS": "Personnel Security",
    "RA": "Risk Assessment",
    "SA": "System and Services Acquisition",
    "SC": "System and Communications Protection",
    "SI": "System and Information Integrity"
}


def parse_priority(priority_str: str) -> int | None:
    """Convert priority string (P1, P2, P3, P4) to integer."""
    if pd.isna(priority_str) or priority_str == "None defined":
        return None
    match = re.match(r'P(\d)', str(priority_str))
    if match:
        return int(match.group(1))
    return None


def clean_text(text) -> str | None:
    """Clean and normalize text, return None if empty."""
    if pd.isna(text):
        return None
    text = str(text).strip()
    if not text:
        return None
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text)
    return text


def format_control_id(family: str, control_num: int, enhancement: str | None) -> str:
    """Format control ID: AC-1 or AC-2(1)."""
    base_id = f"{family}-{control_num}"
    if enhancement:
        # Clean enhancement number (remove parentheses, whitespace)
        enh_clean = re.sub(r'[^\d]', '', str(enhancement))
        if enh_clean:
            return f"{base_id}({enh_clean})"
    return base_id


def format_title(name: str, enhancement: str | None) -> str:
    """Format control title, handling enhancements with | separator."""
    name = clean_text(name) or ""
    # Title case the name
    name = name.title()

    # If it's an enhancement, the name often has the enhancement title embedded
    # Format: "ACCOUNT MANAGEMENT | AUTOMATED SYSTEM ACCOUNT MANAGEMENT"
    if "|" in name:
        parts = name.split("|")
        name = " | ".join(p.strip().title() for p in parts)

    return name


def main():
    print(f"Reading Excel file: {INPUT_FILE}")

    # Read Excel with header at row 3 (0-indexed)
    df = pd.read_excel(INPUT_FILE, header=3)

    # Rename columns based on structure
    df.columns = [
        'Family', 'Control_ID', 'Enhancement', 'Name', 'Class', 'Definition',
        'Supplemental_Guidance', 'References', 'IT_Security', 'IT_Operations',
        'IT_Projects', 'Physical_Security', 'Personnel_Security', 'Learning_Center',
        'Tailoring_Guidance', 'Priority', 'PBMM_Included', 'PBMM_Placeholders',
        'PBMM_Notes', 'Secret_Included', 'Secret_Placeholders', 'Secret_Notes'
    ]

    # Filter valid rows (must have Family)
    df = df[df['Family'].notna()]

    print(f"Found {len(df)} controls/enhancements")

    controls = []

    for _, row in df.iterrows():
        family = str(row['Family']).strip()
        if family not in FAMILY_NAMES:
            print(f"Warning: Unknown family {family}")
            continue

        control_num = int(row['Control_ID'])
        enhancement = row['Enhancement'] if pd.notna(row['Enhancement']) else None

        control_id = format_control_id(family, control_num, enhancement)
        title = format_title(row['Name'], enhancement)

        # Build profile data
        profiles = {}

        # PBMM profile
        pbmm_included = str(row['PBMM_Included']).strip() == 'X'
        if pbmm_included:
            pbmm_data = {"included": True}
            priority = parse_priority(row['Priority'])
            if priority:
                pbmm_data["priority"] = priority
            params = clean_text(row['PBMM_Placeholders'])
            if params:
                pbmm_data["parameters"] = params
            profiles["pbmm"] = pbmm_data
        else:
            profiles["pbmm"] = {"included": False}

        # Secret profile
        secret_included = str(row['Secret_Included']).strip() == 'X'
        if secret_included:
            secret_data = {"included": True}
            priority = parse_priority(row['Priority'])
            if priority:
                secret_data["priority"] = priority
            params = clean_text(row['Secret_Placeholders'])
            if params:
                secret_data["parameters"] = params
            profiles["secret"] = secret_data
        else:
            profiles["secret"] = {"included": False}

        definition = clean_text(row['Definition'])
        supplemental_guidance = clean_text(row['Supplemental_Guidance'])

        control = {
            "control_id": control_id,
            "title": title,
            "family": family,
            "description": definition or supplemental_guidance or "",
        }

        # Add optional fields if present
        ctrl_class = clean_text(row['Class'])
        if ctrl_class:
            control["class"] = ctrl_class

        discussion = supplemental_guidance
        if discussion:
            control["discussion"] = discussion

        references = clean_text(row['References'])
        if references:
            control["references"] = references

        tailoring = clean_text(row['Tailoring_Guidance'])
        if tailoring:
            control["tailoring_guidance"] = tailoring

        control["profiles"] = profiles
        controls.append(control)

    # Count stats
    pbmm_count = sum(1 for c in controls if c['profiles'].get('pbmm', {}).get('included'))
    secret_count = sum(1 for c in controls if c['profiles'].get('secret', {}).get('included'))

    print(f"Total controls: {len(controls)}")
    print(f"PBMM profile: {pbmm_count} controls")
    print(f"Secret profile: {secret_count} controls")

    # Build output structure
    output = {
        "framework": {
            "id": "itsg-33",
            "name": "ITSG-33",
            "version": "2014",
            "description": "IT Security Risk Management - Canadian Government Security Control Catalogue"
        },
        "families": FAMILY_NAMES,
        "controls": controls
    }

    # Write output
    print(f"Writing JSON to: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("Done!")


if __name__ == "__main__":
    main()
