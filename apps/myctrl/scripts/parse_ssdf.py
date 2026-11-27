#!/usr/bin/env python3
"""Parse NIST SSDF (SP 800-218) Excel file and generate JSON for the site."""

import json
import re
import pandas as pd
from pathlib import Path

# Paths
EXCEL_FILE = Path(__file__).parent.parent / "nist.sp.800-218.ssdf-table.xlsx"
OUTPUT_FILE = Path(__file__).parent.parent / "src/data/ssdf.json"


def extract_task_id(task_text: str) -> str:
    """Extract task ID from task text (e.g., 'PO.1.1: ...' -> 'PO.1.1')."""
    match = re.match(r'^([A-Z]+\.\d+\.\d+)', task_text)
    return match.group(1) if match else ""


def extract_task_title(task_text: str) -> str:
    """Extract task title (text after ID and colon)."""
    match = re.match(r'^[A-Z]+\.\d+\.\d+:\s*(.+)', task_text)
    return match.group(1).strip() if match else task_text.strip()


def extract_practice_info(practice_text: str) -> tuple[str, str, str]:
    """Extract practice ID, name, and description from practice text.

    Example: 'Define Security Requirements (PO.1): Ensure that...'
    Returns: ('PO.1', 'Define Security Requirements for Software Development', 'Ensure that...')
    """
    # Pattern: "Name (ID): Description"
    match = re.match(r'^(.+?)\s*\(([A-Z]+\.\d+)\):\s*(.+)$', practice_text, re.DOTALL)
    if match:
        name = match.group(1).strip()
        practice_id = match.group(2).strip()
        description = match.group(3).strip()
        return practice_id, name, description
    return "", practice_text.strip(), ""


def parse_implementation_examples(examples_text: str) -> list[str]:
    """Parse implementation examples from text.

    Format: 'Example 1: ... \nExample 2: ...' -> ['...', '...']
    """
    if pd.isna(examples_text) or not examples_text:
        return []

    # Split by newline followed by 'Example N:'
    parts = re.split(r'\n?Example\s*\d+:\s*', examples_text)

    # Clean up and filter empty entries
    examples = []
    for part in parts:
        part = part.strip()
        if part:
            examples.append(part)

    return examples


def parse_references(ref_text: str) -> dict[str, list[str]]:
    """Parse references from text into structured dict.

    Format: 'BSAFSS: SM.3, DE.1 \nBSIMM: CP1.1, CP1.3'
    Returns: {'BSAFSS': ['SM.3', 'DE.1'], 'BSIMM': ['CP1.1', 'CP1.3']}
    """
    if pd.isna(ref_text) or not ref_text:
        return {}

    references = {}

    # Split by newline
    lines = ref_text.strip().split('\n')

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Split by first colon
        if ':' in line:
            parts = line.split(':', 1)
            framework = parts[0].strip()
            refs_str = parts[1].strip() if len(parts) > 1 else ""

            # Parse individual references (separated by comma, semicolon, or space)
            refs = []
            for ref in re.split(r'[,;]\s*', refs_str):
                ref = ref.strip()
                if ref:
                    refs.append(ref)

            if framework and refs:
                references[framework] = refs

    return references


def main():
    print(f"Reading Excel file: {EXCEL_FILE}")

    # Read SSDF sheet
    df = pd.read_excel(EXCEL_FILE, sheet_name='SSDF')

    # Forward-fill the Practices column (inherited from previous row)
    df['Practices'] = df['Practices'].ffill()

    # Read Groups sheet for family descriptions
    groups_df = pd.read_excel(EXCEL_FILE, sheet_name='Groups')

    # Build families dict
    families = {}

    # First group is in column header
    first_group_text = groups_df.columns[0]
    match = re.match(r'^(.+?)\s*\(([A-Z]+)\):', first_group_text)
    if match:
        families[match.group(2)] = match.group(1).strip()

    # Rest are in rows
    for _, row in groups_df.iterrows():
        group_text = str(row.iloc[0])
        match = re.match(r'^(.+?)\s*\(([A-Z]+)\):', group_text)
        if match:
            families[match.group(2)] = match.group(1).strip()

    print(f"Found {len(families)} groups: {list(families.keys())}")

    # Process controls
    controls = []

    for _, row in df.iterrows():
        practice_text = str(row['Practices']) if pd.notna(row['Practices']) else ""
        task_text = str(row['Tasks']) if pd.notna(row['Tasks']) else ""
        examples_text = str(row['Notional Implementation Examples']) if pd.notna(row['Notional Implementation Examples']) else ""
        ref_text = str(row['References']) if pd.notna(row['References']) else ""

        # Extract task ID
        task_id = extract_task_id(task_text)
        if not task_id:
            print(f"  Skipping row - no task ID found in: {task_text[:50]}...")
            continue

        # Extract task title
        task_title = extract_task_title(task_text)

        # Extract practice info
        practice_id, practice_name, practice_desc = extract_practice_info(practice_text)

        # Extract family (group) from practice ID
        family = practice_id.split('.')[0] if practice_id else ""

        # Parse examples and references
        examples = parse_implementation_examples(examples_text)
        references = parse_references(ref_text)

        control = {
            "control_id": task_id,
            "title": task_title,
            "family": family,
            "description": task_title,  # Task text is the description
            "practice_id": practice_id,
            "practice_name": practice_name,
            "practice_description": practice_desc,
            "implementation_examples": examples,
            "references": references,
        }

        controls.append(control)
        print(f"  Parsed: {task_id} ({practice_id})")

    print(f"\nTotal controls: {len(controls)}")

    # Build output structure
    output = {
        "framework": {
            "id": "ssdf",
            "name": "NIST SSDF",
            "version": "1.1",
            "description": "Secure Software Development Framework - Practices for integrating security into SDLC"
        },
        "families": families,
        "controls": controls
    }

    # Write JSON
    print(f"\nWriting to: {OUTPUT_FILE}")
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, ensure_ascii=False)

    print("Done!")

    # Print stats
    print(f"\nStats:")
    print(f"  Total tasks: {len(controls)}")
    for fam in sorted(families.keys()):
        count = len([c for c in controls if c['family'] == fam])
        print(f"  {fam}: {count} tasks")


if __name__ == "__main__":
    main()
