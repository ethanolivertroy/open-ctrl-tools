-- Trust center profile: title, privacy policy, private mode, banner, theme, favicon, controls.
ALTER TABLE site_config ADD COLUMN title TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN privacy_policy_url TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1));
ALTER TABLE site_config ADD COLUMN banner_setting TEXT NOT NULL DEFAULT 'MINIMAL' CHECK (banner_setting IN ('GRADIENT', 'MINIMAL', 'CUSTOM_IMAGE'));
ALTER TABLE site_config ADD COLUMN banner_start_color TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN banner_end_color TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN banner_object_key TEXT;
ALTER TABLE site_config ADD COLUMN secondary_color TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN favicon_object_key TEXT;
ALTER TABLE site_config ADD COLUMN control_visibility_mode TEXT NOT NULL DEFAULT 'SHOW_ALL_WITH_STATUS' CHECK (control_visibility_mode IN ('SHOW_OK_ONLY', 'SHOW_OK_AND_UNMAPPED', 'SHOW_ALL_WITHOUT_STATUS', 'SHOW_ALL_WITH_STATUS'));
ALTER TABLE site_config ADD COLUMN data_collected_heading TEXT NOT NULL DEFAULT '';
ALTER TABLE site_config ADD COLUMN created_at TEXT NOT NULL DEFAULT '';
UPDATE site_config SET created_at = updated_at WHERE created_at = '';

