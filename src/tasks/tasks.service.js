const pool = require("../config/database");
const tasksModel = require("../models/tasks.model");

const createTask = async ({
  projectId,
  name,
  description,
  assigneeId,
  dueDate,
  priority,
  status,
  userId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------
    // 1. Check project membership
    // --------------------------------------------------

    const projectResult = await client.query(
      `
      SELECT
        id,
        name,
        status,
        created_by
      FROM projects p
      WHERE p.id = $1
        AND (
          (
            p.workspace_id IS NOT NULL
            AND EXISTS (
              SELECT 1
              FROM workspace_members wm
              WHERE wm.workspace_id = p.workspace_id
                AND wm.user_id = $2
                AND wm.status = 'ACTIVE'
            )
          )
          OR (
            p.workspace_id IS NULL
            AND (
              p.created_by = $2
              OR EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.project_id = p.id
                  AND pm.user_id = $2
              )
            )
          )
        )
      `,
      [projectId, userId]
    );

    if (projectResult.rowCount === 0) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    const project = projectResult.rows[0];

    // --------------------------------------------------
    // 2. Check project is active
    // --------------------------------------------------

    if (project.status !== 1) {
      const error = new Error("Project is inactive");
      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------
    // 3. Validate assignee
    // --------------------------------------------------

    if (assigneeId !== null && assigneeId !== undefined) {
      const assigneeResult = await client.query(
        `
        SELECT p.id
        FROM projects p
        WHERE p.id = $1
          AND (
            (
              p.workspace_id IS NOT NULL
              AND EXISTS (
                SELECT 1
                FROM workspace_members wm
                WHERE wm.workspace_id = p.workspace_id
                  AND wm.user_id = $2
                  AND wm.status = 'ACTIVE'
              )
            )
            OR (
              p.workspace_id IS NULL
              AND EXISTS (
                SELECT 1
                FROM project_members pm
                WHERE pm.project_id = p.id
                  AND pm.user_id = $2
              )
            )
          )
        `,
        [projectId, assigneeId]
      );

      if (assigneeResult.rowCount === 0) {
        const error = new Error(
          "Assignee must be a member of this project"
        );

        error.statusCode = 400;
        throw error;
      }
    }

    // --------------------------------------------------
    // 4. Validate priority
    // --------------------------------------------------

    if (![1, 2, 3].includes(priority)) {
      const error = new Error(
        "Priority must be 1 (Low), 2 (Medium), or 3 (High)"
      );

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------
    // 5. Validate task status
    // --------------------------------------------------

    if (![1, 2, 3, 4, 5, 6, 7].includes(status)) {
      const error = new Error("Invalid task status");

      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------
    // 6. Create task
    // --------------------------------------------------

    const task = await tasksModel.createTask(
      client,
      {
        projectId,
        name,
        description,
        assigneeId,
        dueDate,
        priority,
        status,
        createdBy: userId,
        updatedBy: userId,
      }
    );

    await client.query("COMMIT");

    return task;

  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const updateTaskStatus = async ({ taskId, status, userId }) => {
  const result = await pool.query(
    `
    UPDATE tasks t
    SET status = $1,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
    FROM projects p
    WHERE t.id = $3
      AND p.id = t.project_id
      AND p.status = 1
      AND (
        t.assignee_id = $2
        OR p.created_by = $2
        OR (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2
              AND wm.status = 'ACTIVE'
              AND wm.role IN ('OWNER', 'ADMIN')
          )
        )
      )
    RETURNING
      t.id,
      t.project_id,
      t.name,
      t.description,
      t.assignee_id,
      t.due_date,
      t.priority,
      t.status,
      t.updated_by,
      t.updated_at
    `,
    [status, userId, taskId]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      "Task not found or you are not allowed to update its status"
    );
    error.statusCode = 404;
    throw error;
  }

  return result.rows[0];
};

// get tasks by project ID
const getTasksByProject = async ({ projectId, userId }) => {
  // A project is visible only to its owner and accepted members.
  const projectResult = await pool.query(
    `
    SELECT p.id
    FROM projects p
    WHERE p.id = $1
      AND p.status = 1
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2
              AND wm.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $2
            OR EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.id
                AND pm.user_id = $2
            )
          )
        )
      )
    `,
    [projectId, userId]
  );

  if (projectResult.rowCount === 0) {
    const error = new Error("Project not found");
    error.statusCode = 404;
    throw error;
  }

  // Get all tasks belonging to this project
  const tasksResult = await pool.query(
    `
    SELECT
      t.id,
      t.project_id,
      t.name,
      t.description,
      t.assignee_id,
      assignee.name AS assignee_name,
      t.due_date,
      t.priority,
      t.status,
      t.created_by,
      creator.name AS created_by_name,
      t.created_at,
      t.updated_by,
      t.updated_at
    FROM tasks t

    LEFT JOIN users assignee
      ON assignee.id = t.assignee_id

    LEFT JOIN users creator
      ON creator.id = t.created_by

    WHERE t.project_id = $1

    ORDER BY t.created_at DESC, t.id DESC
    `,
    [projectId]
  );

  return tasksResult.rows;
};

const getTasksByProjectMember = async ({
  projectId,
  memberId,
  requesterId,
}) => {
  const projectResult = await pool.query(
    `
    SELECT p.id, p.workspace_id
    FROM projects p
    WHERE p.id = $1
      AND p.status = 1
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2
              AND wm.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $2
            OR EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.id
                AND pm.user_id = $2
            )
          )
        )
      )
    `,
    [projectId, requesterId]
  );

  if (projectResult.rowCount === 0) {
    const error = new Error("Project not found");
    error.statusCode = 404;
    throw error;
  }

  const targetMemberResult = await pool.query(
    `
    SELECT 1
    FROM projects p
    WHERE p.id = $1
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members wm
            WHERE wm.workspace_id = p.workspace_id
              AND wm.user_id = $2
              AND wm.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $2
            OR EXISTS (
              SELECT 1
              FROM project_members pm
              WHERE pm.project_id = p.id
                AND pm.user_id = $2
            )
          )
        )
      )
    `,
    [projectId, memberId]
  );

  if (targetMemberResult.rowCount === 0) {
    const error = new Error("Member is not part of this project");
    error.statusCode = 404;
    throw error;
  }

  const tasksResult = await pool.query(
    `
    SELECT
      t.id,
      t.project_id,
      t.name,
      t.description,
      t.assignee_id,
      assignee.name AS assignee_name,
      t.due_date,
      t.priority,
      t.status,
      t.created_by,
      creator.name AS created_by_name,
      t.created_at,
      t.updated_by,
      t.updated_at
    FROM tasks t
    LEFT JOIN users assignee ON assignee.id = t.assignee_id
    LEFT JOIN users creator ON creator.id = t.created_by
    WHERE t.project_id = $1
      AND t.assignee_id = $2
    ORDER BY t.created_at DESC, t.id DESC
    `,
    [projectId, memberId]
  );

  return tasksResult.rows;
};

module.exports = {
  createTask,
  updateTaskStatus,
  getTasksByProject,
  getTasksByProjectMember,
};