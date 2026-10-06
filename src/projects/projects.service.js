const pool = require("../config/database");

const getAllProjects = async () => {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.description,
      p.created_by,
      p.created_at,
      p.updated_at,

      COALESCE(
        json_agg(
          json_build_object(
            'id', u.id,
            'name', u.name
          )
          ORDER BY u.name, u.id
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS members

    FROM projects p

    LEFT JOIN project_members pm
      ON pm.project_id = p.id

    LEFT JOIN users u
      ON u.id = pm.user_id

    GROUP BY p.id

    ORDER BY p.created_at DESC, p.id DESC
    `
  );

  return result.rows;
};


// CREATE PROJECT 

const createProject = async ({
  name,
  description,
  members,
  userId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // --------------------------------------------------
    // 1. Find the workspace of the logged-in user
    // --------------------------------------------------
    const workspaceResult = await client.query(
      `
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = $1
        AND status = 'ACTIVE'
      ORDER BY workspace_id
      LIMIT 1
      `,
      [userId]
    );

    if (workspaceResult.rowCount === 0) {
      const error = new Error(
        "You are not an active member of any workspace"
      );
      error.statusCode = 400;
      throw error;
    }

    const workspaceId = workspaceResult.rows[0].workspace_id;

    // --------------------------------------------------
    // 2. Validate members
    // --------------------------------------------------
    const requestedMemberIds = Array.isArray(members)
      ? [...new Set(members.map(Number))]
      : [];

    if (
      requestedMemberIds.some(
        (memberId) =>
          !Number.isSafeInteger(memberId) || memberId <= 0
      )
    ) {
      const error = new Error(
        "Members must contain valid user IDs"
      );
      error.statusCode = 400;
      throw error;
    }

    // --------------------------------------------------
    // 3. Check that all members belong to the same
    //    workspace as the logged-in user
    // --------------------------------------------------
    if (requestedMemberIds.length > 0) {
      const workspaceMembersResult = await client.query(
        `
        SELECT user_id
        FROM workspace_members
        WHERE workspace_id = $1
          AND status = 'ACTIVE'
          AND user_id = ANY($2::int[])
        `,
        [workspaceId, requestedMemberIds]
      );

      if (
        workspaceMembersResult.rowCount !==
        requestedMemberIds.length
      ) {
        const error = new Error(
          "All project members must be active members of your workspace"
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // --------------------------------------------------
    // 4. Create project
    // --------------------------------------------------
    const projectResult = await client.query(
      `
      INSERT INTO projects (
        name,
        description,
        created_by,
        updated_by
      )
      VALUES ($1, $2, $3, $4)
      RETURNING
        id,
        name,
        description,
        created_by,
        created_at,
        updated_by,
        updated_at
      `,
      [
        name,
        description || null,
        userId,
        userId,
      ]
    );

    const project = projectResult.rows[0];

    // --------------------------------------------------
    // 5. Add project members
    // --------------------------------------------------
    if (requestedMemberIds.length > 0) {
      await client.query(
        `
        INSERT INTO project_members (
          project_id,
          user_id
        )
        SELECT
          $1,
          user_id
        FROM workspace_members
        WHERE workspace_id = $2
          AND status = 'ACTIVE'
          AND user_id = ANY($3::int[])
        `,
        [
          project.id,
          workspaceId,
          requestedMemberIds,
        ]
      );
    }

    // --------------------------------------------------
    // 6. Fetch project with members
    // --------------------------------------------------
    const finalResult = await client.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_by,
        p.created_at,
        p.updated_by,
        p.updated_at,

        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name
            )
            ORDER BY u.name, u.id
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members

      FROM projects p

      LEFT JOIN project_members pm
        ON pm.project_id = p.id

      LEFT JOIN users u
        ON u.id = pm.user_id

      WHERE p.id = $1

      GROUP BY
        p.id,
        p.name,
        p.description,
        p.created_by,
        p.created_at,
        p.updated_by,
        p.updated_at
      `,
      [project.id]
    );

    await client.query("COMMIT");

    return finalResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

// Edit Project 
const editProject = async ({
  projectId,
  name,
  description,
  members,
  userId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Get user's workspace
    const workspaceResult = await client.query(
      `
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = $1
        AND status = 'ACTIVE'
      LIMIT 1
      `,
      [userId]
    );

    if (workspaceResult.rowCount === 0) {
      const error = new Error(
        "You are not an active member of any workspace"
      );
      error.statusCode = 400;
      throw error;
    }

    const workspaceId = workspaceResult.rows[0].workspace_id;

    // Check project exists
    const projectCheck = await client.query(
      `
      SELECT id
      FROM projects
      WHERE id = $1
      `,
      [projectId]
    );

    if (projectCheck.rowCount === 0) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    // Validate members
    const requestedMemberIds = Array.isArray(members)
      ? [...new Set(members.map(Number))]
      : [];

    if (
      requestedMemberIds.some(
        (id) =>
          !Number.isSafeInteger(id) || id <= 0
      )
    ) {
      const error = new Error(
        "Invalid member IDs"
      );
      error.statusCode = 400;
      throw error;
    }

    // Check members belong to workspace
    if (requestedMemberIds.length > 0) {
      const memberCheck = await client.query(
        `
        SELECT user_id
        FROM workspace_members
        WHERE workspace_id = $1
          AND status = 'ACTIVE'
          AND user_id = ANY($2::int[])
        `,
        [workspaceId, requestedMemberIds]
      );

      if (
        memberCheck.rowCount !==
        requestedMemberIds.length
      ) {
        const error = new Error(
          "All project members must be active members of your workspace"
        );
        error.statusCode = 400;
        throw error;
      }
    }

    // Update project
    await client.query(
      `
      UPDATE projects
      SET
        name = $1,
        description = $2,
        updated_by = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [
        name,
        description || null,
        userId,
        projectId,
      ]
    );

    // Remove old members
    await client.query(
      `
      DELETE FROM project_members
      WHERE project_id = $1
      `,
      [projectId]
    );

    // Insert new members
    if (requestedMemberIds.length > 0) {
      await client.query(
        `
        INSERT INTO project_members (
          project_id,
          user_id
        )
        VALUES
        ${requestedMemberIds
          .map(
            (_, index) =>
              `($1, $${index + 2})`
          )
          .join(",")}
        `,
        [projectId, ...requestedMemberIds]
      );
    }

    // Return updated project
    const finalResult = await client.query(
      `
      SELECT
        p.id,
        p.name,
        p.description,
        p.created_by,
        p.created_at,
        p.updated_by,
        p.updated_at,

        COALESCE(
          json_agg(
            json_build_object(
              'id', u.id,
              'name', u.name
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) AS members

      FROM projects p

      LEFT JOIN project_members pm
        ON pm.project_id = p.id

      LEFT JOIN users u
        ON u.id = pm.user_id

      WHERE p.id = $1

      GROUP BY
        p.id,
        p.name,
        p.description,
        p.created_by,
        p.created_at,
        p.updated_by,
        p.updated_at
      `,
      [projectId]
    );

    await client.query("COMMIT");

    return finalResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  getAllProjects,
  createProject,
   editProject,
};
