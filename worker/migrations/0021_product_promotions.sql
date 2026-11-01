ALTER TABLE products ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN discount_ends_on TEXT;

ALTER TABLE filament_type_prices ADD COLUMN purchase_url TEXT;
ALTER TABLE filament_type_prices ADD COLUMN discount_percent INTEGER NOT NULL DEFAULT 0;
ALTER TABLE filament_type_prices ADD COLUMN discount_ends_on TEXT;
