# Refined Spec: Agent API + Access Gating for myctrl.tools

> **Status:** Approved — Phase 1 ready for implementation
> **Date:** 2026-03-17
> **Linear Project:** myctrl.tools (ec8004e9-679e-40bf-9669-e1d3f59da900)

## Summary

Build an **authenticated, rate-limited REST API** for myctrl.tools so AI agents and developer scripts can retrieve controls, mappings, guidance, and search results without scraping the frontend. The public website remains open for humans. High-value programmatic access is gated behind API keys.

---

## Architecture

### Current Stack
- **Astro 5.x** with `output: 'static'` — generates ~22k static HTML pages at build time
- **Vercel adapter** (`@astrojs/vercel`) — API routes opt into serverless via `export const prerender = false`
- **Existing API routes**: `POST /api/generate` (AI streaming), `GET/POST /api/auth/*` (GitHub OAuth via `jose` JWTs)
- **Data layer**: 105+ framework configs, 100+ JSON data files, lazy-loaded with caching in `src/data/controls.ts`
- **Client-side storage**: IndexedDB via Dexie.js (favorites, notes, API keys display, navigation scope)
- **No server-side database** (this spec adds one)

### New Infrastructure

| Service | Purpose | Package | Cost (500 users) |
|---|---|---|---|
| **Neon Postgres** | API key metadata, usage logs | `@neondatabase/serverless` | $0 (free tier) |
| **Upstash Redis** | Rate limiting counters, key validation cache | `@upstash/redis` + `@upstash/ratelimit` | ~$3.50/mo |

Both are Vercel Marketplace integrations: `vercel integration add neon` and `vercel integration add upstash`.

### API Route Model
All new endpoints are Astro serverless functions at `src/pages/api/v1/*.ts`, deployed as Vercel Functions. Each file exports `export const prerender = false` and an `APIRoute` handler — matching the existing `generate.ts` pattern.

---

## Goals

1. Make myctrl.tools programmatically accessible for AI agents and developer integrations
2. Prevent anonymous scraping from driving up serverless costs
3. Keep public marketing/discovery pages open
4. Expose stable, versioned, machine-readable endpoints for: control lookup, framework lookup, crosswalk/mapping lookup, technology guidance lookup, bounded search
5. Support future MCP server integration

## Non-Goals (v1)

- Do not rebuild the existing frontend UI
- Do not make the entire corpus available without auth
- Do not add LLM inference to the API
- Do not add write operations
- Do not build a billing portal, OAuth provider, or admin CMS
- Do not implement a changes feed (no change tracking infrastructure exists)
- Do not implement bulk exports with signed URLs

---

## Publicly Accessible Surface

These remain public (no auth required):

- `/` — homepage
- Framework/category browse pages (`/frameworks/*`, `/us-federal`, `/ai`, etc.)
- Guidance landing pages (`/guidance/*`)
- `robots.txt`, `sitemap-index.xml`
- **`llms.txt`** (new — discovery file for AI agents)
- **`/developers/api`** (new — API documentation page)
- **`/openapi.json`** (new — machine-readable API schema)

---

## Authenticated Surface

All require a valid API key via `Authorization: Bearer <key>` or `x-api-key: <key>`:

| Endpoint | Method | Description |
|---|---|---|
| `/api/v1/frameworks` | GET | List frameworks with pagination |
| `/api/v1/frameworks/:slug` | GET | Framework detail with metadata |
| `/api/v1/controls/:frameworkSlug/:controlId` | GET | Control lookup with framework-specific fields |
| `/api/v1/crosswalks` | GET | Cross-framework mapping lookup |
| `/api/v1/guidance/:technologySlug` | GET | Technology guidance with commands and sources |
| `/api/v1/search` | GET | Bounded search across controls, frameworks, guides |

---

## API Key System

### Key Format
Keys use a recognizable prefix for leaked credential detection:
```
mct_live_<32 random hex chars>
```
Example: `mct_live_a1b2c3d4e5f6789012345678abcdef01`

