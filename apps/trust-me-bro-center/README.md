# Trust Me Bro Center

Self-hosted trust center running on Cloudflare Workers, D1, R2, and optional Workers AI. Security teams manage the site through an admin UI or over MCP, while reviewers browse published controls, download public files, request gated documents, and subscribe to updates without creating accounts.

This Worker only hosts the public trust page and request workflow; it does not collect evidence, monitor infrastructure controls, run audits, or score vendors. Control statuses reflect whatever an operator or connected agent sets.

Local setups ship with fictional **Northstar Labs** placeholder content. Replace every claim, contact, date, and uploaded document before exposing a site externally.

## Reviewer experience

Public views cover Overview, Resources, Controls, Media, FAQ, Subprocessors, and Updates. Overview displays compliance frameworks, resources, and data-collected disclosures alongside controls, FAQs, subprocessors, and updates. Public files open directly, while request-only documents require admin approval first. Subscriptions use a confirmation button on `/confirm` so link scanners do not auto-confirm addresses, and the "Ask a question" drawer answers strictly from published records.

Only records in `published` appear on the site. Control categories marked `SHAREABLE` and updates marked `PRIVATE` are visible only through personal viewer links. Setting `isPublic` to false locks the entire site behind an access-request form.

## Publishing lifecycle

Every record moves through an explicit lifecycle:

```text
draft -> review -> published -> archived -> draft
            └-> draft
```

New items start as `draft`, and editing an item leaves it unpublished until explicitly moved to `published` (logged in the audit trail). Publishing an update queues an email once per active subscriber; subsequent edits or republishes do not re-email subscribers.

Operators manage the site through `/admin/` (using Cloudflare Access or a shared `ADMIN_TOKEN`) or via the `/mcp` server from clients such as Cursor and Grok Bot.

## Architecture

Static pages are served via Workers Static Assets, while the Worker handles `/api/*` and `/mcp`:

```text
Browser
  ├── Workers Static Assets     public site, viewer access page, admin, confirm, unsubscribe
  └── Worker
        ├── D1     records, categories, controls, requests, viewers, subscribers, chat, mail queue, audit
        ├── R2     uploaded files, logo, favicon, banner, framework badges
        ├── AI     optional Workers AI binding for chat (falls back to keyword retrieval)
        └── Email  Cloudflare Email Service (prints to console locally if EMAIL_LOG_ONLY=true)
```

Public JSON omits R2 object keys, and request-only files are served only through active viewer token routes.

## Run locally

Requires Node.js 22 and npm.

```bash
npm install
cp .dev.vars.example .dev.vars
# Put a long random ADMIN_TOKEN in .dev.vars; do not commit it.
npm run db:local
npm run dev
```

| Surface | URL |
| --- | --- |
| Public site | `http://127.0.0.1:8787/` |
| Viewer access | `http://127.0.0.1:8787/access?token=...` |
| Admin | `http://127.0.0.1:8787/admin/` |
| MCP | `http://127.0.0.1:8787/mcp` |

With `EMAIL_LOG_ONLY=true`, confirmation and viewer access links print to the Wrangler console. Local D1/R2 data stays under `.wrangler/` (gitignored).

```bash
npm test          # unit tests against in-memory fakes
npm run test:d1   # D1Repository against local D1 in workerd
npm run typecheck
npm run build     # dry-run bundle check; does not deploy
```

`npm run check` runs the full suite and build, matching `.github/workflows/ci.yml`.

## Authentication and access control

Two admin auth modes are supported:

