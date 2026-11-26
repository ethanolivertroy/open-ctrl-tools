PRAGMA foreign_keys = ON;

CREATE TABLE site_config (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  company_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  summary TEXT NOT NULL,
  security_email TEXT NOT NULL,
  location TEXT NOT NULL,
  video_url TEXT NOT NULL DEFAULT '',
  accent TEXT NOT NULL DEFAULT '#1f6b52',
  updated_at TEXT NOT NULL
);

CREATE TABLE certifications (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL,
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'request')),
  source_type TEXT NOT NULL CHECK (source_type IN ('external', 'r2')),
  url TEXT,
  object_key TEXT,
  version TEXT NOT NULL DEFAULT '1.0',
  published_at TEXT,
  review_at TEXT,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  CHECK ((source_type = 'external' AND object_key IS NULL) OR (source_type = 'r2' AND object_key IS NOT NULL))
);

CREATE TABLE faqs (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subprocessors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  location TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE updates (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  published_at TEXT NOT NULL,
  visible INTEGER NOT NULL DEFAULT 1 CHECK (visible IN (0, 1))
);

CREATE TABLE subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed')),
  created_at TEXT NOT NULL
);

CREATE TABLE access_requests (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  created_at TEXT NOT NULL,
  reviewed_at TEXT
);

CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX idx_certifications_visible_order ON certifications (visible, sort_order);
CREATE INDEX idx_documents_visible ON documents (visible, category);
CREATE INDEX idx_faqs_visible_order ON faqs (visible, sort_order);
CREATE INDEX idx_subprocessors_visible_order ON subprocessors (visible, sort_order);
CREATE INDEX idx_updates_visible_date ON updates (visible, published_at DESC);
CREATE INDEX idx_access_requests_status_date ON access_requests (status, created_at DESC);
CREATE INDEX idx_audit_log_date ON audit_log (created_at DESC);

INSERT INTO site_config (id, company_name, headline, summary, security_email, location, video_url, accent, updated_at)
VALUES (
  1,
  'Northstar Labs',
  'Security should be easy to inspect.',
  'Review our security program, data practices, subprocessors, and current assurance materials in one place.',
  'security@northstar.example',
  'United States',
  '',
  '#1f6b52',
  '2026-08-30T00:00:00.000Z'
);

INSERT INTO certifications (id, name, status, description, visible, sort_order) VALUES
  ('soc2-type-ii', 'SOC 2 Type II', 'Current', 'Independent examination covering security and availability controls.', 1, 1),
  ('iso-27001', 'ISO 27001', 'Aligned', 'Security program mapped to ISO 27001 control domains.', 1, 2),
  ('gdpr', 'GDPR', 'Supported', 'Contractual and operational measures for applicable privacy obligations.', 1, 3);

INSERT INTO documents (id, title, description, category, visibility, source_type, url, object_key, version, published_at, review_at, visible) VALUES
  ('security-overview', 'Security overview', 'A concise summary of program ownership, access control, encryption, resilience, and incident response.', 'Security', 'public', 'external', '/demo/security-overview.txt', NULL, '1.0', '2026-08-30', '2027-08-30', 1),
  ('soc2-report', 'SOC 2 Type II report', 'Available to qualified customers and prospects after review.', 'Audit', 'request', 'external', NULL, NULL, '2026', '2026-08-30', '2027-08-30', 1),
  ('penetration-test', 'Penetration test summary', 'Executive findings summary from the latest independent assessment.', 'Testing', 'request', 'external', NULL, NULL, '2026', '2026-07-15', '2027-07-15', 1);

INSERT INTO faqs (id, question, answer, visible, sort_order) VALUES
  ('hosting', 'Where is customer data hosted?', 'Production customer data is hosted on Cloudflare in the United States. Regional commitments are documented in the applicable agreement.', 1, 1),
  ('encryption', 'Is customer data encrypted?', 'Yes. Data is encrypted in transit using modern TLS and encrypted at rest using Cloudflare-managed encryption controls.', 1, 2),
  ('ai-training', 'Is customer data used to train shared AI models?', 'No. Customer data is not used to train models shared across customers.', 1, 3),
  ('incident', 'How do I report a security issue?', 'Email the security contact listed on this page. Include a concise description and reproduction details when possible.', 1, 4);

INSERT INTO subprocessors (id, name, purpose, location, url, visible, sort_order) VALUES
  ('cloudflare', 'Cloudflare', 'Edge delivery, application security, trust-center hosting, data storage, and transactional email.', 'Global', 'https://www.cloudflare.com/', 1, 1);

INSERT INTO updates (id, title, body, published_at, visible) VALUES
  ('annual-review', 'Annual assurance materials refreshed', 'The current security overview and independent assessment dates have been updated for the annual review cycle.', '2026-08-30T00:00:00.000Z', 1),
  ('subprocessor-review', 'Subprocessor register reviewed', 'The public subprocessor register was reviewed and confirmed current.', '2026-07-12T00:00:00.000Z', 1);
