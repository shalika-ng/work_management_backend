exports.up = (pgm) => {
  pgm.addColumns("tasks", {
    description: {
      type: "text",
      notNull: false,
    },

    updated_by: {
      type: "integer",
      notNull: false,
      references: '"users"',
      onDelete: "SET NULL",
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumns("tasks", ["description", "updated_by"]);
};