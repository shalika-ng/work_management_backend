const tasksService = require("./tasks.service");

const createTask = async (req, res) => {
  try {
    const {
      project_id,
      name,
      description,
      assignee_id,
      due_date,
      priority,
      status,
    } = req.body;

    // --------------------------------------------------
    // Validate project ID
    // --------------------------------------------------

    if (
      project_id === undefined ||
      project_id === null ||
      project_id === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    const projectId = Number(project_id);

    if (
      !Number.isInteger(projectId) ||
      projectId <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "Project ID must be a valid number",
      });
    }

    // --------------------------------------------------
    // Validate task name
    // --------------------------------------------------

    if (
      !name ||
      typeof name !== "string" ||
      !name.trim()
    ) {
      return res.status(400).json({
        success: false,
        message: "Task name is required",
      });
    }

    // --------------------------------------------------
    // Validate assignee ID if provided
    // --------------------------------------------------

    let assigneeId = null;

    if (
      assignee_id !== undefined &&
      assignee_id !== null &&
      assignee_id !== ""
    ) {
      assigneeId = Number(assignee_id);

      if (
        !Number.isInteger(assigneeId) ||
        assigneeId <= 0
      ) {
        return res.status(400).json({
          success: false,
          message: "Assignee ID must be a valid number",
        });
      }
    }

    // --------------------------------------------------
    // Validate priority
    // --------------------------------------------------

    const taskPriority =
      priority === undefined ||
      priority === null ||
      priority === ""
        ? 2
        : Number(priority);

    if (
      !Number.isInteger(taskPriority) ||
      ![1, 2, 3].includes(taskPriority)
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Priority must be 1 (Low), 2 (Medium), or 3 (High)",
      });
    }

    // --------------------------------------------------
    // Validate status
    // --------------------------------------------------

    const taskStatus =
      status === undefined ||
      status === null ||
      status === ""
        ? 1
        : Number(status);

    if (
      !Number.isInteger(taskStatus) ||
      ![1, 2, 3, 4, 5, 6, 7].includes(taskStatus)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid task status",
      });
    }

    // --------------------------------------------------
    // Get logged-in user
    // --------------------------------------------------

    const userId = req.user.id;

    // --------------------------------------------------
    // Create task
    // --------------------------------------------------

    const task = await tasksService.createTask({
      projectId,
      name: name.trim(),
      description:
        description !== undefined &&
        description !== null &&
        description !== ""
          ? description
          : null,
      assigneeId,
      dueDate:
        due_date !== undefined &&
        due_date !== null &&
        due_date !== ""
          ? due_date
          : null,
      priority: taskPriority,
      status: taskStatus,
      userId,
    });

    // --------------------------------------------------
    // Success response
    // --------------------------------------------------

    return res.status(201).json({
      success: true,
      message: "Task created successfully",
      data: task,
    });
  } catch (error) {
    console.error("Create task error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode
          ? error.message
          : "Failed to create task",
    });
  }
};