### Key Lifecycle
1. User authenticates via **existing GitHub OAuth** flow
2. User visits `/developers` dashboard
3. User clicks "Generate API Key" → server generates key, stores hash in Neon
4. Key displayed **once** — user copies it. Only the prefix (`mct_live_a1b2...`) is shown afterward.
5. User can revoke keys from the dashboard

### Postgres Schema

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  key_prefix VARCHAR(20) NOT NULL,          -- First 20 chars for display
  key_hash VARCHAR(64) NOT NULL UNIQUE,     -- SHA-256 of full key
  owner_github_id TEXT NOT NULL,            -- From existing GitHub OAuth
  owner_github_login TEXT NOT NULL,
  name VARCHAR(100) NOT NULL,               -- User-chosen label
  plan VARCHAR(20) DEFAULT 'free',          -- 'free', 'pro', 'internal'
  status VARCHAR(20) DEFAULT 'active',      -- 'active', 'revoked', 'suspended'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ,
  CONSTRAINT valid_status CHECK (status IN ('active', 'revoked', 'suspended')),
  CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'internal'))
);

CREATE INDEX idx_api_keys_hash ON api_keys (key_hash);
CREATE INDEX idx_api_keys_owner ON api_keys (owner_github_id);
```

### Key Validation Flow
1. Extract key from `Authorization: Bearer <key>` or `x-api-key: <key>` header
2. Compute SHA-256 hash
3. Check Upstash Redis cache first (`api_key:<hash>` → metadata)
4. On cache miss: query Neon Postgres, populate cache (TTL: 5 minutes)
5. Reject if missing (401), revoked/suspended (403), or rate limited (429)
6. Update `last_used_at` asynchronously (don't block the response)

### Security Requirements
- Keys hashed with SHA-256 at rest (no plaintext storage)
- Constant-time hash comparison via `crypto.timingSafeEqual`
- Key prefix `mct_live_` enables GitHub secret scanning detection
- Keys never exposed in client-side JS
- Log usage per key (but don't log the key itself)
- Support key rotation: user can create a new key before revoking the old one

---

## Rate Limiting

### Implementation
Use `@upstash/ratelimit` with **sliding window** algorithm.

### Default Limits

| Plan | Requests/minute | Requests/month |
|---|---|---|
| free | 60 | 5,000 |
| pro | 300 | 100,000 |
| internal | configurable | configurable |

### Response on Limit Exceeded
```http
HTTP/1.1 429 Too Many Requests
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1710700000
Content-Type: application/json

