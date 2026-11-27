#!/usr/bin/env python3
"""
Generate NIST CSF 2.0 JSON from official Excel export.

Data source: CSF 2.0-Implementation_Examples.xlsx (NIST official)
Output: src/data/nist-csf-v2.json

Structure:
- 6 Functions: GV, ID, PR, DE, RS, RC
- 22 Categories
- 106 Subcategories with implementation examples
"""

import json
import re
from pathlib import Path
import pandas as pd

# Paths
SCRIPT_DIR = Path(__file__).parent
PROJECT_ROOT = SCRIPT_DIR.parent
EXCEL_FILE = PROJECT_ROOT / "CSF 2.0-Implementation_Examples.xlsx"
OUTPUT_FILE = PROJECT_ROOT / "src" / "data" / "nist-csf-v2.json"

# Function metadata (code -> full name and description)
FUNCTION_META = {
    "GV": {
        "name": "Govern",
        "description": "The organization's cybersecurity risk management strategy, expectations, and policy are established, communicated, and monitored"
    },
    "ID": {
        "name": "Identify",
        "description": "The organization's current cybersecurity risks are understood"
    },
    "PR": {
        "name": "Protect",
        "description": "Safeguards to manage the organization's cybersecurity risks are used"
    },
    "DE": {
        "name": "Detect",
        "description": "Possible cybersecurity attacks and compromises are found and analyzed"
    },
    "RS": {
        "name": "Respond",
        "description": "Actions regarding a detected cybersecurity incident are taken"
    },
    "RC": {
        "name": "Recover",
        "description": "Assets and operations affected by a cybersecurity incident are restored"
    }
}


def parse_subcategory_id(text: str) -> tuple[str | None, str | None]:
    """Extract subcategory ID and title from text like 'GV.OC-01: The organizational mission...'"""
    if pd.isna(text):
        return None, None
    match = re.match(r'^([A-Z]{2}\.[A-Z]{2}-\d+):\s*(.+)$', str(text).strip())
    if match:
        return match.group(1), match.group(2).strip()
    return None, None


def parse_category_id(text: str) -> tuple[str | None, str | None]:
    """Extract category ID and title from text like 'Organizational Context (GV.OC): ...'"""
    if pd.isna(text):
        return None, None
    # Pattern: Title (XX.YY): Description
    match = re.match(r'^([^(]+)\s*\(([A-Z]{2}\.[A-Z]{2})\):\s*(.+)$', str(text).strip())
    if match:
        title = match.group(1).strip()
        cat_id = match.group(2)
        return cat_id, title
    return None, None


def parse_function_id(text: str) -> str | None:
    """Extract function ID from text like 'GOVERN (GV): ...'"""
    if pd.isna(text):
        return None
    match = re.match(r'^[A-Z]+\s*\(([A-Z]{2})\):', str(text).strip())
    if match:
        return match.group(1)
    return None


def main():
    print(f"Reading Excel file: {EXCEL_FILE}")
    df = pd.read_excel(EXCEL_FILE, sheet_name=0)

    # Forward fill function and category columns
    df['Function'] = df['Function'].ffill()
    df['Category'] = df['Category'].ffill()

    # Build category lookup
    categories = {}
    for cat_text in df['Category'].unique():
        cat_id, cat_title = parse_category_id(cat_text)
        if cat_id:
            categories[cat_id] = cat_title

    print(f"Found {len(categories)} categories")

    # Build controls list
    controls = []
    current_control = None

    for _, row in df.iterrows():
        subcat_text = row['Subcategory']
        example_text = row['Implementation Examples']

        # Parse subcategory
        subcat_id, subcat_title = parse_subcategory_id(subcat_text)

        if subcat_id:
            # Save previous control
            if current_control:
                controls.append(current_control)

            # Extract function code and category from ID (e.g., GV.OC-01 -> GV, GV.OC)
            func_code = subcat_id.split('.')[0]
            cat_code = subcat_id.rsplit('-', 1)[0]

            # Get category title
            cat_title = categories.get(cat_code, "Unknown")

            current_control = {
                "control_id": subcat_id,
                "title": subcat_title,
                "family": func_code,
                "category": cat_code,
                "category_title": cat_title,
                "description": subcat_title,  # Use title as description (subcategory is self-descriptive)
                "implementation_examples": []
            }

            # Add first example if on same row
            if pd.notna(example_text) and str(example_text).strip():
                current_control["implementation_examples"].append(str(example_text).strip())

        elif current_control and pd.notna(example_text) and str(example_text).strip():
            # This is an additional implementation example for current control
            current_control["implementation_examples"].append(str(example_text).strip())

    # Don't forget the last control
    if current_control:
        controls.append(current_control)

    print(f"Found {len(controls)} subcategories")

    # Count examples
    total_examples = sum(len(c.get("implementation_examples", [])) for c in controls)
    print(f"Found {total_examples} implementation examples")

    # Build families dict (function code -> name)
    families = {code: meta["name"] for code, meta in FUNCTION_META.items()}

    # Build output structure
    output = {
        "framework": {
            "id": "nist-csf-v2",
            "name": "NIST CSF",
            "version": "2.0",
            "description": "NIST Cybersecurity Framework 2.0 for improving critical infrastructure security"
        },
        "families": families,
        "controls": controls
    }

    # Write output
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\nWrote {OUTPUT_FILE}")

    # Print summary
    print("\nSummary by Function:")
    from collections import Counter
    func_counts = Counter(c["family"] for c in controls)
    for func_code in ["GV", "ID", "PR", "DE", "RS", "RC"]:
        print(f"  {func_code} ({FUNCTION_META[func_code]['name']}): {func_counts.get(func_code, 0)} subcategories")


if __name__ == "__main__":
    main()
