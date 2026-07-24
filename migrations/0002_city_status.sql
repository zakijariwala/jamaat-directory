-- In-site intake: cities become approvable as a unit. New submissions land as
-- 'pending'; existing/seed cities are already published.

ALTER TABLE cities ADD COLUMN status TEXT DEFAULT 'pending';
UPDATE cities SET status = 'live' WHERE status IS NULL;
