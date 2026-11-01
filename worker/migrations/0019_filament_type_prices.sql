CREATE TABLE IF NOT EXISTS filament_type_prices (
  material_type_key TEXT PRIMARY KEY NOT NULL,
  material_type TEXT NOT NULL,
  price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
  updated_at TEXT NOT NULL
);

DROP TABLE IF EXISTS filament_brand_prices;
