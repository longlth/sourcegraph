BEGIN;

CREATE TABLE IF NOT EXISTS user_public_repos (
    user_id integer NOT NULL,
    repo_uri text NOT NULL,
    repo_id integer NOT NULL,
    UNIQUE(user_id, repo_id),
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (repo_id) REFERENCES repo (id) ON DELETE CASCADE
);

-- Clear the dirty flag in case the operator timed out and isn't around to clear it.
UPDATE schema_migrations SET dirty = 'f'
COMMIT;
