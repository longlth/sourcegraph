BEGIN;

DROP TABLE IF EXISTS lsif_data_documentation_pages;

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE codeintel_schema_migrations SET dirty = 'f'
COMMIT;
