-- Upgrade an OLD local database to the models on develop a459a1f (Athira's data layer, 2026-10-08).
--
-- Who needs this: anyone whose database was created BEFORE pulling a459a1f. `python -m app.init_db`
-- only creates missing tables; it never adds columns, indexes, checks or changes foreign keys.
-- A FRESH database (new Docker volume -> init_db) already has all of this; do NOT run it there.
--
-- How (backup first, then apply; everything runs in one transaction, so it applies fully or not at all):
--   docker exec nexora-postgres pg_dump -U nexora -d nexora -Fc -f /tmp/nexora_backup.dump
--   docker cp nexora-postgres:/tmp/nexora_backup.dump ./nexora_backup.dump
--   python -m app.init_db                                   (from backend/, creates the new tables)
--   docker cp docs/db/upgrade_2026-10-08.sql nexora-postgres:/tmp/upgrade.sql
--   docker exec nexora-postgres psql -U nexora -d nexora -f /tmp/upgrade.sql
--
-- If CREATE UNIQUE INDEX uq_companies_name_normalized fails, two companies share a name (ignoring case);
-- rename one and run again. Tested 2026-10-08 on a database with 6 companies / 432 KPIs: no rows changed.
\set ON_ERROR_STOP on
BEGIN;

ALTER TABLE companies ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE companies ALTER COLUMN updated_at SET DEFAULT now();
CREATE UNIQUE INDEX uq_companies_name_normalized ON companies (lower(name));

CREATE INDEX ix_kpis_company_metric_date ON kpis (company_id, metric_name, metric_date);
ALTER TABLE kpis ADD CONSTRAINT ck_kpis_metric_value_finite
  CHECK (metric_value > -100000000000000000 AND metric_value < 100000000000000000);
ALTER TABLE kpis ADD CONSTRAINT ck_kpis_metric_name_nonempty
  CHECK (length(trim(metric_name)) > 0);
ALTER TABLE kpis DROP CONSTRAINT kpis_company_id_fkey;
ALTER TABLE kpis ADD CONSTRAINT kpis_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE RESTRICT;

ALTER TABLE users ADD COLUMN company_id INTEGER;
ALTER TABLE users ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE users ALTER COLUMN updated_at SET DEFAULT now();
CREATE INDEX ix_users_company_id ON users (company_id);
ALTER TABLE users ADD CONSTRAINT users_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES companies (id) ON DELETE SET NULL;

COMMIT;