{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Rate limit exceeded. Retry after 2026-03-17T12:00:00Z."
  }
}
```

### Rate Limit Headers (on all responses)
```
X-RateLimit-Limit: 60
X-RateLimit-Remaining: 42
X-RateLimit-Reset: 1710700000
```

---

## Endpoint Specifications

### 4.1 Framework List

```http
GET /api/v1/frameworks?category=us-federal&limit=50&cursor=abc123
```

**Query params:**
- `category` — optional filter by tag (e.g., `us-federal`, `ai`, `privacy`, `enterprise`, `international`)
- `limit` — optional, default 50, max 200
- `cursor` — optional cursor for pagination

**Data source:** `FRAMEWORK_CONFIGS` from `src/data/frameworks.ts` + `getAllFrameworkIds()` from `src/data/controls.ts`

**Response:**
```json
{
  "data": [
    {
      "id": "framework:nist-800-53-r5",
      "slug": "nist-800-53-r5",
      "name": "NIST SP 800-53 Rev. 5",
      "version": "Rev. 5",
      "description": "Security and privacy controls for information systems and organizations.",
      "category": "us-federal",
      "tags": ["Federal", "NIST"],
      "content_type": "framework",
      "item_label": "controls",
      "control_count": 1062,
      "has_baselines": true,
      "license": "public-domain",
      "canonical_url": "https://myctrl.tools/frameworks/nist-800-53-r5",
      "official_url": "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final"
    }
  ],
  "page_info": {
    "next_cursor": "eyJvZmZzZXQiOjUwfQ==",
    "has_more": true,
    "total": 105
  }
}
```

### 4.2 Framework Detail

```http
GET /api/v1/frameworks/:slug
```

**Data source:** `getFrameworkConfig(slug)` from `src/data/controls.ts`

**Response:** Same as list item, plus:
```json
{
  "id": "framework:nist-800-53-r5",
  "slug": "nist-800-53-r5",
  "name": "NIST SP 800-53 Rev. 5",
  "version": "Rev. 5",
  "description": "Security and privacy controls for information systems and organizations.",
  "category": "us-federal",
  "tags": ["Federal", "NIST"],
  "content_type": "framework",
  "item_label": "controls",
  "family_label": "Family",
  "control_count": 1062,
  "has_baselines": true,
  "has_severity_levels": false,
  "has_implementation_groups": false,
  "has_risk_tiers": false,
  "license": "public-domain",
  "official_url": "https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final",
  "canonical_url": "https://myctrl.tools/frameworks/nist-800-53-r5",
  "families": {
    "AC": "Access Control",
    "AU": "Audit and Accountability"
  },
  "data_source": null,
  "data_version": "2026.03.17"
}
```

Note: `families` is populated from the framework's JSON `families` field. `data_source` is populated for SCF-derived frameworks.

### 4.3 Control Lookup

```http
GET /api/v1/controls/:frameworkSlug/:controlId
```

**Path examples:**
```
/api/v1/controls/nist-800-53-r5/AC-2
/api/v1/controls/nist-800-53-r5/ac-2        (case-insensitive)
/api/v1/controls/nist-800-53-r5/ac-2-1      (slugified form of AC-2(1))
```

**Data source:** `getControlBySlug(frameworkId, slugify(controlId))` or `getControlById(frameworkId, controlId)` from `src/data/controls.ts`

**Requirements:**
- Support both exact control ID (`AC-2`) and slugified form (`ac-2`)
- Case-insensitive matching
- Include framework-specific fields based on control type
- Include crosswalk mappings if available (via `getCrossFrameworkMappings()` from `src/data/crosswalk.ts`)

**Response (NIST example — includes baseline fields):**
```json
{
  "id": "control:nist-800-53-r5:AC-2",
  "framework": {
    "slug": "nist-800-53-r5",
    "name": "NIST SP 800-53 Rev. 5"
  },
  "control_id": "AC-2",
  "title": "Account Management",
  "family": "Access Control",
  "description": "Full control description text...",
  "related_controls": ["AC-3", "AC-5", "AC-6"],
  "canonical_url": "https://myctrl.tools/frameworks/nist-800-53-r5/ac-2",

  "framework_specific": {
    "baseline_low": true,
    "baseline_moderate": true,
    "baseline_high": true,
    "baseline_privacy": false,
    "supplemental_guidance": "Additional guidance text..."
  },

  "crosswalk_mappings": [
    {
      "target_framework": "fedramp-rev5",
      "target_control_id": "AC-2",
      "relationship": "equivalent"
    },
    {
      "target_framework": "nist-csf-v2",
      "target_control_id": "PR.AA-01",
      "relationship": "related"
    }
  ],

  "source": {
    "publisher": "NIST",
    "document": "NIST SP 800-53 Rev. 5",
    "license": "public-domain"
  },
  "data_version": "2026.03.17"
}
```

**Response (PCI example — includes testing_procedures, guidance):**
```json
{
  "id": "control:pci-dss-v4:1.2.1",
  "framework": { "slug": "pci-dss-v4", "name": "PCI DSS v4.0.1" },
  "control_id": "1.2.1",
  "title": "...",
  "family": "...",
  "description": "...",
  "canonical_url": "https://myctrl.tools/frameworks/pci-dss-v4/1-2-1",

  "framework_specific": {
    "section": "1.2",
    "section_title": "Network security controls are configured and maintained",
    "customized_approach_objective": "...",
    "testing_procedures": [
      { "id": "1.2.1.a", "text": "Examine configuration standards..." }
    ],
    "guidance": {
      "purpose": "...",
      "good_practice": "...",
      "definitions": "...",
      "examples": "...",
      "further_information": "..."
    }
  },

  "crosswalk_mappings": [],
  "source": { "publisher": "PCI SSC", "license": "proprietary" },
  "data_version": "2026.03.17"
}
```

The `framework_specific` object varies by framework type. The frontend already handles this via type guards (`isNistControl()`, `isPciControl()`, `isSTIGControl()`, etc. in `src/data/types.ts`). The API serializes whatever extra fields the control type has.

### 4.4 Crosswalk Lookup

```http
GET /api/v1/crosswalks?from=nist-csf-v2&to=nist-800-53-r5&control=PR.AA-01
```

**Query params:**
- `from` — source framework slug (required)
- `to` — target framework slug (optional — if omitted, returns all mappings for the control)
- `control` — source control ID (optional — if omitted, returns all mappings between the two frameworks)

**Data source:** `getCrossFrameworkMappings(controlId, frameworkId)` and related functions from `src/data/crosswalk.ts`

**Response:**
```json
{
  "query": {
    "from": "nist-csf-v2",
    "to": "nist-800-53-r5",
    "control": "PR.AA-01"
  },
  "mappings": [
    {
      "from": { "framework_slug": "nist-csf-v2", "control_id": "PR.AA-01" },
      "to": { "framework_slug": "nist-800-53-r5", "control_id": "AC-2" },
      "relationship": "related"
    },
    {
      "from": { "framework_slug": "nist-csf-v2", "control_id": "PR.AA-01" },
      "to": { "framework_slug": "nist-800-53-r5", "control_id": "AC-3" },
      "relationship": "related"
    }
  ],
  "available_crosswalks": [
    { "from": "nist-csf-v2", "to": "nist-800-53-r5" },
    { "from": "nist-csf-v2", "to": "pci-dss-v4" },
    { "from": "nist-csf-v2", "to": "iso-27001-2022" }
  ],
  "data_version": "2026.03.17"
}
```

### 4.5 Technology Guidance Lookup

```http
GET /api/v1/guidance/:technologySlug
```

**Data source:** `TECHNOLOGY_GUIDES` array from `src/data/technology-guides.ts`, matched by `TechnologyGuide.id`

**Response (preserves full TechnologyGuide structure):**
```json
{
  "id": "guidance:okta",
  "technology_slug": "okta",
  "name": "Okta",
  "category": "identity",
  "vendor": "Okta, Inc.",
  "description": "Enterprise identity and access management platform",
  "official_url": "https://developer.okta.com/docs/",

  "authoritative_sources": [
    {
      "type": "nist",
      "title": "NIST SP 800-63B: Digital Identity Guidelines - Authentication",
      "url": "https://pages.nist.gov/800-63-3/sp800-63b.html",
      "summary": "NIST SP 800-63B §4.2: AAL2 provides high confidence...",
      "config_examples": [
        {
          "title": "Sign-On Policy - AAL2 MFA Requirement",
          "language": "json",
          "code": "{ ... }",
          "source": "NIST SP 800-63B §4.2 - AAL2 Requirements"
        }
      ]
    }
  ],

  "commands": [
    {
      "description": "List all users with MFA disabled",
      "command": "okta-inspector users --no-mfa",
      "type": "cli",
      "group": "User Audit"
    }
  ],

  "control_mappings": [
    { "framework_id": "nist-800-53-r5", "control_ids": ["AC-2", "IA-2", "IA-5"] }
  ],

  "responsibilities": [
    {
      "title": "MFA Configuration",
      "description": "Customer is responsible for...",
      "items": [
        { "title": "Enable MFA for all users", "controls": ["IA-2"] }
      ]
    }
  ],

  "related_technologies": ["azure-ad", "ping-identity"],
  "github_repos": ["ethanolivertroy/okta-inspector"],
  "canonical_url": "https://myctrl.tools/guidance/okta",
  "data_version": "2026.03.17"
}
```

### 4.6 Search

```http
GET /api/v1/search?q=AC-2&type=control&limit=10
```

**Query params:**
- `q` — required, max 200 chars
- `type` — optional: `control`, `framework`, `guidance`, `all` (default: `all`)
- `limit` — optional, default 10, max 50
- `cursor` — optional

**Implementation (v1):** Simple prefix/substring matching against a pre-built lookup table (not full Fuse.js — too memory-heavy for serverless). Exact ID matches rank highest.

**Response:**
```json
{
  "query": "AC-2",
  "type_filter": "all",
  "results": [
    {
      "type": "control",
      "id": "control:nist-800-53-r5:AC-2",
      "title": "Account Management",
      "framework_slug": "nist-800-53-r5",
      "control_id": "AC-2",
      "family": "Access Control",
      "canonical_url": "https://myctrl.tools/frameworks/nist-800-53-r5/ac-2",
      "score": 1.0,
      "match_reason": "exact_control_id"
    },
    {
      "type": "control",
      "id": "control:fedramp-rev5:AC-2",
      "title": "Account Management",
      "framework_slug": "fedramp-rev5",
      "control_id": "AC-2",
      "canonical_url": "https://myctrl.tools/frameworks/fedramp-rev5/ac-2",
      "score": 1.0,
      "match_reason": "exact_control_id"
    }
  ],
  "page_info": {
    "next_cursor": null,
    "has_more": false,
    "total": 2
  }
}
```

---

## Discovery Files

### `llms.txt`

New file at `public/llms.txt`:

```
# myctrl.tools
> Compliance controls, cross-framework mappings, and implementation guidance for security engineers and GRC professionals.

