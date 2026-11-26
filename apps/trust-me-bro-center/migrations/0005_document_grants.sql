CREATE TABLE document_grants (
  id TEXT PRIMARY KEY,
  access_request_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  email TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  download_count INTEGER NOT NULL DEFAULT 0,
  last_download_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_document_grants_request ON document_grants (access_request_id, created_at DESC);
CREATE INDEX idx_document_grants_created ON document_grants (created_at DESC);
