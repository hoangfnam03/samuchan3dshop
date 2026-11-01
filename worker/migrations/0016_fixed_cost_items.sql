CREATE TABLE IF NOT EXISTS fixed_cost_items (
  id TEXT PRIMARY KEY NOT NULL,
  label TEXT NOT NULL,
  cost_vnd INTEGER NOT NULL CHECK (cost_vnd >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

ALTER TABLE product_cost_items
  ADD COLUMN fixed_cost_item_id TEXT;
