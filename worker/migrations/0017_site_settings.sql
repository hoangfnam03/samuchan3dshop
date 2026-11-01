CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY NOT NULL,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
