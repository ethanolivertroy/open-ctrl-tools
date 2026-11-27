#!/usr/bin/env python3
"""
Parse NIST OLIR CSF 2.0 to ISO 27001:2022 crosswalk and update ISO 27001 JSON.

Source: NIST Online Informative References (OLIR) Catalog
URL: https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=154

This script extracts the CSF ↔ ISO 27001 mappings from the official NIST crosswalk
and adds CSF mapping data to the ISO 27001 controls JSON.
"""

import re

import pandas as pd

from lib.crosswalk import build_bidirectional, build_reverse, sort_values, write_crosswalk
from lib.io import load_json, save_json
from lib.paths import DATA_DIR, require_raw_input

CROSSWALK_FILENAME = "Cybersecurity_Framework_v2.0_Concept_Crosswalk_Template_v1.0.xlsx"
ISO_JSON_FILE = DATA_DIR / "iso-27001-2022.json"
OUTPUT_CROSSWALK = DATA_DIR / "csf-iso-crosswalk.json"


def extract_control_id(iso_ref: str) -> str | None:
    """Extract ISO control ID from reference string like 'Annex A Controls: 5.1'"""
    if pd.isna(iso_ref):
        return None
    match = re.search(r"Annex A Controls:\s*(\d+\.\d+)", str(iso_ref))
    return match.group(1) if match else None


def main():
    crosswalk_file = require_raw_input(CROSSWALK_FILENAME)
    print(f"Reading NIST crosswalk from: {crosswalk_file}")

    # Read the Excel file
    df = pd.read_excel(crosswalk_file, sheet_name="Relationships")
    df.columns = ["csf_element", "csf_description", "iso_ref", "iso_desc", "comments", "strength"]

    print(f"Total rows: {len(df)}")

    # Filter to Annex A controls only
    annex_df = df[df["iso_ref"].str.contains("Annex A Controls:", na=False)].copy()
    annex_df["control_id"] = annex_df["iso_ref"].apply(extract_control_id)
    annex_df = annex_df.dropna(subset=["control_id"])

    print(f"Annex A control mappings: {len(annex_df)}")

    # Build ISO → CSF mapping, with CSF elements sorted per control
    pairs = [
        (row["control_id"], str(row["csf_element"]).strip())
        for _, row in annex_df.iterrows()
    ]
    iso_to_csf, _ = build_bidirectional(pairs)
    iso_to_csf = sort_values(iso_to_csf)

    print(f"ISO controls with CSF mappings: {len(iso_to_csf)}")

    # Build CSF → ISO mapping (from the sorted forward mapping, so key order
    # matches historical output), with ISO controls sorted numerically
    csf_to_iso = sort_values(
        build_reverse(iso_to_csf),
        key=lambda x: (int(x.split(".")[0]), int(x.split(".")[1])),
    )

    # Save crosswalk JSON
    write_crosswalk(
        OUTPUT_CROSSWALK,
        metadata={
            "source": "NIST Online Informative References (OLIR) Catalog",
            "source_url": "https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=154",
            "csf_version": "2.0",
            "iso_version": "27001:2022",
            "total_mappings": len(annex_df),
            "iso_controls": len(iso_to_csf),
            "csf_elements": len(csf_to_iso),
        },
        mappings={
            "iso_to_csf": iso_to_csf,
            "csf_to_iso": csf_to_iso,
        },
    )
    print(f"Saved crosswalk to: {OUTPUT_CROSSWALK}")

    # Update ISO 27001 JSON with CSF mappings
    print(f"\nUpdating ISO JSON: {ISO_JSON_FILE}")
    iso_data = load_json(ISO_JSON_FILE)

    # Update each control with CSF mappings
    updated_count = 0
    for control in iso_data["controls"]:
        control_id = control["control_id"]
        if control_id in iso_to_csf:
            control["csf_mappings"] = iso_to_csf[control_id]
            updated_count += 1
        else:
            control["csf_mappings"] = []

    # Update framework description
    iso_data["framework"]["description"] = "ISO 27001:2022 Annex A control references with NIST CSF 2.0 mappings (via NIST OLIR)"

    save_json(ISO_JSON_FILE, iso_data)
    print(f"Updated {updated_count} controls with CSF mappings")

    # Print summary
    print("\n=== Summary ===")
    print(f"ISO controls with mappings: {updated_count}/{len(iso_data['controls'])}")
    print(f"Controls without mappings: {len(iso_data['controls']) - updated_count}")

    # Show sample
    print("\n=== Sample Mappings ===")
    for control_id in ["5.1", "5.15", "8.24"]:
        if control_id in iso_to_csf:
            print(f"ISO {control_id} → CSF: {', '.join(iso_to_csf[control_id][:5])}{'...' if len(iso_to_csf[control_id]) > 5 else ''}")


if __name__ == "__main__":
    main()
