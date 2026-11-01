ALTER TABLE products ADD COLUMN filament_types TEXT NOT NULL DEFAULT '[]';

UPDATE products
SET filament_types = CASE
  WHEN filament_type IS NULL OR trim(filament_type) = '' THEN '[]'
  ELSE json_array(filament_type)
END;
