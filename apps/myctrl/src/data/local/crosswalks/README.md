# Local Crosswalk Overlays

Drop self-licensed or SCF STRM-extracted crosswalk JSON files here as `src/data/local/crosswalks/<filename>.json`.

- **Gitignored:** All `*.json` files in this directory are ignored by git.
- **Auto-loaded:** [`src/data/crosswalk.ts`](../crosswalk.ts) automatically loads recognized optional crosswalk files from this directory via `import.meta.glob('./local/crosswalks/*.json')`.
- **Recognized filenames:**
  - `ccf-crosswalks.json`
  - `ccf-extended-crosswalks.json`
  - `hipaa-ccf-crosswalk.json`
  - `gdpr-ccf-crosswalk.json`
  - `nis2-ccf-crosswalk.json`
  - `ccpa-ccf-crosswalk.json`
  - `cjis-fedramp-crosswalk.json`
  - `soc2-crosswalk.json`
  - `ai-rmf-iso42001-crosswalk.json`
  - `ai-rmf-iso23894-crosswalk.json`
  - `aiuc-1-airmf-crosswalk.json`
  - `aiuc-1-owasp-llm-crosswalk.json`
- **Validation & Agent Skill:** Run `npm run validate:local` to validate crosswalk overlays, and see [`skills/myctrl-local-standards/SKILL.md`](../../../../skills/myctrl-local-standards/SKILL.md) for full JSON key schemas.
