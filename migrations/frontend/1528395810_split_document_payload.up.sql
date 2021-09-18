BEGIN;

INSERT INTO out_of_band_migrations (id, team, component, description, introduced, non_destructive)
VALUES (7, 'code-intelligence', 'codeintel-db.lsif_data_documents', 'Split payload into multiple columns', '3.27.0', false)
ON CONFLICT DO NOTHING;

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE schema_migrations SET dirty = 'f'
COMMIT;
