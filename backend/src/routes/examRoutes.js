const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const examController = require("../controllers/examController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// All routes require authentication and HOD role
router.use(protect);
router.use(authorizeRoles("HOD"));

// ============================================
// ✅ SPECIFIC ROUTES FIRST (BEFORE ANY /:id routes)
// These must come before routes with :id parameter
// ============================================

// ✅ Get ALL hall tickets (for HOD overview)
router.get("/halltickets", examController.getAllHallTickets);

// ✅ HOD Override Hall Ticket
router.put(
  "/hallticket/:id/hod-override",
  examController.hodOverrideHallTicket,
);

// ✅ Get Hall Tickets for a specific Exam
router.get("/:examId/halltickets", examController.getExamHallTickets);

// ✅ NEW: Get Exam Statistics
router.get("/:id/stats", examController.getExamStats);

// ✅ NEW: Get Student Hall Ticket Status for an Exam
router.get(
  "/:examId/student/:studentId/status",
  examController.getStudentHallTicketStatus,
);

// ✅ NEW: Regenerate Hall Tickets (for date changes)
router.post("/:id/regenerate", examController.regenerateHallTickets);

// ✅ Refresh Exam Subjects from FacultyAllocation
router.put("/:id/refresh-subjects", examController.refreshExamSubjects);

// ============================================
// ✅ EXAM CRUD OPERATIONS
// ============================================

// ✅ Create Exam
router.post(
  "/",
  [
    body("examName").notEmpty().withMessage("Exam name is required"),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester")
      .isInt({ min: 1, max: 8 })
      .withMessage("Valid semester is required"),
    body("section").notEmpty().withMessage("Section is required"),
    body("startDate").isISO8601().withMessage("Valid start date is required"),
    body("endDate").isISO8601().withMessage("Valid end date is required"),
  ],
  examController.createExam,
);

// ✅ Get all Exams (with filters)
router.get("/", examController.getExams);

// ✅ Get single Exam by ID
router.get("/:id", examController.getExam);

// ✅ Update Exam (DRAFT: full update, GENERATED: dates only)
router.put("/:id", examController.updateExam);

// ✅ Delete Exam
router.delete("/:id", examController.deleteExam);

// ============================================
// ✅ SUBJECT MANAGEMENT (only for DRAFT exams)
// ============================================

// ✅ Add Subject to Exam
router.post("/:id/subjects", examController.addSubject);

// ✅ Remove Subject from Exam
router.delete("/:id/subjects", examController.removeSubject);

// ============================================
// ✅ HALL TICKET GENERATION
// ============================================

// ✅ Generate Hall Tickets for Exam
router.post("/:id/generate", examController.generateHallTickets);

module.exports = router;
