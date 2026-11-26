# Open Control Tools

A monorepo of GRC engineering tools, cloud and identity auditors, and compliance utilities organized into `apps/`, `auditors/`, and `tools/`. Each package owns its own dependencies, configuration, tests, and build setup.

## Apps

| Package | Stack | Description |
| --- | --- | --- |
| [`trust-me-bro-center`](./apps/trust-me-bro-center) | TypeScript / Cloudflare Workers | Self-hosted trust center on Workers, D1, R2, and optional Workers AI with an admin UI and MCP server. |

## Auditors

| Package | Stack | Description |
| --- | --- | --- |
| [`duo-audit`](./auditors/duo-audit) | Python | Audits Duo Security settings against FedRAMP 2026 `KSI-IAM`, NIST SP 800-63B, and CISA MFA guidance. |
| [`github-security-audit`](./auditors/github-security-audit) | Bash | Queries GitHub REST and GraphQL APIs for FedRAMP, NIST 800-53, NIST 800-161, SOC 2, HIPAA, ISO 27001, and PCI-DSS checks. |
| [`go-go-okta-inspector`](./auditors/go-go-okta-inspector) | Go | Okta configuration auditor with CLI, TUI, snapshot replay, and MCP server covering FedRAMP, DISA STIG, IRAP, ISMAP, SOC 2, and PCI-DSS. |
| [`google-cloud-shell-audit`](./auditors/google-cloud-shell-audit) | Bash | Runs NIST SP 800-53 Rev 5 and FedRAMP checks plus GCP asset inventory in Cloud Shell or a local shell. |
| [`splunk-audit`](./auditors/splunk-audit) | Python | Audits Splunk configurations against FedRAMP and NIST SP 800-53 baselines. |
| [`wilma`](./auditors/wilma) | Python | Evaluates AWS Bedrock security posture against OWASP LLM/Agentic guidance, NIST AI RMF, and NIST 800-53. |

## Tools

| Package | Stack | Description |
| --- | --- | --- |
| [`cmvp-tui`](./tools/cmvp-tui) | Go | Terminal UI for searching NIST CMVP validated cryptographic modules. |
| [`fedramp-browser`](./tools/fedramp-browser) | Go | Terminal UI for browsing FedRAMP requirements, definitions, and Key Security Indicators. |
| [`oscal-cli`](./tools/oscal-cli) | Go | CLI to validate and convert OSCAL 1.1.3 documents across XML, JSON, and YAML. |

## Cloudflare Workers

This repository intentionally omits a root `package.json` or workspace file so every Worker under `apps/` stays self-contained with its own lockfile and `wrangler.jsonc`:

- **Deploy Button:** Point to the package tree URL, such as `https://deploy.workers.cloudflare.com/?url=https://github.com/ethanolivertroy/open-ctrl-tools/tree/main/apps/trust-me-bro-center`.
- **Cloudflare Workers Builds:** Set **Root directory** to `apps/<name>` and **Build watch paths** to `apps/<name>/*` so changes in other packages do not trigger Worker rebuilds.

## License

MIT License. See [`LICENSE`](./LICENSE). Embedded public-domain NIST OSCAL schemas in `oscal-cli` retain their attribution in [`tools/oscal-cli/NOTICE`](./tools/oscal-cli/NOTICE).
