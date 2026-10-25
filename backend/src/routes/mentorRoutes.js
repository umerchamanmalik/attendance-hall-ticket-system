const express = require("express");
const router = express.Router();
const {
  getMentorSettings,
  toggleAttendanceVisibility,
} = require("../controllers/mentorController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// ✅ All routes require authentication and Mentor/Faculty role
router.use(protect);
router.use(authorizeRoles("Mentor", "Faculty"));

// ✅ Get mentor settings
router.get("/settings", getMentorSettings);

// ✅ Toggle attendance visibility for all mentees
router.put("/toggle-visibility", toggleAttendanceVisibility);

module.exports = router;
