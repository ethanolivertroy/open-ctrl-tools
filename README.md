# Open Control Tools

A monorepo of GRC engineering tools, cloud and identity auditors, agent skills, and reference demos organized into `apps/`, `auditors/`, `tools/`, `skills/`, and `demos/`. Each package owns its own dependencies, configuration, tests, and build setup.

## Apps

| Package | Stack | Description |
| --- | --- | --- |
| [`goog-sec`](./apps/goog-sec) | Astro / Starlight | Community-maintained security guidance for Google Workspace, Google Cloud, and Chrome. |
| [`trust-me-bro-center`](./apps/trust-me-bro-center) | TypeScript / Cloudflare Workers | Self-hosted trust center on Workers, D1, R2, and optional Workers AI with an admin UI and MCP server. |

## Auditors

| Package | Stack | Description |
| --- | --- | --- |
| [`azure-cloud-shell-audit`](./auditors/azure-cloud-shell-audit) | PowerShell | Audits Azure subscriptions against FedRAMP High, NIST SP 800-53 Rev 5, and CIA triad impacts. |
| [`duo-audit`](./auditors/duo-audit) | Python | Audits Duo Security settings against FedRAMP 2026 `KSI-IAM`, NIST SP 800-63B, and CISA MFA guidance. |
| [`github-security-audit`](./auditors/github-security-audit) | Bash | Queries GitHub REST and GraphQL APIs for FedRAMP, NIST 800-53, NIST 800-161, SOC 2, HIPAA, ISO 27001, and PCI-DSS checks. |
| [`go-go-okta-inspector`](./auditors/go-go-okta-inspector) | Go | Okta configuration auditor with CLI, TUI, snapshot replay, and MCP server covering FedRAMP, DISA STIG, IRAP, ISMAP, SOC 2, and PCI-DSS. |
| [`google-cloud-shell-audit`](./auditors/google-cloud-shell-audit) | Bash | Runs NIST SP 800-53 Rev 5 and FedRAMP checks plus GCP asset inventory in Cloud Shell or a local shell. |
| [`gws-inspector-py`](./auditors/gws-inspector-py) | JavaScript / Python / Go | Multi-language scripts auditing Google Workspace settings across 12 FedRAMP compliance controls. |
| [`okta-inspector-py`](./auditors/okta-inspector-py) | Python / Bash | Legacy script predecessor to `go-go-okta-inspector` checking Okta settings against FedRAMP, STIG, IRAP, ISMAP, SOC 2, and PCI-DSS. |
| [`slack-audit`](./auditors/slack-audit) | Python | Audits Slack workspace settings against NIST 800-53 Rev 5, FedRAMP, CIS Slack Benchmark, and ISO 27001. |
| [`splunk-audit`](./auditors/splunk-audit) | Python | Audits Splunk configurations against FedRAMP and NIST SP 800-53 baselines. |
| [`wilma`](./auditors/wilma) | Python | Evaluates AWS Bedrock security posture against OWASP LLM/Agentic guidance, NIST AI RMF, and NIST 800-53. |

## Tools

| Package | Stack | Description |
| --- | --- | --- |
| [`cmvp-tui`](./tools/cmvp-tui) | Go | Terminal UI for searching NIST CMVP validated cryptographic modules. |
| [`controlbot`](./tools/controlbot) | TypeScript | Terraform PR compliance reviewer combining Checkov static scans, NIST 800-53 mapping, and optional Cursor review. |
| [`drata-cli`](./tools/drata-cli) | Node.js | Unofficial OpenAPI-driven CLI and agent workflow skill for Drata's public v1/v2 APIs. |
| [`fedramp-browser`](./tools/fedramp-browser) | Go | Terminal UI for browsing FedRAMP requirements, definitions, and Key Security Indicators. |
| [`mesh-security`](./tools/mesh-security) | TypeScript | Monorepo toolkit (core library, VS Code extension, MCP server) for checking Istio, Consul, and Linkerd configs. |
| [`mesh-security-trainer`](./tools/mesh-security-trainer) | Node.js | Interactive browser trainer for spotting Istio, Consul, and Linkerd security misconfigurations. |
| [`nist-cmvp-api`](./tools/nist-cmvp-api) | Python | Self-hosted scraper, validator, Modal runner, workflow templates, and agent skill for publishing a NIST CMVP static JSON API. |
| [`oscal-cli`](./tools/oscal-cli) | Go | CLI to validate and convert OSCAL 1.1.3 documents across XML, JSON, and YAML. |
| [`pi-kevin`](./tools/pi-kevin) | TypeScript | Pi extension and skill for browsing and analyzing CISA Known Exploited Vulnerabilities (KEV). |

