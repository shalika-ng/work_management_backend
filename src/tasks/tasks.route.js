const express = require("express");

const tasksController = require("./tasks.controller");
const authMiddleware = require("../middleware/auth.middleware");
const taskUpload = require("../middleware/taskUpload.middleware");
const path = require("path"); 

const router = express.Router();

// CREATE TASK
router.post(
  "/create-task",
  authMiddleware,
  taskUpload.single("image"),
  tasksController.createTask
);

// EDIT TASK
router.patch(
  "/:taskId",
  authMiddleware,
  taskUpload.single("image"),
  tasksController.editTask
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

router.delete("/:taskId", authMiddleware, tasksController.deleteTask);

module.exports = router;