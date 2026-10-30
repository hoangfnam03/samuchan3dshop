CREATE TABLE IF NOT EXISTS product_cost_items (
  id TEXT PRIMARY KEY NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  cost_vnd INTEGER NOT NULL CHECK (cost_vnd >= 0),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_product_cost_items_product_order
  ON product_cost_items (product_id, sort_order, label);

ALTER TABLE order_items
  ADD COLUMN unit_cost_vnd INTEGER NOT NULL DEFAULT 0 CHECK (unit_cost_vnd >= 0);
