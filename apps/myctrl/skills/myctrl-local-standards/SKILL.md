---
name: myctrl-local-standards
description: Parse self-licensed security frameworks and crosswalks into gitignored local overlays for open-ctrl-tools apps/myctrl and query the local myctrl instance via API or CLI scripts.
---

# myctrl Local Standards & Crosswalks Skill

Use this skill when helping a user configure **apps/myctrl** with standards, frameworks, or crosswalk workbooks that they have licensed or obtained directly (for example: PCI DSS, ISO/IEC 27001/27002/27701/42001/23894, SOC 2 TSC, CIS Controls v8, AIUC-1, Adobe CCF, Canada ITSP.10.171, HITRUST CSF, COBIT, CSA CCM, TISAX, or SCF STRM workbooks).

`myctrl` never redistributes commercial, proprietary, non-derivative (`CC BY-ND`), share-alike non-commercial (`CC BY-NC-SA`), or third-party derived crosswalk files. Instead, any JSON placed in the gitignored `src/data/local/` and `src/data/local/crosswalks/` directories is automatically merged into the local catalog, search index, crosswalk viewer, gap assessment workflows, and REST API.

## 1. Local Overlay Locations (Gitignored)

All paths below are relative to `apps/myctrl/`:

- **Framework datasets:** `src/data/local/<framework-id>.json` (ignored by `apps/myctrl/.gitignore`: `src/data/local/*.json`)
- **Crosswalk datasets:** `src/data/local/crosswalks/<filename>.json` (ignored by `apps/myctrl/.gitignore`: `src/data/local/crosswalks/*.json`)

When both a built-in dataset (`src/data/<id>.json`) and a local overlay (`src/data/local/<id>.json`) exist for the same `<framework-id>`, the local overlay takes precedence in `src/data/frameworks.ts`.

Before relying on new local files, always run:

```bash
npm run validate:local
```

And double-check git safety before committing anything:

```bash
git status -s
```

Overlay JSON files must remain untracked/ignored (`*.json` inside `src/data/local/`).

## 2. Included Parser & Transformation Scripts

For standards where an official source workbook or spreadsheet has been supplied locally by the user, `apps/myctrl/scripts/` already contains parsers:

- **PCI DSS v4.0.1 Excel workbook** (`Prioritized-Approach-Tool-For-PCI-DSS-v4_0_1.xlsx` -> place workbook in `scripts/data/raw/`, parse, then move output to `src/data/local/pci-dss-v4.json`):
  - `python3 scripts/parse_pci_excel.py`
  - Note: move `src/data/pci-dss-v4.json` to `src/data/local/pci-dss-v4.json` so it stays gitignored.
- **NIST OLIR CSF 2.0 <-> ISO 27001:2022 Excel** (`Cybersecurity_Framework_v2.0_Concept_Crosswalk_Template_v1.0.xlsx` in `scripts/data/raw/`):
  - `python3 scripts/parse_nist_iso_crosswalk.py`
- **AIUC-1 Excel spreadsheet** (`AIUC-1 _ January, 2026 version.xlsx`):
  - `python3 scripts/transform_aiuc1.py` -> move output to `src/data/local/aiuc-1.json`
- **SCF STRM workbooks** (when user holds an SCF license and places approved spreadsheets into `scripts/data/raw/`):
  - `python3 scripts/extract_strm_frameworks.py` -> move generated restricted framework/crosswalk JSONs into `src/data/local/` and `src/data/local/crosswalks/`

For any other licensed PDF, CSV, XLSX, DOCX, or OSCAL source provided by the user, extract controls directly into the JSON schema below and save to `src/data/local/<framework-id>.json`.

## 3. Framework Overlay Schema (`src/data/local/<framework-id>.json`)

Every framework overlay JSON must match `FrameworkData` (`src/data/types.ts`):

```json
{
  "framework": {
    "id": "iso-27001-2022",
    "name": "ISO/IEC 27001:2022",
    "version": "2022",
    "description": "Short factual summary of the standard."
  },
  "families": {
    "5": "Organizational controls",
    "6": "People controls"
  },
  "controls": [
    {
      "control_id": "5.1",
      "title": "Policies for information security",
      "family": "5",
      "description": "Control statement extracted from the user's licensed copy.",
      "related_controls": []
    }
  ]
}
```

