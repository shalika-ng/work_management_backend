exports.up = (pgm) => {
  pgm.createTable("workspaces", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    name: {
      type: "varchar(150)",
      notNull: true,
    },

    created_by: {
      type: "integer",
      notNull: true,
      references: "users",
      onDelete: "CASCADE",
    },

    updated_by: {
      type: "integer",
      notNull: false,
      references: "users",
      onDelete: "SET NULL",
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
};

exports.down = (pgm) => {
  pgm.dropTable("workspaces");
};