## About
myctrl.tools is a fast, searchable resource covering 105+ security and compliance frameworks including NIST 800-53, FedRAMP, PCI DSS, ISO 27001, SOC 2, CIS Controls, CMMC, EU AI Act, GDPR, and more. It provides cross-framework mappings, technology-specific implementation guidance with verification commands, and interactive comparison tools.

## Public Pages
- https://myctrl.tools/ — Homepage
- https://myctrl.tools/frameworks/nist-800-53-r5 — Example framework (NIST 800-53)
- https://myctrl.tools/guidance — Technology guidance index
- https://myctrl.tools/compare — Side-by-side framework comparison
- https://myctrl.tools/crosswalk — Cross-framework mapping browser
- https://myctrl.tools/graph — Interactive framework relationship graph

## API Documentation
- https://myctrl.tools/developers/api — API reference
- https://myctrl.tools/openapi.json — OpenAPI 3.1 schema

## Authenticated API (requires API key)
- GET /api/v1/frameworks — List all frameworks
- GET /api/v1/frameworks/{slug} — Framework detail
- GET /api/v1/controls/{frameworkSlug}/{controlId} — Control lookup
- GET /api/v1/crosswalks?from={slug}&to={slug}&control={id} — Crosswalk mappings
- GET /api/v1/guidance/{technologySlug} — Technology guidance
- GET /api/v1/search?q={query} — Search controls, frameworks, and guides