const editTask = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const body = req.body;
    const allowedFields = new Set([
      "name",
      "description",
      "assignee_id",
      "due_date",
      "priority",
    ]);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a valid number",
      });
    }

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return res.status(400).json({
        success: false,
        message: "Request body must be an object",
      });
    }

    const providedFields = Object.keys(body);
    if (providedFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one task field must be provided",
      });
    }

    const unsupportedFields = providedFields.filter(
      (field) => !allowedFields.has(field)
    );
    if (unsupportedFields.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Unsupported task field(s): ${unsupportedFields.join(", ")}`,
      });
    }

    const changes = {};

    if (Object.hasOwn(body, "name")) {
      if (typeof body.name !== "string" || !body.name.trim()) {
        return res.status(400).json({
          success: false,
          message: "Task name must be a non-empty string",
        });
      }
      if (body.name.trim().length > 200) {
        return res.status(400).json({
          success: false,
          message: "Task name must be 200 characters or fewer",
        });
      }
      changes.name = body.name.trim();
    }

    if (Object.hasOwn(body, "description")) {
      if (body.description !== null && typeof body.description !== "string") {
        return res.status(400).json({
          success: false,
          message: "Description must be a string or null",
        });
      }
      changes.description = body.description || null;
    }

    if (Object.hasOwn(body, "assignee_id")) {
      if (body.assignee_id === null || body.assignee_id === "") {
        changes.assigneeId = null;
      } else {
        const assigneeId = Number(body.assignee_id);
        if (!Number.isSafeInteger(assigneeId) || assigneeId <= 0) {
          return res.status(400).json({
            success: false,
            message: "Assignee ID must be a valid number or null",
          });
        }
        changes.assigneeId = assigneeId;
      }
    }

    if (Object.hasOwn(body, "due_date")) {
      if (body.due_date === null || body.due_date === "") {
        changes.dueDate = null;
      } else {
        const dueDate = body.due_date;
        const parsedDate =
          typeof dueDate === "string" &&
          /^\d{4}-\d{2}-\d{2}$/.test(dueDate)
            ? new Date(`${dueDate}T00:00:00.000Z`)
            : null;
        if (
          !parsedDate ||
          Number.isNaN(parsedDate.getTime()) ||
          parsedDate.toISOString().slice(0, 10) !== dueDate
        ) {
          return res.status(400).json({
            success: false,
            message: "Due date must be a valid date in YYYY-MM-DD format or null",
          });
        }
        changes.dueDate = dueDate;
      }
    }

    if (Object.hasOwn(body, "priority")) {
      const priority = Number(body.priority);
      if (!Number.isInteger(priority) || ![1, 2, 3].includes(priority)) {
        return res.status(400).json({
          success: false,
          message: "Priority must be 1 (Low), 2 (Medium), or 3 (High)",
        });
      }
      changes.priority = priority;
    }

    const task = await tasksService.editTask({
      taskId,
      changes,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Task updated successfully",
      data: task,
    });
  } catch (error) {
    console.error("Edit task error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to update task",
    });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const taskId = Number(req.params.taskId);
    const status = Number(req.body?.status);

    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a valid number",
      });
    }

    if (!Number.isInteger(status) || ![1, 2, 3, 4, 5, 6, 7].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Status must be a valid task status from 1 to 7",
      });
    }

    const task = await tasksService.updateTaskStatus({
      taskId,
      status,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Task status updated successfully",
      data: task,
    });
  } catch (error) {
    console.error("Update task status error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode ? error.message : "Failed to update task status",
    });
  }
};

// Get all tasks for a specific project
const getTasksByProject = async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    // Validate project ID
    if (!Number.isInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Project ID must be a valid number",
      });
    }

    // User ID comes from JWT
    const userId = req.user.id;

    const tasks = await tasksService.getTasksByProject({
      projectId,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Tasks fetched successfully",
      data: tasks,
    });
  } catch (error) {
    console.error("Get tasks by project error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to fetch tasks",
    });
  }
};

const getTasksByProjectMember = async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);
    const memberId = Number(req.params.memberId);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Project ID must be a valid number",
      });
    }

    if (!Number.isSafeInteger(memberId) || memberId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Member ID must be a valid number",
      });
    }

    const tasks = await tasksService.getTasksByProjectMember({
      projectId,
      memberId,
      requesterId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Member tasks fetched successfully",
      data: tasks,
    });
  } catch (error) {
    console.error("Get tasks by project member error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to fetch member tasks",
    });
  }
};

// DELETE TASK API CONTROLLER

const deleteTask = async (req, res) => {
  try {
    // Get task ID from URL parameters
    const taskId = Number(req.params.taskId);


    // Validate task ID
    if (!Number.isSafeInteger(taskId) || taskId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Task ID must be a valid number",
      });
    }


    // Get logged-in user ID from authentication middleware
    const userId = req.user.id;


    // Delete task
    const task = await tasksService.deleteTask({
      taskId,
      userId,
    });


    return res.status(200).json({
      success: true,
      message: "Task deleted successfully",
      data: task,
    });
  } catch (error) {
    console.error("Delete task error:", error);


    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to delete task",
    });
  }
};


// DELETE PROJECT CONTROLLER:


const deleteProject = async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Project ID must be a valid number",
      });
    }

    const project = await projectsService.deleteProject({
      projectId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Project deactivated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Delete project error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to deactivate project",
    });
  }
};


module.exports = {
  createTask,
  editTask,
  updateTaskStatus,
  getTasksByProject,
  getTasksByProjectMember,
  deleteTask
};