# pi-kevin

Pi extension and skill for browsing and analyzing the CISA Known Exploited Vulnerabilities (KEV) catalog inside Pi.

Replaces the earlier `kevs-tui` Go/Bubble Tea binary with a native Pi package for KEV search, EPSS prioritization, remediation guidance, control mapping, and trend queries.

## Install

### Global install

```bash
pi install /path/to/open-ctrl-tools/tools/pi-kevin
```

### Project-local install

```bash
cd /path/to/project
pi install -l /path/to/open-ctrl-tools/tools/pi-kevin
```

## Quick start

Open Pi, then run:

```bash
/kev
```

Optional follow-ups:

```bash
/cve CVE-2024-3400
/skill:kev-analyst
```

## Browser preview

Representative `/kev` layout:

```text
╭──────────────────────────────────────────────────────────────────────────────╮
│◆ KEVin Browser • CISA Known Exploited Vulnerabilities                       │
│[1461 KEVs] [201 ransomware] [73 overdue]                                    │
│⌕ Search: palo alto                                                          │
│Sort BEST • Ransomware on • Overdue off • View preview                       │
│──────────────────────────────────────────────────────────────────────────────│
│◆ Results                                    ◆ Preview                       │
│▌ CVE-2024-3400 PAN-OS command injection      CVE-2024-3400 • RANSOMWARE     │
│  Palo Alto | PAN-OS | EPSS 95% ███████████   PAN-OS • Added 2024-04-12      │
│▌ CVE-2024-0012 PAN-OS auth bypass             Summary                        │
│  Palo Alto | PAN-OS | EPSS 81% █████████░░░   Required action                │
│                                               Enter pin • Ctrl+P patch       │
│                                               Ctrl+N NVD • Ctrl+V top ref    │
│──────────────────────────────────────────────────────────────────────────────│
│type to search • ↑↓ move • PgUp/PgDn jump • Tab detail/preview               │
│Enter pin • Ctrl+P patch • Ctrl+E urgency • Ctrl+G controls • Ctrl+L related │
╰──────────────────────────────────────────────────────────────────────────────╯
```

## What is included

### Interactive KEV browser
- `/kev` opens the KEV browser overlay
- Type to filter by CVE, vendor, product, description, or CWE terms
- Preview/detail toggle for full risk details, required action, notes, and references
- Safe Ctrl shortcuts that do not capture text typing

### Current CVE context
- `/cve <id>` pins a CVE into session context for follow-up questions ("what should I do?", "is this urgent?", "map this to controls")

### `kev-analyst` skill
- Remediation-first triage prioritizing patch status and active exploitation, mapping to controls only when requested

## Built-in tools

- **Core KEV:** `search_kevs`, `get_cve_details`, `list_ransomware_cves`, `list_overdue_cves`, `get_stats`, `check_patch_status`
- **Compliance / GRC:** `map_cve_to_controls`, `get_control_details`, `list_controls`
- **Analytics:** `find_related_cves`, `get_vendor_risk_profile`, `batch_analyze`, `analyze_cwe`, `analyze_trends`

## Commands

| Command | Action |
| --- | --- |
| `/kev` | Open the KEV browser |
| `/kev <query>` | Open the browser with a prefilled search query |
| `/cve <id>` | Pin a CVE as current session context |
| `/kev-clear` | Clear the pinned CVE context |
| `/kev-ui auto\|on\|off` | Set KEVin UI chrome visibility |

## Browser controls

- Navigation: type to search, `↑`/`↓` move, `PgUp`/`PgDn` page, `Home`/`End` jump, `Backspace` delete, `Ctrl+U` clear
- Sorting and filtering: `Ctrl+S` cycle sort, `Ctrl+R` toggle ransomware filter, `Ctrl+O` toggle overdue filter
- Actions: `Tab` switch preview/detail, `Enter` pin CVE, `Ctrl+P` patch status, `Ctrl+E` urgency, `Ctrl+G` control mapping, `Ctrl+L` related CVEs, `Ctrl+N` open NVD, `Ctrl+V` open top advisory, `Ctrl+Y` copy link, `Esc` close

## UI behavior

KEVin UI defaults to `auto` mode: chrome stays hidden at startup, appears when `/kev`, `/cve`, or a KEV tool runs, and hides after inactivity or `/kev-clear`. Override with `/kev-ui on` or `/kev-ui off`.

## Development

```bash
npm install
npm run typecheck
```

## License

Released under the [MIT License](LICENSE).
