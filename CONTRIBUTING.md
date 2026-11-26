# Contributing

Thanks for contributing to `open-ctrl-tools`.

## Repository Layout

Each standalone package lives in a lowercase `kebab-case` directory under one of five top-level categories:

- `apps/` — web apps and deployable services
- `auditors/` — cloud, SaaS, and identity compliance auditors
- `tools/` — CLIs, TUIs, analyzers, and extensions
- `skills/` — reusable Agent Skills packages
- `demos/` — reference GRC engineering pipelines and workshops

## Package Ownership & Cloudflare Workers

- Keep each package self-contained with its own dependencies, tests, build config, and `README.md`.
- Do **not** add a root `package.json`, workspace hoisting file, or root lockfile: Cloudflare Workers packages (`apps/trust-me-bro-center` and `demos/flue-grc-engineer-demo`) rely on isolated package roots and independent lockfiles.

## Before Opening a Pull Request

1. Run the package-local tests, linters, and build checks described in the package's `README.md` (and reflected in [`.github/workflows/ci.yml`](.github/workflows/ci.yml)).
2. Keep fixtures synthetic and run `gitleaks dir . --config .gitleaks.toml --redact --no-banner` if `gitleaks` is installed locally; never commit credentials, `.env` files, internal audit reports, or binary artifacts.
3. Open a pull request against `main` with signed/verified commits or via a standard pull request workflow.
