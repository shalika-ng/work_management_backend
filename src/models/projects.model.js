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
          json_build_object('id', u.id, 'name', u.name)
          ORDER BY u.name, u.id
        ) FILTER (WHERE u.id IS NOT NULL),
        '[]'
      ) AS members
    FROM projects p
    LEFT JOIN project_members pm ON pm.project_id = p.id
    LEFT JOIN users u ON u.id = pm.user_id
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
    `
  );

  return result.rows;
};

module.exports = {
  getAllProjects,
};
