DROP INDEX idx_certifications_visible_order;
DROP INDEX idx_documents_visible;
DROP INDEX idx_faqs_visible_order;
DROP INDEX idx_subprocessors_visible_order;
DROP INDEX idx_updates_visible_date;

ALTER TABLE certifications ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'review', 'published', 'archived'));
UPDATE certifications SET lifecycle = CASE WHEN visible = 1 THEN 'published' ELSE 'draft' END;
ALTER TABLE certifications DROP COLUMN visible;

ALTER TABLE documents ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'review', 'published', 'archived'));
UPDATE documents SET lifecycle = CASE WHEN visible = 1 THEN 'published' ELSE 'draft' END;
ALTER TABLE documents DROP COLUMN visible;

ALTER TABLE faqs ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'review', 'published', 'archived'));
UPDATE faqs SET lifecycle = CASE WHEN visible = 1 THEN 'published' ELSE 'draft' END;
ALTER TABLE faqs DROP COLUMN visible;

ALTER TABLE subprocessors ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'review', 'published', 'archived'));
UPDATE subprocessors SET lifecycle = CASE WHEN visible = 1 THEN 'published' ELSE 'draft' END;
ALTER TABLE subprocessors DROP COLUMN visible;

ALTER TABLE updates ADD COLUMN lifecycle TEXT NOT NULL DEFAULT 'draft' CHECK (lifecycle IN ('draft', 'review', 'published', 'archived'));
UPDATE updates SET lifecycle = CASE WHEN visible = 1 THEN 'published' ELSE 'draft' END;
ALTER TABLE updates DROP COLUMN visible;

ALTER TABLE updates ADD COLUMN notified_at TEXT;

CREATE INDEX idx_certifications_lifecycle_order ON certifications (lifecycle, sort_order);
CREATE INDEX idx_documents_lifecycle ON documents (lifecycle, category);
CREATE INDEX idx_faqs_lifecycle_order ON faqs (lifecycle, sort_order);
CREATE INDEX idx_subprocessors_lifecycle_order ON subprocessors (lifecycle, sort_order);
CREATE INDEX idx_updates_lifecycle_date ON updates (lifecycle, published_at DESC);
