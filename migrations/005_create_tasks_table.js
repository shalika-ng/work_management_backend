exports.up = (pgm) => {
  pgm.createTable("tasks", {
    id: {
      type: "serial",
      primaryKey: true,
    },

    // Project this task belongs to
    project_id: {
      type: "integer",
      notNull: true,
      references: '"projects"',
      onDelete: "CASCADE",
    },

    // Task name
    name: {
      type: "varchar(200)",
      notNull: true,
    },

    // User assigned to the task
    assignee_id: {
      type: "integer",
      notNull: false,
      references: '"users"',
      onDelete: "SET NULL",
    },

    // Task due date
    due_date: {
      type: "date",
      notNull: false,
    },

    // 1 = Low, 2 = Medium, 3 = High
    priority: {
      type: "integer",
      notNull: true,
      default: 2,
    },

    // 1 = Needs Triage
    // 2 = Fixing
    // 3 = Ready for Retest
    // 4 = Retest
    // 5 = Verified
    // 6 = Closed
    // 7 = Completed
    status: {
      type: "integer",
      notNull: true,
      default: 1,
    },

    // User who created the task
    created_by: {
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

  // Priority can only be 1, 2 or 3
  pgm.addConstraint("tasks", "tasks_priority_check", {
    check: "priority IN (1, 2, 3)",
  });

  // Status can only be 1 to 7
  pgm.addConstraint("tasks", "tasks_status_check", {
    check: "status IN (1, 2, 3, 4, 5, 6, 7)",
  });
};

exports.down = (pgm) => {
  pgm.dropConstraint("tasks", "tasks_priority_check");
  pgm.dropConstraint("tasks", "tasks_status_check");

  pgm.dropTable("tasks");
};