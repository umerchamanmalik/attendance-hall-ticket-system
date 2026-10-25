const express = require("express");
const router = express.Router();
const {
  getAllSemesters,
  getStudentsBySemester,
  promoteStudents,
  promoteAllStudents,
  getSemesterStats,
} = require("../controllers/semesterController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

// ✅ All routes require HOD role
router.use(protect);
router.use(authorizeRoles("HOD"));

// ✅ Get all semesters with counts
router.get("/", getAllSemesters);

// ✅ Get students for a specific semester
router.get("/:semester/students", getStudentsBySemester);

// ✅ Promote students from a specific semester
router.post("/:semester/promote", promoteStudents);

// ✅ Promote all students (bulk promotion)
router.post("/promote-all", promoteAllStudents);

// ✅ Get semester stats
router.get("/stats", getSemesterStats);

module.exports = router;
