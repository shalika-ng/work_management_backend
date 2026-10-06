const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

const pool = require("../config/database");


// ==========================
// LOGIN
// ==========================

const loginUser = async (email, password) => {

  // Find user by email
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
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

  // Find user's workspace
  const workspaceResult = await pool.query(
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
    [user.id]
  );

  // Get workspace
  const workspace = workspaceResult.rows[0];

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

    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
        }
      : null,
  };
};

// ==========================
// SIGNUP
// ==========================

const signupUser = async (
  name,
  email,
  password,
  workspaceName
) => {

  // Get a database client
  const client = await pool.connect();

  try {

    // Start transaction
    await client.query("BEGIN");


    // ==========================
    // 1. CHECK EXISTING USER
    // ==========================

    const existingUser = await client.query(
      "SELECT id FROM users WHERE email = $1",
      [email]
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
        email,
        hashedPassword,
      ]
    );

    const user = userResult.rows[0];


    // ==========================
    // 4. CREATE WORKSPACE
    // ==========================

    const workspaceResult = await client.query(
      `
      INSERT INTO workspaces (
        name,
        created_by
      )
      VALUES ($1, $2)
      RETURNING id, name
      `,
      [
        workspaceName,
        user.id,
      ]
    );

    const workspace = workspaceResult.rows[0];


    // ==========================
    // 5. ADD USER TO WORKSPACE
    // ==========================

    await client.query(
      `
      INSERT INTO workspace_members (
        workspace_id,
        user_id,
        role,
        status
      )
      VALUES ($1, $2, $3, $4)
      `,
      [
        workspace.id,
        user.id,
        "OWNER",
        "ACTIVE",
      ]
    );


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
      },
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