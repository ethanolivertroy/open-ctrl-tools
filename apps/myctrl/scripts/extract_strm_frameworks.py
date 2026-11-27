#!/usr/bin/env python3
"""
Extract frameworks and crosswalks from SCF STRM files.

The upstream inputs are unchanged SCF STRM spreadsheets (used with
permission); the outputs are branded as the myCTRL CCF: framework JSONs in
src/data plus ccf-extended-crosswalks.json with ccf_to_framework /
framework_to_ccf mappings keyed by myCTRL CCF control IDs.

STRM files contain:
- Row 0-3: Header info (document names, URLs)
- Row 4: Column headers
- Row 5+: Data

Columns:
- 0: FDE # (control ID)
- 1: FDE Name (optional, often NaN)
- 2: FDE Description
- 3: STRM Rationale
- 4: STRM Relationship (intersects, subset, superset)
- 5: SCF Control Name
- 6: SCF # (SCF control ID)
- 7: SCF Description
- 8: Strength (1-10)
- 9: Notes
"""

import traceback
from collections import defaultdict
from pathlib import Path

import pandas as pd

from lib.io import save_json
from lib.paths import DATA_DIR, RAW_DIR
from lib.slugify import slugify_text as slugify  # noqa: F401 (kept for parity with old local def)

# Configuration for each STRM file
STRM_CONFIGS = {
    # Americas
    'scf-strm-americas-canada-itsp-10-171.xlsx': {
        'id': 'canada-itsp',
        'name': 'Canada ITSP 10.171',
        'version': '10.171',
        'category': 'international',
        'search_prefix': 'itsp',
    },
    'scf-strm-americas-canada-osfi-b13.xlsx': {
        'id': 'canada-osfi-b13',
        'name': 'OSFI B-13',
        'version': '2022',
        'category': 'international',
        'search_prefix': 'osfi',
    },

    # APAC
    'scf-strm-apac-australia-essential-8.xlsx': {
        'id': 'au-essential-8',
        'name': 'Australia Essential Eight',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'e8',
    },
    'scf-strm-apac-australia-ism-june-2024.xlsx': {
        'id': 'au-ism',
        'name': 'Australia ISM',
        'version': 'June 2024',
        'category': 'international',
        'search_prefix': 'ism',
    },
    'scf-strm-apac-china-cybersecurity-law-2017.xlsx': {
        'id': 'china-csl',
        'name': 'China Cybersecurity Law',
        'version': '2017',
        'category': 'international',
        'search_prefix': 'csl',
    },
    'scf-strm-apac-india-dpdpa-2023.xlsx': {
        'id': 'india-dpdpa',
        'name': 'India DPDPA',
        'version': '2023',
        'category': 'privacy',
        'search_prefix': 'dpdpa',
    },
    'scf-strm-apac-india-sebi.xlsx': {
        'id': 'india-sebi',
        'name': 'India SEBI Guidelines',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'sebi',
    },
    'scf-strm-apac-nz-hisf-2025.xlsx': {
        'id': 'nz-hisf',
        'name': 'New Zealand HISF',
        'version': '2025',
        'category': 'international',
        'search_prefix': 'hisf',
    },
    'scf-strm-apac-nz-hisf-suppliers-2025.xlsx': {
        'id': 'nz-hisf-suppliers',
        'name': 'New Zealand HISF Suppliers',
        'version': '2025',
        'category': 'international',
        'search_prefix': 'hisfs',
    },

    # EMEA
    'scf-strm-emea-eu-ai-act.xlsx': {
        'id': 'eu-ai-act-strm',
        'name': 'EU AI Act (Detailed)',
        'version': '2024',
        'category': 'ai',
        'search_prefix': 'euaidetail',
    },
    'scf-strm-emea-eu-cyber-resilience-act.xlsx': {
        'id': 'eu-cra',
        'name': 'EU Cyber Resilience Act',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'cra',
    },
    'scf-strm-emea-eu-cyber-resilience-act-annexes.xlsx': {
        'id': 'eu-cra-annexes',
        'name': 'EU CRA Annexes',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'craannex',
    },
    'scf-strm-emea-eu-dora.xlsx': {
        'id': 'eu-dora',
        'name': 'EU DORA',
        'version': '2022',
        'category': 'international',
        'search_prefix': 'dora',
    },
    'scf-strm-emea-sa-cybersecurity-guidelines-iot.xlsx': {
        'id': 'sa-iot',
        'name': 'Saudi Arabia IoT Guidelines',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'saiot',
    },
    'scf-strm-emea-sa-pdpl.xlsx': {
        'id': 'sa-pdpl',
        'name': 'Saudi Arabia PDPL',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'pdpl',
    },
    'scf-strm-emea-spain-boe-a-2022-7191.xlsx': {
        'id': 'spain-ens',
        'name': 'Spain ENS (BOE-A-2022-7191)',
        'version': '2022',
        'category': 'international',
        'search_prefix': 'ens',
    },
    'scf-strm-emea-uae-niaf.xlsx': {
        'id': 'uae-niaf',
        'name': 'UAE NIAF',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'niaf',
    },
    'scf-strm-emea-uk-caf-4-0.xlsx': {
        'id': 'uk-caf',
        'name': 'UK CAF',
        'version': '4.0',
        'category': 'international',
        'search_prefix': 'caf',
    },
    'scf-strm-emea-uk-def-stan-05-138.xlsx': {
        'id': 'uk-defstan',
        'name': 'UK DEF STAN 05-138',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'defstan',
    },

    # General/International
    'scf-strm-general-aicpa-tsc-2017.xlsx': {
        'id': 'soc2-tsc-detailed',
        'name': 'SOC 2 TSC (Detailed)',
        'version': '2017',
        'category': 'enterprise',
        'search_prefix': 'tsc',
    },
    'scf-strm-general-apec-privacy-framework.xlsx': {
        'id': 'apec-privacy',
        'name': 'APEC Privacy Framework',
        'version': '2015',
        'category': 'privacy',
        'search_prefix': 'apec',
    },
    'scf-strm-general-cis-csc-8-1.xlsx': {
        'id': 'cis-v8-detailed',
        'name': 'CIS Controls v8.1 (Detailed)',
        'version': '8.1',
        'category': 'enterprise',
        'search_prefix': 'cisdetail',
    },
    'scf-strm-general-govramp.xlsx': {
        'id': 'govramp',
        'name': 'GovRAMP',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'govramp',
    },
    'scf-strm-general-iec-tr-60601-4-5.xlsx': {
        'id': 'iec-60601',
        'name': 'IEC TR 60601-4-5',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'iec60601',
    },
    'scf-strm-general-imo-maritime-cyber-risk-management.xlsx': {
        'id': 'imo-maritime',
        'name': 'IMO Maritime Cyber Risk',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'imo',
    },
    'scf-strm-general-iso-27001-2022.xlsx': {
        'id': 'iso-27001-detailed',
        'name': 'ISO 27001:2022 (Detailed)',
        'version': '2022',
        'category': 'enterprise',
        'search_prefix': 'iso27001d',
    },
    'scf-strm-general-iso-27002-2022.xlsx': {
        'id': 'iso-27002',
        'name': 'ISO 27002:2022',
        'version': '2022',
        'category': 'enterprise',
        'search_prefix': 'iso27002',
    },
    'scf-strm-general-iso-27701-2025.xlsx': {
        'id': 'iso-27701',
        'name': 'ISO 27701',
        'version': '2025',
        'category': 'privacy',
        'search_prefix': 'iso27701',
    },
    'scf-strm-general-iso-29100-2024.xlsx': {
        'id': 'iso-29100',
        'name': 'ISO 29100',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'iso29100',
    },
    'scf-strm-general-iso-42001-2023.xlsx': {
        'id': 'iso-42001-detailed',
        'name': 'ISO 42001:2023 (Detailed)',
        'version': '2023',
        'category': 'ai',
        'search_prefix': 'iso42001d',
    },
    'scf-strm-general-naic-insurance-data-security-model-law-668.xlsx': {
        'id': 'naic-668',
        'name': 'NAIC Model Law 668',
        'version': '2024',
        'category': 'enterprise',
        'search_prefix': 'naic',
    },
    'scf-strm-general-nist-800-161-r1.xlsx': {
        'id': 'nist-800-161',
        'name': 'NIST SP 800-161',
        'version': 'Rev 1',
        'category': 'federal',
        'search_prefix': 'sp161',
    },
    'scf-strm-general-nist-800-171-r3.xlsx': {
        'id': 'nist-800-171-r3',
        'name': 'NIST SP 800-171 Rev 3',
        'version': 'Rev 3',
        'category': 'federal',
        'search_prefix': 'sp171r3',
    },
    'scf-strm-general-nist-800-171a-r3.xlsx': {
        'id': 'nist-800-171a-r3',
        'name': 'NIST SP 800-171A Rev 3',
        'version': 'Rev 3',
        'category': 'federal',
        'search_prefix': 'sp171ar3',
    },
    'scf-strm-general-nist-800-171a.xlsx': {
        'id': 'nist-800-171a',
        'name': 'NIST SP 800-171A',
        'version': 'Rev 2',
        'category': 'federal',
        'search_prefix': 'sp171a',
    },
    'scf-strm-general-nist-800-172.xlsx': {
        'id': 'nist-800-172',
        'name': 'NIST SP 800-172',
        'version': '2021',
        'category': 'federal',
        'search_prefix': 'sp172',
    },
    'scf-strm-general-nist-800-207.xlsx': {
        'id': 'nist-800-207',
        'name': 'NIST SP 800-207 Zero Trust',
        'version': '2020',
        'category': 'federal',
        'search_prefix': 'zt',
    },
    'scf-strm-general-nist-800-218.xlsx': {
        'id': 'nist-800-218',
        'name': 'NIST SP 800-218 SSDF',
        'version': '1.1',
        'category': 'federal',
        'search_prefix': 'ssdf',
    },
    'scf-strm-general-nist-ai-600-1.xlsx': {
        'id': 'nist-ai-600-1',
        'name': 'NIST AI 600-1',
        'version': '1.0',
        'category': 'ai',
        'search_prefix': 'ai600',
    },
    'scf-strm-general-oecd-privacy-principles.xlsx': {
        'id': 'oecd-privacy',
        'name': 'OECD Privacy Principles',
        'version': '2013',
        'category': 'privacy',
        'search_prefix': 'oecd',
    },
    'scf-strm-general-sparta.xlsx': {
        'id': 'sparta',
        'name': 'SPARTA',
        'version': '2024',
        'category': 'international',
        'search_prefix': 'sparta',
    },
    'scf-strm-general-tisax-6-0-3.xlsx': {
        'id': 'tisax',
        'name': 'TISAX',
        'version': '6.0.3',
        'category': 'enterprise',
        'search_prefix': 'tisax',
    },
    'scf-strm-data-privacy-management-principles.xlsx': {
        'id': 'dpmp',
        'name': 'Data Privacy Management Principles',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'dpmp',
    },

    # US Federal
    'scf-strm-us-fed-45-cfr-155-260.xlsx': {
        'id': 'cms-45cfr',
        'name': '45 CFR 155.260',
        'version': '2024',
        'category': 'federal',
        'search_prefix': '45cfr',
    },
    'scf-strm-us-fed-cjis-5-9-3.xlsx': {
        'id': 'cjis',
        'name': 'FBI CJIS',
        'version': '5.9.3',
        'category': 'federal',
        'search_prefix': 'cjis',
    },
    'scf-strm-us-fed-data-privacy-framework.xlsx': {
        'id': 'us-dpf',
        'name': 'US Data Privacy Framework',
        'version': '2023',
        'category': 'privacy',
        'search_prefix': 'dpf',
    },
    'scf-strm-us-fed-dhs-cis-tic-3-0.xlsx': {
        'id': 'tic-3',
        'name': 'DHS TIC 3.0',
        'version': '3.0',
        'category': 'federal',
        'search_prefix': 'tic',
    },
    'scf-strm-us-fed-dhs-cisa-cpg.xlsx': {
        'id': 'cisa-cpg',
        'name': 'CISA CPG',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'cpg',
    },
    'scf-strm-us-fed-dhs-cisa-ssdaf.xlsx': {
        'id': 'cisa-ssdaf',
        'name': 'CISA SSDAF',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'ssdaf',
    },
    'scf-strm-us-fed-dod-cmmc-2-level-1.xlsx': {
        'id': 'cmmc-l1',
        'name': 'CMMC 2.0 Level 1',
        'version': '2.0',
        'category': 'federal',
        'search_prefix': 'cmmcl1',
    },
    'scf-strm-us-fed-dod-cmmc-2-level-1-aos.xlsx': {
        'id': 'cmmc-l1-aos',
        'name': 'CMMC 2.0 Level 1 AOS',
        'version': '2.0',
        'category': 'federal',
        'search_prefix': 'cmmcaos',
    },
    'scf-strm-us-fed-dod-zt-roadmap.xlsx': {
        'id': 'dod-zt-roadmap',
        'name': 'DoD Zero Trust Roadmap',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'dodztr',
    },
    'scf-strm-us-fed-dod-zta-reference-architecture-2-0.xlsx': {
        'id': 'dod-zta',
        'name': 'DoD ZTA Reference Architecture',
        'version': '2.0',
        'category': 'federal',
        'search_prefix': 'dodzta',
    },
    'scf-strm-us-fed-eo-14028.xlsx': {
        'id': 'eo-14028',
        'name': 'Executive Order 14028',
        'version': '2021',
        'category': 'federal',
        'search_prefix': 'eo14028',
    },
    'scf-strm-us-fed-fca-crm.xlsx': {
        'id': 'fca-crm',
        'name': 'FCA CRM',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'fca',
    },
    'scf-strm-us-fed-fipps.xlsx': {
        'id': 'fipps',
        'name': 'FIPPs',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'fipps',
    },
    'scf-strm-us-fed-glba-cfr-314.xlsx': {
        'id': 'glba',
        'name': 'GLBA (16 CFR 314)',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'glba',
    },
    'scf-strm-us-fed-hipaa-simplification-2013.xlsx': {
        'id': 'hipaa-simp',
        'name': 'HIPAA Simplification 2013',
        'version': '2013',
        'category': 'federal',
        'search_prefix': 'hipaas',
    },
    'scf-strm-us-fed-nerc-cip-2024.xlsx': {
        'id': 'nerc-cip',
        'name': 'NERC CIP',
        'version': '2024',
        'category': 'federal',
        'search_prefix': 'nerccip',
    },
    'scf-strm-us-fed-sec-cybersecurity-rule.xlsx': {
        'id': 'sec-cyber',
        'name': 'SEC Cybersecurity Rule',
        'version': '2023',
        'category': 'federal',
        'search_prefix': 'sec',
    },

    # US State
    'scf-strm-us-state-nv-regulation-5.xlsx': {
        'id': 'nv-reg5',
        'name': 'Nevada Regulation 5',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'nvreg5',
    },
    'scf-strm-us-state-ny-dfs-23-nycrr500-amd2.xlsx': {
        'id': 'ny-dfs-500',
        'name': 'NY DFS 23 NYCRR 500',
        'version': 'Amendment 2',
        'category': 'enterprise',
        'search_prefix': 'nydfs',
    },
    'scf-strm-us-state-or-cpa.xlsx': {
        'id': 'or-cpa',
        'name': 'Oregon CPA',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'orcpa',
    },
    'scf-strm-us-state-tn-information-protection-act.xlsx': {
        'id': 'tn-ipa',
        'name': 'Tennessee IPA',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'tnipa',
    },
    'scf-strm-us-state-tx-cdpa.xlsx': {
        'id': 'tx-cdpa',
        'name': 'Texas CDPA',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'txcdpa',
    },
    'scf-strm-us-state-tx-sb2610.xlsx': {
        'id': 'tx-sb2610',
        'name': 'Texas SB 2610',
        'version': '2024',
        'category': 'enterprise',
        'search_prefix': 'txsb2610',
    },
    'scf-strm-us-state-va-cdpa.xlsx': {
        'id': 'va-cdpa',
        'name': 'Virginia CDPA',
        'version': '2024',
        'category': 'privacy',
        'search_prefix': 'vacdpa',
    },
}

