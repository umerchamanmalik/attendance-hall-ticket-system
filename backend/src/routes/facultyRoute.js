// backend/src/routes/facultyRoute.js
const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const facultyController = require("../controllers/facultyController");

// ✅ All routes require authentication
router.use(protect);

// ============================================
// ✅ HOD ROUTES (Faculty Management)
// ============================================

// ✅ Get pending faculty (waiting for approval)
router.get(
  "/pending",
  authorizeRoles("HOD"),
  facultyController.getPendingFaculty,
);

// ✅ Get approved faculty
router.get(
  "/approved",
  authorizeRoles("HOD"),
  facultyController.getApprovedFaculty,
);

// ✅ Get faculty statistics
router.get("/stats", authorizeRoles("HOD"), facultyController.getFacultyStats);

// ✅ Approve/Reject faculty
router.put(
  "/:id/status",
  authorizeRoles("HOD"),
  [
    body("facultyStatus")
      .isIn(["approved", "rejected"])
      .withMessage("Status must be 'approved' or 'rejected'"),
    body("assignedRoleType")
      .optional()
      .isIn(["Faculty", "Mentor", "Both"])
      .withMessage("Role type must be 'Faculty', 'Mentor', or 'Both'"),
  ],
  facultyController.updateFacultyStatus,
);

// ============================================
// ✅ COMMON ROUTES
// ============================================

// ✅ Get faculty by email
router.get(
  "/email/:email",
  authorizeRoles("HOD", "Faculty"),
  facultyController.getFacultyByEmail,
);

// ✅ Get allocations for a specific faculty
router.get(
  "/:id/allocations",
  authorizeRoles("HOD", "Faculty"),
  facultyController.getFacultyAllocationsById,
);

module.exports = router;
