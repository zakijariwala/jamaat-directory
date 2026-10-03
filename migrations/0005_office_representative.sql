-- Jamaat office number + official representative, and a private source note
-- for bulk-imported listings.
--
--   cities.office_phone        the jamaat's own office number. NEVER published;
--                              served one-at-a-time by /api/reveal?type=office.
--   contacts.is_representative 1 = this contact is the jamaat's official
--                              representative (shown first, with a badge).
--   facilities.source          where a bulk-imported listing came from (e.g. the
--                              supplied list's file name). Private moderation
--                              note; NEVER published.
--
-- No NOT NULL on the flag: generated seed/ingest SQL writes NULL for absent
-- values, and the code treats anything other than 1 as "no".

ALTER TABLE cities ADD COLUMN office_phone TEXT;
ALTER TABLE contacts ADD COLUMN is_representative INTEGER DEFAULT 0;
ALTER TABLE facilities ADD COLUMN source TEXT;
