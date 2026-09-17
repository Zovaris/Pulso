CREATE TABLE IF NOT EXISTS command_flags (
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    command_id TEXT    NOT NULL,
    favorite   INTEGER NOT NULL DEFAULT 0,
    hidden     INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (project_id, command_id)
);
