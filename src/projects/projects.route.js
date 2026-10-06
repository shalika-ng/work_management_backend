const express = require("express");

const projectsController = require("./projects.controller");
const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();

router.get("/projects", authMiddleware, projectsController.getProjects);
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

module.exports = router;