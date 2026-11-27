# Local Licensed Standards Overlay

Drop self-licensed framework JSON files here as `src/data/local/<framework-id>.json`.

- **Gitignored:** All `*.json` files in this directory are ignored by git and will never be committed or redistributed.
- **Auto-loaded:** Vite (`import.meta.glob('./local/*.json')`) automatically detects files placed here during `npm run dev`, `npm run build`, and `npm test`. Local files take precedence over built-in files if IDs match.
- **Validation:** Run `npm run validate:local` before building to verify schema, required fields (`control_id`, `title`, `family`, `description`), and slug uniqueness.
- **Agent Skill:** See [`skills/myctrl-local-standards/SKILL.md`](../../../skills/myctrl-local-standards/SKILL.md) for schema details, supported external framework IDs, and instructions you can give your own coding agent (Pi, Claude Code, Cursor, Codex, Grok) to convert licensed PDFs/workbooks into valid overlay JSONs.
