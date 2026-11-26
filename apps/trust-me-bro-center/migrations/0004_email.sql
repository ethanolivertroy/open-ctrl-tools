CREATE TABLE email_outbox (
  id TEXT PRIMARY KEY,
  to_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  template TEXT NOT NULL,
  headers_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  claimed_at TEXT,
  created_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE INDEX idx_email_outbox_status_date ON email_outbox (status, created_at);

CREATE TABLE subscribers_next (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'unsubscribed')),
  created_at TEXT NOT NULL,
  confirmed_at TEXT,
  confirm_token_hash TEXT,
  confirm_expires_at TEXT,
  unsubscribe_token TEXT
);

INSERT INTO subscribers_next (id, email, status, created_at)
SELECT id, email, status, created_at FROM subscribers;

DROP TABLE subscribers;
ALTER TABLE subscribers_next RENAME TO subscribers;

CREATE UNIQUE INDEX idx_subscribers_confirm_token ON subscribers (confirm_token_hash) WHERE confirm_token_hash IS NOT NULL;
CREATE UNIQUE INDEX idx_subscribers_unsubscribe_token ON subscribers (unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS audit_subscriber_insert
AFTER INSERT ON subscribers
BEGIN
  INSERT INTO audit_log (id, actor, action, detail_json, created_at)
  VALUES (lower(hex(randomblob(16))), 'public', 'subscriber.created', '{}', NEW.created_at);
END;
