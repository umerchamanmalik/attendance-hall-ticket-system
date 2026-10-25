// backend/src/routes/authRoutes.js
const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  getProfile,
  checkRegistrationStatus,
  checkUserExists,
} = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

const router = express.Router();

// ============================================
// ✅ PUBLIC ROUTES
// ============================================

// ✅ 1. Register (Student/Faculty self-registration)
router.post(
  "/register",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .isIn(["Student", "Faculty"])
      .withMessage("Role must be Student or Faculty"),
    body("department").optional().isString().trim(),
  ],
  register,
);

// ✅ 2. Login
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  login,
);

// ✅ 3. Check registration status (before login)
router.get("/check-registration", checkRegistrationStatus);

// ✅ 4. Check if User exists (for self-registration)
router.get("/check-user", checkUserExists);

// ============================================
// ✅ PROTECTED ROUTES
// ============================================

// ✅ 5. Get user profile
router.get("/profile", protect, getProfile);

module.exports = router;
