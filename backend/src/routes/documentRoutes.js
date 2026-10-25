const express = require("express");
const { body } = require("express-validator");
const {
  uploadDocument,
  getDocuments,
  getDocumentById,
  editDocument,
  deleteDocument,
  getDocumentsForReview,
  getMentorDocuments,
  reviewDocument,
  getDocumentStats,
  getFacultyDocuments,
  confirmAttendanceCorrection,
  getAllDocuments,
  getFacultyDocumentStats, // ✅ ADDED
} = require("../controllers/documentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const {
  uploadDocument: uploadMiddleware,
} = require("../middleware/uploadMiddleware");
const Document = require("../models/Document");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Subject = require("../models/Subject");

const VALID_DOCUMENT_TYPES = [
  "leave",
  "attendance-correction",
  "Medical Certificate",
  "Leave Application",
  "Attendance Justification",
  "Attendance Correction",
  "Other",
];

const router = express.Router();

// ============================================
// ✅ SPECIFIC ROUTES FIRST (no :id parameters)
// ============================================

// Get subjects available for the signed-in student
router.get("/subjects", protect, async (req, res, next) => {
  try {
    console.log("🔍 [Subjects API] Getting subjects for user:", req.user.email);

    let student;
    if (req.user.email) {
      student = await Student.findOne({ email: req.user.email });
    }

    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    // ✅ Normalize student department
    const studentDept = (student.department || "CS")
      .toString()
      .trim()
      .toUpperCase();

    console.log(
      `📋 Student: ${student.studentName} | Dept: ${studentDept} | Sem: ${student.semester} | Sec: ${student.section}`,
    );

    // ✅ Build department filter (with CS fallback for legacy data)
    let deptFilter;
    if (studentDept === "CS") {
      deptFilter = {
        $or: [
          { department: "CS" },
          { department: { $exists: false } },
          { department: null },
          { department: "" },
        ],
      };
    } else {
      deptFilter = { department: studentDept };
    }

    // ✅ Filter by department + semester + section
    const allocations = await FacultyAllocation.find({
      ...deptFilter,
      semester: student.semester,
      section: student.section,
    });

    console.log(
      `📊 Found ${allocations.length} allocations for ${studentDept} Sem ${student.semester} Sec ${student.section}`,
    );

    // ✅ FIXED: Only return subjects with REAL Subject._id
    const subjects = [];

    for (const allocation of allocations) {
      let realSubject = null;

      // 1️⃣ Try allocation.subjectId
      if (allocation.subjectId) {
        try {
          realSubject = await Subject.findById(allocation.subjectId).select(
            "subjectName subjectCode",
          );
        } catch (err) {
          // Invalid ObjectId format — skip
        }
      }

      // 2️⃣ Fallback: lookup by subjectName + sem + section
      if (!realSubject && allocation.subjectName) {
        realSubject = await Subject.findOne({
          subjectName: allocation.subjectName,
          semester: student.semester,
          section: student.section,
        }).select("subjectName subjectCode");
      }

      // ✅ Skip if no real Subject
      if (!realSubject) {
        console.log(
          `⚠️ Skipping orphaned allocation: "${allocation.subjectName}" (sem ${student.semester}, sec ${student.section})`,
        );
        continue;
      }

      subjects.push({
        subjectId: {
          _id: realSubject._id,
          name: realSubject.subjectName,
          code: realSubject.subjectCode || "",
        },
        subjectName: realSubject.subjectName,
      });
    }

    // ✅ Add manual subjects from exam ONLY if a real Subject exists
    try {
      const Exam = require("../models/Exam");
      const recentExam = await Exam.findOne({
        ...deptFilter,
        semester: student.semester,
        section: student.section,
      }).sort({ createdAt: -1 });

      if (recentExam && recentExam.subjects) {
        const existingNames = new Set(
          subjects.map((s) => (s.subjectName || "").trim().toLowerCase()),
        );

        for (const subjectName of recentExam.subjects) {
          const key = (subjectName || "").trim().toLowerCase();
          if (!key || existingNames.has(key)) continue;

          const realSubject = await Subject.findOne({
            subjectName: subjectName,
            semester: student.semester,
            section: student.section,
          }).select("subjectName subjectCode");

          if (realSubject) {
            subjects.push({
              subjectId: {
                _id: realSubject._id,
                name: realSubject.subjectName,
                code: realSubject.subjectCode || "",
              },
              subjectName: realSubject.subjectName,
            });
            existingNames.add(key);
          }
        }
      }
    } catch (e) {
      console.log("ℹ️ Could not fetch manual subjects:", e.message);
    }

    console.log(`✅ /subjects returning ${subjects.length} real subjects`);

    res.json({ success: true, data: subjects });
  } catch (error) {
    console.error("❌ [Subjects API] Error:", error);
    next(error);
  }
});

