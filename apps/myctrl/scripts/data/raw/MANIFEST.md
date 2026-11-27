# Raw Input Manifest

This directory holds the raw upstream files (Excel/CSV/JSON downloads) consumed
by the Python data pipeline in `scripts/`. Most binary inputs (`*.xlsx`) are
gitignored, so a fresh checkout will not have them. Scripts that need a missing
file raise `FileNotFoundError` pointing back to this manifest.

Place each file here (`scripts/data/raw/`) with the exact filename listed below.

## Excel inputs (gitignored, download manually)

| File | Consumed by | Source |
| --- | --- | --- |
| `Cybersecurity_Framework_v2-0_Concept_Crosswalk_800-53_5_2_0_draft.xlsx` | `generate_crosswalk.py` (writes `src/data/csf-nist-crosswalk.json`) | NIST CSF 2.0 resources, concept crosswalk to SP 800-53 Rev 5.2.0 draft: https://www.nist.gov/cyberframework |
| `Cybersecurity_Framework_v2.0_Concept_Crosswalk_Template_v1.0.xlsx` | `parse_nist_iso_crosswalk.py` (writes `src/data/csf-iso-crosswalk.json`; updates local `iso-27001-2022.json` if present) | NIST OLIR catalog, reference ID 154 (CSF 2.0 to ISO/IEC 27001:2022): https://csrc.nist.gov/projects/olir/informative-reference-catalog/details?referenceId=154 |
| `csf-v2_pci-dss_v4.0.1_olir-supportive.xlsx` | `generate_pci_crosswalk.py` (writes `src/data/csf-pci-crosswalk.json`) | NIST OLIR catalog, CSF 2.0 to PCI DSS v4.0.1 supportive mapping: https://csrc.nist.gov/projects/olir/informative-reference-catalog |
| `Prioritized-Approach-Tool-For-PCI-DSS-v4_0_1.xlsx` | `parse_pci_excel.py` (move generated `pci-dss-v4.json` into gitignored `src/data/local/pci-dss-v4.json`) | PCI SSC document library, "Prioritized Approach Tool" for PCI DSS v4.0.1: https://www.pcisecuritystandards.org/document_library/ |
| `FedRAMP_Security_Controls_Baseline (1).xlsx` | `generate_fedramp_baselines.py` (writes `src/data/fedramp-rev5.json`) | FedRAMP Rev 5 baselines workbook: https://www.fedramp.gov/documents-templates/ (keep the ` (1)` suffix or rename the constant in the script) |
| `StateRAMP-Baseline-Requirements-for-Authorized.xlsx` | `transform-govramp.py` (enriches `src/data/govramp.json`) | GovRAMP (formerly StateRAMP) documents: https://govramp.org/documents/ |
| `GovRAMP-Core-Controls.xlsx` | `transform-govramp.py` (enriches `src/data/govramp.json`) | GovRAMP documents: https://govramp.org/documents/ |

## SCF STRM spreadsheets (gitignored, directory `scf-strm/`)

`extract_strm_frameworks.py` reads every `scf-strm-*.xlsx` listed in its
`STRM_CONFIGS` from `scripts/data/raw/scf-strm/` when supplied locally under an
SCF license. Move any restricted/commercial framework JSONs into gitignored
`src/data/local/` and `ccf-extended-crosswalks.json` (`ccf_to_framework` /
`framework_to_ccf` keys) into gitignored `src/data/local/crosswalks/`.

## Optional upstream inputs (not committed in open-source monorepo)

These large upstream inputs (~21 MB) are excluded from the public monorepo and
can be downloaded separately if regenerating built-in datasets from scratch:

| File/dir | Consumed by | Notes |
| --- | --- | --- |
| `FRMR.documentation.json` | `extract_frmr_glossary.py`, `extract_frmr_requirements.py` | FedRAMP Machine Readable docs (github.com/FedRAMP) |
| `nist-official/` | `parse_nist_oscal.py`, `parse_cprt_excel.py`, `audit_framework_data.py` | NIST OSCAL catalog/baselines and CPRT exports |
| `test_ac-2.json`, `test_nist-800-53-r5.json` | test fixtures | - |
