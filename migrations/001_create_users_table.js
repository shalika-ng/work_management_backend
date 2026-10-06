exports.up = (pgm) => {
  pgm.createTable("users", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    email: {
      type: "varchar(150)",
      notNull: true,
      unique: true,
    },

    name: {
      type: "varchar(100)",
      notNull: true,
    },

    password: {
      type: "text",
      notNull: true,
    },

    created_by: {
      type: "integer",
      notNull: false,
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
  pgm.dropTable("users");
};