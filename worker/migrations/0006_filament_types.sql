ALTER TABLE colors
  ADD COLUMN filament_type TEXT NOT NULL DEFAULT 'unclassified'
  CHECK (filament_type IN ('unclassified', 'pla', 'pla_plus', 'pla_matte', 'pla_silk'));

CREATE INDEX IF NOT EXISTS idx_colors_filament_type_order
  ON colors (filament_type, sort_order, name);
