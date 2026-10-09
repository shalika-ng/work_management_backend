const pool = require("../config/database");

const getAllProjects = async (userId) => {
  const result = await pool.query(
    `
    SELECT
      p.id,
      p.name,
      p.description,
      p.workspace_id,
      p.created_by,
      p.created_at,
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
    WHERE
      (p.workspace_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM workspace_members active_member
        WHERE active_member.workspace_id = p.workspace_id
          AND active_member.user_id = $1
          AND active_member.status = 'ACTIVE'
      ))
      OR (
        p.workspace_id IS NULL AND (
          p.created_by = $1 OR EXISTS (
            SELECT 1
            FROM project_members visible_member
            WHERE visible_member.project_id = p.id
              AND visible_member.user_id = $1
          )
        )
      )
    GROUP BY p.id
    ORDER BY p.created_at DESC, p.id DESC
    `,
    [userId]
  );

  return result.rows;
};

module.exports = {
  getAllProjects,
};
