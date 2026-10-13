const express = require("express");

const projectsController = require("./projects.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/projects", authMiddleware, projectsController.getProjects);
router.get(
  "/projects/report-summary",
  authMiddleware,
  projectsController.getProjectReportSummary
);
router.get(
  "/projects/:projectId/members/:memberId/task-progress",
  authMiddleware,
  projectsController.getProjectMemberTaskProgress
);
router.post(
  "/create-project",
  authMiddleware,
  projectsController.createProject
);

router.put(
  "/edit-project/:id",
  authMiddleware,
  projectsController.editProject
);

router.post(
  "/workspaces/:workspaceId/invitations",
  authMiddleware,
  projectsController.createWorkspaceInvitation
);
router.post(
  "/workspaces/:workspaceId/members",
  authMiddleware,
  projectsController.createWorkspaceMember
);
router.get(
  "/workspaces/:workspaceId/members",
  authMiddleware,
  projectsController.getWorkspaceMembers
);

module.exports = router;