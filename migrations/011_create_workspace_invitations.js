exports.up = (pgm) => {
  pgm.createTable("workspace_invitations", {
    id: {
      type: "serial",
      primaryKey: true,
    },
    workspace_id: {
      type: "integer",
      notNull: true,
      references: "workspaces",
      onDelete: "CASCADE",
    },
    email: {
      type: "varchar(150)",
      notNull: true,
    },
    token_hash: {
      type: "varchar(64)",
      notNull: true,
      unique: true,
    },
    invited_by: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },
    expires_at: {
      type: "timestamp",
      notNull: true,
    },
    accepted_at: {
      type: "timestamp",
      notNull: false,
    },
    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.addIndex("workspace_invitations", ["workspace_id", "email"]);
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_invitations");
};
