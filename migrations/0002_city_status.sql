-- In-site intake: cities become approvable as a unit. New submissions land as
-- 'pending'; existing/seed cities are already published.

-- NOTE: SQLite ADD COLUMN ... DEFAULT sets existing rows to the default, so a
-- `WHERE status IS NULL` backfill never matches. Promote every pre-existing
-- city instead — at migration time all existing cities were already published;
-- new submissions insert their own status='pending' afterwards.
ALTER TABLE cities ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
UPDATE cities SET status = 'live';