Validation rules enforced by `scripts/validate-local-overlay.mjs`:
1. `framework.id` MUST be a non-empty string matching the filename stem (`<framework-id>.json`).
2. `framework.name`, `framework.version`, and `framework.description` must be non-empty strings.
3. `families` must be a `Record<string, string>` mapping family keys to display names.
4. `controls` must be a non-empty array where each item has non-empty `control_id`, `title`, `family`, and string `description`.
5. Every `control_id` must produce a unique non-empty URL slug under `slugifyControlId` (letters/digits/hyphens, `(01)` -> `-1`, `.` -> `-`).

### Optional framework-specific fields (`src/data/types.ts`)
- **CIS (`cis-controls-v8`, `cis-v8-detailed`):** `asset_type`, `security_function`, `ig1`, `ig2`, `ig3` (booleans)
- **PCI DSS (`pci-dss-v4`):** `section`, `section_title`, `customized_approach_objective`, `applicability_notes`, `testing_procedures` (`[{ id, text }]`), `guidance` (`{ purpose, good_practice, definitions, examples, further_information }`)
- **ISO 27001 (`iso-27001-2022`):** `csf_mappings?: string[]`

### Supported External Catalog IDs (`src/data/framework-configs.ts`)

Drop matching `<id>.json` files into `src/data/local/` to populate any of these 27 external-only entries:

| Framework ID | Name | License / Terms | Official Publisher |
|---|---|---|---|
| `pci-dss-v4` | PCI DSS v4.0.1 | Proprietary | https://www.pcisecuritystandards.org/document_library/ |
| `cis-controls-v8` | CIS Controls v8 | CC BY-ND 4.0 | https://www.cisecurity.org/controls |
| `cis-v8-detailed` | CIS Controls v8.1 (Detailed) | CC BY-ND 4.0 | https://www.cisecurity.org/controls/v8-1 |
| `iso-27001-2022` | ISO/IEC 27001:2022 | Proprietary | https://www.iso.org/standard/82875.html |
| `iso-27001-detailed` | ISO 27001:2022 (Detailed) | Proprietary | https://www.iso.org/standard/82875.html |
| `iso-27002` | ISO/IEC 27002:2022 | Proprietary | https://www.iso.org/standard/75652.html |
| `iso-27701` | ISO/IEC 27701 | Proprietary | https://www.iso.org/standard/85819.html |
| `iso-29100` | ISO/IEC 29100 | Proprietary | https://www.iso.org/standard/85938.html |
| `iso-42001` | ISO/IEC 42001 | Proprietary | https://www.iso.org/standard/81230.html |
| `iso-42001-detailed` | ISO/IEC 42001:2023 (Detailed) | Proprietary | https://www.iso.org/standard/81230.html |
| `iso-23894` | ISO/IEC 23894 | Proprietary | https://www.iso.org/standard/77304.html |
| `soc2-tsc` | SOC 2 Trust Services Criteria | Proprietary | https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2 |
| `soc2-tsc-detailed` | SOC 2 TSC (Detailed) | Proprietary | https://www.aicpa-cima.com/topic/audit-assurance/audit-and-assurance-greater-than-soc-2 |
| `aiuc-1` | AIUC-1 | Proprietary | https://aiuc.ai |
| `adobe-ccf-v5` | Adobe CCF v5 | CC BY-NC-SA 4.0 | https://www.adobe.com/trust/compliance/adobe-ccf.html |
| `canada-itsp` | Canada ITSP.10.171 | Proprietary | https://www.cyber.gc.ca/en/guidance/protecting-specified-information-non-government-canada-systems-and-organizations-itsp10171 |
| `apec-privacy` | APEC Privacy Framework | Proprietary | https://www.apec.org/publications/2017/08/apec-privacy-framework-(2015) |
| `iec-60601` | IEC TR 60601-4-5 | Proprietary | https://webstore.iec.ch/en/publication/64703 |
| `naic-668` | NAIC Model Law 668 | Proprietary | https://content.naic.org/sites/default/files/model-law-668.pdf |
| `oecd-privacy` | OECD Privacy Principles | Proprietary | https://legalinstruments.oecd.org/public/doc/114/114.en.pdf |
| `tisax` | TISAX | Proprietary | https://enx.com/en-us/TISAX/ |
| `dpmp` | Data Privacy Management Principles | CC BY-ND | https://securecontrolsframework.com/ |
| `uc-framework` | Unified Compliance | Proprietary | https://www.unifiedcompliance.com/ |
| `hitrust-csf` | HITRUST CSF | Proprietary | https://hitrustalliance.net/csf |
| `csa-ccm` | CSA CCM | Open License (external) | https://cloudsecurityalliance.org/research/cloud-controls-matrix/ |
| `cobit` | COBIT | Proprietary | https://www.isaca.org/resources/cobit |
| `fair` | FAIR | Open License (external) | https://www.fairinstitute.org/ |

