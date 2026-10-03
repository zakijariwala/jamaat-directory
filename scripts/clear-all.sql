-- Empties every data table in D1 (schema and migrations are kept).
-- Run via:  npm run db:clear   (asks for confirmation first)
DELETE FROM flags;
DELETE FROM feedback;
DELETE FROM facilities;
DELETE FROM contacts;
DELETE FROM cities;
