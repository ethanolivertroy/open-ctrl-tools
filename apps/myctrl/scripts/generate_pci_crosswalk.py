#!/usr/bin/env python3
"""
Parse NIST CSF 2.0 ↔ PCI-DSS v4.0.1 crosswalk Excel and generate JSON.
"""

import pandas as pd

from lib.crosswalk import build_bidirectional, sort_mapping, total_mappings
from lib.io import save_json
from lib.paths import DATA_DIR, require_raw_input

EXCEL_FILENAME = "csf-v2_pci-dss_v4.0.1_olir-supportive.xlsx"
OUTPUT_FILE = DATA_DIR / "csf-pci-crosswalk.json"


def parse_crosswalk(excel_file):
    """Parse the Excel file and extract CSF ↔ PCI-DSS mappings."""
    df = pd.read_excel(excel_file, sheet_name='Relationships')

    # Clean column names (remove newlines)
    df.columns = df.columns.str.replace('\n', ' ').str.strip()

    # Get mapping rows (where Reference Document Element is not null)
    mappings = df[df['Reference Document Element'].notna()].copy()

    # Build bidirectional mappings
    pairs = []
    for _, row in mappings.iterrows():
        csf_id = str(row['Focal Document Element']).strip()
        pci_id = str(row['Reference Document Element']).strip()

        if csf_id and pci_id and csf_id != 'nan' and pci_id != 'nan':
            pairs.append((csf_id, pci_id))

    csf_to_pci, pci_to_csf = build_bidirectional(pairs)

    # Sort keys and value lists
    csf_to_pci = sort_mapping(csf_to_pci)
    pci_to_csf = sort_mapping(pci_to_csf)

    return {
        "metadata": {
            "source": "NIST CSF 2.0 ↔ PCI DSS v4.0.1 OLIR Supportive Mapping",
            "csf_version": "2.0",
            "pci_version": "4.0.1",
            "total_mappings": total_mappings(csf_to_pci),
            "csf_subcategories": len(csf_to_pci),
            "pci_requirements": len(pci_to_csf)
        },
        "csf_to_pci": csf_to_pci,
        "pci_to_csf": pci_to_csf
    }


def main():
    excel_file = require_raw_input(EXCEL_FILENAME)
    print(f"Parsing {excel_file}...")
    data = parse_crosswalk(excel_file)

    print(f"Found {data['metadata']['total_mappings']} mappings")
    print(f"  CSF subcategories: {data['metadata']['csf_subcategories']}")
    print(f"  PCI requirements: {data['metadata']['pci_requirements']}")

    save_json(OUTPUT_FILE, data)

    print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
