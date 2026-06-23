-- Slice S10 — App settings / defaults (mirrors fastrak appdflt.dbf): a
-- key/value config table the legacy app reads for application defaults. Note
-- fastrak's CID here is 8-char (narrower than the usual 10) — kept as text so
-- legacy ids import unchanged (ADR-0002). See docs/analysis/fastrak-overview.md.
CREATE TABLE IF NOT EXISTS app_settings (
  id            text PRIMARY KEY,           -- fastrak CID (8-char here)
  tenant_id     text NOT NULL DEFAULT 'fastrak',
  application   varchar(50),                -- CAPPLICATI (the setting key)
  value         varchar(50),                -- CVALUE (the setting value)
  input_mask    varchar(50),                -- CINPUTMASK
  format        varchar(10),                -- CFORMAT
  control_width integer,                    -- NCONTROLWI
  data_type     varchar(1),                 -- CDATATYPE
  message       text,                       -- MMESSAGE (memo)
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_settings_tenant_idx ON app_settings (tenant_id);
