CREATE TABLE IF NOT EXISTS filament_purchase_lots (
  id TEXT PRIMARY KEY NOT NULL,
  material_type_key TEXT NOT NULL REFERENCES filament_type_prices(material_type_key) ON DELETE CASCADE,
  purchase_date TEXT NOT NULL,
  spool_count INTEGER NOT NULL CHECK (spool_count > 0),
  purchase_price_cny REAL NOT NULL CHECK (purchase_price_cny >= 0),
  exchange_rate_vnd_per_cny REAL NOT NULL CHECK (exchange_rate_vnd_per_cny > 0),
  shipping_cost_vnd INTEGER NOT NULL CHECK (shipping_cost_vnd >= 0),
  additional_costs_json TEXT NOT NULL DEFAULT '[]',
  cost_items_json TEXT NOT NULL DEFAULT '[]',
  base_cost_per_spool_vnd INTEGER NOT NULL CHECK (base_cost_per_spool_vnd >= 0),
  fixed_cost_per_spool_vnd INTEGER NOT NULL DEFAULT 0 CHECK (fixed_cost_per_spool_vnd >= 0),
  unit_cost_vnd INTEGER NOT NULL CHECK (unit_cost_vnd >= 0),
  total_cost_vnd INTEGER NOT NULL CHECK (total_cost_vnd >= 0),
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_filament_purchase_lots_type_date
  ON filament_purchase_lots (material_type_key, purchase_date DESC, created_at DESC);
