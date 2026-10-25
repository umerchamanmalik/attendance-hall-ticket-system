const express = require("express");
const { body } = require("express-validator");
const {
  takeAttendance,
  getAttendanceHistory,
  getAssignedClasses,
  editAttendance,
  getAttendance, // ✅ Add this import
} = require("../controllers/attendanceController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ All routes require authentication
router.use(protect);

// ✅ GET / - Fetch attendance with filters (Faculty, Mentor, HOD)
router.get("/", authorizeRoles("Faculty", "Mentor", "HOD"), getAttendance);

// ✅ GET /classes - Get assigned classes
router.get(
  "/classes",
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getAssignedClasses,
);

// ✅ GET /history - Get attendance history
router.get(
  "/history",
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getAttendanceHistory,
);

// ✅ POST / - Take attendance
router.post(
  "/",
  authorizeRoles("Faculty", "Mentor"),
  [
    body("subjectName").notEmpty().withMessage("Subject name is required"),
    body("academicYear")
      .isIn(["First Year", "Second Year", "Third Year", "Final Year"])
      .withMessage("Invalid academic year"),
    body("semester").isInt({ min: 1, max: 8 }).withMessage("Invalid semester"),
    body("section").isIn(["A", "B", "C", "D"]).withMessage("Invalid section"),
    body("attendanceDate").isISO8601().withMessage("Valid date required"),
    body("attendance")
      .isArray({ min: 1 })
      .withMessage("Attendance items are required"),
  ],
  takeAttendance,
);

// ✅ PUT /:id - Edit attendance record
router.put("/:id", authorizeRoles("Faculty", "Mentor"), editAttendance);

module.exports = router;