## Skills

| Package | Stack | Description |
| --- | --- | --- |
| [`emass-skills`](./skills/emass-skills) | Agent Skills | Agent skills for operating the eMASSer CLI across eMASS GET, POST, PUT, DELETE, and artifact workflows. |
| [`nist-cybersecurity-skills`](./skills/nist-cybersecurity-skills) | Agent Skills / Python | NIST cybersecurity publication reference skill and Python lookup utility. |
| [`security-skills`](./skills/security-skills) | Agent Skills | Agent skills for scanning service mesh and IaC configurations with NIST 800-53 mappings. |

## Demos

| Package | Stack | Description |
| --- | --- | --- |
| [`bsidesorl-2025-grcengcloud`](./demos/bsidesorl-2025-grcengcloud) | Python | BSides Orlando 2025 talk demo collecting GCP posture against a FedRAMP 20x pilot-era KSI snapshot. |
| [`codex-grc-agent-demo`](./demos/codex-grc-agent-demo) | Python | Proof-of-concept GRC assessment agent using OpenAI Agents SDK and `codex_tool`. |
| [`databricks-grc-demo`](./demos/databricks-grc-demo) | Python | Reference Databricks Unity Catalog medallion pipeline and ML risk scoring demo for NIST 800-53 controls. |
| [`flue-grc-engineer-demo`](./demos/flue-grc-engineer-demo) | TypeScript / Cloudflare Workers | Flue demo GRC engineering agent running inside Cloudflare Container sandboxes. |
| [`gcp-assured-workload-demo`](./demos/gcp-assured-workload-demo) | Terraform / Bash | Reference Terraform and validation scripts for GCP Assured Workloads FedRAMP High environments. |
| [`mellea-for-grc`](./demos/mellea-for-grc) | Jupyter / Python | Tutorial notebook exploring Mellea generative validation pipelines for SOC 2 and ISO 27001 checks. |
| [`nist-cybersecurity-mlx-pipeline`](./demos/nist-cybersecurity-mlx-pipeline) | Python / Bash | Reproducible scripts for downloading NIST publications, extracting text, and fine-tuning Qwen models with MLX LoRA. |
| [`pcidss-mcp-training`](./demos/pcidss-mcp-training) | Jupyter / Python | Training notebook on building MCP servers over compliance workbooks using TypeScript and Zod. |

## Cloudflare Workers

This repository intentionally omits a root `package.json` or workspace file so Cloudflare Workers projects (`apps/trust-me-bro-center` and `demos/flue-grc-engineer-demo`) stay self-contained with their own lockfiles and `wrangler.jsonc` configs:

- **Deploy Button:** Point to a standalone Worker tree URL, such as `https://deploy.workers.cloudflare.com/?url=https://github.com/ethanolivertroy/open-ctrl-tools/tree/main/apps/trust-me-bro-center`.
- **Cloudflare Workers Builds:** Set **Root directory** to `apps/trust-me-bro-center` (or `demos/flue-grc-engineer-demo`) and **Build watch paths** to that directory (`apps/trust-me-bro-center/*`) so changes in other packages do not trigger Worker rebuilds.

## License

MIT License. See [`LICENSE`](./LICENSE). Embedded public-domain NIST OSCAL schemas in `oscal-cli` retain their attribution in [`tools/oscal-cli/NOTICE`](./tools/oscal-cli/NOTICE), and bundled Drata OpenAPI specifications in `drata-cli` retain Drata's terms in [`tools/drata-cli/NOTICE`](./tools/drata-cli/NOTICE).