Note on `assessment-frameworks.ts`: placing a valid `src/data/local/aiuc-1.json` automatically enables AIUC-1 in the Assessment Dashboard UI (`getAvailableAssessmentFrameworks()`).

## 4. Crosswalk Overlay Schemas (`src/data/local/crosswalks/<filename>.json`)

`src/data/crosswalk.ts` automatically loads these exact filenames from `src/data/local/crosswalks/`:

1. `soc2-crosswalk.json`:
   Required properties (`Record<string, string[]>`): `tsc_to_csf`, `csf_to_tsc`, `tsc_to_iso`, `iso_to_tsc`, `tsc_to_nist`, `nist_to_tsc` (+ optional `metadata`).
2. `ai-rmf-iso42001-crosswalk.json`:
   Required properties: `ai_rmf_to_iso42001`, `iso42001_to_ai_rmf` (+ optional `iso42001_clauses`, `metadata`).
3. `ai-rmf-iso23894-crosswalk.json`:
   Required properties: `ai_rmf_to_iso23894`, `iso23894_to_ai_rmf` (+ optional `iso23894_clauses`, `metadata`).
4. `aiuc-1-airmf-crosswalk.json`:
   Required properties: `aiuc_to_ai_rmf`, `ai_rmf_to_aiuc` (+ optional `metadata`).
5. `aiuc-1-owasp-llm-crosswalk.json`:
   Required properties: `aiuc_to_owasp_llm`, `owasp_llm_to_aiuc` (+ optional `metadata`).
6. `hipaa-ccf-crosswalk.json`:
   Required properties: `hipaa_to_ccf`, `ccf_to_hipaa`.
7. `gdpr-ccf-crosswalk.json`:
   Required properties: `gdpr_to_ccf`, `ccf_to_gdpr`.
8. `nis2-ccf-crosswalk.json`:
   Required properties: `nis2_to_ccf`, `ccf_to_nis2`.
9. `ccpa-ccf-crosswalk.json`:
   Required properties: `ccpa_to_ccf`, `ccf_to_ccpa`.
10. `cjis-fedramp-crosswalk.json`:
   Required properties: `cjis_to_fedramp`, `fedramp_to_cjis` (+ optional `metadata`).
11. `ccf-crosswalks.json` & `ccf-extended-crosswalks.json`:
   Required properties: `ccf_to_framework` and `framework_to_ccf`, each shaped as `{ "<framework-id>": { "<id>": ["<mapped-id>", ...] } }`. Enables transitive bridge lookups and assessment auto-fill for SOC 2, PCI DSS, ISO 27001, CIS, etc.

## 5. Local Development & Querying via API

Once local overlays pass `npm run validate:local`:

```bash
npm run dev
# Or build the full static site + search index + Worker bundle:
npm run build
```

You can query your local `myctrl` server over HTTP (`/api/v1/` routes documented in `src/pages/api/v1/`):

- `GET /api/v1/frameworks` — lists built-in + locally loaded frameworks (`data_availability: "built-in"` when loaded vs `"external-only"` when unpopulated)
- `GET /api/v1/frameworks/<slug>` — metadata & families for one framework
- `GET /api/v1/controls/<slug>/<control-id>` — full control details for loaded frameworks
- `GET /api/v1/search?q=<query>&framework=<slug>` — full-text search across built-in and local controls
- `GET /api/v1/crosswalks?framework=<slug>&control=<id>` — crosswalk lookups

Or ask any AI coding agent (Pi, Claude Code, Cursor, Codex, Grok) with this skill loaded to parse your licensed PDF/XLSX into `src/data/local/<id>.json`, run `npm run validate:local`, and start `npm run dev` or `npm run build` for local GRC workflows.
