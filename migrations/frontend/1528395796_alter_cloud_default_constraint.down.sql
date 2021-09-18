BEGIN;

DROP INDEX IF EXISTS kind_cloud_default;
CREATE UNIQUE INDEX IF NOT EXISTS kind_cloud_default ON external_services (kind, cloud_default)
    WHERE cloud_default = true;

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE schema_migrations SET dirty = 'f'
COMMIT;