1. **Admin token:** set `ADMIN_TOKEN` as a Worker secret. The admin UI stores it in tab `sessionStorage`, and audit entries record `admin`.
2. **Cloudflare Access:** protect `/admin/*` and `/api/admin/*` with Access and set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD`. The Worker validates `Cf-Access-Jwt-Assertion` and records the user email in audit logs (`ADMIN_TOKEN` continues working for local dev and `/mcp`).

The public UI does not link to `/admin/`. Do not put Access in front of `/mcp`, `/mcp/*`, `/access`, or `/api/viewer/*`, since those routes authenticate with a Bearer token or viewer token. Never store production tokens in `wrangler.jsonc`, source files, or committed `.dev.vars` files.

## MCP integration (Cursor and Grok Bot)

Agents authenticate with the same Bearer `ADMIN_TOKEN`:

| Client | Configuration |
| --- | --- |
| Cursor | Copy `mcp.json.example`, set `url` to `/mcp`, and set `Authorization: Bearer <ADMIN_TOKEN>`. |
| Grok Bot | Follow [`grokbot.md`](./grokbot.md) with URL `https://<WORKER_HOST>/mcp` and header `Authorization: Bearer <ADMIN_TOKEN>`. |

MCP tools include `trust_center_guide`, `get_public_snapshot`, `get_admin_state`, `set_lifecycle`, `manage_category`, `manage_control`, `set_data_collected`, `set_videos`, `manage_subscriber`, `list_access_requests`, `decide_access_request`, `manage_viewer`, `list_chatbot_conversations`, and `reset_demo_content` (`confirm=true`). Keep `ADMIN_TOKEN` out of chat logs, screenshots, and shared prompts.

## Email queue, subscriptions, and viewer links

Emails for subscriptions, request approvals, new viewers, and published updates are written to `email_outbox` inside the triggering D1 transaction. The Worker drains immediately and retries on a 5-minute schedule, claiming rows as `sending` for 10 minutes before retry so concurrent runs do not double-send.

The `send_email` binding uses Cloudflare Email Service (the same underlying binding used by [Grok Bot Inbox](https://github.com/ethanolivertroy/grokbot-cloudflare-inbox), which handles inbound mail separately). Without `EMAIL` and `EMAIL_FROM` configured, messages stay `pending` in the admin Email panel.

| Binding / Var | Purpose |
| --- | --- |
| `EMAIL` | Wrangler `send_email` binding |
| `EMAIL_FROM` | Verified sender address, e.g. `Trust Me Bro Center <trust@example.com>` |
| `EMAIL_LOG_ONLY` | Logs email content in dev instead of sending |
| `PUBLIC_BASE_URL` | Origin used for links in emails (defaults to request origin) |
| `AI` | Optional Workers AI binding (`@cf/meta/llama-3.1-8b-instruct`); falls back to local text matching |

Subscribe requests store a hashed 48-hour token (`pending`) until confirmed via `/confirm`; future emails include `/unsubscribe` and `List-Unsubscribe`. Approving an access request or adding a viewer generates a 256-bit bearer token stored as SHA-256 (`FULL_ACCESS` or `PARTIAL_ACCESS` over selected published documents, optional expiry, and optional `isNdaRequired` click-through). Removing a viewer immediately revokes the link; approving a request whose document was unpublished returns HTTP 409. Pending access requests deduplicate repeat submissions from the same email/resources and queue one alert to the security contact (`ACCESS_REQUEST_NOTIFY_EMAIL` or site contact). Admins can export subscribers as CSV (`/api/admin/subscribers/export`) or retry failed mail rows.

## Public form protection

Both `POST /api/subscribe` and `POST /api/access-requests` apply:

| Control | Mechanism | Behavior |
| --- | --- | --- |
| IP rate limit | `PUBLIC_FORM_LIMITER` in `wrangler.jsonc` | 10 req/min per IP per route; returns `429` with `Retry-After` (fails open on binding error) |
| Address cooldown | D1 | Suppresses repeat pending confirmations within 10 minutes and deduplicates pending access requests |
| Turnstile (optional) | `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` | Enables widget and server verification when both are set |

## API endpoints

Admin list routes accept `pageSize` (1-100, default 10) and `pageCursor`, returning `{ results: { data, pageInfo } }`.

| Method | Path | Access |
| --- | --- | --- |
| GET | `/api/site` | public (cached 30s) |
| GET | `/api/logo`, `/api/favicon`, `/api/banner`, `/api/certifications/:id/badge` | public |
| GET | `/robots.txt`, `/sitemap.xml` | public |
| POST | `/api/subscribe` | public (rate-limited) |
| POST | `/api/subscribe/confirm`, `/api/unsubscribe` | confirmation / unsubscribe token |
| POST | `/api/access-requests` | public (rate-limited) |
| GET | `/api/documents/:id` | public (published only) |
| POST | `/api/chat` | public |
| GET | `/api/viewer/:token`, `/api/viewer/:token/documents/:id` | viewer token |
| POST | `/api/viewer/:token/nda` | viewer token |
| GET | `/api/admin/state` | admin |
| GET, PUT, PATCH | `/api/admin/site` | admin |
| POST, DELETE | `/api/admin/logo`, `/api/admin/favicon`, `/api/admin/banner` | admin |
| GET, POST | `/api/admin/resources/:kind` | admin |
| GET, PUT, PATCH, DELETE | `/api/admin/resources/:kind/:id` | admin |
| POST | `/api/admin/resources/:kind/:id/lifecycle` | admin |
| POST | `/api/admin/documents/upload` | admin |
| GET | `/api/admin/resources/documents/:id/media` | admin |
| POST, DELETE | `/api/admin/resources/certifications/:id/badge` | admin |
| GET, PUT | `/api/admin/videos` | admin |
| GET, POST | `/api/admin/resource-categories`, `/api/admin/faq-categories`, `/api/admin/control-categories` | admin |
| PUT | `/api/admin/{resource,faq,control}-categories/order` | admin |
| GET, PATCH, DELETE | `/api/admin/{resource,faq,control}-categories/:id` | admin |
| PATCH | `/api/admin/control-categories/:id/controls` | admin |
| PUT | `/api/admin/control-categories/:id/controls/order` | admin |
| GET, POST | `/api/admin/controls` | admin |
| GET, PATCH, DELETE | `/api/admin/controls/:id` | admin |
| POST, DELETE | `/api/admin/controls/tags` | admin |
| GET, PUT | `/api/admin/data-collected` | admin |
| GET, POST | `/api/admin/subscribers` | admin |
| GET | `/api/admin/subscribers/export` | admin (CSV) |
| GET, DELETE | `/api/admin/subscribers/:id` | admin |
| POST | `/api/admin/emails/:id/retry` | admin (failed rows) |
| GET | `/api/admin/access-requests`, `/api/admin/access-requests/:id` | admin |
| POST | `/api/admin/access-requests/:id/approve`, `.../deny` | admin |
| GET, POST | `/api/admin/viewers` | admin |
| GET, PATCH, DELETE | `/api/admin/viewers/:id` | admin |
| GET | `/api/admin/chatbot/conversations`, `/api/admin/chatbot/conversations/:id` | admin |
| POST | `/api/admin/reset` | admin |
| ALL | `/mcp`, `/mcp/*` | admin Bearer token |

## Design scope and roadmap

Records keep a `draft` / `review` / `published` lifecycle, viewer NDAs are simple recorded click-throughs rather than e-signatures, and access request activity is handled in admin and MCP rather than via outbound webhooks. Planned additions such as subscriber groups and webhooks are listed in [`ROADMAP.md`](./ROADMAP.md).

## Deploying to Cloudflare

Cloudflare's Deploy Button can target this subdirectory directly (`https://deploy.workers.cloudflare.com/?url=https://github.com/ethanolivertroy/open-ctrl-tools/tree/main/apps/trust-me-bro-center`) once the repository is public to clone it standalone and provision D1 and R2 bindings. For Cloudflare Workers Builds (Git integration), set **Root directory** to `apps/trust-me-bro-center` and **Build watch paths** to `apps/trust-me-bro-center/*`.

Manual deployment:

```bash
npx wrangler d1 create trust-me-bro-center-db
npx wrangler r2 bucket create trust-me-bro-center-documents
# Set the returned database_id in wrangler.jsonc
npx wrangler secret put ADMIN_TOKEN
```

Optional setup: onboard your sender domain under **Compute > Email Service** and set `EMAIL_FROM`; set `ACCESS_TEAM_DOMAIN` and `ACCESS_AUD` for Access; set `PUBLIC_BASE_URL` for explicit email link origins; set `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` as secrets; set `ACCESS_REQUEST_NOTIFY_EMAIL` if alerts go elsewhere; uncomment the `ai` binding in `wrangler.jsonc` for Workers AI chat answers.

```bash
npm run build
npm run deploy
```

`npm run deploy` runs D1 migrations against `DB` and deploys the Worker. Note that migration `0010` converts prior unrevoked document grants into partial-access viewers without stored raw links; remove and re-add those viewers in admin if they need fresh links. After deployment, attach a custom domain, put `/admin/*` behind Access (leaving `/mcp*`, `/access`, and `/api/viewer/*` un-gated), rate-limit `/api/chat` and admin auth failures at the WAF, and replace the Northstar demo content. Unknown routes serve `public/404.html`, and `/api/site` caches for 30 seconds.
