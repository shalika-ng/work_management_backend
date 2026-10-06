const projectsService = require("./projects.service");

const getProjects = async (req, res) => {
	try {
		const projects = await projectsService.getAllProjects();

		return res.status(200).json({
			success: true,
			message: "Projects fetched successfully",
			data: projects,
		});
	} catch (error) {
		console.error("Projects error:", error);

		return res.status(500).json({
			success: false,
			message: "Failed to fetch projects",
		});
	}
};

// CREATE PROJECT

const createProject = async (req, res) => {
  try {
    const { name, description, members } = req.body;

    // Validate project name
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    // Get logged-in user from JWT
    const userId = req.user.id;

    const project = await projectsService.createProject({
      name,
      description,
      members,
      userId,
    });

    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error) {
    console.error("Create project error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to create project",
    });
  }
};

// Edit Project

const editProject = async (req, res) => {
  try {
    const projectId = Number(req.params.id);

    const { name, description, members } = req.body;

    if (!projectId || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    const userId = req.user.id;

    const project = await projectsService.editProject({
      projectId,
      name,
      description,
      members,
      userId,
    });

    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    console.error("Edit project error:", error);

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to update project",
    });
  }
};

module.exports = {
  getProjects,
  createProject,
  editProject
};
