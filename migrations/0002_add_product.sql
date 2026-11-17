-- Forward-only, additive migration (design: Projects/skincare-tracker/design/data-model.md).
-- Schema only: never data (D25). Applied with `wrangler d1 migrations apply`.
CREATE TABLE product (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
  brand      TEXT NOT NULL CHECK (length(trim(brand)) BETWEEN 1 AND 80),
  step       TEXT NOT NULL CHECK (step IN ('cleanser','serum','moisturiser','spf')),
  session    TEXT NOT NULL CHECK (session IN ('am','pm')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  -- Numeric sort key for the contract's fixed step sequence (NOT the `step` text order).
  -- STORED keeps the rank derived from `step` (one source of truth, no drift) and indexable.
  -- Internal only: never exposed in the API contract.
  step_order INTEGER NOT NULL GENERATED ALWAYS AS (
    CASE step WHEN 'cleanser' THEN 1 WHEN 'serum' THEN 2 WHEN 'moisturiser' THEN 3 WHEN 'spf' THEN 4 END
  ) STORED
);

CREATE INDEX product_order_idx ON product (session, step_order, created_at, id);
