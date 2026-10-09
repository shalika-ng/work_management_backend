const express = require("express");
const cors = require("cors");

const authRoutes = require("./auth/auth.route");
const dashboardRoutes = require("./dashboard/dashboard.route");
const projectsRoutes = require("./projects/projects.route");
const tasksRoutes = require("./tasks/tasks.route");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Home route
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Server is running",
  });
});

// Auth routes
app.use("/api/auth", authRoutes);

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", projectsRoutes);

// Tasks routes
app.use("/api/tasks", tasksRoutes);

module.exports = app;