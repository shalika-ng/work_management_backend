exports.up = (pgm) => {
  pgm.addColumn("projects", {
    status: {
      type: "integer",
      notNull: true,
      default: 1,
    },
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("projects", "status");
};