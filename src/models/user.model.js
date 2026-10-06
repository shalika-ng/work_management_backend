const pool = require("../config/database");

const findUserByEmail = async (email) => {
  const result = await pool.query(
    "SELECT * FROM users WHERE email = $1",
    [email]
  );

  return result.rows[0];
};

const findUserById = async (id) => {
  const result = await pool.query(
    "SELECT id, email, name, created_by, updated_by, created_at, updated_at FROM users WHERE id = $1",
    [id]
  );

  return result.rows[0];
};

const createUser = async (userData) => {
  const {
    email,
    name,
    password,
    created_by,
    updated_by,
  } = userData;

  const result = await pool.query(
    `INSERT INTO users
      (email, name, password, created_by, updated_by)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, email, name, created_by, updated_by, created_at, updated_at`,
    [
      email,
      name,
      password,
      created_by,
      updated_by,
    ]
  );

  return result.rows[0];
};

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
};