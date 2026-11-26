# Splunk Security Compliance Checker

Python CLI that audits Splunk configurations against FedRAMP (Low, Moderate, High) and NIST SP 800-53 baselines and generates JSON, HTML, CSV, or console reports.

## What It Checks

Runs 30+ read-only configuration checks defined in `config/checks.yaml` and scored via `config/severity_mapping.yaml`:

- **Authentication & Access Control (AC, IA)**: default admin accounts, service accounts, lockout thresholds, session timeouts, MFA, password rules
- **Audit & Logging (AU)**: audit logging state, content settings, storage limits, log protection, event generation
- **Encryption & Data Protection (SC)**: TLS/SSL configuration, Splunk Web HTTPS, cipher suites, data-at-rest encryption
- **System Integrity (CM, SI)**: config backups, secure settings, disabled unused features, Splunk version, patch status

Supports filtering by control family (`--controls`), choosing a FedRAMP or NIST baseline (`--standard`), and reporting findings by Critical/High/Medium/Low severity with remediation instructions.

## Installation

Requires Python 3.11 for the pinned Splunk SDK dependencies:

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/splunk-audit
python3.11 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
```

## Usage

```bash
# Basic scan (console summary)
python splunk_compliance.py --host splunk.example.com --port 8089 --username admin

# Filter control families
python splunk_compliance.py --host splunk.example.com --username admin --controls AC,AU,SC

# Write HTML report
python splunk_compliance.py --host splunk.example.com --username admin \
    --report-format html --output compliance_report.html

# Check a specific baseline
python splunk_compliance.py --host splunk.example.com --username admin \
    --standard fedramp-high

# Skip SSL verification (testing only)
python splunk_compliance.py --host splunk.example.com --username admin \
    --skip-ssl-verify
```

Supported standards: `fedramp-low`, `fedramp-moderate` (default), `fedramp-high`, and `nist-800-53`.
Supported output formats: console (default), `json`, `html`, `csv`.

## Configuration Files

- `config/checks.yaml`: check definitions, NIST control mappings, severities, expected values
- `config/severity_mapping.yaml`: severity weights, SLAs, pass/fail score thresholds

To add a check, add its definition to `config/checks.yaml`, implement the check function in the corresponding module, and document it.

## Exit Codes

- `0`: all checks passed or score above threshold
- `1`: critical findings present or score below threshold

The tool performs read-only operations over HTTPS (`--skip-ssl-verify` only for local/test certs) with token auth support and never stores credentials.

## Troubleshooting

- Connection errors: check management port (default `8089`) and firewall rules.
- Permission errors: target user needs admin or equivalent Splunk capabilities for the queried REST endpoints.
- SSL errors: install internal CA certificates for production rather than using `--skip-ssl-verify`.

## License

MIT License. See [LICENSE](LICENSE).
