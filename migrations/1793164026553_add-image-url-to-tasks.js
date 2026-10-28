exports.up = (pgm) => {
  pgm.addColumn("tasks", "image_url", {
    type: "varchar(500)",
    notNull: false,
  });
};

exports.down = (pgm) => {
  pgm.dropColumn("tasks", "image_url");
};