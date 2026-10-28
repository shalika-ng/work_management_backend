const express = require("express");
const cors = require("cors");
const path = require("path");
const authRoutes = require("./auth/auth.route");
const dashboardRoutes = require("./dashboard/dashboard.route");
const projectsRoutes = require("./projects/projects.route");
const tasksRoutes = require("./tasks/tasks.route");
const chatRoutes = require("./chat/chat.route");

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

app.use(
  "/uploads/tasks",
  express.static(
    path.join(process.cwd(), "uploads", "tasks")
  )
);

// Auth routes
app.use("/api/auth", authRoutes);

// Dashboard routes
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", projectsRoutes);

// Tasks routes
app.use("/api/tasks", tasksRoutes);
app.use("/api/chat", chatRoutes);

module.exports = app;