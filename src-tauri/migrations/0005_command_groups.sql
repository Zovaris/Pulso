CREATE TABLE command_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    label TEXT NOT NULL
);

-- Personal commands live under project 0, which is not a row in projects.
CREATE TABLE command_group_members (
    group_id INTEGER NOT NULL REFERENCES command_groups(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    command_id TEXT NOT NULL,
    PRIMARY KEY (group_id, position)
);

CREATE TRIGGER command_group_members_forget_project
AFTER DELETE ON projects
BEGIN
    DELETE FROM command_group_members WHERE project_id = OLD.id;
END;

CREATE TRIGGER command_group_members_forget_custom
AFTER DELETE ON custom_commands
BEGIN
    DELETE FROM command_group_members WHERE command_id = 'custom:' || OLD.id;
END;
