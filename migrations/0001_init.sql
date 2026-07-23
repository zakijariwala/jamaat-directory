-- Jamaat Directory — initial schema (Cloudflare D1 / SQLite).
-- Source of truth for the site. The public snapshot (directory.json) is
-- derived from this and NEVER contains phone numbers.

CREATE TABLE cities (
  id            TEXT PRIMARY KEY,        -- slug: 'sangli'
  name          TEXT NOT NULL,
  jamaat_name   TEXT NOT NULL,
  state         TEXT,
  aliases       TEXT,                    -- JSON array: ["pune","poona"]
  region        TEXT,                    -- north | south | east | west | central
  nearest_rail  TEXT,
  nearest_air   TEXT,
  notes         TEXT,
  updated_at    TEXT NOT NULL
);

CREATE TABLE contacts (
  id            TEXT PRIMARY KEY,
  city_id       TEXT NOT NULL REFERENCES cities(id),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,           -- E.164, NEVER enters the public snapshot
  whatsapp      INTEGER DEFAULT 1,       -- 0/1
  role          TEXT,
  helps_with    TEXT,
  best_time     TEXT,
  languages     TEXT,
  self_added    INTEGER DEFAULT 0,       -- 1 = added themselves
  consent       INTEGER DEFAULT 0,       -- required 1 when self_added = 0
  status        TEXT DEFAULT 'pending',  -- pending | live | flagged | removed
  verified_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE facilities (
  id            TEXT PRIMARY KEY,
  city_id       TEXT NOT NULL REFERENCES cities(id),
  kind          TEXT NOT NULL,           -- masjid | musafir_khana | hotel | restaurant
  name          TEXT NOT NULL,
  address       TEXT,
  maps_url      TEXT,
  phone         TEXT,                    -- also excluded from snapshot
  timings       TEXT,
  charges_band  TEXT,                    -- free | donation | paid
  booking_note  TEXT,
  facilities    TEXT,                    -- JSON array of chips
  status        TEXT DEFAULT 'pending',
  verified_at   TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE flags (
  id            TEXT PRIMARY KEY,
  target_type   TEXT NOT NULL,           -- contact | facility
  target_id     TEXT NOT NULL,
  reason        TEXT,
  kind          TEXT NOT NULL,           -- problem | removal_request
  resolved      INTEGER DEFAULT 0,
  created_at    TEXT NOT NULL
);

CREATE INDEX idx_contacts_city ON contacts(city_id, status);
CREATE INDEX idx_facilities_city ON facilities(city_id, status);
