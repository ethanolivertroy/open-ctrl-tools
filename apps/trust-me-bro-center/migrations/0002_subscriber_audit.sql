CREATE TRIGGER IF NOT EXISTS audit_subscriber_insert
AFTER INSERT ON subscribers
BEGIN
  INSERT INTO audit_log (id, actor, action, detail_json, created_at)
  VALUES (lower(hex(randomblob(16))), 'public', 'subscriber.created', '{}', NEW.created_at);
END;
