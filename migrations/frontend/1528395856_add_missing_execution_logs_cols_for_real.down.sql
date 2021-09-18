BEGIN;

ALTER TABLE IF EXISTS lsif_uploads DROP COLUMN IF EXISTS execution_logs;

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE schema_migrations SET dirty = 'f'
COMMIT;
