DROP INDEX IF EXISTS idx_colors_filament_type_order;
DROP INDEX IF EXISTS idx_colors_filament_display_name;

ALTER TABLE colors DROP COLUMN filament_type;
ALTER TABLE colors ADD COLUMN filament_type TEXT NOT NULL DEFAULT 'unclassified';

CREATE INDEX IF NOT EXISTS idx_colors_filament_type_order
  ON colors (filament_type, sort_order, display_name);

CREATE UNIQUE INDEX IF NOT EXISTS idx_colors_filament_display_name
  ON colors (filament_type, display_name);
