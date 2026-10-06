const dashboardService = require("./dashboard.service");

const getDashboard = async (req, res) => {
  try {
    const userId = req.user.id;

    const dashboard = await dashboardService.getDashboard(userId);

    return res.status(200).json({
      success: true,
      message: "Dashboard data fetched successfully",
      data: dashboard,
    });
  } catch (error) {
    console.error("Dashboard error:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Failed to fetch dashboard data",
    });
  }
};

module.exports = {
  getDashboard,
};