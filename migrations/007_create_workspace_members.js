exports.up = (pgm) => {
  pgm.createTable("workspace_members", {
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

    user_id: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },

    role: {
      type: "varchar(30)",
      notNull: true,
      default: "MEMBER",
    },

    status: {
      type: "varchar(20)",
      notNull: true,
      default: "ACTIVE",
    },

    created_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: "timestamp",
      notNull: true,
      default: pgm.func("CURRENT_TIMESTAMP"),
    },
  });

  pgm.addConstraint(
    "workspace_members",
    "unique_workspace_user",
    {
      unique: ["workspace_id", "user_id"],
    }
  );
};

exports.down = (pgm) => {
  pgm.dropTable("workspace_members");
};