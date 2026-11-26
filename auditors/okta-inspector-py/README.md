# Okta Multi-Framework Compliance Audit Tool

Python and Bash scripts that inspect Okta organization settings via the Okta Admin API and map findings to FedRAMP (NIST 800-53), DISA STIG, IRAP, ISMAP, SOC 2, and PCI-DSS 4.0, including FIPS 140-2/140-3 checks.

> For the single-binary Go rewrite with TUI and MCP server support, see [`go-go-okta-inspector`](../go-go-okta-inspector).

Built using the [Okta Developer API docs](https://developer.okta.com/).

## Quick Start

### Python (`okta-audit.py`)

```bash
pip install requests
./okta-audit.py -d your-org.okta.com -t YOUR_API_TOKEN
```

### Bash (`okta-audit.sh`)

```bash
# Requires: bash 4+, jq, zip, curl
./okta-audit.sh -d your-org.okta.com -t YOUR_API_TOKEN
```

## Capabilities

Data collection queries ~40 Okta endpoints with automatic pagination and rate-limit backoff using either SSWS or OAuth 2.0 tokens. Checks cover:

- FedRAMP (NIST 800-53): 20+ identity and access controls
- DISA STIG V1R1: 24 requirements (session management, auth, password policy, logging, PIV/CAC)
- IRAP / Essential Eight: Australian ISM controls and Essential Eight checks
- ISMAP: Japanese ISO 27001:2013 cloud security checks
- SOC 2: Trust Service Criteria (`CC6` controls)
- PCI-DSS 4.0: Requirements 7 and 8
- Risk-based auth, inactive users, and FIPS / PIV / CAC checks

Outputs include an executive summary, a cross-framework control matrix, a DISA STIG checklist, and `QUICK_REFERENCE.md`.

## Requirements

### Python (`okta-audit.py`)
- Python 3.6+
- `requests` (`pip install requests`)

### Bash (`okta-audit.sh`)
- Bash 4+ (associative arrays)
- `jq`, `zip`, `curl`

## Installation

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/okta-inspector-py
chmod +x okta-audit.py okta-audit.sh
pip install requests
```

## Usage

### Common Flags

```text
-d, --domain DOMAIN       Okta domain (e.g. your-org.okta.com)
-t, --token TOKEN         Okta API token
-o, --output-dir DIR      Output directory (default: timestamped dir)
-p, --page-size SIZE      API page size (default: 200)
-h, --help                Show help
```

Python-only flags:
```text
--max-pages PAGES         Maximum API pages to fetch (default: 10)
--oauth                   Use an OAuth 2.0 token instead of SSWS
```

Bash-only flags:
```text
-i, --interactive         Prompt for arguments even if flags are set
-n, --non-interactive     Run without prompts
```

### Examples

```bash
# Python
./okta-audit.py -d mycompany.okta.com -t YOUR_API_TOKEN
./okta-audit.py -d mycompany.okta.com -t YOUR_API_TOKEN -o audit_results
./okta-audit.py -d mycompany.okta.com -t YOUR_OAUTH_TOKEN --oauth

# Bash
./okta-audit.sh -d mycompany.okta.com -t YOUR_API_TOKEN
./okta-audit.sh -d mycompany.okta.com -t YOUR_API_TOKEN -n
```

## Output Structure

```text
okta_audit_results_TIMESTAMP/
├── core_data/              # Raw API responses
│   ├── sign_on_policies.json
│   ├── password_policies.json
│   ├── authenticators.json
│   └── ... (25+ data files)
├── analysis/               # Processed findings
│   ├── session_analysis.json
│   ├── password_policy_analysis.json
│   ├── inactive_users.json
│   └── ... (15+ analysis files)
├── compliance/             # Compliance reports
│   ├── executive_summary.md
│   ├── unified_compliance_matrix.md
│   ├── fips_compliance_report.txt
│   ├── disa_stig/
│   │   └── stig_compliance_checklist.md
│   ├── irap/
│   │   ├── irap_compliance_report.md
│   │   └── essential_eight_assessment.md
│   └── ismap/
│       └── ismap_compliance_report.md
├── QUICK_REFERENCE.md
└── validate_compliance.sh
```

## Compliance Coverage

### FedRAMP (NIST 800-53)
- Access Control: `AC-2`, `AC-2(3)`, `AC-2(4)`, `AC-2(12)`, `AC-7`, `AC-8`, `AC-11`, `AC-12`
- Audit and Accountability: `AU-2`, `AU-3`, `AU-4`, `AU-6`
- Identification and Authentication: `IA-2`, `IA-2(1)`, `IA-2(11)`, `IA-5`, `IA-5(2)`
- System and Communications Protection: `SC-13`
- System and Information Integrity: `SI-4`

### DISA STIG V1R1 (24 Requirements)

| Category | Status | Requirements | Notes |
|---|---|---|---|
| Session management | Automated | V-273186, V-273187, V-273203, V-273206 | 4/4 via API |
| Password policy | Automated | V-273195 through V-273201, V-273208, V-273209 | 9/9 via API |
| Authentication & MFA | Automated | V-273189, V-273190, V-273191, V-273193, V-273194 | 5/5 via API |
| Logging & PIV/CAC | Automated | V-273202, V-273204 | 2/2 via API |
| Inactive users | Partial | V-273188 | Flags inactive accounts; cannot verify automation rules via API |
| FIPS / CA chains | Partial | V-273205, V-273207 | Reads Okta Verify and IdP records; platform FIPS and CA chains need manual check |
| DOD Warning Banner | Manual | V-273192 | UI banner cannot be checked over API |

## API Permissions Required

Create a read-only token in the Okta Admin Console under **Security > API > Tokens** (copy it immediately), or authenticate with an account holding the **Read-Only Administrator**, **Compliance Administrator**, or **Report Administrator** role.

Required OAuth / API scopes:
- Users/Groups/Apps: `okta.users.read`, `okta.groups.read`, `okta.apps.read`
- Auth & Security: `okta.authenticators.read`, `okta.authorizationServers.read`, `okta.idps.read`, `okta.trustedOrigins.read`
- Policies: `okta.policies.read` (sign-on, password, MFA enrollment, access, user lifecycle, authentication)
- Logging: `okta.logs.read`, `okta.eventHooks.read`, `okta.logStreams.read`
- System config: `okta.orgs.read`, `okta.factors.read`, `okta.deviceAssurance.read`, `okta.networkZones.read`, `okta.behaviors.read`

Token handling practices: use a dedicated service account, rotate tokens every 90 days, keep tokens in environment variables or a secret manager, review usage in Okta System Log, and revoke unused tokens.

Test token permissions:

```bash
curl -X GET "https://your-org.okta.com/api/v1/users?limit=1" \
  -H "Authorization: SSWS YOUR_API_TOKEN" \
  -H "Accept: application/json"
```

`401 Unauthorized` means an invalid token; `403 Forbidden` means missing scopes.

## Key Reports

- `compliance/executive_summary.md`: overall findings, high-risk items, and counts
- `compliance/unified_compliance_matrix.md`: maps checks to FedRAMP, STIG, IRAP, ISMAP, SOC 2, and PCI-DSS
- `compliance/disa_stig/stig_compliance_checklist.md`: automated vs. manual DISA STIG checklist
- `compliance/irap/irap_compliance_report.md`: Australian ISM checks and `.gov.au` domain check
- `compliance/irap/essential_eight_assessment.md`: Essential Eight check summary
- `compliance/ismap/ismap_compliance_report.md`: Japanese ISO 27001:2013 checks and `.go.jp` check
- `compliance/soc2/soc2_compliance_report.md`: SOC 2 CC6 controls
- `compliance/pci_dss/pci_dss_compliance_report.md`: PCI-DSS 4.0 Requirements 7 and 8
- `QUICK_REFERENCE.md`: directory map for reviewers

## Python vs. Bash

The Python version runs on Windows, macOS, and Linux, handles errors and rate-limit retries cleanly, and is easier to extend. The Bash version needs no Python environment, runs natively on Unix/Linux, and includes interactive prompts (`-i`).

Large tenants (~40 endpoints) take 2-10 minutes depending on user/policy count; tune `--page-size` or `--max-pages` as needed.

## Troubleshooting

- `401`/`403` errors: check token scopes, confirm the `SSWS` prefix if calling manually, and pass the bare hostname (`company.okta.com`, not `https://company.okta.com`).
- `429` rate limits: lower `--page-size` or run off-peak.
- Missing fields: some endpoints vary by Okta edition and token permissions; check console warnings.

## License

MIT License. See [LICENSE](LICENSE).

## Support

- GitLab: <https://gitlab.com/hackIDLE/fedramp/fedramp-testing-public/identity-and-access-management/okta-audit>
- GitHub mirror: <https://github.com/ethanolivertroy/okta-audit>