# Skip these files as they have already been extracted or are duplicates
SKIP_FILES = {
    'scf-strm-us-fed-hipaa-security-rule.xlsx',  # Already extracted
    'scf-strm-emea-eu-gdpr.xlsx',  # Already extracted
    'scf-strm-emea-eu-nis2.xlsx',  # Already extracted
    'scf-strm-emea-eu-nis2-annex.xlsx',  # Part of NIS2
    'scf-strm-us-state-ca-ccpa-2026.xlsx',  # Already extracted
    'scf-strm-general-nist-800-171-r2.xlsx',  # We already have this version
    'scf-strm-general-nist-800-53-r5-2.xlsx',  # We already have this
    'scf-strm-general-nist-csf-2-0.xlsx',  # We already have this
    'scf-strm-general-nist-ai-100-1-rmf.xlsx',  # We already have AI RMF
    'scf-strm-general-pci-dss-4-0-1.xlsx',  # We already have PCI DSS
}


def extract_family_from_id(control_id: str) -> str:
    """Extract family/section from control ID."""
    # Handle various formats
    if '.' in control_id:
        parts = control_id.split('.')
        return parts[0]
    elif ' ' in control_id:
        return control_id.split(' ')[0]
    elif '-' in control_id:
        return control_id.split('-')[0]
    return control_id


