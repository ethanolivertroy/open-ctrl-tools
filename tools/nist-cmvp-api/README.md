# NIST CMVP API

Self-hosted Python scraper, validator, Modal sharded runner, GitHub Actions workflow templates, and Agent Skill for building a static JSON API mirror of the [NIST Cryptographic Module Validation Program (CMVP)](https://csrc.nist.gov/projects/cryptographic-module-validation-program).

> **Code-only in `open-ctrl-tools`:** This monorepo distributes the MIT-licensed pipeline (`scraper.py`, `validate_api.py`, `modal_scrape.py`, tests, workflow templates, and agent skill) rather than committing a 60 MB frozen scrape snapshot (`api/` and `data/cmvp.db`). Generated datasets contain scraped vendor contact metadata and algorithm extractions parsed from vendor-authored Security Policy PDFs, and CMVP data updates continuously—so running the pipeline yourself (locally, on Modal, or in a dedicated GitHub Pages repo) gives you fresh data on your own schedule.
>
> For quick read-only lookups against the historical archived snapshot, see [`https://ethanolivertroy.github.io/nist-cmvp-api/`](https://ethanolivertroy.github.io/nist-cmvp-api/).

## Features

- Scrapes active FIPS 140-2/140-3 validated modules, historical/revoked modules, and modules in process from `csrc.nist.gov`
- Extracts Security Policy PDF links and per-certificate `algorithm_extraction` metadata (using Crawl4AI with a PyMuPDF local PDF parser fallback, or optional `cmvp.db` import)
- Generates per-certificate detail records (`api/certificates/{certificate}.json`), discovery indexes (`api/certificates/index.json`, `api/indexes/*.json`), OpenAPI 3.0.3 (`openapi.json`), JSON Schemas (`api/schemas/*.schema.json`), `llms.txt` / `llms-full.txt`, `api/docs.md`, `api/examples.json`, `api/data-quality.json`, and `api/changes.json`
- Includes reusable GitHub Actions workflow templates (`workflows/`) and an Agent Skill (`skills/nist-cmvp-pipeline/SKILL.md`) so coding agents can stand up and refresh a mirror automatically

## Agent Skill

Install or point your coding agent (Pi, Claude Code, Codex, OpenCode, Cursor) at [`skills/nist-cmvp-pipeline/SKILL.md`](skills/nist-cmvp-pipeline/SKILL.md) for end-to-end instructions covering:

- Credential-free lint, pytest, and `pip-audit` verification
- Configuring `CMVP_PUBLIC_BASE_URL` and `CMVP_REPO_URL`
- Running local or Modal sharded scrapes and validating artifacts with `validate_api.py`
- Setting up automated weekly GitHub Actions refreshes + GitHub Pages in a dedicated mirror repository
- Pointing `grclanker` (`CMVP_API_BASE_URL`) or HTTP clients at your self-hosted mirror

## Generated API Surface

Once `scraper.py` runs, it writes the following endpoints relative to your root output directory (with `Base URL` set via `CMVP_PUBLIC_BASE_URL`, defaulting to `https://ethanolivertroy.github.io/nist-cmvp-api`):

| Endpoint | Description |
|----------|-------------|
| `api/modules.json` | Validated cryptographic modules with algorithms and security policy URLs |
| `api/historical-modules.json` | Expired/revoked modules with security policy URLs |
| `api/modules-in-process.json` | Modules currently in validation |
| `api/algorithms.json` | Algorithm summary with usage statistics across all certificates |
| `api/metadata.json` | Dataset info (last update, counts, feature flags, extraction metrics) |
| `api/index.json` | API index with all endpoints, schema links, and feature flags |
| `api/data-quality.json` | Latest run quality report, cache reuse checks, misses, refreshes, fallbacks, and changed certificates |
| `api/changes.json` | Incremental diff feed across recent runs (`max_runs: 26`) |
| `api/examples.json` | `curl`, Python, JavaScript, and agent-oriented lookup examples |
| `api/indexes/vendors.json` | Certificate references keyed by vendor name |
| `api/indexes/algorithms.json` | Certificate references keyed by extracted algorithm category |
| `api/indexes/statuses.json` | Certificate references keyed by status |
| `api/indexes/standards.json` | Certificate references keyed by FIPS standard |
| `api/schemas/*.schema.json` | JSON Schemas (Draft 2020-12) for response validation |
| `api/certificates/index.json` | Compact discovery index for every per-certificate detail file |
| `api/certificates/{certificate}.json` | Structured detail record for one CMVP certificate |
| `api/docs.md` | Markdown endpoint reference with examples |
| `openapi.json` | OpenAPI 3.0.3 schema |
| `llms.txt` / `llms-full.txt` | Compact and complete single-file agent discovery references |

## Local Development & Verification

The checked-in transitive hash locks target **CPython 3.12 on Linux x86_64**.

```bash
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r requirements-dev.lock

# Credential-free checks; these do not scrape or deploy
python -m ruff check .
python -m pytest test_scraper.py -q

# Audit the complete, already-resolved locks; no advisory is excluded
python -m pip_audit --require-hashes --disable-pip -r requirements-dev.lock
python -m pip_audit --require-hashes --disable-pip -r requirements.lock
```

For full runtime verification (Crawl4AI + PyMuPDF + NLTK), install `requirements.lock` into a separate environment:

```bash
python3.12 -m venv .venv-run
. .venv-run/bin/activate
python -m pip install --require-hashes -r requirements.lock
```

Regenerate locks after a reviewed dependency change (verified with `uv`):

```bash
uv pip compile requirements.txt --python-version 3.12 --python-platform x86_64-unknown-linux-gnu --generate-hashes --no-header -o requirements.lock
uv pip compile requirements-dev.txt --python-version 3.12 --python-platform x86_64-unknown-linux-gnu --generate-hashes --no-header -o requirements-dev.lock
```

## Self-Hosting & Live Scraping

Point generated metadata and documentation at your mirror origin, run `scraper.py`, and validate the generated tree:

```bash
export CMVP_PUBLIC_BASE_URL="https://<your-org>.github.io/<your-cmvp-repo>"
export CMVP_REPO_URL="https://github.com/<your-org>/<your-cmvp-repo>"

# Full scraper (Crawl4AI preferred, local PDF parser fallback)
python -u scraper.py

# Or force the local PyMuPDF PDF parser
ALGORITHM_SOURCE=security_policy_pdf python -u scraper.py

# Or fast catalog-only smoke scrape (skips algorithm extraction)
SKIP_ALGORITHMS=1 python -u scraper.py

# Validate generated artifacts strictly
python validate_api.py \
  --root . \
  --require-current-schema \
  --require-supported-algorithm-source \
  --require-data-quality-pass
```

### Automated GitHub Pages Mirror

To schedule automated weekly refreshes in your own standalone mirror repository:

1. Copy the pipeline files (`scraper.py`, `validate_api.py`, `modal_scrape_helpers.py`, `requirements.txt`, `requirements.lock`, `README.md`, `LICENSE`) into a dedicated repository.
2. Remove the generated-artifact ignores (`api/`, `index.html`, `llms.txt`, `llms-full.txt`, `openapi.json`) from that repository's `.gitignore`.
3. Copy [`workflows/update-cmvp-api.yml.example`](workflows/update-cmvp-api.yml.example) to `.github/workflows/update-cmvp-api.yml` and [`workflows/data-freshness.yml.example`](workflows/data-freshness.yml.example) to `.github/workflows/data-freshness.yml`.
4. Enable GitHub Actions write permissions and GitHub Pages (deploy from `main` root).

## Modal Remote Runs

Use [Modal](https://modal.com/) for faster parallel sharded scrapes and cache reuse across thousands of certificates:

```bash
# One-time local CLI setup
python3 -m venv .venv-modal
.venv-modal/bin/python -m pip install modal
.venv-modal/bin/python -m modal setup

# Cheap remote execution smoke test
.venv-modal/bin/python -m modal run modal_scrape.py::smoke

# Quality-preserving sharded dry run (does not update the Modal Volume cache)
.venv-modal/bin/python -m modal run modal_scrape.py::sharded \
  --shard-count 8 \
  --no-use-cache-volume \
  --no-update-cache-volume

# Persist reusable cache in the nist-cmvp-api-cache Modal Volume
.venv-modal/bin/python -m modal run modal_scrape.py::sharded \
  --shard-count 8 \
  --no-use-cache-volume

# Download and validate the generated archive
.venv-modal/bin/python -m modal volume get nist-cmvp-api-cache /runs/<run_id>/artifacts.tar.gz /tmp/cmvp-run/
tar -xzf /tmp/cmvp-run/artifacts.tar.gz -C /tmp/cmvp-run/
python validate_api.py \
  --root /tmp/cmvp-run \
  --require-current-schema \
  --require-supported-algorithm-source \
  --require-data-quality-pass

# Single-container remote scrape
.venv-modal/bin/python -m modal run modal_scrape.py::main
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CMVP_PUBLIC_BASE_URL` | `https://ethanolivertroy.github.io/nist-cmvp-api` | Base URL embedded in OpenAPI, schemas, docs, and examples |
| `CMVP_REPO_URL` | `https://github.com/ethanolivertroy/nist-cmvp-api` | Repository URL linked in OpenAPI and `index.html` |
| `NIST_SEARCH_PATH` | `/all` | Override the CMVP search path for modules |
| `SKIP_ALGORITHMS` | `0` | Set to `1` to skip algorithm/detail extraction |
| `ALGORITHM_SOURCE` | `crawl4ai` | Algorithm extraction source: `crawl4ai`, `security_policy_pdf`, `database`, or `none` |
| `CMVP_DB_PATH` | - | Path to `cmvp.db` for algorithm import (fastest override) |
| `CERT_FETCH_CONCURRENCY` | `8` | Concurrent certificate detail page fetches |
| `PDF_FETCH_CONCURRENCY` | `32` | Concurrent Security Policy PDF fetches/parses |
| `CERT_PROCESS_TIMEOUT` | `900` | Per-certificate processing timeout in seconds |
| `FULL_REFRESH` | `0` | Set to `1` to bypass reuse of previously generated outputs |

## License

MIT License — see [LICENSE](LICENSE).

## Related Projects

- [`cmvp-tui`](../cmvp-tui) - Terminal UI for searching NIST CMVP validated cryptographic modules
- [NIST-CMVP-ReportGen](https://github.com/ethanolivertroy/NIST-CMVP-ReportGen) - Companion CMVP reporting CLI with local PDF indexing and search
