const crypto = require("crypto");
const bcrypt = require("bcrypt");

const pool = require("../config/database");
const projectsModel = require("../models/projects.model");

const createServiceError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const projectSelect = `
  SELECT
    p.id,
    p.name,
    p.description,
    p.workspace_id,
    p.created_by,
    p.created_at,
    p.updated_by,
    p.updated_at,
    CASE WHEN p.created_by = $1 THEN 'ADMIN' ELSE 'MEMBER' END AS role,
    COALESCE(
      json_agg(
        json_build_object('id', u.id, 'name', u.name)
        ORDER BY u.name, u.id
      ) FILTER (WHERE u.id IS NOT NULL),
      '[]'
    ) AS members
  FROM projects p
  LEFT JOIN project_members pm ON pm.project_id = p.id
  LEFT JOIN users u ON u.id = pm.user_id
`;

const getAllProjects = (userId) => projectsModel.getAllProjects(userId);

const getProjectById = async (client, projectId, userId) => {
  const result = await client.query(
    `
    ${projectSelect}
    WHERE p.id = $2
      AND (
        (
          p.workspace_id IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM workspace_members active_member
            WHERE active_member.workspace_id = p.workspace_id
              AND active_member.user_id = $1
              AND active_member.status = 'ACTIVE'
          )
        )
        OR (
          p.workspace_id IS NULL
          AND (
            p.created_by = $1 OR EXISTS (
              SELECT 1
              FROM project_members visible_member
              WHERE visible_member.project_id = p.id
                AND visible_member.user_id = $1
            )
          )
        )
      )
    GROUP BY p.id
    `,
    [userId, projectId]
  );

  return result.rows[0];
};

