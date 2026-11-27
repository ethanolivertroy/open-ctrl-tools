#!/usr/bin/env python3
"""Transform AIUC-1 Excel spreadsheet into JSON for myctrl.tools.

Reads both sheets:
  - "AIUC-1 requirements" → 51 top-level controls (A001–A051)
  - "AIUC-1 Controls & Evidence" → 129 evidence items nested under controls

Output: src/data/aiuc-1.json
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

EXCEL_PATH = Path(__file__).parent.parent / "AIUC-1 _ January, 2026 version.xlsx"
OUTPUT_PATH = Path(__file__).parent.parent / "src" / "data" / "aiuc-1.json"

# Principle name → slug
PRINCIPLE_SLUGS = {
    "Data & Privacy": "data-privacy",
    "Security": "security",
    "Safety": "safety",
    "Reliability": "reliability",
    "Accountability": "accountability",
    "Society": "society",
}


def extract_control_id(title: str) -> str:
    """Extract 'A001' from 'A001: Establish input data policy'."""
    match = re.match(r"([A-F]\d{3})", title.strip())
    if match:
        return match.group(1)
    raise ValueError(f"Cannot extract control ID from: {title}")


def extract_title(raw_title: str) -> str:
    """Extract title text after the 'A001: ' prefix."""
    match = re.match(r"[A-F]\d{3}:\s*(.*)", raw_title.strip())
    if match:
        return match.group(1).strip()
    return raw_title.strip()


def clean_text(text) -> str:
    """Clean cell value to string, stripping whitespace."""
    if text is None:
        return ""
    return str(text).strip()


def parse_requirements(wb) -> list[dict]:
    """Parse the 'AIUC-1 requirements' sheet into control dicts."""
    ws = wb["AIUC-1 requirements"]
    controls = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        principle, raw_title, description, application, frequency, capabilities = row[:6]
        if not raw_title:
            continue
        raw_title = clean_text(raw_title)
        control_id = extract_control_id(raw_title)
        controls.append({
            "control_id": control_id,
            "title": extract_title(raw_title),
            "family": PRINCIPLE_SLUGS.get(clean_text(principle), clean_text(principle).lower()),
            "description": clean_text(description),
            "application": clean_text(application),
            "frequency": clean_text(frequency),
            "capabilities": clean_text(capabilities),
            "controls_evidence": [],
        })
    return controls


def parse_evidence(wb) -> dict[str, list[dict]]:
    """Parse 'AIUC-1 Controls & Evidence' sheet, keyed by control ID."""
    ws = wb["AIUC-1 Controls & Evidence"]
    evidence_by_control: dict[str, list[dict]] = {}

    # Header row is row 2 (row 1 is a merged header)
    # Columns: Requirement title (0), Mandatory/Optional (1), Full requirement (2),
    #          Control application (3), Control (4), Evidence title (5),
    #          Typical evidence (6), Category (7), Typical Location (8), Capabilities (9)
    evidence_counter: dict[str, int] = {}

    for row in ws.iter_rows(min_row=3, values_only=True):
        raw_title = clean_text(row[0])
        if not raw_title:
            continue

        control_id = extract_control_id(raw_title)

        # Track evidence numbering
        if control_id not in evidence_counter:
            evidence_counter[control_id] = 0
        evidence_counter[control_id] += 1
        seq = evidence_counter[control_id]

        evidence_title = clean_text(row[5])
        # Extract evidence_id from title if present (e.g., "A001.1 Documentation: ...")
        eid_match = re.match(r"([A-F]\d{3}\.\d+)", evidence_title)
        if eid_match:
            evidence_id = eid_match.group(1)
        else:
            evidence_id = f"{control_id}.{seq}"

        evidence = {
            "evidence_id": evidence_id,
            "evidence_title": evidence_title,
            "control_text": clean_text(row[4]),
            "control_application": clean_text(row[3]),
            "typical_evidence": clean_text(row[6]),
            "category": clean_text(row[7]),
            "location": clean_text(row[8]),
        }

        if control_id not in evidence_by_control:
            evidence_by_control[control_id] = []
        evidence_by_control[control_id].append(evidence)

    return evidence_by_control


def main():
    wb = openpyxl.load_workbook(str(EXCEL_PATH), read_only=True)

    controls = parse_requirements(wb)
    evidence = parse_evidence(wb)

    # Merge evidence into controls
    for control in controls:
        cid = control["control_id"]
        if cid in evidence:
            control["controls_evidence"] = evidence[cid]

    # Build output
    output = {
        "framework": {
            "id": "aiuc-1",
            "name": "AIUC-1",
            "version": "January 2026",
            "description": "AI Agent Security, Safety and Reliability Standard",
        },
        "families": {
            "data-privacy": "Data & Privacy",
            "security": "Security",
            "safety": "Safety",
            "reliability": "Reliability",
            "accountability": "Accountability",
            "society": "Society",
        },
        "controls": controls,
    }

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print(f"Wrote {len(controls)} controls with {sum(len(c['controls_evidence']) for c in controls)} evidence items to {OUTPUT_PATH}")
    wb.close()


if __name__ == "__main__":
    main()
