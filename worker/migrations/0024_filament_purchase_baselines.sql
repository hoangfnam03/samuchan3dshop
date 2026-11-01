CREATE TABLE IF NOT EXISTS filament_purchase_baselines (
  id TEXT PRIMARY KEY NOT NULL,
  material_type_key TEXT NOT NULL UNIQUE REFERENCES filament_type_prices(material_type_key) ON DELETE CASCADE,
  material_type TEXT NOT NULL,
  purchase_date TEXT NOT NULL,
  purchase_price_cny REAL NOT NULL DEFAULT 0,
  exchange_rate_vnd_per_cny REAL NOT NULL DEFAULT 0,
  shipping_cost_vnd INTEGER NOT NULL DEFAULT 0,
  additional_costs_json TEXT NOT NULL DEFAULT '[]',
  fixed_costs_json TEXT NOT NULL DEFAULT '[]',
  unit_cost_vnd INTEGER NOT NULL DEFAULT 0,
  price_vnd INTEGER NOT NULL DEFAULT 0,
  purchase_url TEXT,
  discount_percent INTEGER NOT NULL DEFAULT 0,
  discount_ends_on TEXT,
  created_at TEXT NOT NULL
);

INSERT OR IGNORE INTO filament_purchase_baselines (
  id, material_type_key, material_type, purchase_date, purchase_price_cny,
  exchange_rate_vnd_per_cny, shipping_cost_vnd, additional_costs_json,
  fixed_costs_json, unit_cost_vnd, price_vnd, purchase_url,
  discount_percent, discount_ends_on, created_at
)
SELECT
  'initial-' || price.material_type_key,
  price.material_type_key,
  price.material_type,
  '2026-10-31',
  price.purchase_price_cny,
  price.exchange_rate_vnd_per_cny,
  price.shipping_cost_vnd,
  COALESCE(price.additional_costs_json, '[]'),
  COALESCE((
    SELECT json_group_array(json_object('id', fixed.id, 'label', fixed.label, 'costVnd', fixed.cost_vnd, 'sortOrder', fixed.sort_order))
    FROM fixed_filament_cost_items AS fixed
  ), '[]'),
  price.total_cost_vnd + COALESCE((SELECT SUM(fixed.cost_vnd) FROM fixed_filament_cost_items AS fixed), 0),
  price.price_vnd,
  price.purchase_url,
  price.discount_percent,
  price.discount_ends_on,
  '2026-10-31T00:00:00+07:00'
FROM filament_type_prices AS price;
