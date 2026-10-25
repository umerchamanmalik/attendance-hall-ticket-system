// backend/src/routes/examHallTicketRoutes.js
const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const examHallTicketController = require("../controllers/examHallTicketController");

// ============================================
// ✅ STUDENT ROUTES
// ============================================

router.get(
  "/student/my-hallticket",
  protect,
  authorizeRoles("Student"),
  examHallTicketController.getMyHallTicket,
);

router.get(
  "/student/download/:hallTicketId",
  protect,
  authorizeRoles("Student"),
  examHallTicketController.downloadHallTicket,
);

// ============================================
// ✅ MENTOR ROUTES
// ============================================

router.get(
  "/mentor/halltickets",
  protect,
  authorizeRoles("Mentor", "HOD", "Faculty"),
  examHallTicketController.getMentorHallTickets,
);

// ✅ Mentor review route (matches frontend)
router.put(
  "/mentor/review/:hallTicketId",
  protect,
  authorizeRoles("Mentor", "HOD", "Faculty"),
  examHallTicketController.reviewHallTicket,
);

// ✅ Mentor bulk approve - PREVIEW (dry run)
router.post(
  "/mentor/bulk-approve-preview",
  protect,
  authorizeRoles("Mentor", "HOD", "Faculty"),
  (req, res, next) => {
    req.body = { ...(req.body || {}), preview: true };
    next();
  },
  examHallTicketController.bulkApproveEligibleHallTickets,
);

// ✅ Mentor bulk approve - ACTUAL
router.post(
  "/mentor/bulk-approve-eligible",
  protect,
  authorizeRoles("Mentor", "HOD", "Faculty"),
  (req, res, next) => {
    req.body = { ...(req.body || {}), preview: false };
    next();
  },
  examHallTicketController.bulkApproveEligibleHallTickets,
);

// ============================================
// ✅ HOD ROUTES
// ============================================

router.get(
  "/hod/all",
  protect,
  authorizeRoles("HOD"),
  examHallTicketController.getAllHallTickets,
);

router.put(
  "/hod/force-approve/:hallTicketId",
  protect,
  authorizeRoles("HOD"),
  examHallTicketController.forceApproveHallTicket,
);

router.post(
  "/hod/generate/:examId",
  protect,
  authorizeRoles("HOD"),
  examHallTicketController.generateHallTicketsForExam,
);

router.post(
  "/hod/bulk-generate",
  protect,
  authorizeRoles("HOD"),
  examHallTicketController.bulkGenerateHallTickets,
);

router.get(
  "/hod/download/:hallTicketId",
  protect,
  authorizeRoles("HOD"),
  examHallTicketController.downloadHallTicket,
);

// ============================================
// ✅ FACULTY ROUTES
// ============================================

router.get(
  "/faculty/class",
  protect,
  authorizeRoles("Faculty", "HOD"),
  examHallTicketController.getHallTicketsByClass,
);

// ============================================
// ✅ GENERIC ROUTES
// ============================================

// ✅ Generic download route
router.get(
  "/:hallTicketId/download",
  protect,
  authorizeRoles("Student", "HOD", "Faculty", "Mentor"),
  examHallTicketController.downloadHallTicket,
);

// ✅ Generic mentor review route (backward compatibility)
router.put(
  "/:hallTicketId/mentor-review",
  protect,
  authorizeRoles("Mentor", "HOD", "Faculty"),
  examHallTicketController.reviewHallTicket,
);

module.exports = router;
