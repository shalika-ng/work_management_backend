const dashboardModel = require("../models/dashboard.model");

const getDashboard = async (userId) => {
  const user = await dashboardModel.findUserById(userId);

  if (!user) {
    throw new Error("User not found");
  }

  const taskStats = await dashboardModel.getTaskStats(userId);
  const workspace = await dashboardModel.getWorkspaceByUserId(userId);

  const now = new Date();

  return {
    date: now.toISOString().split("T")[0],
    time: now.toISOString().split("T")[1].split(".")[0],

    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      designation: user.designation,
      status: user.status,
    },

    task_stats: {
      completed_tasks: Number(taskStats.completed_tasks),
      overdue_tasks: Number(taskStats.overdue_tasks),
      due_today: Number(taskStats.due_today),
    },

    workspace: workspace
      ? {
          id: workspace.id,
          name: workspace.name,
        }
      : null,
  };
};

module.exports = {
  getDashboard,
};