const createProject = async ({
  name,
  description,
  members,
  workspaceId,
  userId,
}) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workspaceResult = await client.query(
      `
      SELECT workspace_id
      FROM workspace_members
      WHERE user_id = $1
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'ADMIN')
        AND ($2::int IS NULL OR workspace_id = $2)
      ORDER BY workspace_id
      LIMIT 1
      `,
      [userId, workspaceId || null]
    );

    if (workspaceResult.rowCount === 0) {
      throw createServiceError(
        "You must be a workspace owner or admin to create a project",
        403
      );
    }

    const selectedWorkspaceId = workspaceResult.rows[0].workspace_id;
    const requestedMemberIds = Array.isArray(members)
      ? [...new Set(members.map(Number))]
      : [];

    if (
      requestedMemberIds.some(
        (memberId) => !Number.isSafeInteger(memberId) || memberId <= 0
      )
    ) {
      throw createServiceError("Members must contain valid user IDs", 400);
    }

    const selectedMemberIds = requestedMemberIds.filter(
      (memberId) => memberId !== userId
    );
    if (selectedMemberIds.length > 0) {
      const workspaceMembersResult = await client.query(
        `
        SELECT user_id
        FROM workspace_members
        WHERE workspace_id = $1
          AND user_id = ANY($2::int[])
          AND status = 'ACTIVE'
        `,
        [selectedWorkspaceId, selectedMemberIds]
      );

      if (workspaceMembersResult.rowCount !== selectedMemberIds.length) {
        throw createServiceError(
          "All project members must be active members of this workspace",
          400
        );
      }
    }

    const projectResult = await client.query(
      `
      INSERT INTO projects (
        name, description, workspace_id, created_by, updated_by
      )
      VALUES ($1, $2, $3, $4, $4)
      RETURNING id
      `,
      [name, description || null, selectedWorkspaceId, userId]
    );
    const projectId = projectResult.rows[0].id;

    await client.query(
      `
      INSERT INTO project_members (project_id, user_id)
      SELECT $1, member_id
      FROM unnest($2::int[]) AS members(member_id)
      ON CONFLICT (project_id, user_id) DO NOTHING
      `,
      [projectId, [userId, ...selectedMemberIds]]
    );

    const project = await getProjectById(client, projectId, userId);
    await client.query("COMMIT");
    return project;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

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

    const projectResult = await client.query(
      `
      SELECT p.id
      FROM projects p
      WHERE p.id = $1 AND p.created_by = $2
        AND EXISTS (
          SELECT 1
          FROM workspace_members wm
          WHERE wm.workspace_id = p.workspace_id
            AND wm.user_id = $2
            AND wm.status = 'ACTIVE'
            AND wm.role IN ('OWNER', 'ADMIN')
        )
      FOR UPDATE
      `,
      [projectId, userId]
    );

    if (projectResult.rowCount === 0) {
      const existsResult = await client.query(
        "SELECT 1 FROM projects WHERE id = $1",
        [projectId]
      );
      if (existsResult.rowCount === 0) {
        throw createServiceError("Project not found", 404);
      }
      throw createServiceError("Only the project owner can edit it", 403);
    }

    const project = projectResult.rows[0];
    if (Array.isArray(members)) {
      const requestedMemberIds = [...new Set(members.map(Number))].filter(
        (memberId) => memberId !== userId
      );

      if (
        requestedMemberIds.some(
          (memberId) => !Number.isSafeInteger(memberId) || memberId <= 0
        )
      ) {
        throw createServiceError("Invalid member IDs", 400);
      }

      if (requestedMemberIds.length > 0) {
        const projectMemberResult = await client.query(
          `
          SELECT user_id
          FROM project_members
          WHERE project_id = $1
            AND user_id = ANY($2::int[])
          `,
          [projectId, requestedMemberIds]
        );

        if (projectMemberResult.rowCount !== requestedMemberIds.length) {
          throw createServiceError(
            "New project members must accept an invitation before joining",
            400
          );
        }
      }
    }

    await client.query(
      `
      UPDATE projects
      SET name = $1,
          description = $2,
          updated_by = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4
      `,
      [name, description || null, userId, projectId]
    );

    if (Array.isArray(members)) {
      const requestedMemberIds = [...new Set(members.map(Number))].filter(
        (memberId) => memberId !== userId
      );
      await client.query(
        "DELETE FROM project_members WHERE project_id = $1 AND user_id <> $2",
        [projectId, userId]
      );
      if (requestedMemberIds.length > 0) {
        await client.query(
          `
          INSERT INTO project_members (project_id, user_id)
          SELECT $1, member_id
          FROM unnest($2::int[]) AS member_ids(member_id)
          ON CONFLICT (project_id, user_id) DO NOTHING
          `,
          [projectId, requestedMemberIds]
        );
      }
    }

    const updatedProject = await getProjectById(
      client,
      projectId,
      userId
    );
    await client.query("COMMIT");
    return updatedProject;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createWorkspaceInvitation = async ({ workspaceId, email, userId }) => {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const workspaceResult = await client.query(
      `
      SELECT w.id, w.name
      FROM workspaces w
      JOIN workspace_members wm ON wm.workspace_id = w.id
      WHERE w.id = $1
        AND wm.user_id = $2
        AND wm.status = 'ACTIVE'
        AND wm.role IN ('OWNER', 'ADMIN')
      `,
      [workspaceId, userId]
    );

    if (workspaceResult.rowCount === 0) {
      const existsResult = await client.query(
        "SELECT 1 FROM workspaces WHERE id = $1",
        [workspaceId]
      );
      if (existsResult.rowCount === 0) {
        throw createServiceError("Workspace not found", 404);
      }
      throw createServiceError(
        "Only workspace owners and admins can invite members",
        403
      );
    }

    const workspace = workspaceResult.rows[0];
    const existingMember = await client.query(
      `
      SELECT wm.status
      FROM workspace_members wm
      JOIN users u ON u.id = wm.user_id
      WHERE wm.workspace_id = $1 AND lower(u.email) = $2
      `,
      [workspaceId, normalizedEmail]
    );
    if (
      existingMember.rowCount > 0 &&
      existingMember.rows[0].status === "ACTIVE"
    ) {
      throw createServiceError("This user is already a workspace member", 409);
    }

    const invitationResult = await client.query(
      `
      INSERT INTO workspace_invitations (
        workspace_id, email, token_hash, invited_by, expires_at
      )
      VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP + INTERVAL '7 days')
      RETURNING id, email, expires_at
      `,
      [workspaceId, normalizedEmail, tokenHash, userId]
    );

    await client.query("COMMIT");
    return {
      ...invitationResult.rows[0],
      workspace,
      invite_token: token,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const createWorkspaceMember = async ({
  workspaceId,
  name,
  email,
  password,
  adminUserId,
}) => {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const workspaceAccess = await client.query(
      `
      SELECT 1
      FROM workspace_members
      WHERE workspace_id = $1
        AND user_id = $2
        AND status = 'ACTIVE'
        AND role IN ('OWNER', 'ADMIN')
      FOR UPDATE
      `,
      [workspaceId, adminUserId]
    );

    if (workspaceAccess.rowCount === 0) {
      const workspaceExists = await client.query(
        "SELECT 1 FROM workspaces WHERE id = $1",
        [workspaceId]
      );
      if (workspaceExists.rowCount === 0) {
        throw createServiceError("Workspace not found", 404);
      }
      throw createServiceError(
        "Only workspace owners and admins can create members",
        403
      );
    }

    const existingUser = await client.query(
      "SELECT id FROM users WHERE lower(email) = $1",
      [normalizedEmail]
    );
    if (existingUser.rowCount > 0) {
      throw createServiceError(
        "This email already has an account. Add that user to the workspace instead.",
        409
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userResult = await client.query(
      `
      INSERT INTO users (name, email, password, created_by, updated_by)
      VALUES ($1, $2, $3, $4, $4)
      RETURNING id, name, email
      `,
      [name, normalizedEmail, hashedPassword, adminUserId]
    );
    const user = userResult.rows[0];

    await client.query(
      `
      INSERT INTO workspace_members (workspace_id, user_id, role, status)
      VALUES ($1, $2, 'MEMBER', 'ACTIVE')
      `,
      [workspaceId, user.id]
    );

    await client.query("COMMIT");
    return {
      ...user,
      workspace_id: workspaceId,
      role: "MEMBER",
    };
  } catch (error) {
    await client.query("ROLLBACK");
    if (error.code === "23505") {
      throw createServiceError("This email already has an account", 409);
    }
    throw error;
  } finally {
    client.release();
  }
};

const getWorkspaceMembers = async ({ workspaceId, userId }) => {
  const accessResult = await pool.query(
    `
    SELECT 1
    FROM workspace_members
    WHERE workspace_id = $1
      AND user_id = $2
      AND status = 'ACTIVE'
    `,
    [workspaceId, userId]
  );

  if (accessResult.rowCount === 0) {
    const workspaceResult = await pool.query(
      "SELECT 1 FROM workspaces WHERE id = $1",
      [workspaceId]
    );
    if (workspaceResult.rowCount === 0) {
      throw createServiceError("Workspace not found", 404);
    }
    throw createServiceError(
      "You must be an active member of this workspace to view its members",
      403
    );
  }

  const result = await pool.query(
    `
    SELECT
      u.id,
      u.name,
      u.email,
      wm.role,
      wm.status,
      wm.created_at AS joined_at
    FROM workspace_members wm
    JOIN users u ON u.id = wm.user_id
    WHERE wm.workspace_id = $1
      AND wm.status = 'ACTIVE'
    ORDER BY u.name, u.id
    `,
    [workspaceId]
  );

  return result.rows;
};

const acceptWorkspaceInvitationWithClient = async (
  client,
  userId,
  email,
  token
) => {
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const invitationResult = await client.query(
    `
    SELECT id, email, workspace_id
    FROM workspace_invitations
    WHERE token_hash = $1
      AND accepted_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    FOR UPDATE
    `,
    [tokenHash]
  );

  if (invitationResult.rowCount === 0) {
    throw createServiceError("Invitation is invalid or expired", 400);
  }

  const invitation = invitationResult.rows[0];
  if (invitation.email !== email.trim().toLowerCase()) {
    throw createServiceError(
      "This invitation was sent to a different email address",
      403
    );
  }

  const membershipResult = await client.query(
    `
    INSERT INTO workspace_members (workspace_id, user_id, role, status)
    VALUES ($1, $2, 'MEMBER', 'ACTIVE')
    ON CONFLICT (workspace_id, user_id)
    DO UPDATE SET
      role = CASE
        WHEN workspace_members.role IN ('OWNER', 'ADMIN')
        THEN workspace_members.role
        ELSE 'MEMBER'
      END,
      status = 'ACTIVE',
      updated_at = CURRENT_TIMESTAMP
    RETURNING role
    `,
    [invitation.workspace_id, userId]
  );
  await client.query(
    `
    UPDATE workspace_invitations
    SET accepted_at = CURRENT_TIMESTAMP
    WHERE id = $1
    `,
    [invitation.id]
  );

  return {
    workspace_id: invitation.workspace_id,
    role: membershipResult.rows[0].role,
  };
};

const acceptWorkspaceInvitation = async ({ userId, email, token }) => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const membership = await acceptWorkspaceInvitationWithClient(
      client,
      userId,
      email,
      token
    );
    await client.query("COMMIT");
    return membership;
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
  createWorkspaceInvitation,
  createWorkspaceMember,
  getWorkspaceMembers,
  acceptWorkspaceInvitation,
  acceptWorkspaceInvitationWithClient,
};
