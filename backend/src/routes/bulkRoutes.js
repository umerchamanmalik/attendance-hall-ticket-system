const express = require("express");
const router = express.Router();
const {
  downloadStudentTemplate,
  bulkUploadStudents,
  downloadSubjectTemplate,
  bulkUploadSubjects,
  downloadFacultyAllocationTemplate,
  bulkUploadFacultyAllocation,
  downloadHallTicketTemplate,
  bulkGenerateHallTickets,
} = require("../controllers/bulkController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const { uploadExcel } = require("../middleware/uploadExcel");

// All routes require HOD role
router.use(protect);
router.use(authorizeRoles("HOD"));

// ============================================
// STUDENT BULK UPLOAD
// ============================================
router.get("/template/students", downloadStudentTemplate);
router.post("/upload/students", uploadExcel.single("file"), bulkUploadStudents);

// ============================================
// SUBJECT BULK UPLOAD
// ============================================
router.get("/template/subjects", downloadSubjectTemplate);
router.post("/upload/subjects", uploadExcel.single("file"), bulkUploadSubjects);

// ============================================
// FACULTY ALLOCATION BULK UPLOAD
// ============================================
router.get("/template/faculty", downloadFacultyAllocationTemplate);
router.post(
  "/upload/faculty",
  uploadExcel.single("file"),
  bulkUploadFacultyAllocation,
);

// ============================================
// HALL TICKET BULK GENERATION
// ============================================
router.get("/template/halltickets", downloadHallTicketTemplate);
router.post(
  "/upload/halltickets",
  uploadExcel.single("file"),
  bulkGenerateHallTickets,
);

module.exports = router;
