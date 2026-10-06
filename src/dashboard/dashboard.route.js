const express = require("express");

const router = express.Router();

const dashboardController = require("./dashboard.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get(
  "/",
  authMiddleware,
  dashboardController.getDashboard
);

module.exports = router;