-- Videos replace the single video_url column.
CREATE TABLE videos (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
INSERT INTO videos (id, url, title, description, sort_order)
SELECT lower(hex(randomblob(16))), video_url, 'Security overview', '', 0 FROM site_config WHERE id = 1 AND video_url <> '';
ALTER TABLE site_config DROP COLUMN video_url;

-- Compliance frameworks: standard and badge image.
ALTER TABLE certifications ADD COLUMN standard TEXT;
ALTER TABLE certifications ADD COLUMN badge_object_key TEXT;
UPDATE certifications SET standard = 'soc2' WHERE id = 'soc2-type-ii' AND name = 'SOC 2 Type II' AND standard IS NULL;
UPDATE certifications SET standard = 'iso27001' WHERE id = 'iso-27001' AND name = 'ISO 27001' AND standard IS NULL;
UPDATE certifications SET standard = 'gdpr' WHERE id = 'gdpr' AND name = 'GDPR' AND standard IS NULL;

-- Resource categories: ordered, resources may be uncategorized.
CREATE TABLE resource_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE documents ADD COLUMN category_id TEXT;
ALTER TABLE documents ADD COLUMN file_name TEXT;
ALTER TABLE documents ADD COLUMN mime_type TEXT;
INSERT INTO resource_categories (id, name, sort_order)
SELECT lower(hex(randomblob(16))), category, ROW_NUMBER() OVER (ORDER BY MIN(rowid))
FROM documents WHERE category <> '' GROUP BY category;
UPDATE documents SET category_id = (SELECT id FROM resource_categories WHERE resource_categories.name = documents.category) WHERE category <> '';

-- FAQ categories.
CREATE TABLE faq_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE faqs ADD COLUMN category_id TEXT;

-- Subprocessors gain a free-text description.
ALTER TABLE subprocessors ADD COLUMN description TEXT NOT NULL DEFAULT '';

-- Updates: category and visibility.
ALTER TABLE updates ADD COLUMN category TEXT NOT NULL DEFAULT 'GENERAL' CHECK (category IN ('GENERAL', 'COMPLIANCE', 'SECURITY', 'PRIVACY', 'INCIDENT', 'ROADMAP'));
ALTER TABLE updates ADD COLUMN visibility_type TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (visibility_type IN ('PUBLIC', 'PRIVATE'));

-- Controls and control categories.
CREATE TABLE control_categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'PUBLIC' CHECK (visibility IN ('PUBLIC', 'SHAREABLE')),
  status_visibility_override TEXT CHECK (status_visibility_override IS NULL OR status_visibility_override IN ('SHOW_OK_ONLY', 'SHOW_OK_AND_UNMAPPED', 'SHOW_ALL_WITHOUT_STATUS', 'SHOW_ALL_WITH_STATUS')),
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE controls (
  id TEXT PRIMARY KEY,
  external_id TEXT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'UNMAPPED' CHECK (status IN ('OK', 'NEEDS_ATTENTION', 'UNMAPPED')),
  tags_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE TABLE control_category_members (
  category_id TEXT NOT NULL REFERENCES control_categories (id) ON DELETE CASCADE,
  control_id TEXT NOT NULL REFERENCES controls (id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (category_id, control_id)
);
CREATE INDEX idx_control_members_control ON control_category_members (control_id);

-- Data collected disclosures.
CREATE TABLE data_collected (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COLLECTED', 'HIDDEN', 'NOT_COLLECTED')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Access requests: multiple requested resources, access level, denial reason.
CREATE TABLE access_requests_next (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  requested_resources_json TEXT,
  access_level TEXT NOT NULL DEFAULT 'PARTIAL_ACCESS' CHECK (access_level IN ('FULL_ACCESS', 'PARTIAL_ACCESS')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  denial_reason TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT INTO access_requests_next (id, name, email, company, reason, requested_resources_json, access_level, status, denial_reason, created_at, updated_at)
SELECT id, name, email, company, reason, json_array(document_id), 'PARTIAL_ACCESS', status, NULL, created_at, COALESCE(reviewed_at, created_at)
FROM access_requests;
DROP TABLE access_requests;
ALTER TABLE access_requests_next RENAME TO access_requests;
CREATE INDEX idx_access_requests_status_date ON access_requests (status, created_at DESC);
-- Pending requests are deduplicated per requester email; this backs that lookup.
CREATE INDEX idx_access_requests_email_status ON access_requests (email, status);

-- Viewers replace per-document grants. Live grants become partial-access viewers
-- who need a fresh access link from admin.
CREATE TABLE viewers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  company_name TEXT NOT NULL DEFAULT '',
  access_level TEXT NOT NULL DEFAULT 'PARTIAL_ACCESS' CHECK (access_level IN ('FULL_ACCESS', 'PARTIAL_ACCESS')),
  resource_ids_json TEXT,
  nda_required INTEGER NOT NULL DEFAULT 0 CHECK (nda_required IN (0, 1)),
  nda_accepted_at TEXT,
  expires_at TEXT,
  token_hash TEXT UNIQUE,
  added_by TEXT NOT NULL DEFAULT 'admin',
  access_request_id TEXT,
  invite_sent_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  removed_at TEXT
);
INSERT INTO viewers (id, email, name, company_name, access_level, resource_ids_json, nda_required, expires_at, added_by, created_at, updated_at)
SELECT
  lower(hex(randomblob(16))),
  g.email,
  COALESCE((SELECT name FROM access_requests r WHERE r.email = g.email ORDER BY r.created_at DESC LIMIT 1), ''),
  COALESCE((SELECT company FROM access_requests r WHERE r.email = g.email ORDER BY r.created_at DESC LIMIT 1), ''),
  'PARTIAL_ACCESS',
  json_group_array(DISTINCT g.document_id),
  0,
  MAX(g.expires_at),
  'migration',
  MIN(g.created_at),
  MAX(g.created_at)
FROM document_grants g
WHERE g.revoked_at IS NULL
GROUP BY g.email;
DROP TABLE document_grants;

-- Chatbot conversations grounded on published content.
CREATE TABLE chatbot_conversations (
  id TEXT PRIMARY KEY,
  first_message TEXT NOT NULL,
  num_messages INTEGER NOT NULL DEFAULT 0,
  user_email TEXT,
  is_public INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE chatbot_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES chatbot_conversations (id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('USER', 'ASSISTANT')),
  message TEXT NOT NULL,
  references_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX idx_chatbot_messages_conversation ON chatbot_messages (conversation_id, created_at);
CREATE INDEX idx_chatbot_conversations_date ON chatbot_conversations (created_at DESC);
