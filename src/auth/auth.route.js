const express = require("express");

const authController = require("./auth.controller");

const authMiddleware = require("../middleware/auth.middleware");

const router = express.Router();


// ==========================
// LOGIN
// ==========================

router.post(
  "/login",
  authController.login
);


// ==========================
// SIGNUP
// ==========================

router.post(
  "/signup",
  authController.signup
);


// ==========================
// CHANGE PASSWORD
// ==========================

router.put(
  "/change-password",
  authMiddleware,
  authController.changePassword
);

// ==========================
// LOGOUT
// ==========================
router.post(
  "/logout",
  authMiddleware,
  authController.logout
);
console.log("Auth routes loaded");

module.exports = router;