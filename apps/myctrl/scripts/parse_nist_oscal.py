#!/usr/bin/env python3
"""
Parse NIST OSCAL JSON files and generate control data for myctrl.tools

Usage:
    python scripts/parse_nist_oscal.py
"""
import json
import re
from pathlib import Path
from typing import Dict, List, Set, Any, Optional


def normalize_control_id(oscal_id: str) -> str:
    """
    Convert OSCAL ID format to standard format.
    ac-2 -> AC-2
    ac-2.1 -> AC-2(1)
    """
    # Split on dot for enhancements
    parts = oscal_id.upper().split('.')
    base = parts[0]

    if len(parts) > 1:
        enhancement = parts[1]
        return f"{base}({enhancement})"
    return base


def clean_prose(text: str) -> str:
    """Clean OSCAL parameter placeholders from prose."""
    # Replace {{ insert: param, ac-02_odp.01 }} with [Assignment: ...]
    text = re.sub(
        r'\{\{\s*insert:\s*param,\s*([^}]+)\s*\}\}',
        r'[Assignment: organization-defined \1]',
        text
    )
    return text


def extract_prose(part: Dict[str, Any]) -> str:
    """Extract prose from a part, including nested parts."""
    prose_parts = []

    # Direct prose
    if 'prose' in part:
        prose_parts.append(clean_prose(part['prose']))

    # Nested parts (for statements with sub-items)
    for sub_part in part.get('parts', []):
        sub_prose = clean_prose(sub_part.get('prose', ''))
        if sub_prose:
            # Add sub-item ID if present
            prop_id = sub_part.get('id', '')
            if prop_id:
                # Clean up the ID to get item letter/number
                item_match = re.search(r'[._]([a-z0-9]+)$', prop_id)
                if item_match:
                    prose_parts.append(f"{item_match.group(1)}. {sub_prose}")
                else:
                    prose_parts.append(sub_prose)
            else:
                prose_parts.append(sub_prose)

    return '\n'.join(prose_parts)


def parse_baseline_profile(profile_path: Path) -> Set[str]:
    """Parse a baseline profile and return set of included control IDs."""
    with open(profile_path, 'r') as f:
        data = json.load(f)

    control_ids = set()
    profile = data.get('profile', {})

    for imp in profile.get('imports', []):
        for include in imp.get('include-controls', []):
            for ctrl_id in include.get('with-ids', []):
                # Normalize the ID
                normalized = normalize_control_id(ctrl_id)
                control_ids.add(normalized)

    return control_ids


def parse_control(control: Dict[str, Any], family_name: str, baselines: Dict[str, Set[str]]) -> Dict[str, Any]:
    """Parse a single control from OSCAL format."""
    # Get control ID and title
    oscal_id = control.get('id', '')
    control_id = normalize_control_id(oscal_id)
    title = control.get('title', '')

    # Extract statement (description)
    description = ''
    guidance = ''

    for part in control.get('parts', []):
        part_name = part.get('name', '')

        if part_name == 'statement':
            description = extract_prose(part)
        elif part_name == 'guidance':
            guidance = part.get('prose', '')

    # Check baselines
    baseline_low = control_id in baselines.get('LOW', set())
    baseline_moderate = control_id in baselines.get('MODERATE', set())
    baseline_high = control_id in baselines.get('HIGH', set())
    baseline_privacy = control_id in baselines.get('PRIVACY', set())

    # Extract related controls from links
    related_controls = []
    for link in control.get('links', []):
        if link.get('rel') == 'related':
            href = link.get('href', '')
            # Extract control ID from href like "#ac-2"
            match = re.search(r'#([a-z]{2,3}-\d+(?:\.\d+)?)', href)
            if match:
                related_controls.append(normalize_control_id(match.group(1)))

    # Get enhancement IDs
    enhancements = []
    for enh in control.get('controls', []):
        enh_id = normalize_control_id(enh.get('id', ''))
        if enh_id:
            enhancements.append(enh_id)

    return {
        'control_id': control_id,
        'title': title,
        'family': family_name,
        'description': description,
        'supplemental_guidance': guidance if guidance else None,
        'baseline_low': baseline_low,
        'baseline_moderate': baseline_moderate,
        'baseline_high': baseline_high,
        'baseline_privacy': baseline_privacy,
        'related_controls': related_controls if related_controls else None,
        'enhancements': enhancements if enhancements else None,
        'threats_addressed': None,  # Not in OSCAL catalog
    }


