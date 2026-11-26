# Go Go Okta Inspector

Okta configuration and compliance auditor written in Go as a single binary. Rewrites [okta-inspector](https://github.com/ethanolivertroy/okta-inspector) (Python and Bash) in Go with a CLI, interactive Bubble Tea TUI, snapshot replay, and an MCP server.

## Frameworks

- FedRAMP (NIST 800-53): U.S. Federal identity and access management controls
- DISA STIG V1R1: Defense Information Systems Agency requirements
- IRAP: Australian Government ISM controls and Essential Eight
- ISMAP: Japanese Government ISO 27001:2013 cloud security controls
- SOC 2: Trust Service Criteria (`CC6`)
- PCI-DSS 4.0: Requirements 7 and 8

## Install

### Frozen standalone version

With Go 1.24.2 or later, install the final standalone revision:

```sh
go install github.com/ethanolivertroy/go-go-okta-inspector@v0.0.0-20260324034249-01da00161893
```

### Build the monorepo version

```sh
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/go-go-okta-inspector
make build
```

## Quick Start

```bash
# Run an audit
go-go-okta-inspector audit -d your-org.okta.com -t YOUR_API_TOKEN

# Launch interactive TUI
go-go-okta-inspector interactive -d your-org.okta.com -t YOUR_API_TOKEN

# Generate reports from a saved snapshot
go-go-okta-inspector report -s snapshot.json -f markdown

# Start MCP server
go-go-okta-inspector serve-mcp
```

## Commands

| Command | Description |
|---|---|
| `audit` | Run compliance checks against an Okta tenant |
| `interactive` | Launch interactive terminal UI |
| `report` | Generate reports from saved snapshot data |
| `serve-mcp` | Start Model Context Protocol server over stdio |
| `config` | Manage configuration (`init`, `set`, `show`) |
| `build` | Compile restricted binaries using a capability manifest |
| `version` | Print version information |

Runs 70+ checks across all six frameworks, paginates large Okta tenants, retries with exponential backoff on rate limits, supports offline snapshot replay, and compiles least-privilege binaries via capability manifests.

## Compliance Coverage

- FedRAMP (NIST 800-53): Access Control (`AC-2`, `AC-7`, `AC-8`, `AC-11`, `AC-12`), Audit (`AU-2`, `AU-3`, `AU-4`, `AU-6`), Auth (`IA-2`, `IA-5`), Crypto (`SC-13`), Monitoring (`SI-4`)
- DISA STIG V1R1: 24 requirements (19 automated, 4 partial, 1 manual-only)
- IRAP: Australian ISM controls, Essential Eight, `.gov.au` domain checks
- ISMAP: Japanese cloud security controls, `.go.jp` domain checks
- SOC 2: `CC6` Trust Service Criteria
- PCI-DSS 4.0: Requirements 7 and 8

## API Permissions Required

Create a read-only token in the Okta Admin Console (**Security > API > Tokens**), or assign a **Read-Only Administrator**, **Compliance Administrator**, or **Report Administrator** role.

Required read scopes:
- Users/Groups/Apps: `okta.users.read`, `okta.groups.read`, `okta.apps.read`
- Auth/Security: `okta.authenticators.read`, `okta.authorizationServers.read`, `okta.idps.read`, `okta.trustedOrigins.read`
- Policies: `okta.policies.read`
- Logging: `okta.logs.read`, `okta.eventHooks.read`, `okta.logStreams.read`
- System config: `okta.orgs.read`, `okta.factors.read`, `okta.deviceAssurance.read`, `okta.networkZones.read`, `okta.behaviors.read`

Token handling: use a dedicated service account, rotate every 90 days, pass via `OKTA_API_TOKEN` or a secret store, monitor Okta logs, and revoke when no longer needed.

## Output Structure

```text
audit_results/
├── core_data/              # Raw API responses (JSON)
├── analysis/               # Processed findings
├── compliance/             # Framework-specific reports
│   ├── executive_summary.md
│   ├── unified_compliance_matrix.md
│   ├── disa_stig/
│   ├── irap/
│   ├── ismap/
│   ├── soc2/
│   └── pci_dss/
└── QUICK_REFERENCE.md
```

## License

MIT License. See [LICENSE](LICENSE).

## Acknowledgments

- [Okta Developer API](https://developer.okta.com/)
- Built with [Cobra](https://github.com/spf13/cobra), [Bubble Tea](https://github.com/charmbracelet/bubbletea), and [Lip Gloss](https://github.com/charmbracelet/lipgloss)