// ============================================
// ✅ MENTOR ROUTES (specific paths)
// ============================================

// Get Documents for Review
router.get(
  "/review",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  getDocumentsForReview,
);

// Get Mentor Documents (pending)
router.get(
  "/mentor-documents",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  getMentorDocuments,
);

// Get Mentor Documents by mentorId
router.get(
  "/mentor/:mentorId",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  getMentorDocuments,
);

// Get Document Stats for Mentor Dashboard
router.get(
  "/stats",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  getDocumentStats,
);

// ============================================
// ✅ ROUTE: Check Prior Permission
// ✅ FIXED: Use day-boundary matching to avoid timezone drift
// ✅ FIXED: Removed submittedDate check for attendance corrections
// ============================================

router.get(
  "/check-prior-permission/:documentId",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  async (req, res, next) => {
    try {
      const { documentId } = req.params;

      const document = await Document.findById(documentId);
      if (!document) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      // ✅ FIXED: Collect all correction dates (array OR single attendanceDate)
      const absenceDates = [];
      if (document.dates && document.dates.length > 0) {
        document.dates.forEach((d) => absenceDates.push(new Date(d)));
      } else if (document.attendanceDate) {
        absenceDates.push(new Date(document.attendanceDate));
      }

      if (absenceDates.length === 0) {
        return res.json({
          success: true,
          data: {
            hasPriorPermission: false,
            message: "No absence dates to check",
            details: [],
          },
        });
      }

      // ✅ Find all approved leave applications for this student
      const leaveApplications = await Document.find({
        studentId: document.studentId,
        documentType: "leave",
        status: { $in: ["mentor-approved", "completed"] },
        leaveStartDate: { $ne: null },
        leaveEndDate: { $ne: null },
      });

      const details = [];
      let hasPriorPermission = false;

      absenceDates.forEach((absenceDate) => {
        // ✅ FIXED: Normalize both sides to UTC day boundaries
        const absenceDayStart = new Date(absenceDate);
        absenceDayStart.setUTCHours(0, 0, 0, 0);
        const absenceDayEnd = new Date(absenceDate);
        absenceDayEnd.setUTCHours(23, 59, 59, 999);

        leaveApplications.forEach((leave) => {
          const leaveStart = new Date(leave.leaveStartDate);
          leaveStart.setUTCHours(0, 0, 0, 0);
          const leaveEnd = new Date(leave.leaveEndDate);
          leaveEnd.setUTCHours(23, 59, 59, 999);

          // ✅ FIXED: Compare by day boundaries only (no submittedDate check)
          if (absenceDayStart >= leaveStart && absenceDayEnd <= leaveEnd) {
            details.push({
              date: absenceDate,
              leaveStartDate: leave.leaveStartDate,
              leaveEndDate: leave.leaveEndDate,
              submittedAt: leave.submittedAt,
              description: leave.description,
              documentId: leave._id,
            });
            hasPriorPermission = true;
          }
        });
      });

      res.json({
        success: true,
        data: {
          hasPriorPermission,
          message: hasPriorPermission
            ? "✅ Student had prior permission for these dates"
            : "❌ No prior permission found for the specified dates",
          details,
        },
      });
    } catch (error) {
      console.error("Error checking prior permission:", error);
      next(error);
    }
  },
);

// ============================================
// ✅ FACULTY ROUTES (specific paths)
// ============================================

// Get Faculty Pending Documents
router.get(
  "/faculty-pending",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getFacultyDocuments,
);

// Get Faculty Documents by facultyId
router.get(
  "/faculty/:facultyId",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getFacultyDocuments,
);

// Legacy route for faculty documents
router.get(
  "/faculty-documents",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getFacultyDocuments,
);

