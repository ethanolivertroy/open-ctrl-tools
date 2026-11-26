# Duo Audit

![Duo Audit](image.png)

Audit Duo Security settings against **FedRAMP Consolidated Rules for 2026** Key Security Indicators (`KSI-IAM`) from [FedRAMP/2026-markdown](https://github.com/FedRAMP/2026-markdown), alongside NIST SP 800-63B and CISA phishing-resistant MFA checks.

Author: [Ethan Troy](https://ethantroy.dev)

## Features

- Maps Duo Admin API signals to the six official `KSI-IAM` indicators from the 2026 markdown corpus:
  - `KSI-IAM-AAM`: Automating Account Management
  - `KSI-IAM-APM`: Adopting Passwordless Methods (includes phishing-resistant MFA when passwordless is not feasible)
  - `KSI-IAM-ELP`: Ensuring Least Privilege
  - `KSI-IAM-JIT`: Authorizing Just-in-Time
  - `KSI-IAM-SNU`: Securing Non-User Authentication
  - `KSI-IAM-SUS`: Responding to Suspicious Activity
- Writes JSON evidence (`fedramp_20x_ksi_evidence.json`), FedRAMP/NIST/CISA reports, and an executive summary.
- Leaves `KSI-IAM-JIT` and `KSI-IAM-SUS` as `unknown` when Duo API data alone cannot verify IdP/process controls.

## Requirements

- Python 3.8+ (3.10+ recommended)
- `pip install -r requirements.txt` (`duo_client`, `colorama`, `tabulate`)

## Installation

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/duo-audit
pip install -r requirements.txt
```

## Usage

```bash
./duo-audit.py
./duo-audit.py --host api-xxxxx.duosecurity.com --ikey YOUR_INTEGRATION_KEY --skey YOUR_SECRET_KEY
./duo-audit.py --output-dir /path/to/output
```

| Artifact | Purpose |
| --- | --- |
| `fedramp_compliance_report.txt` | Narrative assessment against official KSI-IAM IDs |
| `fedramp_20x_ksi_evidence.json` | Machine-readable KSI status and evidence fields |
| `executive_summary.txt` | Leadership rollup |
| `compliance_checklist.txt` | Manual checks (2026 KSI-IAM and legacy Rev 5 items) |
| `security_decision_records/` | Per-KSI Security Decision Record markdown stubs |

JSON output includes `ruleset_provenance` with a pinned `FedRAMP/2026-markdown` commit SHA (`FEDRAMP_2026_MARKDOWN_PIN` in `duo-audit.py`).

`KSI-IAM-SUS` treats admin disable logs as weak signals only and never auto-passes; automated response must be attested in the SDR.

## FedRAMP source of truth

Uses the Consolidated Rules for 2026 markdown corpus rather than Phase One pilot / RFC-0006:

- Repository: <https://github.com/FedRAMP/2026-markdown>
- IAM KSIs: [`providers/20x/key-security-indicators/identity-and-access-management.md`](https://github.com/FedRAMP/2026-markdown/blob/main/providers/20x/key-security-indicators/identity-and-access-management.md)
- KSI overview: [`providers/20x/key-security-indicators/index.md`](https://github.com/FedRAMP/2026-markdown/blob/main/providers/20x/key-security-indicators/index.md)
- Full KSI reference: [`reference/key-security-indicators.md`](https://github.com/FedRAMP/2026-markdown/blob/main/reference/key-security-indicators.md)

Indicator launch notes in that corpus include `2026-06-24` for Consolidated Rules for 2026.

## Security Notice

This tool retrieves sensitive Duo configuration data. Restrict access to report outputs and redact secrets before sharing.

## FIPS & Trusted Endpoints

Duo Admin API often omits full Federal / FIPS status. Verify FIPS components manually using the [Duo Federal Guide](https://duo.com/docs/duo-federal-guide).

## License

[MIT](LICENSE). Ethan Troy (<https://ethantroy.dev>).