def parse_strm_file(filepath: str) -> tuple[list[dict], dict[str, list[str]], str]:
    """
    Parse a STRM file and extract controls and crosswalk mappings.

    Returns:
        controls: List of control dicts
        scf_mappings: Dict mapping control IDs to SCF IDs
        framework_name: Extracted framework name
    """
    xl = pd.ExcelFile(filepath)
    sheet_name = xl.sheet_names[0]

    # Read raw data
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=None)

    # Extract framework name from header (row 0, col 6)
    framework_name = str(df.iloc[0, 6]) if pd.notna(df.iloc[0, 6]) else sheet_name

    # Find header row (usually row 4) - look for "FDE #"
    header_row = 4
    for i in range(10):
        if pd.notna(df.iloc[i, 0]) and 'FDE' in str(df.iloc[i, 0]):
            header_row = i
            break

    # Re-read with proper header
    df = pd.read_excel(filepath, sheet_name=sheet_name, header=header_row)

    # Normalize column names
    df.columns = [str(c).strip() for c in df.columns]

    # Find the control ID column (FDE #)
    id_col = None
    for col in df.columns:
        if 'FDE' in col and '#' in col:
            id_col = col
            break
    if id_col is None:
        id_col = df.columns[0]

    # Find description column (FDE Description or similar)
    desc_col = None
    for col in df.columns:
        if 'FDE' in col and ('Description' in col or 'Element' in col):
            desc_col = col
            break
    if desc_col is None:
        desc_col = df.columns[2] if len(df.columns) > 2 else df.columns[1]

    # Find SCF ID column
    scf_col = None
    for col in df.columns:
        if col == 'SCF #' or (col.startswith('SCF') and '#' in col):
            scf_col = col
            break
    if scf_col is None:
        scf_col = df.columns[6] if len(df.columns) > 6 else None

    # Extract unique controls
    controls_dict = {}
    scf_mappings = defaultdict(list)

    for _, row in df.iterrows():
        control_id = str(row[id_col]).strip() if pd.notna(row[id_col]) else None
        if not control_id or control_id == 'nan':
            continue

        description = str(row[desc_col]).strip() if pd.notna(row[desc_col]) else ''

        # Add control if not seen before
        if control_id not in controls_dict:
            family = extract_family_from_id(control_id)
            controls_dict[control_id] = {
                'control_id': control_id,
                'title': control_id,  # Will be updated if FDE Name exists
                'family': family,
                'description': description,
            }

        # Extract SCF mapping
        if scf_col and pd.notna(row[scf_col]):
            scf_id = str(row[scf_col]).strip()
            if scf_id and scf_id != 'nan' and scf_id not in scf_mappings[control_id]:
                scf_mappings[control_id].append(scf_id)

    controls = [
        control
        for control in controls_dict.values()
        if control.get('description') or scf_mappings.get(control['control_id'])
    ]
    return controls, dict(scf_mappings), framework_name


