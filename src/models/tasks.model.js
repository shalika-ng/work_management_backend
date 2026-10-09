const createTask = async (
  client,
  {
    projectId,
    name,
    description,
    assigneeId,
    dueDate,
    priority,
    status,
    createdBy,
    updatedBy,
  }
) => {
  const result = await client.query(
    `
    INSERT INTO tasks (
      project_id,
      name,
      description,
      assignee_id,
      due_date,
      priority,
      status,
      created_by,
      updated_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)

    RETURNING
      id,
      project_id,
      name,
      description,
      assignee_id,
      due_date,
      priority,
      status,
      created_by,
      updated_by,
      created_at,
      updated_at
    `,
    [
      projectId,
      name,
      description || null,
      assigneeId || null,
      dueDate || null,
      priority,
      status,
      createdBy,
      updatedBy,
    ]
  );

  return result.rows[0];
};

module.exports = {
  createTask,
};