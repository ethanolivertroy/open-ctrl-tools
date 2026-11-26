# Mesh Security Trainer

Interactive browser trainer for finding security misconfigurations in Istio, Consul, and Linkerd service mesh configurations.

Unlike static linters that only print findings, Practice mode lets you review a sample config, mark vulnerable lines, categorize each issue, and compare your picks against the analyzer output (showing exploit notes, a before/after diff, and NIST control references).

## Modes

### Practice mode

Pick an exercise config, click lines you suspect have issues, choose categories, and submit for grading:

- **Caught**: right line, right category
- **Close**: right line, wrong category
- **Missed**: real finding you skipped
- **False alarms**: flagged lines that are valid

A dedicated exercise section focuses on missing configuration blocks where there is no vulnerable line to click.

### Analyze mode

Paste or upload your own Istio, Consul, or Linkerd config to run the same analyzer rules and see explanations and links immediately.

## Coverage

117 checks across Istio, Consul, and Linkerd covering mTLS, RBAC/authorization policies, certificates, gossip encryption, egress controls, observability, resource limits, and FedRAMP settings. Findings map to:

- NIST SP 800-204 A/B/C and SP 800-233 (microservices and service mesh security)
- NIST SP 800-207 (zero trust), SP 800-52 (TLS), SP 800-57 (key management)
- NIST SP 800-53 Rev 5 controls
- Istio, Consul, and Linkerd hardening docs

## Run locally

Requires Node.js 18+.

```bash
cd open-ctrl-tools/tools/mesh-security-trainer
npm ci
npm start
# Analyze mode:   http://localhost:3000
# Practice mode:  http://localhost:3000/practice.html
```

## Development

```bash
npm test          # run test suite
npm run dev       # run with nodemon auto-reload
```

### Directory layout

```text
src/
  analyzers/    Istio, Consul, and Linkerd analyzers + finding schema
  knowledge/    NIST/vendor references and lesson content (attack, fix, hints)
  learn/        Practice exercises and grading
  routes/       HTTP handlers for analyze and practice APIs
  lib/          Shared summary and line-number helpers
public/         Analyze UI, practice UI, and Monaco editor integration
tests/          Analyzer, endpoint, grading, and content-integrity tests
```

Practice answer keys are computed directly by running the analyzers against exercise fixtures so answers stay in sync with analyzer rules; in Practice mode answers stay server-side until submission.

To add checks or lessons, add analyzer logic under `src/analyzers/`, exercise fixtures in `src/learn/exercises.js`, and lesson content in `src/knowledge/lessons.data.json` keyed by finding ID.

## License

MIT. See [LICENSE](LICENSE).

## Disclaimer

Educational tool only. Passing all checks here does not substitute for a full security assessment of a production service mesh.
