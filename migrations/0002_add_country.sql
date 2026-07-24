-- Go international: cities gain a country. Existing rows are all Indian.
-- The legacy `region` column (Indian 5-region bucket) is left in place, unused.

ALTER TABLE cities ADD COLUMN country TEXT;
UPDATE cities SET country = 'India' WHERE country IS NULL;
