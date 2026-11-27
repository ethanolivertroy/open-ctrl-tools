#!/usr/bin/env python3
"""
Parse FedRAMP Rev 5 Security Controls Baseline Excel and generate JSON.
Extracts per-baseline FedRAMP parameters and requirements.
"""

import pandas as pd

from lib.io import save_json
from lib.paths import DATA_DIR, require_raw_input

EXCEL_FILENAME = "FedRAMP_Security_Controls_Baseline (1).xlsx"
OUTPUT_FILE = DATA_DIR / "fedramp-rev5.json"


def normalize_control_id(control_id: str) -> str:
    """Normalize control ID to consistent format (strip leading zeros)."""
    import re
    # AC-01 -> AC-1, IA-02 (12) -> IA-2 (12)
    def strip_zeros(match):
        return f"-{int(match.group(1))}"
    return re.sub(r'-0*(\d+)', strip_zeros, control_id)


def natural_sort_key(control_id: str):
    """Extract (family, base_num, enhancement_num) for natural sorting."""
    import re
    # AC-1 -> (AC, 1, 0)
    # AC-2 (1) -> (AC, 2, 1)
    match = re.match(r'([A-Z]+)-(\d+)(?:\s*\((\d+)\))?', control_id)
    if match:
        family = match.group(1)
        base = int(match.group(2))
        enhancement = int(match.group(3)) if match.group(3) else 0
        return (family, base, enhancement)
    return (control_id, 0, 0)


def format_fedramp_parameters(params_text: str) -> str | None:
    """Format FedRAMP parameters for display.

    Parses lines like:
        AC-2 (c) [twenty-four (24) hours]
        AC-2 (h) (1) [time period]

    Returns formatted text with just the sub-item references and values.
    """
    import re
    if not params_text:
        return None

    lines = []
    # Match patterns like: AC-2 (c) [value] or AC-2 (h) (1) [value]
    for match in re.finditer(r'([A-Z]+-\d+(?:\s*\([^)]+\))+)\s*\[([^\]]+)\]', params_text):
        control_ref = match.group(1).strip()
        value = match.group(2).strip()
        # Skip "Assignment:" and "Selection:" - these are placeholders, not values
        if not value.lower().startswith('assignment:') and not value.lower().startswith('selection:'):
            # Extract just the sub-item parts like "(c)" or "(h) (1)"
            sub_items = re.findall(r'\([^)]+\)', control_ref)
            if sub_items:
                sub_ref = ' '.join(sub_items)
                lines.append(f"{sub_ref}: {value}")

    return '\n'.join(lines) if lines else None


def clean_value(val) -> str | None:
    """Clean a value, returning None for empty/nan values."""
    if pd.isna(val):
        return None
    s = str(val).strip()
    if s in ('', 'nan', 'None'):
        return None
    return s


FAMILIES = {
    "AC": "Access Control",
    "AT": "Awareness and Training",
    "AU": "Audit and Accountability",
    "CA": "Assessment, Authorization, and Monitoring",
    "CM": "Configuration Management",
    "CP": "Contingency Planning",
    "IA": "Identification and Authentication",
    "IR": "Incident Response",
    "MA": "Maintenance",
    "MP": "Media Protection",
    "PE": "Physical and Environmental Protection",
    "PL": "Planning",
    "PM": "Program Management",
    "PS": "Personnel Security",
    "PT": "PII Processing and Transparency",
    "RA": "Risk Assessment",
    "SA": "System and Services Acquisition",
    "SC": "System and Communications Protection",
    "SI": "System and Information Integrity",
    "SR": "Supply Chain Risk Management"
}


def parse_baseline_sheet(xl, sheet_name):
    """Parse a baseline sheet and return control data with baseline-specific fields."""
    df = pd.read_excel(xl, sheet_name=sheet_name, skiprows=1)

    # Rename columns based on position
    col_names = ['sort_id', 'family', 'id', 'name', 'description', 'discussion',
                 'params', 'addl_req', 'fedramp_param', 'monitoring']
    df.columns = col_names[:len(df.columns)]

    # Filter out header rows and empty rows
    df = df[df['sort_id'].notna() & (df['sort_id'] != 'SORT ID')]

    controls = {}
    for _, row in df.iterrows():
        raw_id = str(row['sort_id']).strip()
        control_id = normalize_control_id(raw_id)

        # Extract family from control ID (e.g., "AC-1" -> "AC")
        family = control_id.split('-')[0] if '-' in control_id else control_id[:2]

        raw_params = clean_value(row.get('params'))
        formatted_params = format_fedramp_parameters(raw_params) if raw_params else None

        controls[control_id] = {
            # Core control data (shared across baselines)
            'control_id': control_id,
            'title': clean_value(row['name']) or '',
            'family': family,
            'description': clean_value(row['description']) or '',
            'discussion': clean_value(row.get('discussion')),
            # Baseline-specific data
            'baseline_data': {
                'fedramp_parameters': formatted_params,
                'additional_requirements': clean_value(row.get('addl_req')),
                'monitoring_periodicity': clean_value(row.get('monitoring')),
            }
        }

    return controls


