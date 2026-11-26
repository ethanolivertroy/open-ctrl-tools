# Codex GRC Agent Demo

Python proof-of-concept for a bounded GRC assessment agent built with the [OpenAI Agents SDK](https://openai.github.io/openai-agents-python/) and the experimental `codex_tool`.

The demo keeps the deterministic parts of compliance in code and data:

- baseline membership comes from local JSON,
- control metadata comes from local JSON,
- shared-responsibility hints come from code,
- POA&M entries are formatted by a deterministic helper,
- specialist analysis happens through `Agent.as_tool()`,
- local workspace inspection happens through `codex_tool(...)`.

## Status

Demo proof of concept only; do not rely on outputs for formal security or compliance review.

## What it does

- assesses a local SSP and evidence bundle against a small `NIST 800-53` / `FedRAMP Moderate` starter dataset,
- returns typed findings and a compliance rollup,
- generates POA&M-ready remediation entries for weak controls,
- uses specialist agents for policy review and evidence review,
- keeps Codex inside `workspace-write` with network disabled.

## Project layout

```text
codex-grc-agent-demo/
├── data/
│   ├── fedramp-baselines.json
│   └── nist-800-53-r5.json
├── examples/
│   ├── sample-ssp.md
│   └── evidence/
│       ├── access-review.md
│       ├── logging-procedure.md
│       └── mfa-standard.md
├── src/grc_agent/
│   ├── agent.py
│   ├── cli.py
│   ├── datasets.py
│   └── models.py
└── tests/
```

## Install

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
npm i -g @openai/codex
```

Codex CLI can authenticate with either `CODEX_API_KEY` or `OPENAI_API_KEY`.

```bash
export OPENAI_API_KEY=sk-...
```

## Run

```bash
grc-agent assess \
  --framework "NIST 800-53" \
  --baseline "FedRAMP Moderate" \
  examples/sample-ssp.md
```

Optional file output:

```bash
grc-agent assess \
  --framework "NIST 800-53" \
  --baseline "FedRAMP Moderate" \
  --output out/assessment.json \
  examples/sample-ssp.md
```

## Notes

- The included framework data is intentionally tiny so the repo stays readable.
- Swap the JSON files in `data/` for fuller baseline data before treating outputs as meaningful.
- The agent code follows the current OpenAI docs pattern for `Runner.run(...).final_output`, `Agent.as_tool()`, and the experimental `codex_tool`.

## Test

```bash
python -m pytest
```

