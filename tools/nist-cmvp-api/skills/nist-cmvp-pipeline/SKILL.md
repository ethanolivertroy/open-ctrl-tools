---
name: nist-cmvp-pipeline
description: Use when standing up, running, validating, or automating a self-hosted NIST CMVP static JSON API mirror locally, on Modal, or via GitHub Actions and GitHub Pages, or when pointing consumers (`cmvp-tui`, `grclanker`, or HTTP clients) at a freshly built CMVP endpoint.
---

# NIST CMVP API Pipeline

Run and automate the open-source NIST Cryptographic Module Validation Program (CMVP) scraper, validator, and static JSON API generator in `tools/nist-cmvp-api/` without relying on pre-baked third-party snapshots.

## Why run your own pipeline

NIST CMVP active, historical, and in-process lists change frequently as new validations publish and older certificates sunset. Because `open-ctrl-tools` distributes MIT-licensed pipeline code rather than a 60 MB frozen snapshot containing scraped vendor contact details and Security Policy PDF extractions, agents and operators generate fresh `api/` outputs directly from NIST (`csrc.nist.gov`) into their own local workspace or dedicated GitHub Pages mirror repository.

## 1. Verify the local environment first (credential-free)

The pinned hash locks target **CPython 3.12 on Linux x86_64**. Run verification checks before live scraping:

```bash
cd tools/nist-cmvp-api
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install --require-hashes -r requirements-dev.lock

python -m ruff check .
python -m pytest test_scraper.py -q
python -m pip_audit --require-hashes --disable-pip -r requirements-dev.lock
python -m pip_audit --require-hashes --disable-pip -r requirements.lock
```

Install the full scraping runtime (`Crawl4AI` + `PyMuPDF` + `NLTK`) into a disposable environment when ready to scrape:

```bash
python3.12 -m venv .venv-run
. .venv-run/bin/activate
python -m pip install --require-hashes -r requirements.lock
```

## 2. Configure mirror URLs

Point generated OpenAPI specs, JSON Schemas, `llms.txt`, `api/examples.json`, and `index.html` at your own hosting origin before running `scraper.py`:

```bash
export CMVP_PUBLIC_BASE_URL="https://<your-org>.github.io/<your-cmvp-repo>"
export CMVP_REPO_URL="https://github.com/<your-org>/<your-cmvp-repo>"
```

If omitted, `scraper.py` defaults to `https://ethanolivertroy.github.io/nist-cmvp-api` and `https://github.com/ethanolivertroy/nist-cmvp-api`.

## 3. Choose a scrape mode

1. **Fast catalog-only smoke scrape** (skips Security Policy PDF downloads and algorithm extraction):

   ```bash
   SKIP_ALGORITHMS=1 python -u scraper.py
   ```

2. **Full local scrape with local PDF parser fallback** (avoids Crawl4AI if unavailable):

   ```bash
   ALGORITHM_SOURCE=security_policy_pdf python -u scraper.py
   ```

3. **Full local scrape with Crawl4AI (default)**:

   ```bash
   ALGORITHM_SOURCE=crawl4ai python -u scraper.py
   ```

4. **Cached sharded remote scrape on Modal** (recommended for fast, parallel updates without tying up CI):

   ```bash
   python3 -m venv .venv-modal
   .venv-modal/bin/python -m pip install modal
   .venv-modal/bin/python -m modal setup

   # Verify remote worker health first
   .venv-modal/bin/python -m modal run modal_scrape.py::smoke

   # Dry-run sharded scrape without replacing the reusable Modal Volume cache
   .venv-modal/bin/python -m modal run modal_scrape.py::sharded \
     --shard-count 8 \
     --no-use-cache-volume \
     --no-update-cache-volume

   # Persist cache updates once validated
   .venv-modal/bin/python -m modal run modal_scrape.py::sharded \
     --shard-count 8 \
     --no-use-cache-volume

   # Download generated archive to a local directory
   .venv-modal/bin/python -m modal volume get nist-cmvp-api-cache /runs/<run_id>/artifacts.tar.gz /tmp/cmvp-run/
   tar -xzf /tmp/cmvp-run/artifacts.tar.gz -C /tmp/cmvp-run/
   ```

   Avoid `--full-refresh` for routine refreshes; reusing cached certificate details and algorithm payloads keeps historical records complete when older Security Policy PDFs fail to parse or go offline.

## 4. Validate generated artifacts strictly

Always validate generated output before publishing or deploying:

```bash
python validate_api.py \
  --root . \
  --require-current-schema \
  --require-supported-algorithm-source \
  --require-data-quality-pass
```

For Modal downloads unpacked into `/tmp/cmvp-run`, pass `--root /tmp/cmvp-run`.

## 5. Automate weekly refreshes on GitHub Pages

To host a continuously refreshed mirror in a separate data repository:

1. Copy `tools/nist-cmvp-api/` (`scraper.py`, `validate_api.py`, `modal_scrape_helpers.py`, `requirements.txt`, `requirements.lock`, `README.md`, `LICENSE`) into your mirror repository.
2. Ensure `.gitignore` in that mirror repository does **not** ignore `api/`, `openapi.json`, `llms.txt`, `llms-full.txt`, or `index.html`.
3. Copy the two workflow templates into `.github/workflows/`:
   - `workflows/update-cmvp-api.yml.example` -> `.github/workflows/update-cmvp-api.yml`
   - `workflows/data-freshness.yml.example` -> `.github/workflows/data-freshness.yml`
4. Enable GitHub Actions (`Read and write permissions`) and GitHub Pages on `main` (root `/`).
5. Trigger **Update NIST CMVP Data** manually once via `workflow_dispatch` to populate the initial `api/` snapshot.

## 6. Connect downstream tools

Point consumers at your self-hosted endpoint or serve the local `api/` directory over HTTP (`python3 -m http.server 8080`):

- **grclanker** (`cmvp_*` tools):

  ```bash
  export CMVP_API_BASE_URL="https://<your-org>.github.io/<your-cmvp-repo>/api"
  ```

- **Direct `curl` / `jq` lookups:**

  ```bash
  curl -s "${CMVP_API_BASE_URL}/modules.json" | jq '.modules[] | select(."Vendor Name" | contains("OpenSSL"))'
  curl -s "${CMVP_API_BASE_URL}/certificates/index.json" | jq '.certificates[:5]'
  curl -s "${CMVP_API_BASE_URL}/data-quality.json" | jq '{status: .update_monitor.status, summary}'
  ```
