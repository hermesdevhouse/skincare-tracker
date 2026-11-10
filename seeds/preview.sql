-- Fake data for the PREVIEW database only (D25). Never run against devhouse-template-prod.
DELETE FROM items;
INSERT INTO items (id, name) VALUES
  (1, 'Example item one'),
  (2, 'Example item two'),
  (3, 'Example item three');
