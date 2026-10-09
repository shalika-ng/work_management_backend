exports.up = (pgm) => {
  pgm.addColumn("projects", {
    workspace_id: {
      type: "integer",
      notNull: false,
      references: "workspaces",
      onDelete: "CASCADE",
    },
  });

  pgm.sql(`
    INSERT INTO workspaces (name, created_by)
    SELECT DISTINCT u.name || ' Workspace', p.created_by
    FROM projects p
    JOIN users u ON u.id = p.created_by
    WHERE NOT EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.user_id = p.created_by
    )
  `);

  pgm.sql(`
    INSERT INTO workspace_members (workspace_id, user_id, role, status)
    SELECT w.id, w.created_by, 'ADMIN', 'ACTIVE'
    FROM workspaces w
    WHERE NOT EXISTS (
      SELECT 1
      FROM workspace_members wm
      WHERE wm.workspace_id = w.id
        AND wm.user_id = w.created_by
    )
      AND EXISTS (
        SELECT 1
        FROM projects p
        WHERE p.created_by = w.created_by
      )
  `);

  pgm.sql(`
    UPDATE projects p
    SET workspace_id = (
      SELECT wm.workspace_id
      FROM workspace_members wm
      WHERE wm.user_id = p.created_by
        AND wm.status = 'ACTIVE'
      ORDER BY wm.workspace_id
      LIMIT 1
    )
  `);

  pgm.sql(`
    INSERT INTO project_members (project_id, user_id)
    SELECT id, created_by
    FROM projects
    ON CONFLICT (project_id, user_id) DO NOTHING
  `);

  pgm.addIndex("projects", "workspace_id");
};

exports.down = (pgm) => {
  pgm.dropIndex("projects", "workspace_id");
  pgm.dropColumn("projects", "workspace_id");
};
