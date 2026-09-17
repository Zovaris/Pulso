CREATE TABLE IF NOT EXISTS executions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    command_id TEXT    NOT NULL,
    label      TEXT    NOT NULL,
    program    TEXT    NOT NULL,
    args       TEXT    NOT NULL,
    cwd        TEXT    NOT NULL,
    state      TEXT    NOT NULL,
    started_at INTEGER NOT NULL,
    ended_at   INTEGER,
    exit_code  INTEGER,
    detail     TEXT
);

CREATE INDEX IF NOT EXISTS executions_by_started ON executions (started_at DESC);
CREATE INDEX IF NOT EXISTS executions_by_project ON executions (project_id, started_at DESC);

CREATE TABLE IF NOT EXISTS execution_logs (
    execution_id INTEGER NOT NULL REFERENCES executions(id) ON DELETE CASCADE,
    seq          INTEGER NOT NULL,
    at           INTEGER NOT NULL,
    stream       TEXT    NOT NULL,
    text         TEXT    NOT NULL,
    PRIMARY KEY (execution_id, seq)
);