def parse_oscal_catalog(catalog_path: Path, baselines: Dict[str, Set[str]]) -> List[Dict[str, Any]]:
    """Parse the OSCAL catalog and return all controls."""
    with open(catalog_path, 'r') as f:
        data = json.load(f)

    controls = []
    catalog = data.get('catalog', {})

    # Family ID to name mapping
    family_names = {
        'ac': 'Access Control',
        'at': 'Awareness and Training',
        'au': 'Audit and Accountability',
        'ca': 'Assessment, Authorization, and Monitoring',
        'cm': 'Configuration Management',
        'cp': 'Contingency Planning',
        'ia': 'Identification and Authentication',
        'ir': 'Incident Response',
        'ma': 'Maintenance',
        'mp': 'Media Protection',
        'pe': 'Physical and Environmental Protection',
        'pl': 'Planning',
        'pm': 'Program Management',
        'ps': 'Personnel Security',
        'pt': 'Personally Identifiable Information Processing and Transparency',
        'ra': 'Risk Assessment',
        'sa': 'System and Services Acquisition',
        'sc': 'System and Communications Protection',
        'si': 'System and Information Integrity',
        'sr': 'Supply Chain Risk Management',
    }

    for group in catalog.get('groups', []):
        family_id = group.get('id', '')
        family_name = family_names.get(family_id, group.get('title', 'Unknown'))

        # Process base controls
        for ctrl in group.get('controls', []):
            parsed = parse_control(ctrl, family_name, baselines)
            controls.append({
                'url': f"https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
                'extracted': parsed
            })

            # Process control enhancements (nested controls)
            for enh in ctrl.get('controls', []):
                parsed_enh = parse_control(enh, family_name, baselines)
                controls.append({
                    'url': f"https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
                    'extracted': parsed_enh
                })

    return controls


def main():
    base_dir = Path('scripts/data/raw/nist-official')
    output_dir = Path('scripts/data/raw/nist-800-53-r5')
    output_dir.mkdir(parents=True, exist_ok=True)

    print("Parsing NIST OSCAL data...")

    # Load baseline profiles
    print("\n1. Loading baseline profiles...")
    baselines = {}
    for level in ['LOW', 'MODERATE', 'HIGH', 'PRIVACY']:
        profile_path = base_dir / f'{level.lower()}_baseline.json'
        if profile_path.exists():
            baselines[level] = parse_baseline_profile(profile_path)
            print(f"   {level}: {len(baselines[level])} controls")

    # Parse catalog
    print("\n2. Parsing catalog...")
    catalog_path = base_dir / 'catalog.json'
    controls = parse_oscal_catalog(catalog_path, baselines)
    print(f"   Total controls parsed: {len(controls)}")

    # Generate output
    output = {
        'framework_id': 'nist-800-53-r5',
        'base_url': 'https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final',
        'pages_crawled': len(controls),
        'controls_found': len(controls),
        'controls': controls
    }

    # Save
    output_path = output_dir / 'crawl_results.json'
    with open(output_path, 'w') as f:
        json.dump(output, f, indent=2)

    print(f"\n3. Output saved to: {output_path}")

    # Statistics
    print("\n=== Statistics ===")
    print(f"Total controls: {len(controls)}")

    # Count by baseline
    low_count = sum(1 for c in controls if c['extracted']['baseline_low'])
    mod_count = sum(1 for c in controls if c['extracted']['baseline_moderate'])
    high_count = sum(1 for c in controls if c['extracted']['baseline_high'])
    priv_count = sum(1 for c in controls if c['extracted']['baseline_privacy'])

    print(f"LOW baseline: {low_count}")
    print(f"MODERATE baseline: {mod_count}")
    print(f"HIGH baseline: {high_count}")
    print(f"PRIVACY baseline: {priv_count}")

    # Count by family
    families = {}
    for c in controls:
        family = c['extracted']['family']
        families[family] = families.get(family, 0) + 1

    print("\nControls by family:")
    for family in sorted(families.keys()):
        print(f"  {family}: {families[family]}")


if __name__ == '__main__':
    main()
