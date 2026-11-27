#!/usr/bin/env python3
"""
Extract defined terms (glossary) from FRMR.documentation.json.
Source: https://github.com/FedRAMP/docs/blob/main/FRMR.documentation.json

Outputs: src/data/fedramp-20x-glossary.json
"""

import json
import requests
from pathlib import Path

FRMR_URL = "https://raw.githubusercontent.com/FedRAMP/docs/main/FRMR.documentation.json"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "fedramp-20x-glossary.json"


def fetch_frmr_data() -> dict:
    """Fetch FRMR documentation JSON from GitHub."""
    print(f"Fetching: {FRMR_URL}")
    resp = requests.get(FRMR_URL, timeout=30)
    resp.raise_for_status()
    return resp.json()


def extract_glossary(data: dict) -> dict:
    """Extract defined terms from FRD.data.both."""
    frd_both = data.get("FRD", {}).get("data", {}).get("both", {})
    glossary = {}

    for term_id, term_data in frd_both.items():
        term_name = term_data.get("term", "")
        if not term_name:
            continue

        # Normalize note vs notes (some terms use singular, some plural)
        note = term_data.get("note")
        notes = term_data.get("notes")
        if notes and not note:
            note = " ".join(notes)

        # Normalize reference_url vs referenceurl (FRD-KEV uses no underscore)
        ref_url = term_data.get("reference_url") or term_data.get("referenceurl")

        entry = {
            "id": term_id,
            "term": term_name,
            "definition": term_data.get("definition", "").strip(),
            "alts": term_data.get("alts", []),
            "note": note,
        }

        if term_data.get("reference"):
            entry["reference"] = term_data["reference"]
        if ref_url:
            entry["referenceUrl"] = ref_url

        glossary[term_name] = entry

    return glossary


def main():
    data = fetch_frmr_data()
    glossary = extract_glossary(data)

    # Sort by term name for stable output
    sorted_glossary = dict(sorted(glossary.items()))

    output = {
        "_meta": {
            "source": FRMR_URL,
            "description": "FedRAMP FRMR defined terms extracted from FRD.data.both",
            "termCount": len(sorted_glossary),
        },
        "terms": sorted_glossary,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)
        f.write("\n")

    print(f"Wrote {len(sorted_glossary)} terms to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
