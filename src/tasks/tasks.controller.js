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

module.exports = {
  createTask,
  updateTaskStatus,
  getTasksByProject,
  getTasksByProjectMember,

};