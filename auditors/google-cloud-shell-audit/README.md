# Google Cloud Shell Audit Tool for FedRAMP Compliance

Bash script for NIST SP 800-53 Rev 5 and FedRAMP compliance checks and GCP resource inventory in Google Cloud Shell or a local shell.

## Overview

`gcp_audit.sh` has two modes:

1. **Compliance checks**: maps GCP settings to NIST SP 800-53 Rev 5 controls across AC, AU, CM, IA, SC, SI, MP, CA, SR, and PT with `PASS`/`WARN`/`FAIL` status, remediation notes, Low/Moderate/High FedRAMP levels, and evidence exports.
2. **Resource inventory**: pulls configuration across 35+ GCP regional and global services (using Cloud Asset Inventory where available) into structured exports.

Outputs include JSON, CSV, HTML, Security Command Center, and SSP templates, bundled in a timestamped ZIP archive. Supports parallel scans, differential comparison against prior runs (`--diff`), and org-level or project-level scope.

## Quick Start

### Google Cloud Shell

Open [Google Cloud Shell](https://shell.cloud.google.com/) and run:

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/google-cloud-shell-audit
chmod +x gcp_audit.sh

# Audit the current default project
./gcp_audit.sh

# Audit a specific project with HTML output and High baseline
./gcp_audit.sh --project my-project-id --format html --verbose --level high

# Download archive from Cloud Shell
cloudshell download gcp_audit_results_*.zip
```

### Local Shell

Requires `gcloud` CLI, `bash`, `jq`, and `parallel`:

```bash
git clone https://github.com/ethanolivertroy/open-ctrl-tools.git
cd open-ctrl-tools/auditors/google-cloud-shell-audit
chmod +x gcp_audit.sh
gcloud auth login
./gcp_audit.sh --project my-project-id
```

## CLI Options

```text
./gcp_audit.sh [options]

Options:
  -h, --help                  Show help message and exit
  -o, --organization ID       Specify the organization ID (optional)
  -p, --project ID            Specify the project ID (default: current project)
  -a, --all-projects          Scan all accessible projects
  -f, --format FORMAT         Output format: json, csv, html, scc, ssp (default: json)
  -v, --verbose               Enable verbose output
  -r, --report-only           Run only compliance reporting
  -i, --inventory-only        Run only resource inventory
  -d, --diff PREVIOUS_SCAN    Compare with previous scan results
  -j, --jobs NUM              Number of parallel jobs (default: 10)
  -l, --level LEVEL           FedRAMP level: low, moderate, high (default: moderate)
  -c, --custom-controls FILE  Path to custom controls JSON file
  -s, --skip CATEGORIES       Comma-separated list of categories to skip
  -e, --export-evidence       Generate exportable evidence for auditors
  -z, --severity              Include severity ratings in findings
  --ssp-template              Generate System Security Plan template with evidence
```

Examples:

```bash
./gcp_audit.sh --organization 123456789012 --format html --verbose --level high
./gcp_audit.sh --project my-project-id --inventory-only
./gcp_audit.sh --project my-project-id --diff gcp_audit_results_20231201120000 --export-evidence
```

## Compliance Checks

| Control Family | Scope | Examples |
|---|---|---|
| Access Control (AC) | Account management, access enforcement | Service accounts, admin roles, public resources |
| Audit and Accountability (AU) | Logging, monitoring, retention | Audit logging, log retention |
| Configuration Management (CM) | Baseline configurations | Shielded VMs, secure defaults |
| Identification & Authentication (IA) | Authentication, credential management | Key rotation, auth settings |
| System & Communications Protection (SC) | Boundary protection, cryptography | Network rules, KMS, TLS |
| System & Information Integrity (SI) | Flaw remediation, monitoring | Vulnerability scanning, integrity checks |
| Media Protection (MP) | Data protection | Bucket access and encryption |
| Security Assessment (CA) | Assessment and authorization | Continuous monitoring |
| Supply Chain Risk Management (SR) | Supply chain controls | Binary Authorization, Artifact Registry |
| Privacy Controls (PT) | PII and data protection | DLP scanning and discovery |

## GCP Services and Container Checks

Covers VPC Service Controls, Binary Authorization, Confidential Computing, Assured Workloads, Cloud Asset Inventory, Data Loss Prevention, Identity-Aware Proxy, Security Command Center, Workload Identity, Organization Policy constraints, Access Approval, and NIST SP 800-190 container checks (image scanning, runtime restrictions, GKE/mTLS/admission controllers, host OS hardening, Pod Security Standards, supply chain artifacts, logging, network policy, secrets, and incident response).

## Exported Evidence

Default runs write a timestamped directory and ZIP archive containing resource JSON exports (IAM policies, networks, compute, storage, service accounts, org policies, KMS keys) and NIST 800-53 Rev 5 findings with raw command outputs.

With `--export-evidence`, the script writes per-control evidence directories (grouped by NIST family and NIST SP 800-190 container controls), an indexed navigation file, and FedRAMP baseline coverage counts.

With `--ssp-template`, it populates draft System Security Plan implementation statements and missing-control gap lists using observed settings.

## Prerequisites & IAM Permissions

Cloud Shell includes `gcloud`, `jq`, and GNU `parallel`. Local runs require the Google Cloud SDK (`gcloud`) authenticated against the target project or org; the script attempts to install `jq` and `parallel` locally if absent.

### Read-Only Auditor Role

Assign `roles/iam.securityReviewer` for read-only inspection:

```bash
# Project level
gcloud projects add-iam-policy-binding PROJECT_ID \
  --member=user:auditor@example.com \
  --role=roles/iam.securityReviewer

# Organization level
gcloud organizations add-iam-policy-binding ORGANIZATION_ID \
  --member=user:auditor@example.com \
  --role=roles/iam.securityReviewer
```

For full org-wide inventory and SCC checks, add:
1. `roles/resourcemanager.organizationViewer`
2. `roles/cloudasset.viewer`
3. `roles/securitycenter.adminViewer`

For basic single-project scans, `roles/viewer` is enough. Or create a custom role:

```bash
gcloud iam roles create SecurityAuditor --project=PROJECT_ID \
  --permissions=cloudasset.assets.listResource,cloudasset.assets.searchAllResources,iam.policy.get,resourcemanager.hierarchyNodes.listEffectiveIamPolicies,securitycenter.assets.list,securitycenter.findings.list,securitycenter.sources.list
```

## License

MIT License. See [LICENSE](LICENSE).
