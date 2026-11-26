# Azure Cloud Shell Security Audit Tool

PowerShell script for auditing Azure subscriptions in Azure Cloud Shell against FedRAMP High, NIST SP 800-53 Rev 5, and CIA triad impact categories.

## Quick Start

1. Open [Azure Cloud Shell](https://shell.azure.com) (PowerShell mode).
2. Clone and run:

```powershell
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/azure-cloud-shell-audit
./audit.ps1 -SubscriptionId "your-subscription-id"
```

## Scope

Maps Azure configuration checks across nine NIST 800-53 Rev 5 / FedRAMP High families:

- Access Control (`AC`): accounts, access enforcement, least privilege, information flow
- Audit and Accountability (`AU`): audit logs, retention, monitoring, log protection
- System and Communications Protection (`SC`): encryption, network rules, boundary controls
- System and Information Integrity (`SI`): patching, malware defense, integrity monitoring, input checks
- Identification and Authentication (`IA`): MFA, identity lifecycle
- Incident Response (`IR`): handling, monitoring, reporting, response setup
- Configuration Management (`CM`): baselines, change tracking, asset inventory
- Risk Assessment (`RA`): scanning, assessment process
- Media Protection (`MP`): storage and media transport settings

Each finding records impact ratings across Confidentiality, Integrity, and Availability (CIA). Custom mapping modules cover ISO 27001, SOC 2, PCI DSS, and CIS Azure Foundations Benchmark.

## Usage Examples

```powershell
# Audit an entire subscription
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012"

# Filter to specific control families
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" -Controls "AC-*,AU-*"

# Focus on confidentiality checks
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" -AssessmentType CIA

# Write JSON output
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" -OutputFormat JSON

# Include Azure Policy state or notifications
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" -EnablePolicyCompliance
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" -EnableContinuousCompliance -NotificationEmail "security@company.com"

# Full HTML report with Policy and notifications
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" `
           -Controls "*" `
           -OutputFormat HTML `
           -EnablePolicyCompliance `
           -EnableContinuousCompliance `
           -NotificationEmail "security@company.com"

# Quick scan on high-risk families
./audit.ps1 -SubscriptionId "12345678-1234-1234-1234-123456789012" `
           -Controls "AC-*,SC-*,SI-*" `
           -AssessmentType QuickScan
```

Output formats: `HTML` (default), `JSON`, `CSV`, `Markdown`.

## Prerequisites

- Azure Cloud Shell (recommended) or PowerShell 7.0+ with the `Az` module (`Install-Module -Name Az -Force`)
- Reader access on the target Azure subscription (`Security Reader` recommended for full checks)

Reports include an executive summary (overall status, critical counts, CIA breakdown), per-control findings with Azure resource IDs, and remediation steps. The script is read-only, uses Cloud Shell session auth, sanitizes secrets from output, and throttles API calls.

## Extending Controls

1. Add control metadata to `config/control-definitions.json`.
2. Add the check function under `modules/controls/`.
3. Update control mappings under `modules/compliance/`.

See [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) for troubleshooting notes.

## Troubleshooting

- Auth errors: run `Connect-AzAccount` and `Set-AzContext -SubscriptionId "your-subscription-id"`.
- Permission errors: confirm `Reader` (or `Security Reader`) on the subscription.
- Missing `Az` module locally: run in Azure Cloud Shell or install `Az` via PowerShellGet.

## License

[MIT](./LICENSE)

## Disclaimer

Users are responsible for having authorization to audit target Azure subscriptions, complying with applicable laws and export controls, verifying findings before making changes, and protecting audit outputs. This software is provided as-is without warranty of accuracy or regulatory compliance and does not replace qualified security review.
