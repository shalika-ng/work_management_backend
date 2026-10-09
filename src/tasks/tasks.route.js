const express = require("express");

const tasksController = require("./tasks.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.post(
  "/create-task",
  authMiddleware,
  tasksController.createTask
);
router.patch(
  "/:taskId/status",
  authMiddleware,
  tasksController.updateTaskStatus
);

// Get all tasks by project ID
router.get(
  "/projects/:projectId/tasks",
  authMiddleware,
  tasksController.getTasksByProject
);
router.get(
  "/projects/:projectId/members/:memberId/tasks",
  authMiddleware,
  tasksController.getTasksByProjectMember
);

module.exports = router;