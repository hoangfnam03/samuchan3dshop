CREATE TABLE IF NOT EXISTS filament_brand_prices (
  brand_key TEXT PRIMARY KEY NOT NULL,
  brand_name TEXT NOT NULL,
  price_vnd INTEGER NOT NULL CHECK (price_vnd >= 0),
  updated_at TEXT NOT NULL
);
