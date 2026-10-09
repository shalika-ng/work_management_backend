const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const pool = require("../config/database");
const projectsService = require("../projects/projects.service");


// ==========================
// LOGIN
// ==========================

const loginUser = async (email, password) => {

  // Find user by email
  const result = await pool.query(
    "SELECT * FROM users WHERE lower(email) = $1",
    [email.trim().toLowerCase()]
  );

  // User not found
  if (result.rows.length === 0) {
    throw new Error("Invalid email or password");
  }

  const user = result.rows[0];

  // Check password
  const isPasswordValid = await bcrypt.compare(
    password,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error("Invalid email or password");
  }

  // If the user has any pending workspace invites for this email,
  // accept them automatically when they log in.
  const pendingInvites = await pool.query(
    `
    SELECT id, workspace_id
    FROM workspace_invitations
    WHERE lower(email) = $1
      AND accepted_at IS NULL
      AND expires_at > CURRENT_TIMESTAMP
    ORDER BY created_at DESC
    `,
    [user.email.trim().toLowerCase()]
  );

  if (pendingInvites.rows.length > 0) {
    for (const invite of pendingInvites.rows) {
      const existingMembership = await pool.query(
        `
        SELECT 1
        FROM workspace_members
        WHERE user_id = $1 AND workspace_id = $2
        `,
        [user.id, invite.workspace_id]
      );

      if (existingMembership.rowCount === 0) {
        await pool.query(
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
          `,
          [invite.workspace_id, user.id]
        );
      }

      await pool.query(
        `
        UPDATE workspace_invitations
        SET accepted_at = CURRENT_TIMESTAMP
        WHERE id = $1
        `,
        [invite.id]
      );
    }
  }

  // Load only workspaces and projects the user belongs to.
  const workspaceResult = await pool.query(
    `
    SELECT
      w.id,
      w.name,
      wm.role
    FROM workspace_members wm
    JOIN workspaces w
      ON w.id = wm.workspace_id
    WHERE wm.user_id = $1
      AND wm.status = 'ACTIVE'
    ORDER BY w.id
    `,
    [user.id]
  );

  const projects = await projectsService.getAllProjects(user.id);

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "1d",
    }
  );

  // Return login response
  return {
    token,

    user: {
      id: user.id,
      name: user.name,
      email: user.email,
    },

    workspace: workspaceResult.rows[0] || null,
    workspaces: workspaceResult.rows,
    projects,
  };
};

// ==========================
// SIGNUP
// ==========================

const signupUser = async (
  name,
  email,
  password,
  workspaceName,
  inviteToken
) => {

  // Get a database client
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();

  try {

    // Start transaction
    await client.query("BEGIN");


    // ==========================
    // 1. CHECK EXISTING USER
    // ==========================

    const existingUser = await client.query(
      "SELECT id FROM users WHERE lower(email) = $1",
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      throw new Error("Email already registered");
    }


    // ==========================
    // 2. HASH PASSWORD
    // ==========================

    const hashedPassword = await bcrypt.hash(
      password,
      10
    );


    // ==========================
    // 3. CREATE USER
    // ==========================

    const userResult = await client.query(
      `
      INSERT INTO users (
        name,
        email,
        password
      )
      VALUES ($1, $2, $3)
      RETURNING id, name, email
      `,
      [
        name,
        normalizedEmail,
        hashedPassword,
      ]
    );

    const user = userResult.rows[0];

    let workspace;
    let role;

    if (inviteToken) {
      const membership =
        await projectsService.acceptWorkspaceInvitationWithClient(
        client,
        user.id,
        normalizedEmail,
        inviteToken
      );
      const workspaceResult = await client.query(
        "SELECT id, name FROM workspaces WHERE id = $1",
        [membership.workspace_id]
      );
      workspace = workspaceResult.rows[0];
      role = membership.role;
    } else {
      const workspaceResult = await client.query(
        `
        INSERT INTO workspaces (name, created_by)
        VALUES ($1, $2)
        RETURNING id, name
        `,
        [workspaceName, user.id]
      );
      workspace = workspaceResult.rows[0];
      role = "ADMIN";

      await client.query(
        `
        INSERT INTO workspace_members (
          workspace_id, user_id, role, status
        )
        VALUES ($1, $2, $3, 'ACTIVE')
        `,
        [workspace.id, user.id, role]
      );
    }


    // ==========================
    // 6. COMMIT TRANSACTION
    // ==========================

    await client.query("COMMIT");


    // ==========================
    // 7. GENERATE TOKEN
    // ==========================

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );


    // ==========================
    // 8. RETURN RESULT
    // ==========================

    return {
      token,

      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },

      workspace: {
        id: workspace.id,
        name: workspace.name,
        role,
      },
      role,
    };

  } catch (error) {

    // If anything fails,
    // undo all database changes
    await client.query("ROLLBACK");

    throw error;

  } finally {

    // Release database connection
    client.release();
  }
};


// ==========================
// CHANGE PASSWORD
// ==========================

const changePassword = async (
  userId,
  currentPassword,
  newPassword
) => {

  // Find user's current password
  const result = await pool.query(
    "SELECT password FROM users WHERE id = $1",
    [userId]
  );

  // User not found
  if (result.rows.length === 0) {
    throw new Error("User not found");
  }

  const user = result.rows[0];


  // Check current password
  const isPasswordValid = await bcrypt.compare(
    currentPassword,
    user.password
  );

  if (!isPasswordValid) {
    throw new Error(
      "Current password is incorrect"
    );
  }


  // Prevent same password
  const isSamePassword = await bcrypt.compare(
    newPassword,
    user.password
  );

  if (isSamePassword) {
    throw new Error(
      "New password must be different from current password"
    );
  }


  // Hash new password
  const hashedPassword = await bcrypt.hash(
    newPassword,
    10
  );


  // Update password
  await pool.query(
    `
    UPDATE users
    SET password = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    `,
    [
      hashedPassword,
      userId,
    ]
  );
};


module.exports = {
  loginUser,
  signupUser,
  changePassword,
};