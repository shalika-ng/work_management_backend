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

const updateTask = async (client, { taskId, changes, userId }) => {
  const result = await client.query(
    `
    UPDATE tasks t
    SET name = CASE WHEN $3::boolean THEN $4 ELSE t.name END,
        description = CASE WHEN $5::boolean THEN $6 ELSE t.description END,
        assignee_id = CASE WHEN $7::boolean THEN $8 ELSE t.assignee_id END,
        due_date = CASE WHEN $9::boolean THEN $10 ELSE t.due_date END,
        priority = CASE WHEN $11::boolean THEN $12 ELSE t.priority END,
        updated_by = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE t.id = $1
    RETURNING
      t.id,
      t.project_id,
      t.name,
      t.description,
      t.assignee_id,
      t.due_date,
      t.priority,
      t.status,
      t.created_by,
      t.updated_by,
      t.created_at,
      t.updated_at
    `,
    [
      taskId,
      userId,
      Object.hasOwn(changes, "name"),
      changes.name ?? null,
      Object.hasOwn(changes, "description"),
      changes.description ?? null,
      Object.hasOwn(changes, "assigneeId"),
      changes.assigneeId ?? null,
      Object.hasOwn(changes, "dueDate"),
      changes.dueDate ?? null,
      Object.hasOwn(changes, "priority"),
      changes.priority ?? null,
    ]
  );

  return result.rows[0];
};

module.exports = {
  createTask,
  updateTask,
};