def generate_families(controls: list[dict]) -> dict[str, str]:
    """Generate family mapping from controls."""
    families = {}
    for control in controls:
        family = control['family']
        if family not in families:
            families[family] = family  # Use family ID as name
    return families


def save_framework_json(config: dict, controls: list[dict], output_dir: str) -> str:
    """Save framework JSON file."""
    families = generate_families(controls)

    framework_data = {
        'framework': {
            'id': config['id'],
            'name': config['name'],
            'version': config['version'],
            'description': f"{config['name']} compliance framework",
        },
        'families': families,
        'controls': controls,
    }

    output_path = save_json(Path(output_dir) / f"{config['id']}.json", framework_data)

    return str(output_path)


def main():
    strm_dir = RAW_DIR / 'scf-strm'
    output_dir = DATA_DIR

    if not strm_dir.exists():
        raise FileNotFoundError(
            f"STRM input directory not found: {strm_dir}\n"
            f"Raw SCF STRM spreadsheets are not committed to git. "
            f"See {RAW_DIR / 'MANIFEST.md'} for download instructions."
        )

    # Track all crosswalks (keyed by myCTRL CCF control IDs)
    all_crosswalks = {
        'ccf_to_framework': {},
        'framework_to_ccf': {},
    }

    # Track framework configs for frameworks.ts
    framework_configs = []
    search_prefixes = []

    # Process each STRM file
    for filename, config in STRM_CONFIGS.items():
        if filename in SKIP_FILES:
            print(f"Skipping {filename} (already extracted)")
            continue

        filepath = strm_dir / filename
        if not filepath.exists():
            print(f"Warning: {filename} not found")
            continue

        print(f"Processing {filename}...")
        try:
            controls, scf_mappings, detected_name = parse_strm_file(str(filepath))

            if not controls:
                print(f"  Warning: No controls extracted from {filename}")
                continue

            # Save framework JSON
            json_path = save_framework_json(config, controls, str(output_dir))
            print(f"  Saved {len(controls)} controls to {json_path}")

            # Add to crosswalks (SCF # column values are the myCTRL CCF control IDs)
            fw_id = config['id']
            all_crosswalks['ccf_to_framework'][fw_id] = {}
            all_crosswalks['framework_to_ccf'][fw_id] = {}

            for control_id, ccf_ids in scf_mappings.items():
                for ccf_id in ccf_ids:
                    # CCF to framework
                    if ccf_id not in all_crosswalks['ccf_to_framework'][fw_id]:
                        all_crosswalks['ccf_to_framework'][fw_id][ccf_id] = []
                    if control_id not in all_crosswalks['ccf_to_framework'][fw_id][ccf_id]:
                        all_crosswalks['ccf_to_framework'][fw_id][ccf_id].append(control_id)

                    # Framework to CCF
                    if control_id not in all_crosswalks['framework_to_ccf'][fw_id]:
                        all_crosswalks['framework_to_ccf'][fw_id][control_id] = []
                    if ccf_id not in all_crosswalks['framework_to_ccf'][fw_id][control_id]:
                        all_crosswalks['framework_to_ccf'][fw_id][control_id].append(ccf_id)

            # Track for code generation
            framework_configs.append({
                'id': config['id'],
                'name': config['name'],
                'version': config['version'],
                'category': config['category'],
                'control_count': len(controls),
            })
            search_prefixes.append({
                'prefix': config['search_prefix'],
                'id': config['id'],
            })

        except Exception as e:
            print(f"  Error processing {filename}: {e}")
            traceback.print_exc()

    # Save crosswalks
    crosswalk_path = save_json(output_dir / 'ccf-extended-crosswalks.json', {
        'metadata': {
            'source': (
                'Derived from SCF STRM mappings (used with permission); '
                'maintained as the myCTRL CCF crosswalk set'
            ),
            'description': 'myCTRL CCF control mappings to international and regional frameworks',
        },
        **all_crosswalks,
    })
    print(f"\nSaved crosswalks to {crosswalk_path}")

    # Output code snippets for manual integration
    print("\n" + "="*60)
    print("Framework configs for frameworks.ts:")
    print("="*60)
    for fc in framework_configs:
        print(f"""
  '{fc['id']}': {{
    id: '{fc['id']}',
    name: '{fc['name']}',
    version: '{fc['version']}',
    category: '{fc['category']}',
    description: '{fc['name']} compliance framework',
  }},""")

    print("\n" + "="*60)
    print("Search prefixes for CommandSearch.tsx:")
    print("="*60)
    for sp in search_prefixes:
        print(f"  '{sp['prefix']}': '{sp['id']}',")

    print("\n" + "="*60)
    print("Import statements for frameworks.ts:")
    print("="*60)
    for fc in framework_configs:
        print(f"import {fc['id'].replace('-', '')}Data from './{fc['id']}.json';")

    print("\n" + "="*60)
    print("FRAMEWORK_DATA entries:")
    print("="*60)
    for fc in framework_configs:
        var_name = fc['id'].replace('-', '')
        print(f"  '{fc['id']}': ({var_name}Data as {{ controls: BaseControl[] }}).controls,")


if __name__ == '__main__':
    main()
