const projectsService = require("./projects.service");

const getProjects = async (req, res) => {
	try {
		const projects = await projectsService.getAllProjects(req.user.id);

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
    const { name, description, members, workspace_id } = req.body || {};

    // Validate project name
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (members !== undefined && !Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: "Members must be an array of user IDs",
      });
    }

    if (
      workspace_id !== undefined &&
      (!Number.isSafeInteger(Number(workspace_id)) ||
        Number(workspace_id) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Workspace ID must be a valid number",
      });
    }

    // Get logged-in user from JWT
    const userId = req.user.id;

    const project = await projectsService.createProject({
      name: name.trim(),
      description,
      members,
      workspaceId: workspace_id === undefined ? null : Number(workspace_id),
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

    const { name, description, members } = req.body || {};

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    if (members !== undefined && !Array.isArray(members)) {
      return res.status(400).json({
        success: false,
        message: "Members must be an array of user IDs",
      });
    }

    const userId = req.user.id;

    const project = await projectsService.editProject({
      projectId,
      name: name.trim(),
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

const createWorkspaceInvitation = async (req, res) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const { email } = req.body || {};

    if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required",
      });
    }

    const invitation = await projectsService.createWorkspaceInvitation({
      workspaceId,
      email,
      userId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Workspace invitation created; send the invitation token to the invitee",
      data: invitation,
    });
  } catch (error) {
    console.error("Create workspace invitation error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to create workspace invitation",
    });
  }
};

const createWorkspaceMember = async (req, res) => {
  try {
    const workspaceId = Number(req.params.workspaceId);
    const { name, email, password } = req.body || {};

    if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: "Member name is required",
      });
    }

    if (
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      return res.status(400).json({
        success: false,
        message: "A valid email address is required for login",
      });
    }

    if (typeof password !== "string" || !password) {
      return res.status(400).json({
        success: false,
        message: "A password is required",
      });
    }

    const member = await projectsService.createWorkspaceMember({
      workspaceId,
      name: name.trim(),
      email: email.trim(),
      password,
      adminUserId: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Workspace member created successfully",
      data: member,
    });
  } catch (error) {
    console.error("Create workspace member error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to create workspace member",
    });
  }
};

const getWorkspaceMembers = async (req, res) => {
  try {
    const workspaceId = Number(req.params.workspaceId);

    if (!Number.isSafeInteger(workspaceId) || workspaceId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid workspace ID",
      });
    }

    const members = await projectsService.getWorkspaceMembers({
      workspaceId,
      userId: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Workspace members fetched successfully",
      data: members,
    });
  } catch (error) {
    console.error("Get workspace members error:", error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.statusCode
        ? error.message
        : "Failed to fetch workspace members",
    });
  }
};

module.exports = {
  getProjects,
  createProject,
  editProject,
  createWorkspaceInvitation,
  createWorkspaceMember,
  getWorkspaceMembers,
};
