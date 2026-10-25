const express = require("express");
const { body, query } = require("express-validator");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const studentController = require("../controllers/studentController");

const router = express.Router();

// ============================================
// ⚠️ IMPORTANT: Specific routes MUST come BEFORE routes with :id parameters
// ============================================

// ✅ 1. Get mentor's mentees - MUST BE FIRST (BEFORE /:id)
router.get(
  "/mentor/mentees",
  protect,
  authorizeRoles("Mentor", "Faculty"),
  studentController.getMentorMentees,
);

// ✅ 1b. Alias used by the mentor dashboard UI
router.get(
  "/mentees",
  protect,
  authorizeRoles("Mentor", "Faculty"),
  studentController.getMentorMentees,
);

// ✅ 2. Search students
router.get(
  "/search",
  protect,
  authorizeRoles("HOD", "Faculty", "Mentor"),
  studentController.searchStudents,
);

// ✅ 3. Get mentors list
router.get(
  "/mentors/list",
  protect,
  authorizeRoles("HOD"),
  studentController.getMentors,
);

// ✅ 4. Get current student profile
router.get(
  "/me",
  protect,
  authorizeRoles("Student"),
  studentController.getCurrentStudentProfile,
);

// ============================================
// ✅ 5. Get students by class
// ============================================
router.get(
  "/class",
  protect,
  authorizeRoles("HOD", "Faculty", "Mentor"),
  [
    query("academicYear").notEmpty().withMessage("Academic year is required"),
    query("semester").notEmpty().withMessage("Semester is required"),
    query("section").notEmpty().withMessage("Section is required"),
  ],
  studentController.getStudentsByClass,
);

// Compatibility alias for older frontend calls
router.get(
  "/by-class",
  protect,
  authorizeRoles("HOD", "Faculty", "Mentor"),
  [
    query("academicYear").notEmpty().withMessage("Academic year is required"),
    query("semester").notEmpty().withMessage("Semester is required"),
    query("section").notEmpty().withMessage("Section is required"),
  ],
  studentController.getStudentsByClass,
);

// ✅ 6. Get all students - Generic route (can be anywhere)
router.get("/", protect, authorizeRoles("HOD"), studentController.getStudents);

// ============================================
// ✅ SELF-REGISTRATION ROUTES
// ============================================

// ✅ 7. Check if student exists (for self-registration)
router.get("/check-exists", studentController.checkStudentExists);

// ✅ 8. Mark student as registered (after successful registration)
router.put("/mark-registered", studentController.markStudentAsRegistered);

// ✅ 9. Verify registration token (email invitation flow - optional)
router.get(
  "/register/verify/:token",
  studentController.verifyRegistrationToken,
);

// ✅ 10. Complete registration (student sets password - email invitation flow)
router.post(
  "/register/complete",
  [
    body("token").notEmpty().withMessage("Registration token is required"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("confirmPassword")
      .notEmpty()
      .withMessage("Please confirm your password"),
  ],
  studentController.completeRegistration,
);

// ✅ 11. Resend registration email
router.post(
  "/register/resend",
  [body("email").isEmail().withMessage("Valid email is required")],
  studentController.resendRegistrationEmail,
);

// ✅ 12. Get unregistered students (HOD only)
router.get(
  "/register/unregistered",
  protect,
  authorizeRoles("HOD"),
  studentController.getUnregisteredStudents,
);

// ============================================
// ⚠️ :id routes MUST come AFTER all specific routes
// ============================================

// ✅ 13. Get student by ID - MUST BE AFTER all specific routes
router.get(
  "/:id",
  protect,
  authorizeRoles("HOD", "Faculty", "Mentor"),
  studentController.getStudent,
);

// ✅ 14. Add new student
router.post(
  "/",
  protect,
  authorizeRoles("HOD"),
  [
    body("studentName").notEmpty().withMessage("Student name is required"),
    body("rollNumber").notEmpty().withMessage("Roll number is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    body("academicYear").notEmpty().withMessage("Academic year is required"),
    body("semester").isNumeric().withMessage("Semester must be a number"),
    body("section").notEmpty().withMessage("Section is required"),
    body("mentorName").notEmpty().withMessage("Mentor name is required"),
  ],
  studentController.addStudent,
);

// ✅ 15. Update student
router.put(
  "/:id",
  protect,
  authorizeRoles("HOD"),
  studentController.updateStudent,
);

// ✅ 16. Delete student
router.delete(
  "/:id",
  protect,
  authorizeRoles("HOD"),
  studentController.deleteStudent,
);

// ✅ 17. Update attendance visibility
router.put(
  "/:id/attendance-visibility",
  protect,
  authorizeRoles("Mentor", "Faculty"),
  [
    body("attendanceVisibility")
      .isIn(["Show Percentage", "Hide Percentage"])
      .withMessage("Invalid visibility option"),
  ],
  studentController.updateAttendanceVisibility,
);

// ============================================
// Student Profile Routes
// ============================================

// ✅ 18. Get student profile
router.get(
  "/profile/me",
  protect,
  authorizeRoles("Student"),
  studentController.getStudentProfile,
);

// ✅ 19. Update student profile
router.put(
  "/profile/me",
  protect,
  authorizeRoles("Student"),
  studentController.updateStudentProfile,
);

// ✅ 20. Upload student photo
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "uploads/students");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `student-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = filetypes.test(file.mimetype);
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"));
    }
  },
}).single("photo");

router.post(
  "/profile/photo",
  protect,
  authorizeRoles("Student"),
  (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        return res.status(400).json({ success: false, error: err.message });
      }
      next();
    });
  },
  studentController.uploadStudentPhoto,
);

// ✅ 21. Delete student photo
router.delete(
  "/profile/photo",
  protect,
  authorizeRoles("Student"),
  studentController.deleteStudentPhoto,
);

// ============================================
// Student Attendance Routes
// ============================================

// ✅ 22. Get student attendance details
router.get(
  "/:studentId/attendance",
  protect,
  authorizeRoles("HOD", "Faculty", "Mentor"),
  studentController.getStudentAttendanceDetails,
);

// ============================================
// ✅ Attendance Progress Tracker Routes
// ============================================

// ✅ 23. Get attendance progress for a student
router.get(
  "/attendance-progress/:studentId",
  protect,
  studentController.getAttendanceProgress,
);

// ✅ 24. Get attendance trend (last 30 days)
router.get(
  "/attendance-trend/:studentId",
  protect,
  studentController.getAttendanceTrend,
);

// ✅ 25. Get safe to skip calculation
router.get(
  "/safe-to-skip/:studentId",
  protect,
  studentController.getSafeToSkip,
);

// ✅ 26. Get subject details with attendance history
router.get(
  "/subject-details/:studentId/:subjectId",
  protect,
  studentController.getSubjectDetails,
);

// ✅ 27. Toggle attendance progress visibility (Mentor only)
router.put(
  "/toggle-attendance-progress/:studentId",
  protect,
  authorizeRoles("Mentor", "Faculty"),
  studentController.toggleAttendanceProgress,
);

// ✅ 28. Get student analytics (enhanced attendance data)
router.get(
  "/analytics/:studentId",
  protect,
  studentController.getStudentAnalytics,
);

// ✅ 29. Debug route
router.get("/debug/user", protect, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        user: req.user,
        email: req.user?.email,
        name: req.user?.name,
        role: req.user?.role,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
