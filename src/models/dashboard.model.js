const pool = require("../config/database");

const findUserById = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      id,
      email,
      name,
      designation,
      status
    FROM users
    WHERE id = $1
    `,
    [userId]
  );

  return result.rows[0];
};

const getTaskStats = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      COUNT(*) FILTER (
        WHERE status = 7
      ) AS completed_tasks,

      COUNT(*) FILTER (
        WHERE due_date < CURRENT_DATE
        AND status NOT IN (6, 7)
      ) AS overdue_tasks,

      COUNT(*) FILTER (
        WHERE due_date = CURRENT_DATE
        AND status NOT IN (6, 7)
      ) AS due_today

    FROM tasks
    WHERE assignee_id = $1
    `,
    [userId]
  );

  return result.rows[0];
};

const getWorkspaceByUserId = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      w.id,
      w.name
    FROM workspace_members wm
    JOIN workspaces w
      ON w.id = wm.workspace_id
    WHERE wm.user_id = $1
      AND wm.status = 'ACTIVE'
    LIMIT 1
    `,
    [userId]
  );

  return result.rows[0];
};

module.exports = {
  findUserById,
  getTaskStats,
  getWorkspaceByUserId,
};