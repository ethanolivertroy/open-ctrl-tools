# ControlBot

Terraform PR compliance reviewer combining [Checkov](https://www.checkov.io/) for static scan facts and the [Cursor SDK](https://cursor.com/docs/sdk) for review narratives and custom checklist checks.

ControlBot posts inline PR comments on violating Terraform lines, maps rules to NIST SP 800-53 controls, extracts repository evidence facts, generates POA&M seeds, and exits non-zero when blocking severity rules fail.

## Demo

- Repo: <https://github.com/ethanolivertroy/controlbot>
- Sample PR: <https://github.com/ethanolivertroy/controlbot/pull/1>

## How it works

```text
PR with Terraform
  -> Checkov (static scan)
  -> Repo evidence extraction (non-blocking observations)
  -> NIST 800-53 mapping
  -> ControlBot (inline PR comments + merge gate)
  -> Optional: Cursor agent (full report + custom checklist)
```

The agent enriches Checkov output with control context and remediation text without inventing deterministic findings. Custom checklist rules (Qodo-style) are evaluated by the Cursor agent into a separate `stats.custom_compliance` lane, and repo evidence facts are recorded without altering Checkov counts or merge-blocking results.

## Quick start

```bash
npm install
pip install checkov

npm run scan
npm run evidence
npm run review -- --scan-only
npm run controlbot
npm run poam

cat review-payload.json   # Inline PR comment payload
cat evidence-facts.json   # Deterministic repo evidence facts
cat poam-seeds.md         # POA&M seed summary
```

Optional full agent report:

```bash
export CURSOR_API_KEY="cursor_..."
npm run review
```

Checklist results write to `custom-compliance-results.json`. Under `--scan-only`, checklist rules are marked `UNKNOWN` and do not block.

## GitHub Actions

1. Add an optional `CURSOR_API_KEY` secret (inline Checkov/NIST comments run without it).
2. PRs modifying `*.tf` trigger [`.github/workflows/controlbot.yml`](.github/workflows/controlbot.yml).
3. ControlBot updates one sticky summary comment, syncs triage labels, posts inline comments, and fails CI on blocking findings.

## Configure

[`.controlbot/profile.yaml`](.controlbot/profile.yaml):

```yaml
baseline: fedramp-moderate
inherited_controls: [PE-1, PE-2]   # CSP-inherited: skip
block_on_severity: [HIGH, CRITICAL]
inline_comments: true
bot_name: ControlBot
```

Extend [`mappings/checkov-to-nist.yaml`](mappings/checkov-to-nist.yaml) to map additional rules to controls.

Custom compliance checklist ([`.controlbot/checklist.yaml`](.controlbot/checklist.yaml)):

```yaml
pr_compliances:
  - id: resource-ownership-tags
    title: "Resource Ownership Tags"
    compliance_label: true
    objective: "Terraform-managed AWS resources must identify an owner and data classification."
    success_criteria: "Resources include owner and data_classification tags or inherit them from a module/default tag configuration."
    failure_criteria: "Resources are declared without ownership or data-classification tags and no inherited tagging mechanism is visible."
    controls: [CM-8, PL-2]
    severity: MEDIUM
```

With `compliance_label: true`, a Cursor-agent `FAIL` blocks under `stats.custom_compliance` without merging into Checkov/NIST inline counts.

Checklist precedence:

1. Org checklist loads from `.controlbot/org/checklist.yaml` (override via `CONTROLBOT_ORG_CHECKLIST` env var or `--org-checklist <path>`).
2. Local `.controlbot/checklist.yaml` merges second; matching `id` overrides the org rule, or disables it when `enabled: false`.
3. Outputs in `custom-compliance-results.json` and `review-payload.json` tag each rule with its source (`org`, `local`, or `local override`).

## Evidence facts

`npm run evidence` collects non-blocking observations into `evidence-facts.json`:
- Terraform resources, provider regions, public exposure, tags, and encryption attributes
- GitHub workflow triggers, permissions, test/typecheck steps, and artifact uploads
- `package.json` / `package-lock.json` dependencies and scripts
- `CODEOWNERS` presence
- `.controlbot/*` policies and Checkov-to-NIST mapping coverage

## PR labels and sticky summary

ControlBot updates a single PR summary comment keyed by `<!-- controlbot-summary -->` and syncs labels per run (removing stale `controlbot:*` and `effort:*` labels first):

| Label | Meaning |
| --- | --- |
| `controlbot:blocking` | Merge-blocking deterministic or custom compliance findings exist |
| `controlbot:custom-compliance` | At least one custom compliance checklist item failed |
| `controlbot:family-SC`, `controlbot:family-AC`, etc. | Findings affect the named NIST control family |
| `effort:1` ... `effort:5` | Deterministic effort bucket derived from finding severity and volume |

## POA&M seeds

`npm run poam` writes structured `controlbot.poam-seeds.v1` JSON to `poam-seeds.json` and a Markdown table to `poam-seeds.md` for all active Checkov/NIST findings and failed custom checklist items (with default severity due windows: CRITICAL 15d, HIGH 30d, MEDIUM 60d, LOW 90d).

## Example Terraform

[`fixtures/terraform/main.tf`](fixtures/terraform/main.tf) contains intentionally weak resources for demos.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run scan` | Checkov to `findings.json` |
| `npm run evidence` | Build `evidence-facts.json` |
| `npm run review` | Agent or scan-only to `report.md` and `custom-compliance-results.json` |
| `npm run controlbot` | Build PR review payload; exit `2` if blocking |
| `npm run poam` | Build `poam-seeds.json` and `poam-seeds.md` |
| `npm run post-review` | Post to GitHub (CI) |
| `npm test` | Regression tests for checklist merge, labels, and POA&M seeds |

## Exit codes

| Code | Meaning |
| --- | --- |
| `0` | Pass |
| `1` | Tooling error |
| `2` | Blocking control or custom compliance findings |

## License

MIT
