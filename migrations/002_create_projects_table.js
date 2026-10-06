exports.up = (pgm) => {
  pgm.createTable("projects", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    name: {
      type: "varchar(150)",
      notNull: true,
    },

    description: {
      type: "text",
      notNull: false,
    },

    created_by: {
      type: "integer",
      notNull: true,
      references: '"users"',
      onDelete: "CASCADE",
    },

    updated_by: {
      type: "integer",
      notNull: false,
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
  pgm.dropTable("projects");
};
