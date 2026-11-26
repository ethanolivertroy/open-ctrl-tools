-- Public access requests are deduplicated per requester email and document
-- while a request is still pending. This index backs that lookup.
CREATE INDEX IF NOT EXISTS idx_access_requests_email_document_status
  ON access_requests (email, document_id, status);
