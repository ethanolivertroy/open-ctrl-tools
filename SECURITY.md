# Security Policy

## Scope

This policy covers all packages in `apps/`, `auditors/`, `tools/`, `skills/`, and `demos/` inside `ethanolivertroy/open-ctrl-tools`.

## Reporting a Vulnerability

Do **not** open public GitHub issues for unpatched vulnerabilities, proof-of-concept exploits, or exposed credentials/tokens.

Instead, report vulnerabilities privately through GitHub Security Advisories:

- https://github.com/ethanolivertroy/open-ctrl-tools/security/advisories/new

Please include:

- The affected package path (for example, `apps/trust-me-bro-center` or `auditors/wilma`)
- Reproduction steps, configuration details, or a minimal proof of concept
- Impact assessment and any suggested remediation

## Handling Credentials & Evidence

- Audit tools in `auditors/` and `tools/` authenticate only against the cloud, identity, or compliance APIs explicitly configured by the operator and do not transmit credentials elsewhere.
- Never commit live API tokens, `.env` files, or environment exports to issues, pull requests, or sample outputs.
- Automated secret scanning (`gitleaks` in CI and GitHub Secret Scanning / Push Protection) runs across changes to catch accidental secret exposure.
