# Google Workspaces FedRAMP Compliance Audit

![Google Workspaces FedRAMP Compliance Audit](image.png)

Scripts in JavaScript, Python, and Go that audit Google Workspace settings via the Admin SDK APIs across 12 FedRAMP compliance controls.

## Implementations

- `fedramp-compliance-check.js` (JavaScript)
- `fedramp_check.py` (Python)
- `fedramp_check.go` (Go)

## Prerequisites

- Google Workspace Enterprise or Business account with admin privileges
- Google Cloud project with Admin SDK APIs enabled
- OAuth 2.0 client or Service Account credentials

## Installation

```bash
# JavaScript
npm ci

# Python
python -m pip install -r requirements.txt

# Go
go mod download
```

## Authentication Methods

Python and Go support:

1. OAuth 2.0 (`credentials.json`, default)
2. Service Account with domain-wide delegation (file path or `GOOGLE_SERVICE_ACCOUNT_JSON`, plus `GOOGLE_ADMIN_EMAIL`)
3. Environment variables pointing to credentials
4. Interactive prompt (`--interactive`)
5. Config files (JSON, or YAML in Python)
6. Google Cloud Secret Manager
7. AWS Secrets Manager
8. HashiCorp Vault

### Obtaining an Access Token

**3-Legged OAuth:** Create an OAuth 2.0 Client ID in GCP (**APIs & Services > Credentials**), request the required Admin SDK scopes (such as `https://www.googleapis.com/auth/admin.directory.user.readonly`), exchange the callback code for a token, and send `Authorization: Bearer YOUR_ACCESS_TOKEN`.

**Service Account + Domain-Wide Delegation:** Enable Workspace APIs in GCP, create a Service Account, enable domain-wide delegation, authorize its client ID in the Google Workspace Admin console (**Security > API Controls > Domain-wide Delegation**), and impersonate an admin user:

```python
from google.oauth2 import service_account
from google.auth.transport.requests import Request

SCOPES = ['https://www.googleapis.com/auth/admin.directory.user.readonly']
creds = service_account.Credentials.from_service_account_file(
    'service-account.json',
    scopes=SCOPES,
    subject='admin@your-domain.com'
)
creds.refresh(Request())
token = creds.token
```

## Usage

### JavaScript
```bash
node fedramp-compliance-check.js
```

### Python
```bash
python fedramp_check.py
python fedramp_check.py --credentials-path /path/to/credentials.json --report-path /path/to/report.json
python fedramp_check.py --service-account /path/to/service-account.json --admin-email admin@domain.com
python fedramp_check.py --interactive
python fedramp_check.py --auth-method gcp_secret --gcp-secret-credentials project-id/secret-name
python fedramp_check.py --config-file /path/to/config.yaml
```

### Go
```bash
go run fedramp_check.go
go run fedramp_check.go -credentials /path/to/credentials.json -report /path/to/report.json
go run fedramp_check.go -service-account /path/to/service-account.json -admin-email admin@domain.com
go run fedramp_check.go -interactive
go run fedramp_check.go -config /path/to/config.json
```

## Environment Variables

- `GOOGLE_APPLICATION_CREDENTIALS`: Path to OAuth or Service Account credentials JSON
- `GOOGLE_WORKSPACE_TOKEN_PATH`: Path to stored OAuth token file
- `FEDRAMP_REPORT_PATH`: Output path for the JSON report
- `GOOGLE_SERVICE_ACCOUNT_JSON`: Inline service account JSON content
- `GOOGLE_ADMIN_EMAIL`: Admin email for service account impersonation
- `FEDRAMP_AUTH_METHOD`: Auth backend (`oauth`, `service_account`, `gcp_secret`, etc.)
- `GCP_PROJECT_ID`: GCP project ID for Secret Manager
- `GCP_SECRET_CREDENTIALS`: Secret name in GCP Secret Manager
- `AWS_SECRET_NAME`: Secret name in AWS Secrets Manager
- `AWS_REGION`: AWS region for Secrets Manager
- `VAULT_ADDR`: HashiCorp Vault address
- `VAULT_TOKEN`: HashiCorp Vault token
- `VAULT_SECRET_PATH`: Secret path in HashiCorp Vault

## Compliance Checks

Audits 12 Google Workspace security areas and writes status, per-control findings, summary counts, and remediation notes to JSON:

- FedRAMP-authorized Workspace services only (Gmail, Drive, Meet, etc.)
- Data region restriction set to the United States
- Assured Controls add-on (Enterprise Plus)
- Access Transparency logging (Enterprise Plus / Assured Controls)
- Password policy (minimum length, complexity, expiration)
- Two-step verification enforcement
- Admin role assignments and least privilege
- Admin, Drive, and login audit logging
- Security Center configuration (Enterprise Plus)
- DLP rules in Gmail and Drive
- Context-Aware Access policies
- Endpoint Management policies

## License

MIT License. See [LICENSE](LICENSE).
