# myctrl (`myctrl.tools`)

Open-source, local-first security & compliance framework reference, crosswalk explorer, and GRC assessment workspace built with Astro, React, and Cloudflare Workers.

**Live hosted reference:** [myctrl.tools](https://myctrl.tools)

## Built-In Open Catalog vs. Bring-Your-Own Local Overlay

To respect copyright and license terms without gatekeeping your local workflow, this repository separates **built-in open datasets** from **external publisher directories**:

- **80 built-in public-domain & permissive open-license frameworks** (`67` public-domain + `13` permissive open-license datasets including NIST SP 800-53, NIST CSF 2.0, NIST SP 800-171, FedRAMP Rev 5 & 20x KSI, CMMC 2.0, DoD SRG, EU AI Act, GDPR, NIS2, OWASP Top 10 series, ITSG-33, UK Cyber Essentials, BSI C5, Australia ISM/Essential Eight, OCSF, and MITRE ATT&CK).
- **7 built-in public-domain / NIST OLIR ID crosswalks** (`csf-nist`, `csf-pci`, `csf-iso`, `cis-csf`, `cci-nist`, `cmmc-nist171`, `eu-ai-act-airmf`).
- **27 external publisher entries** (`PCI DSS`, `ISO/IEC 27001/27002/27701/42001/23894`, `SOC 2`, `CIS Controls v8`, `AIUC-1`, `Adobe CCF`, `HITRUST CSF`, `COBIT`, `CSA CCM`, `TISAX`, etc.): their control text is **not redistributed** here. Each framework page links directly to the official publisher and supports loading your own licensed copies locally.
- **Gitignored Local Overlay (`src/data/local/`):** Drop your own licensed framework JSONs (`src/data/local/<id>.json`) or crosswalk maps (`src/data/local/crosswalks/<file>.json`) to unlock full search, control views, crosswalk bridges, and AIUC-1/enterprise assessments locally without ever committing third-party content.

## Agent Skill for AI Coding Agents (Pi, Claude Code, Cursor, Codex, Grok)

See [`skills/myctrl-local-standards/SKILL.md`](./skills/myctrl-local-standards/SKILL.md) for an agent-agnostic skill explaining:
- Exact JSON schemas (`FrameworkData` and every local crosswalk file key)
- Built-in parsers in `scripts/` (e.g., `parse_pci_excel.py`, `parse_nist_iso_crosswalk.py`, `transform_aiuc1.py`, `extract_strm_frameworks.py`)
- Schema validation (`npm run validate:local`) and local HTTP API endpoints (`/api/v1/*`)

## Quick Start

Requires **Node.js `>=22.23.4`**.

```bash
cd apps/myctrl
npm ci --onnxruntime-node-install-cuda=skip
npm run dev
```

*(Pass `--onnxruntime-node-install-cuda=skip` or set `ONNXRUNTIME_NODE_INSTALL_CUDA=skip` on Linux machines without CUDA so `onnxruntime-node` does not attempt an optional GPU tarball download.)*

### Useful Commands

```bash
npm run validate:local              # Validate optional JSON files in src/data/local/
npm run typecheck                   # Astro sync + TypeScript check
npm test                            # Run Vitest unit & data integrity suite
npm run build                       # Build static site, search indexes, and Worker bundle
node scripts/qa_static_routes.mjs   # Verify built static routes in dist/
node scripts/qa_internal_links.mjs  # Verify internal hrefs in dist/
python3 scripts/validate_mappings.py # Validate built-in framework/crosswalk ID integrity
```

## Optional Local Standards Workflow

```bash
# 1. Place licensed framework or crosswalk JSONs in gitignored src/data/local/
cp /path/to/your/iso-27001-2022.json src/data/local/iso-27001-2022.json

# 2. Validate overlay schema and unique URL slugs
npm run validate:local

# 3. Run or build locally — Vite auto-discovers src/data/local/*.json
npm run dev
```

See [`src/data/local/README.md`](./src/data/local/README.md) and [`src/data/local/crosswalks/README.md`](./src/data/local/crosswalks/README.md) for quick reminders.

## License & Notices

Code in `apps/myctrl` is licensed under the [MIT License](./LICENSE).
See [`NOTICE`](./NOTICE) for framework/data public-domain status, open-license attributions (CC BY-SA 4.0, CC BY 4.0, OGL, Apache-2.0, SIL OFL 1.1), and non-redistribution details.
