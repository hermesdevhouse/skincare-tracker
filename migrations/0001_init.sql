-- Schema only. Runs against both databases; never put data here (D25).
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL
);
