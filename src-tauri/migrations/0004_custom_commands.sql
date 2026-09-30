CREATE TABLE custom_commands (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    label TEXT NOT NULL,
    command TEXT NOT NULL,
    cwd TEXT NOT NULL,
    favorite INTEGER NOT NULL DEFAULT 0
);

-- Personal executions have no project. Preserve existing history and log IDs.
CREATE TABLE executions_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
    command_id TEXT NOT NULL,
    label TEXT NOT NULL,
    program TEXT NOT NULL,
    args TEXT NOT NULL,
    cwd TEXT NOT NULL,
    state TEXT NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at INTEGER,
    exit_code INTEGER,
    detail TEXT
);
INSERT INTO executions_new SELECT * FROM executions;
CREATE TEMP TABLE saved_execution_logs AS SELECT * FROM execution_logs;
DROP TABLE execution_logs;
DROP TABLE executions;
ALTER TABLE executions_new RENAME TO executions;
CREATE INDEX executions_by_started ON executions (started_at DESC);
CREATE INDEX executions_by_project ON executions (project_id, started_at DESC);
CREATE TABLE execution_logs (
    execution_id INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    seq INTEGER NOT NULL,
    at INTEGER NOT NULL,
    stream TEXT NOT NULL,
    text TEXT NOT NULL,
    PRIMARY KEY (execution_id, seq)
);
INSERT INTO execution_logs SELECT * FROM saved_execution_logs;
DROP TABLE saved_execution_logs;
