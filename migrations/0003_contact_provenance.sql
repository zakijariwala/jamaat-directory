-- Moderation-trust context for a contact: how the submitter knows the person
-- and whether the person knows they're being submitted. One combined, private
-- text column (never published — not referenced by buildSnapshot's allowlist).

ALTER TABLE contacts ADD COLUMN provenance TEXT;
