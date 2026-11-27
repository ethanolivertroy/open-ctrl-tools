#!/usr/bin/env python3
"""
Generate CSF 2.0 ↔ NIST 800-53 crosswalk JSON from official NIST Excel.

Data source: Cybersecurity_Framework_v2-0_Concept_Crosswalk_800-53_5_2_0_draft.xlsx
Output: src/data/csf-nist-crosswalk.json

Structure:
- Bidirectional mappings
- 746 total mappings
- 106 CSF subcategories → 234 NIST controls
"""

import pandas as pd

from lib.crosswalk import build_bidirectional, sort_values, write_crosswalk
from lib.paths import DATA_DIR, require_raw_input

EXCEL_FILENAME = "Cybersecurity_Framework_v2-0_Concept_Crosswalk_800-53_5_2_0_draft.xlsx"
OUTPUT_FILE = DATA_DIR / "csf-nist-crosswalk.json"


def main():
    excel_file = require_raw_input(EXCEL_FILENAME)
    print(f"Reading Excel file: {excel_file}")
    df = pd.read_excel(excel_file, sheet_name='Relationships')

    # Clean column names
    df.columns = ['csf_element', 'csf_description', 'nist_control', 'nist_description', 'comments', 'strength']

    # Filter rows with actual mappings (where nist_control is not NaN)
    mappings = df[df['nist_control'].notna()].copy()

    # Clean up the NIST control IDs (remove whitespace)
    mappings['nist_control'] = mappings['nist_control'].str.strip()
    mappings['csf_element'] = mappings['csf_element'].str.strip()

    print(f"Total mappings: {len(mappings)}")

    # Build bidirectional mappings
    pairs = [
        (row['csf_element'], row['nist_control'])
        for _, row in mappings.iterrows()
        if row['csf_element'] and row['nist_control']
        and not pd.isna(row['csf_element']) and not pd.isna(row['nist_control'])
    ]
    csf_to_nist, nist_to_csf = build_bidirectional(pairs)

    # Sort the control lists for consistency
    csf_to_nist = sort_values(csf_to_nist)
    nist_to_csf = sort_values(nist_to_csf)

    write_crosswalk(
        OUTPUT_FILE,
        metadata={
            "source": "NIST CSF 2.0 Concept Crosswalk to SP 800-53 Rev 5.2.0 (Draft)",
            "csf_version": "2.0",
            "nist_version": "5.2.0",
            "total_mappings": len(mappings),
            "csf_subcategories": len(csf_to_nist),
            "nist_controls": len(nist_to_csf)
        },
        mappings={
            "csf_to_nist": csf_to_nist,
            "nist_to_csf": nist_to_csf
        },
    )

    print(f"\nWrote {OUTPUT_FILE}")
    print(f"\nSummary:")
    print(f"  CSF subcategories with mappings: {len(csf_to_nist)}")
    print(f"  NIST controls referenced: {len(nist_to_csf)}")

    # Show some examples
    print("\nSample CSF → NIST mappings:")
    for csf_id in list(csf_to_nist.keys())[:5]:
        print(f"  {csf_id} → {csf_to_nist[csf_id][:3]}{'...' if len(csf_to_nist[csf_id]) > 3 else ''}")

    print("\nSample NIST → CSF mappings:")
    for nist_id in list(nist_to_csf.keys())[:5]:
        print(f"  {nist_id} → {nist_to_csf[nist_id][:3]}{'...' if len(nist_to_csf[nist_id]) > 3 else ''}")


if __name__ == "__main__":
    main()
