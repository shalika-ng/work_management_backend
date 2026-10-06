const authService = require("./auth.service");


// ==========================
// LOGIN
// ==========================

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate request body
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await authService.loginUser(
      email,
      password
    );

    return res.status(200).json({
      success: true,
      message: "Login successful",
      data: result,
    });

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================
// SIGNUP
// ==========================

const signup = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      workspace_name,
    } = req.body;

    // Validate request body
    if (
      !name ||
      !email ||
      !password ||
      !workspace_name
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Name, email, password and workspace name are required",
      });
    }

    const result = await authService.signupUser(
      name,
      email,
      password,
      workspace_name
    );

    return res.status(201).json({
      success: true,
      message: "Signup successful",
      data: result,
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================
// CHANGE PASSWORD
// ==========================

const changePassword = async (req, res) => {
  try {
    const {
      current_password,
      new_password,
    } = req.body;

    // Validate request body
    if (!current_password || !new_password) {
      return res.status(400).json({
        success: false,
        message:
          "Current password and new password are required",
      });
    }

    // Get logged-in user ID from JWT
    const userId = req.user.id;

    await authService.changePassword(
      userId,
      current_password,
      new_password
    );

    return res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });

  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};


// ==========================
// LOGOUT
// ==========================

const logout = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logout successful",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
module.exports = {
  login,
  signup,
  changePassword,
  logout,
};