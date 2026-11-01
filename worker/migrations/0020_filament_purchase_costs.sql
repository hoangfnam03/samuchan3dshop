ALTER TABLE filament_type_prices ADD COLUMN purchase_price_cny REAL NOT NULL DEFAULT 0;
ALTER TABLE filament_type_prices ADD COLUMN exchange_rate_vnd_per_cny REAL NOT NULL DEFAULT 0;
ALTER TABLE filament_type_prices ADD COLUMN shipping_cost_vnd INTEGER NOT NULL DEFAULT 0;
ALTER TABLE filament_type_prices ADD COLUMN additional_costs_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE filament_type_prices ADD COLUMN total_cost_vnd INTEGER NOT NULL DEFAULT 0;
