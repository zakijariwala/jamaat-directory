-- General feedback from the About page. Private; read by moderators only.

CREATE TABLE feedback (
  id         TEXT PRIMARY KEY,
  name       TEXT,
  contact    TEXT,
  message    TEXT NOT NULL,
  created_at TEXT NOT NULL
);
