#!/usr/bin/env python3
"""
Parse PCI DSS requirements from official Excel workbook.
Source: Prioritized-Approach-Tool-For-PCI-DSS-v4_0_1.xlsx
"""

import re

import pandas as pd

from lib.io import save_json
from lib.paths import DATA_DIR, require_raw_input

EXCEL_FILENAME = "Prioritized-Approach-Tool-For-PCI-DSS-v4_0_1.xlsx"
OUTPUT_PATH = DATA_DIR / "pci-dss-v4.json"

def parse_pci_excel(excel_path):
    # Read the Excel file
    df = pd.read_excel(excel_path, sheet_name='Prioritized Approach Milestones', header=None)

    families = {}
    sections = {}
    controls = []

    for idx, row in df.iterrows():
        text = row[0]
        if pd.isna(text):
            continue
        text = str(text).strip()

        # Main requirement: "Requirement 1: Install and Maintain..."
        main_req_match = re.match(r'^Requirement (\d+): (.+)$', text)
        if main_req_match:
            family_num = main_req_match.group(1)
            family_name = main_req_match.group(2).strip()
            families[family_num] = family_name
            continue

        # Section header: "1.1 Description..." (X.Y format, no third number)
        section_match = re.match(r'^(\d+\.\d+)\s+(.+)$', text)
        if section_match:
            section_id = section_match.group(1)
            # Only if it's NOT a control (no third part like X.Y.Z)
            if not re.match(r'^\d+\.\d+\.\d+', text):
                section_desc = section_match.group(2).strip()
                # Clean up newlines
                section_desc = re.sub(r'\s*\n\s*', ' ', section_desc)
                sections[section_id] = section_desc
                continue

        # Control: "1.2.3 Description..." (X.Y.Z format)
        control_match = re.match(r'^(\d+\.\d+\.\d+)\s+(.+)$', text, re.DOTALL)
        if control_match:
            control_id = control_match.group(1)
            description = control_match.group(2).strip()

            # Clean up newlines and bullet points
            description = re.sub(r'\s*\n\s*', ' ', description)
            description = re.sub(r'\s*•\s*', ' ', description)
            description = re.sub(r'\s+', ' ', description)

            # Extract section and family from control_id
            parts = control_id.split('.')
            family = parts[0]
            section = f"{parts[0]}.{parts[1]}"

            # Create a short title (first sentence or up to 100 chars)
            title_match = re.match(r'^([^.]+\.)', description)
            if title_match:
                title = title_match.group(1).strip()
            else:
                title = description[:100] + "..." if len(description) > 100 else description

            control = {
                "control_id": control_id,
                "title": title,
                "section": section,
                "section_title": sections.get(section, ""),
                "family": family,
                "description": description
            }
            controls.append(control)

    # Build final JSON structure
    result = {
        "framework": {
            "id": "pci-dss-v4",
            "name": "PCI DSS",
            "version": "4.0.1",
            "description": "Payment Card Industry Data Security Standard"
        },
        "families": families,
        "sections": sections,
        "controls": controls
    }

    return result

def main():
    excel_path = require_raw_input(EXCEL_FILENAME)
    print(f"Reading: {excel_path}")
    data = parse_pci_excel(excel_path)

    print(f"Families: {len(data['families'])}")
    print(f"Sections: {len(data['sections'])}")
    print(f"Controls: {len(data['controls'])}")

    save_json(OUTPUT_PATH, data)

    print(f"\nWritten to: {OUTPUT_PATH}")

if __name__ == "__main__":
    main()
