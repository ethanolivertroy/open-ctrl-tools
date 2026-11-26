# Slack Security Audit Tool

Python CLI that audits Slack workspace settings against NIST 800-53 Rev 5, FedRAMP (Low/Moderate/High), CIS Slack Benchmark, and ISO 27001, mapping each check to CIA triad impacts.

## What It Checks

- 150+ security checks mapped across NIST 800-53 Rev 5, FedRAMP, CIS Slack Benchmark v1.1, and ISO 27001 Annex A
- Confidentiality, Integrity, and Availability (CIA) impact weights per finding
- Severity and exploitability risk scoring (0-10)
- Point-in-time snapshot exports (raw workspace configs + audit logs when using Enterprise Grid)
- JSON, HTML, Markdown, and CSV reports

## Quick Start

### Install

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/slack-audit
pip install -r requirements.txt
chmod +x slack_security_audit_cli.py
```

### Usage

```bash
# Run with default settings
./slack_security_audit_cli.py --token xoxb-your-slack-token

# Filter frameworks
./slack_security_audit_cli.py --token xoxb-your-slack-token --frameworks nist_800_53 cis

# Use a config file
./slack_security_audit_cli.py --token xoxb-your-slack-token --config audit_config.yaml

# Override CIA weights (must sum to 1.0)
./slack_security_audit_cli.py --token xoxb-your-slack-token --cia-weights 0.5 0.3 0.2

# Verbose debug output
./slack_security_audit_cli.py --token $TOKEN --verbose
```

## Configuration

Example `config.yaml`:

```yaml
mode: point_in_time
frameworks:
  - name: nist_800_53
    version: "5"
    profile: high
  - name: fedramp
    profile: moderate
  - name: cis
    version: "1.1"

cia_weights:
  confidentiality: 0.4
  integrity: 0.3
  availability: 0.3

scanning:
  deep_scan: true
  scan_files: true
  scan_messages: false  # Message content is off by default

reporting:
  formats: ["json", "html", "markdown"]
  include_evidence: true
  executive_summary: true
```

Test custom subsets with `--config custom_controls.yaml`.

## Required Slack OAuth Scopes

Create a Slack app with read scopes:
- `admin`, `admin.teams:read`, `admin.users:read`, `admin.conversations:read`, `admin.apps:read`
- `channels:read`, `groups:read`, `users:read`, `team:read`, `files:read`
- `audit:read` (Enterprise Grid only)

## Output Layout

```text
audit_results/
└── audit_<timestamp>/
    ├── audit_report_<id>.json
    ├── audit_report_<id>.html
    ├── audit_report_<id>.md
    ├── nist_800_53_results.json
    ├── fedramp_results.json
    ├── cis_results.json
    ├── findings_<id>.csv
    └── controls_<id>.csv
```

## Risk Scoring

```text
Risk Score = (Base Severity * 0.4) +
             (Exploitability * 0.3) +
             (CIA Impact * 0.2) +
             (Regulatory Impact * 0.1)
```

Buckets (0-10): Critical `9.0-10.0`, High `7.0-8.9`, Medium `4.0-6.9`, Low `2.0-3.9`, Info `0.0-1.9`.

## Package Layout

```text
slack_security_audit/
├── core.py                 # Main orchestrator
├── config.py               # Config loader
├── models.py               # Data models
├── slack_client.py         # Rate-limited Slack API client
├── analyzers/              # CIA impact and risk scoring
├── collectors/             # Workspace, user, app, and log collectors
├── frameworks/             # NIST 800-53, CIS, and framework mappings
└── reporters/              # JSON, HTML, Markdown, CSV writers
```

## Adding Controls and Collectors

Extend `ComplianceFramework`:

```python
class MyFramework(ComplianceFramework):
    def _load_controls(self):
        return {
            "CTRL-1": {
                "title": "My Control",
                "description": "Control description"
            }
        }

async def _assess_ctrl_1(self, data, workspace_info):
    return self.create_control_result(...)
```

Extend `DataCollector`:

```python
class MyCollector(DataCollector):
    async def collect(self):
        return data
```

## Notes & Troubleshooting

- Auth errors: confirm the token includes all required scopes; Enterprise Grid endpoints require `audit:read` on an Enterprise Grid workspace.
- Rate limits: handled automatically via backoff in `slack_client.py`.
- Keep API tokens in env vars (`$TOKEN`), keep `scan_messages: false` unless needed, and restrict access to exported audit reports.

## License

MIT License. See [LICENSE](LICENSE).
