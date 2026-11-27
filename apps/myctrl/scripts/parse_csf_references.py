#!/usr/bin/env python3
"""
Parse NIST CSF 2.0 Excel file to extract Informative References.
Updates nist-csf-v2.json with reference data.
"""

import json
import re
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Installing openpyxl...")
    import subprocess
    subprocess.check_call(["pip", "install", "openpyxl"])
    import openpyxl


def parse_control_id(subcategory_text: str) -> str | None:
    """Extract control ID from subcategory text like 'GV.OC-01: Description'"""
    if not subcategory_text:
        return None
    # Match patterns like GV.OC-01, PR.AA-01, DE.CM-01, etc.
    match = re.match(r'^([A-Z]{2}\.[A-Z]{2}-\d{2})', subcategory_text)
    if match:
        return match.group(1)
    return None


def parse_references(ref_text: str) -> list[dict]:
    """
    Parse informative references text into structured format.

    Input format (newline-separated):
        CCMv4.0: BCR-01
        ISO/IEC 27001:2022: Mandatory Clause: 4.1
        SP 800-53 Rev. 5: PM-7

    Output format:
        [
            {"framework": "CCMv4.0", "controls": ["BCR-01", "BCR-07"]},
            {"framework": "ISO/IEC 27001:2022", "controls": ["Mandatory Clause: 4.1"]},
        ]
    """
    if not ref_text or not isinstance(ref_text, str):
        return []

    # Group references by framework
    framework_refs: dict[str, list[str]] = {}

    for line in ref_text.strip().split('\n'):
        line = line.strip()
        if not line:
            continue

        # Parse "Framework: Control" format
        # Handle special cases like "ISO/IEC 27001:2022: Mandatory Clause: 4.1"
        # where framework has colons in it

        # Known framework prefixes (order matters - longer first)
        known_frameworks = [
            "ISO/IEC 27001:2022",
            "SP 800-53 Rev. 5",
            "SP 800-221A",
            "SP 800-218",
            "SP 800-181 Rev. 1",
            "SP 800-161 Rev. 1",
            "SP 800-160 Vol. 2 Rev. 1",
            "SP 800-160 Vol. 1",
            "SP 800-82 Rev. 3",
            "SP 800-63B-4",
            "CRI Profile v2.0",
            "CSF v1.1",
            "CCMv4.0",
            "PCI DSS v4.0",
            "NICE Framework",
            "SCF",
        ]

        framework = None
        control = None

        for fw in known_frameworks:
            if line.startswith(f"{fw}:"):
                framework = fw
                control = line[len(fw) + 1:].strip()
                break

        # Fallback: split on first colon
        if not framework:
            parts = line.split(':', 1)
            if len(parts) == 2:
                framework = parts[0].strip()
                control = parts[1].strip()
            else:
                # No colon found, skip
                continue

        if framework and control:
            if framework not in framework_refs:
                framework_refs[framework] = []
            if control not in framework_refs[framework]:
                framework_refs[framework].append(control)

    # Convert to list format
    return [
        {"framework": fw, "controls": ctrls}
        for fw, ctrls in sorted(framework_refs.items())
    ]


def main():
    script_dir = Path(__file__).parent
    project_root = script_dir.parent

    excel_path = project_root / "csf2 (3).xlsx"
    json_path = project_root / "src" / "data" / "nist-csf-v2.json"

    if not excel_path.exists():
        print(f"Error: Excel file not found at {excel_path}")
        return 1

    print(f"Reading Excel file: {excel_path}")
    wb = openpyxl.load_workbook(excel_path, data_only=True)

    # Get the CSF 2.0 sheet
    if "CSF 2.0" not in wb.sheetnames:
        print(f"Error: 'CSF 2.0' sheet not found. Available: {wb.sheetnames}")
        return 1

    ws = wb["CSF 2.0"]

    # Parse references from Excel
    # Column C = Subcategory (index 2, 0-based)
    # Column E = Informative References (index 4, 0-based)
    references_map: dict[str, list[dict]] = {}

    for row in ws.iter_rows(min_row=2, values_only=True):  # Skip header
        subcategory = row[2] if len(row) > 2 else None
        ref_text = row[4] if len(row) > 4 else None

        control_id = parse_control_id(str(subcategory) if subcategory else "")
        if control_id and ref_text:
            refs = parse_references(str(ref_text))
            if refs:
                references_map[control_id] = refs

    print(f"Parsed references for {len(references_map)} controls")

    # Load existing JSON
    print(f"Loading JSON: {json_path}")
    with open(json_path, 'r', encoding='utf-8') as f:
        csf_data = json.load(f)

    # Update controls with references
    updated_count = 0
    for control in csf_data.get("controls", []):
        control_id = control.get("control_id")
        if control_id and control_id in references_map:
            control["informative_references"] = references_map[control_id]
            updated_count += 1

    print(f"Updated {updated_count} controls with informative references")

    # Write updated JSON
    print(f"Writing updated JSON: {json_path}")
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(csf_data, f, indent=2, ensure_ascii=False)

    # Print sample
    print("\nSample output (GV.OC-01):")
    for control in csf_data["controls"]:
        if control.get("control_id") == "GV.OC-01":
            refs = control.get("informative_references", [])
            for ref in refs[:3]:
                print(f"  {ref['framework']}: {', '.join(ref['controls'][:2])}")
            if len(refs) > 3:
                print(f"  ... and {len(refs) - 3} more frameworks")
            break

    print("\nDone!")
    return 0


if __name__ == "__main__":
    exit(main())
