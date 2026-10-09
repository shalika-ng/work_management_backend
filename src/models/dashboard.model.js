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
        WHERE t.status = 7
      ) AS completed_tasks,

      COUNT(*) FILTER (
        WHERE t.due_date < CURRENT_DATE
        AND t.status NOT IN (6, 7)
      ) AS overdue_tasks,

      COUNT(*) FILTER (
        WHERE t.due_date = CURRENT_DATE
        AND t.status NOT IN (6, 7)
      ) AS due_today

    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = $1
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $1
              AND wm.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $1 OR EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.id
                AND pm.user_id = $1
            )
          )
        )
      )
    `,
    [userId]
  );

  return result.rows[0];
};

const getTasksByUserId = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      t.id,
      t.project_id,
      p.name AS project_name,
      t.name,
      t.description,
      t.assignee_id,
      t.due_date,
      t.priority,
      t.status,
      t.created_by,
      t.created_at,
      t.updated_at
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    WHERE t.assignee_id = $1
      AND p.status = 1
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $1
              AND wm.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $1 OR EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.id
                AND pm.user_id = $1
            )
          )
        )
      )
    ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC, t.id DESC
    `,
    [userId]
  );

  return result.rows;
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
  getTasksByUserId,
  getWorkspaceByUserId,
};