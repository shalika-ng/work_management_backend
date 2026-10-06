exports.up = (pgm) => {
  pgm.createTable("project_members", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    project_id: {
      type: "integer",
      notNull: true,
      references: '"projects"',
      onDelete: "CASCADE",
    },

    user_id: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
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

  pgm.addConstraint("project_members", "unique_project_member", {
    unique: ["project_id", "user_id"],
  });
};

exports.down = (pgm) => {
  pgm.dropTable("project_members");
};