## Authentication
API access requires an API key. Sign in with GitHub at https://myctrl.tools/developers to generate a key. Pass via `Authorization: Bearer <key>` or `x-api-key: <key>`.

## Data Sources
Framework data is sourced from official publications (NIST, PCI SSC, ISO, CIS, etc.) and the Secure Controls Framework (SCF). See individual framework pages for specific source attribution and licensing.
```

### `openapi.json`

Generate a static OpenAPI 3.1 spec at build time. This file describes all authenticated endpoints, request parameters, security schemes (`apiKey` in header), and response schemas. Served as a static file from `public/openapi.json`.

---

## Error Handling

All errors return JSON with consistent structure:

```json
{
  "error": {
    "code": "not_found",
    "message": "Control 'XY-99' not found in framework 'nist-800-53-r5'."
  }
}
```

### Standard Error Codes

| HTTP | Code | When |
|---|---|---|
| 400 | `bad_request` | Invalid params, malformed slug, query too long |
| 401 | `unauthorized` | Missing or invalid API key |
| 403 | `forbidden` | Revoked or suspended key |
| 404 | `not_found` | Framework, control, or guide not found |
| 429 | `rate_limit_exceeded` | Per-key rate limit hit |
| 500 | `internal_error` | Unexpected server error |

---

## Performance

- API responses served from **statically imported JSON** — each framework file loaded lazily per request (10-500KB each)
- P95 latency targets: exact lookups < 300ms, search < 500ms
- CDN-friendly: all GET endpoints return `Cache-Control: public, max-age=300, s-maxage=3600` for common lookups
- No SSR/frontend dependency — API functions are independent serverless endpoints
- Vercel Functions: Node.js runtime, default 10s max duration (sufficient for JSON lookups)

---

## Auth Middleware Pattern

Shared middleware function used by all `/api/v1/*` endpoints:

```
src/lib/api-auth.ts
├── validateApiKey(request) → { key, owner, plan } | error response
├── checkRateLimit(keyId, plan) → { allowed, headers } | 429 response
└── withApiAuth(handler) → wrapped APIRoute with auth + rate limiting
```

This follows the existing pattern where `src/lib/server-auth.ts` handles GitHub OAuth session validation.

---

## Implementation Phases

### Phase 1: Foundation (MVP)
**Goal:** Working API with auth and core endpoints

1. `vercel integration add neon` + `vercel integration add upstash` — provision services
2. Create `src/lib/api-auth.ts` — key validation + rate limiting middleware
3. Create Postgres schema (api_keys table)
4. Create `public/llms.txt`
5. Endpoints:
   - `GET /api/v1/frameworks` (list)
   - `GET /api/v1/frameworks/:slug` (detail)
   - `GET /api/v1/controls/:frameworkSlug/:controlId` (lookup)
   - `GET /api/v1/search` (simple matching)
6. Error handling middleware
7. Developer dashboard page (`/developers`) with key management (create, view prefix, revoke)
8. Developer API docs page (`/developers/api`)

**Files to create/modify:**
- `src/lib/api-auth.ts` (new)
- `src/lib/api-db.ts` (new — Neon connection + queries)
- `src/pages/api/v1/frameworks/index.ts` (new)
- `src/pages/api/v1/frameworks/[slug].ts` (new)
- `src/pages/api/v1/controls/[...path].ts` (new — catch-all for `/:framework/:control`)
- `src/pages/api/v1/search.ts` (new)
- `src/pages/api/v1/keys.ts` (new — key CRUD, behind GitHub auth)
- `src/pages/developers/index.astro` (new — dashboard)
- `src/pages/developers/api.astro` (new — docs)
- `public/llms.txt` (new)
- `package.json` (add `@neondatabase/serverless`, `@upstash/redis`, `@upstash/ratelimit`)

### Phase 2: Extended Endpoints
- `GET /api/v1/crosswalks`
- `GET /api/v1/guidance/:technologySlug`
- `public/openapi.json` (generated at build time)
- JSON-LD metadata in canonical HTML pages
- Usage tracking per key (write to Neon async)
- Key rotation support (multiple active keys per user)

### Phase 3: Platform Features
- MCP server wrapping the API
- Usage dashboard for key owners
- Full-text search (Algolia/Typesense)
- Changes feed (requires adding timestamps to data)
- Bulk exports (plan-gated)
- Billing integration

---

## Corrections from Original Spec

| Original Spec | Correction |
|---|---|
| No mention of Astro/framework | This is Astro 5.x with Vercel adapter, not Next.js |
| No existing API mentioned | 6 API routes exist: `POST /api/generate` + 5 auth endpoints |
| `canonical_url` uses `/controls/` path | Site uses `/frameworks/{slug}/{control}` — no `/controls/` route |
| Flat `verification_commands: string[]` | Actual type is `TechCommand[]` with `description`, `type`, `group` |
| Flat `authoritative_sources` | Actual type is `AuthoritativeSource` with `type`, `summary`, `configExamples` |
| Generic control response body | Controls have framework-specific fields (baselines, testing procedures, severity, risk tiers) via discriminated union types |
| Changes feed endpoint | No change tracking exists — deferred to v2 |
| Exports with signed URLs | Data is static JSON — deferred to v2 |
| Search via full-text engine | Fuse.js index too heavy for serverless — v1 uses simple matching |
| No storage solution specified | Neon Postgres (keys) + Upstash Redis (rate limiting + cache) |
| No key provisioning flow | Use existing GitHub OAuth → developer dashboard |
