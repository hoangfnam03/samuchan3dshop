ALTER TABLE colors
  ADD COLUMN display_name TEXT NOT NULL DEFAULT '';

UPDATE colors
SET display_name = name
WHERE display_name = '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_colors_filament_display_name
  ON colors (filament_type, display_name);
