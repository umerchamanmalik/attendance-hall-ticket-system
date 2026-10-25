const express = require("express");
const { body } = require("express-validator");
const {
  createAllocation,
  getAllocations,
  getAllocation,
  updateAllocation,
  deleteAllocation,
  getFacultyUsers,
  deleteAllAllocations,
  getAllocationSummary,
  copyAllocationsFromPrevious,
  // ✅ NEW
  preCreateFaculty,
  getAllFacultyForHOD,
  deletePendingFaculty,
} = require("../controllers/facultyAllocationController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, authorizeRoles("HOD"));

// ============================================
// ✅ SPECIFIC ROUTES (must come BEFORE /:id)
// ============================================

// ✅ NEW: Pre-create faculty (before /users or /:id to avoid conflicts)
router.post(
  "/faculty/pre-create",
  [
    body("name").notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("department").notEmpty().withMessage("Department is required"),
    body("roleType").isIn(["Faculty", "Mentor", "Both"]),
  ],
  preCreateFaculty,
);

// ✅ NEW: Get all faculty (pending + approved)
router.get("/faculty/all", getAllFacultyForHOD);

// ✅ NEW: Delete pending (unclaimed) faculty
router.delete("/faculty/:id", deletePendingFaculty);

// ✅ Get Faculty Users (for allocation dropdown)
router.get("/users", getFacultyUsers);

// ✅ Get Allocation Summary by Semester
router.get("/summary", getAllocationSummary);

// ✅ Copy Allocations from Previous Semester
router.post(
  "/copy",
  [
    body("fromSemester").isInt({ min: 1, max: 8 }),
    body("toSemester").isInt({ min: 1, max: 8 }),
  ],
  copyAllocationsFromPrevious,
);

// ✅ Delete All Allocations (with optional filters)
router.delete("/all", deleteAllAllocations);

// ============================================
// ✅ ALLOCATION CRUD
// ============================================

router.post(
  "/",
  [
    body("academicYear").isIn([
      "First Year",
      "Second Year",
      "Third Year",
      "Final Year",
    ]),
    body("semester").isInt({ min: 1, max: 8 }),
    body("section").isIn(["A", "B", "C", "D"]),
    body("subjectName").notEmpty(),
    body("facultyName").notEmpty(),
    body("roleType").isIn(["Faculty", "Mentor", "Both"]),
  ],
  createAllocation,
);

router.get("/", getAllocations);

router.get("/:id", getAllocation);
router.put("/:id", updateAllocation);
router.delete("/:id", deleteAllocation);

module.exports = router;
