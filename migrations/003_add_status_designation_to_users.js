exports.up = (pgm) => {
  pgm.addColumns("users", {
    status: {
      type: "integer",
      notNull: true,
      default: 1,
    },

    designation: {
      type: "varchar(100)",
      notNull: false,
    },
  });

  pgm.addConstraint("users", "users_status_check", {
    check: "status IN (1, 2)",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("users", "users_status_check");

  pgm.dropColumns("users", ["status", "designation"]);
};