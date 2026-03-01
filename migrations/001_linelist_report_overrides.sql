CREATE TABLE IF NOT EXISTS linelist_report_overrides (
  id           TEXT PRIMARY KEY,   -- UUID
  facility_id  TEXT NOT NULL,
  outbreak_id  TEXT NOT NULL,
  template     TEXT NOT NULL,      -- 'ili' or 'gi'
  row_index    INTEGER NOT NULL,
  col_key      TEXT NOT NULL,
  value        TEXT NOT NULL DEFAULT '',
  updated_by   TEXT,               -- userId
  updated_at   TEXT NOT NULL,      -- ISO timestamp
  UNIQUE (outbreak_id, template, row_index, col_key)
);

CREATE INDEX IF NOT EXISTS idx_linelist_overrides_outbreak
  ON linelist_report_overrides(outbreak_id, template);
