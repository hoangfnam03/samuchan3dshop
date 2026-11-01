ALTER TABLE colors ADD COLUMN brand TEXT NOT NULL DEFAULT '';

DROP INDEX IF EXISTS idx_colors_filament_display_name;

CREATE UNIQUE INDEX idx_colors_filament_brand_display_name
  ON colors (filament_type, brand, display_name);
