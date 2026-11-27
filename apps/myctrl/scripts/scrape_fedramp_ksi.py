#!/usr/bin/env python3
"""
Fetch and transform FedRAMP 20x Key Security Indicators (KSI) to JSON format.
Source: https://github.com/FedRAMP/docs/blob/main/FRMR.documentation.json
"""

import json
import requests
from pathlib import Path

KSI_URL = "https://raw.githubusercontent.com/FedRAMP/docs/main/FRMR.documentation.json"


def fetch_ksi_data() -> dict:
    """Fetch KSI JSON from GitHub."""
    print(f"Fetching: {KSI_URL}")
    resp = requests.get(KSI_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def transform_ksi(data: dict) -> dict:
    """Transform FedRAMP KSI structure to our framework format."""
    ksi_data = data.get("KSI", {})
    source_info = data.get("info", {})

    families = {}
    controls = []

    for category_code, category in ksi_data.items():
        if not isinstance(category, dict):
            continue

        # Extract family info
        category_name = category.get("name", category_code)
        families[category_code] = category_name

        # Process indicators. The current FRMR file stores indicators as an
        # object keyed by ID; older snapshots used a list.
        raw_indicators = category.get("indicators", {})
        if isinstance(raw_indicators, dict):
            indicators = raw_indicators.items()
        else:
            indicators = [(indicator.get("id", ""), indicator) for indicator in raw_indicators]
        for indicator_id, indicator in indicators:
            # Skip retired indicators
            if indicator.get("retired", False):
                print(f"  Skipping retired: {indicator.get('id')}")
                continue

            # Extract NIST control references (lowercase for URL slugs)
            nist_refs = []
            for ctrl in indicator.get("controls", []):
                ctrl_id = ctrl.get("control_id", "") if isinstance(ctrl, dict) else str(ctrl)
                if ctrl_id:
                    nist_refs.append(ctrl_id.lower())

            # Build reference if available
            references = []
            ref_title = indicator.get("reference")
            ref_url = indicator.get("reference_url")
            if ref_title and ref_url:
                references.append({"title": ref_title, "url": ref_url})

            # Phase 2 materials no longer publish separate low/moderate impact
            # flags in the KSI data. Keep both flags true so existing impact
            # routes continue to show the complete 20x KSI set.
            impact = indicator.get("impact", {})
            varies_by_level = indicator.get("varies_by_level", {})
            default_statement = (
                indicator.get("statement")
                or varies_by_level.get("moderate", {}).get("statement")
                or varies_by_level.get("low", {}).get("statement")
                or ""
            )

            control = {
                "control_id": indicator.get("id") or indicator_id,
                "fka": indicator.get("fka"),
                "title": indicator.get("name", ""),
                "family": category_code,
                "description": default_statement.replace("**Optional:** ", ""),
                "impact_low": impact.get("low", True),
                "impact_moderate": impact.get("moderate", True),
                "related_controls": nist_refs,
                "references": references,
                "updated": indicator.get("updated", []),
                "terms": indicator.get("terms", []),
                "variesByLevel": varies_by_level,
            }

            control = {key: value for key, value in control.items() if value not in (None, [], {})}
            controls.append(control)
            print(f"  Parsed: {control['control_id']} - {control['title'][:50]}...")

    return {
        "framework": {
            "id": "fedramp-20x-ksi",
            "name": "FedRAMP 20x KSI",
            "version": source_info.get("version", "Phase 2"),
            "description": "Key Security Indicators from FedRAMP Machine-Readable Documentation"
        },
        "families": families,
        "controls": controls
    }


def save_json(data: dict, output_path: Path):
    """Save data to JSON file."""
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    print(f"Saved: {output_path}")


def main():
    output_dir = Path(__file__).parent.parent / "src" / "data"

    print("Fetching FedRAMP 20x KSI...")
    raw_data = fetch_ksi_data()

    print("\nTransforming KSI data...")
    ksi_data = transform_ksi(raw_data)

    save_json(ksi_data, output_dir / "fedramp-20x-ksi.json")
    print(f"\nTotal: {len(ksi_data['controls'])} indicators")
    print(f"Categories: {len(ksi_data['families'])}")

    print("\nDone!")


if __name__ == "__main__":
    main()