// ✅ ADDED: Faculty-specific stats
router.get(
  "/faculty-stats",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  getFacultyDocumentStats,
);

// ============================================
// ✅ STUDENT ROUTES (specific paths first)
// ============================================

// Create/Upload Document
router.post(
  "/",
  protect,
  authorizeRoles("Student"),
  uploadMiddleware.single("file"),
  [
    body("documentType").isIn(VALID_DOCUMENT_TYPES),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  uploadDocument,
);

// Edit Document (Student - only if pending)
router.put(
  "/edit/:id",
  protect,
  authorizeRoles("Student"),
  [
    body("documentType").optional().isIn(VALID_DOCUMENT_TYPES),
    body("description")
      .optional()
      .notEmpty()
      .withMessage("Description is required"),
  ],
  editDocument,
);

// Delete Document (Student - only if pending)
router.delete(
  "/delete/:id",
  protect,
  authorizeRoles("Student", "Mentor", "Faculty", "HOD"),
  deleteDocument,
);

// ============================================
// ✅ GET ALL DOCUMENTS - MUST BE BEFORE /:id
// ============================================

// Get Student's Documents
router.get("/", protect, getDocuments);

// ============================================
// ✅ ADMIN ROUTES (specific paths)
// ============================================

// Get All Documents (Admin only)
router.get(
  "/admin/all",
  protect,
  authorizeRoles("Admin", "HOD"),
  getAllDocuments,
);

// Get All Documents (legacy)
router.get("/all", protect, authorizeRoles("Admin", "HOD"), getAllDocuments);

// ============================================
// ✅ DYNAMIC ROUTES (with :id) - MUST BE LAST
// ============================================

// Get Single Document by ID
router.get("/:id", protect, getDocumentById);

// Faculty Confirm/Review routes (with :id)
router.put(
  "/faculty-review/:id",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  confirmAttendanceCorrection,
);

// Legacy confirm route
router.put(
  "/faculty-confirm/:id",
  protect,
  authorizeRoles("Faculty", "Mentor", "HOD"),
  confirmAttendanceCorrection,
);

// Review Document (Mentor approve/reject)
router.put(
  "/review/:id",
  protect,
  authorizeRoles("Mentor", "Faculty", "HOD"),
  reviewDocument,
);

// Legacy edit route (keeping for backward compatibility)
router.put(
  "/:id",
  protect,
  authorizeRoles("Student"),
  [
    body("documentType").isIn(VALID_DOCUMENT_TYPES),
    body("description").notEmpty().withMessage("Description is required"),
  ],
  async (req, res, next) => {
    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      const student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found" });
      }

      if (document.studentId.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized to edit this document",
        });
      }

      if (document.status !== "Pending" && document.status !== "pending") {
        return res.status(400).json({
          success: false,
          error:
            "Cannot edit document that is already reviewed. Status: " +
            document.status,
        });
      }

      document.documentType = req.body.documentType;
      document.description = req.body.description;
      await document.save();

      res.json({
        success: true,
        message: "Document updated successfully",
        data: document,
      });
    } catch (error) {
      next(error);
    }
  },
);

// Legacy delete route (keeping for backward compatibility)
router.delete(
  "/:id",
  protect,
  authorizeRoles("Student", "Mentor", "Faculty", "HOD"),
  async (req, res, next) => {
    try {
      const document = await Document.findById(req.params.id);
      if (!document) {
        return res
          .status(404)
          .json({ success: false, error: "Document not found" });
      }

      const student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found" });
      }

      if (document.studentId.toString() !== student._id.toString()) {
        return res.status(403).json({
          success: false,
          error: "Unauthorized to delete this document",
        });
      }

      if (document.status !== "Pending" && document.status !== "pending") {
        return res.status(400).json({
          success: false,
          error:
            "Cannot delete document that is already reviewed. Status: " +
            document.status,
        });
      }

      const fs = require("fs");
      const path = require("path");
      if (document.fileName) {
        const filePath = path.join(
          process.cwd(),
          "uploads/documents",
          document.fileName,
        );
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log("🗑️ Deleted file:", filePath);
        }
      }

      await document.deleteOne();

      res.json({
        success: true,
        message: "Document deleted successfully",
      });
    } catch (error) {
      next(error);
    }
  },
);

module.exports = router;
