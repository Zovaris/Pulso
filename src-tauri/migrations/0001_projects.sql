-- Slice 1: the two entities Rust owns that outlive a session.
--
-- `projects.path` is the canonical path and is unique, so picking the same
-- folder twice cannot create a second row. Availability is not stored: it is
-- resolved against the filesystem every time the list is read, because a folder
-- can be moved or deleted while Soffy is closed.

CREATE TABLE IF NOT EXISTS projects (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    path     TEXT    NOT NULL UNIQUE,
    name     TEXT    NOT NULL,
    added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