def parse_li_saas_sheet(xl):
    """Parse LI-SaaS sheet which has a different structure - just control IDs."""
    df = pd.read_excel(xl, sheet_name='LI-SaaS Baseline', skiprows=1)
    df.columns = ['no', 'control_id', 'name', 'tailoring', 'comments']

    # Filter valid rows
    df = df[df['control_id'].notna()]

    # Return set of normalized control IDs
    return set(normalize_control_id(str(cid).strip()) for cid in df['control_id'])


def main():
    excel_file = require_raw_input(EXCEL_FILENAME)
    print(f"Parsing {excel_file}...")
    xl = pd.ExcelFile(excel_file)

    # Parse all baselines - each returns full control data with baseline-specific fields
    low_controls = parse_baseline_sheet(xl, 'Low Baseline')
    moderate_controls = parse_baseline_sheet(xl, 'Moderate Baseline')
    high_controls = parse_baseline_sheet(xl, 'High Baseline')
    li_saas_control_ids = parse_li_saas_sheet(xl)  # Different structure - IDs only

    print(f"  Low: {len(low_controls)} controls")
    print(f"  Moderate: {len(moderate_controls)} controls")
    print(f"  High: {len(high_controls)} controls")
    print(f"  LI-SaaS: {len(li_saas_control_ids)} controls")

    # Build controls with nested baselines structure
    # Use High as the base (superset of all controls)
    all_controls = []
    for control_id, high_data in high_controls.items():
        # Create the control with shared fields from High baseline
        control = {
            'control_id': high_data['control_id'],
            'title': high_data['title'],
            'family': high_data['family'],
            'description': high_data['description'],
            'discussion': high_data['discussion'],
            'baselines': {}
        }

        # Add Low baseline data if control is in Low
        if control_id in low_controls:
            low_data = low_controls[control_id]['baseline_data']
            control['baselines']['low'] = {
                'included': True,
                'fedramp_parameters': low_data['fedramp_parameters'],
                'additional_requirements': low_data['additional_requirements'],
                'monitoring_periodicity': low_data['monitoring_periodicity'],
            }

        # Add Moderate baseline data if control is in Moderate
        if control_id in moderate_controls:
            mod_data = moderate_controls[control_id]['baseline_data']
            control['baselines']['moderate'] = {
                'included': True,
                'fedramp_parameters': mod_data['fedramp_parameters'],
                'additional_requirements': mod_data['additional_requirements'],
                'monitoring_periodicity': mod_data['monitoring_periodicity'],
            }

        # Add High baseline data (always present)
        high_baseline_data = high_data['baseline_data']
        control['baselines']['high'] = {
            'included': True,
            'fedramp_parameters': high_baseline_data['fedramp_parameters'],
            'additional_requirements': high_baseline_data['additional_requirements'],
            'monitoring_periodicity': high_baseline_data['monitoring_periodicity'],
        }

        # Add LI-SaaS indicator (no baseline-specific data available)
        if control_id in li_saas_control_ids:
            control['baselines']['li_saas'] = {
                'included': True,
            }

        all_controls.append(control)

    # Sort by control ID (natural sort for proper numeric ordering)
    all_controls.sort(key=lambda c: natural_sort_key(c['control_id']))

    # Build output
    output = {
        "framework": {
            "id": "fedramp-rev5",
            "name": "FedRAMP",
            "version": "Rev 5",
            "description": "Federal Risk and Authorization Management Program Security Baselines based on NIST SP 800-53 Rev 5"
        },
        "families": FAMILIES,
        "controls": all_controls
    }

    save_json(OUTPUT_FILE, output)

    print(f"\nWrote {len(all_controls)} controls to {OUTPUT_FILE}")

    # Print baseline stats
    low_count = sum(1 for c in all_controls if 'low' in c['baselines'])
    mod_count = sum(1 for c in all_controls if 'moderate' in c['baselines'])
    high_count = sum(1 for c in all_controls if 'high' in c['baselines'])
    li_saas_count = sum(1 for c in all_controls if 'li_saas' in c['baselines'])
    print(f"  Low baseline: {low_count}")
    print(f"  Moderate baseline: {mod_count}")
    print(f"  High baseline: {high_count}")
    print(f"  LI-SaaS baseline: {li_saas_count}")

    # Show example of baseline differences
    print("\nExample: AC-2 baseline differences:")
    ac2 = next((c for c in all_controls if c['control_id'] == 'AC-2'), None)
    if ac2:
        for baseline, data in ac2['baselines'].items():
            if data.get('fedramp_parameters'):
                print(f"  {baseline.upper()}:")
                for line in data['fedramp_parameters'].split('\n')[:3]:
                    print(f"    {line}")


if __name__ == "__main__":
    main()
