BEGIN;

ALTER TABLE insights_query_runner_jobs ADD COLUMN record_time timestamptz;

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE schema_migrations SET dirty = 'f'
COMMIT;
