const Document = require("../models/Document");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const FacultyAllocation = require("../models/FacultyAllocation");
const Subject = require("../models/Subject");
const User = require("../models/User");
const mongoose = require("mongoose");
const {
  getDepartmentFilter,
  getDepartmentCode,
} = require("../utils/departmentHelper");
const { createNotification } = require("./notificationController");
// ✅ ADDED: Import hall ticket sync service
const {
  syncStudentHallTickets,
} = require("../services/hallTicketAttendanceSync");

const safeCreateStudentNotification = async (payload) => {
  if (!payload || !payload.recipientId) return;

  try {
    await createNotification(payload);
  } catch (error) {
    console.error("❌ Notification creation failed:", error.message);
  }
};

// ============================================
// Helper Functions
// ============================================

const normalizeDocumentType = (value) => {
  const map = {
    leave: "leave",
    "leave-application": "leave",
    "Leave Application": "leave",
    "attendance-correction": "attendance-correction",
    "attendance correction": "attendance-correction",
    "Attendance Correction": "attendance-correction",
    "Medical Certificate": "attendance-correction",
    "Attendance Justification": "attendance-correction",
    Other: "Other",
  };
  return map[value] || value || "Other";
};

const isLeaveDocument = (documentType) =>
  normalizeDocumentType(documentType) === "leave";
const isAttendanceCorrectionDocument = (documentType) =>
  normalizeDocumentType(documentType) === "attendance-correction";

const resolveAttendanceUpdateTargets = (document, allocations = []) => {
  let subjectIds = [];
  const subjectObjects = Array.isArray(document.subjects)
    ? document.subjects
    : [];

  if (subjectObjects.length > 0) {
    subjectIds = subjectObjects
      .map((subject) => {
        if (!subject) return null;
        if (typeof subject === "string") return subject;
        return subject._id || subject.id || subject;
      })
      .filter(Boolean);
  } else if (allocations.length > 0) {
    subjectIds = allocations.map((allocation) => allocation.subjectId);
  }

  // ✅ FIXED: Use subjectName (Subject model's actual field), fall back to name
  const subjectNames = subjectObjects
    .map((s) => s.subjectName || s.name || s)
    .filter(Boolean);

  const datesToUpdate =
    document.dates && document.dates.length > 0
      ? document.dates.map((date) => new Date(date))
      : [document.attendanceDate].filter(Boolean);

  return {
    subjectIds,
    subjectNames,
    datesToUpdate,
  };
};

const parseDates = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value
      .filter(Boolean)
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()));
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((date) => date.trim())
      .filter(Boolean)
      .map((date) => new Date(date))
      .filter((date) => !Number.isNaN(date.getTime()));
  }

  const singleDate = new Date(value);
  return Number.isNaN(singleDate.getTime()) ? [] : [singleDate];
};

const normalizeReviewDecision = (value) => {
  if (typeof value !== "string") return null;

  const normalized = value.trim().toLowerCase();
  if (["approved", "approve"].includes(normalized)) return "Approved";
  if (["rejected", "reject"].includes(normalized)) return "Rejected";
  return null;
};

// ============================================
// STUDENT DOCUMENT OPERATIONS
// ============================================

const uploadDocument = async (req, res, next) => {
  try {
    const {
      studentId: providedStudentId,
      documentType,
      description,
      attendanceDate,
      leaveStartDate,
      leaveEndDate,
      priorPermission,
      dates,
      subjects,
    } = req.body;

    const normalizedType = normalizeDocumentType(documentType);
    const isLeave = isLeaveDocument(normalizedType);
    const isAttendanceCorrection =
      isAttendanceCorrectionDocument(normalizedType);

    const hasFile = Boolean(req.file);

    let student = null;
    let studentId = providedStudentId;

    if (req.user.role === "Student") {
      student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found" });
      }
      studentId = student._id;
    } else {
      student = await Student.findById(studentId);
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student not found" });
      }
    }

    const attendanceDateValue =
      attendanceDate || (Array.isArray(dates) ? dates[0] : dates);

    const documentData = {
      studentId,
      department: student.department || getDepartmentCode(req, "CS"),
      mentorId: student?.mentorId || null,
      documentType: normalizedType,
      description: description || "",
      fileName: hasFile ? req.file.filename : null,
      filePath: hasFile ? req.file.path : null,
      status: "pending",
      statusDisplay: "Pending Mentor Review",
      overallStatus: "Pending Mentor Review",
      mentorStatus: "Pending",
      facultyStatus: "Pending",
      priorPermission: priorPermission === true || priorPermission === "true",
      isEdited: false,
      editHistory: [],
    };

    if (isLeave) {
      documentData.leaveStartDate = leaveStartDate
        ? new Date(leaveStartDate)
        : null;
      documentData.leaveEndDate = leaveEndDate ? new Date(leaveEndDate) : null;
      documentData.dates = [];
    }

    if (isAttendanceCorrection) {
      let subjectIds = [];
      if (subjects) {
        if (Array.isArray(subjects)) {
          subjectIds = subjects;
        } else if (typeof subjects === "string") {
          subjectIds = subjects.split(",").filter(Boolean);
        }
      }

      console.log(
        `📥 Received ${subjectIds.length} subject IDs from frontend:`,
        subjectIds,
      );

      // ✅ FIXED: Validate each ID is a real Subject._id (with dedup + logging)
      const validSubjectIds = [];
      const seenIds = new Set();

      for (const sid of subjectIds) {
        const sidStr = String(sid).trim();

        if (seenIds.has(sidStr)) {
          console.log(`⏭️ Skipping duplicate: ${sidStr}`);
          continue;
        }
        seenIds.add(sidStr);

        if (!mongoose.Types.ObjectId.isValid(sidStr)) {
          console.log(`⚠️ Skipping invalid ObjectId format: ${sidStr}`);
          continue;
        }

        const exists = await Subject.findById(sidStr).select("_id subjectName");
        if (exists) {
          console.log(`✅ Valid subject: ${sidStr} → ${exists.subjectName}`);
          validSubjectIds.push(sidStr);
        } else {
          console.log(`⚠️ Skipping orphaned subject ID: ${sidStr}`);
        }
      }

      // ✅ ADDED: Reject if student selected subjects but NONE validated
      if (subjectIds.length > 0 && validSubjectIds.length === 0) {
        return res.status(400).json({
          success: false,
          error:
            "None of the selected subjects are valid. Please refresh the page and try again.",
        });
      }

      // ✅ If "All Subjects" was selected (empty), expand to ALL real subjects
      //    from FacultyAllocation for the student's sem/section/dept.
      if (validSubjectIds.length === 0) {
        console.log("📊 Expanding 'All Subjects' selection...");
        const allocations = await FacultyAllocation.find({
          semester: student.semester,
          section: student.section,
          ...(student.department
            ? { department: student.department.toUpperCase() }
            : {}),
        }).select("subjectId subjectName");

        for (const allocation of allocations) {
          let realSubject = null;

          // 1️⃣ Try allocation.subjectId
          if (allocation.subjectId) {
            try {
              realSubject = await Subject.findById(allocation.subjectId).select(
                "_id subjectName",
              );
            } catch (err) {
              // Invalid format — try name fallback below
            }
          }

          // 2️⃣ Fallback: lookup by subjectName + sem + section
          if (!realSubject && allocation.subjectName) {
            realSubject = await Subject.findOne({
              subjectName: allocation.subjectName,
              semester: student.semester,
              section: student.section,
            }).select("_id subjectName");
          }

          if (realSubject) {
            validSubjectIds.push(realSubject._id.toString());
          } else {
            console.log(
              `⚠️ Skipping allocation with no real Subject: "${allocation.subjectName}"`,
            );
          }
        }

        // Deduplicate
        const unique = [...new Set(validSubjectIds)];
        validSubjectIds.length = 0;
        validSubjectIds.push(...unique);

        console.log(
          `✅ Expanded "All Subjects" to ${validSubjectIds.length} real subjects`,
        );
      }

      documentData.subjects = validSubjectIds;
      documentData.attendanceDate = attendanceDateValue
        ? new Date(attendanceDateValue)
        : null;
      documentData.dates = parseDates(dates || attendanceDateValue);
      documentData.correctionType = "Absent to Present";

      // ✅ Build subjectApprovals array (one entry per subject)
      const subjectApprovals = [];
      for (const sid of validSubjectIds) {
        const subj = await Subject.findById(sid).select("_id subjectName");
        if (subj) {
          subjectApprovals.push({
            subjectId: subj._id,
            subjectName: subj.subjectName,
            facultyId: null,
            facultyName: null,
            status: "Pending",
            remarks: "",
            reviewedAt: null,
          });
        }
      }
      documentData.subjectApprovals = subjectApprovals;
      console.log(
        `✅ Initialized ${subjectApprovals.length} subject approval entries`,
      );
    }

    const document = await Document.create(documentData);

    // ✅ ADDED: Notify the student's Mentor about the new document
    try {
      const mentorUser = student.mentorId
        ? await User.findById(student.mentorId).select("_id name role")
        : student.mentorName
          ? await User.findOne({
              name: student.mentorName,
              role: { $in: ["Mentor", "Faculty"] },
            }).select("_id name role")
          : null;

      if (mentorUser?._id) {
        const docLabel = isLeave
          ? "leave application"
          : "attendance correction";

        await safeCreateStudentNotification({
          recipientId: mentorUser._id,
          recipientRole: mentorUser.role || "Mentor",
          department: student.department || document.department || "CS",
          senderId: student._id,
          senderName: student.studentName,
          senderRole: "Student",
          title: isLeave
            ? "📄 New Leave Application"
            : "📋 New Attendance Correction",
          message: `${student.studentName} (${student.rollNumber}) submitted a ${docLabel} awaiting your review.`,
          type: "document_status",
          priority: "normal",
          actionUrl: "/mentor/documents",
          actionText: "Review Document",
          relatedId: document._id,
          relatedModel: "Document",
        });
        console.log(`🔔 Notified mentor ${mentorUser.name} about new document`);
      } else {
        console.log(
          `⚠️ No mentor User found for student ${student.studentName}`,
        );
      }
    } catch (notifyErr) {
      console.error("❌ Failed to notify mentor:", notifyErr.message);
    }

    res.status(201).json({ success: true, data: document });
  } catch (error) {
    console.error("Upload error:", error);
    next(error);
  }
};

// Get Student's Documents
const getDocuments = async (req, res, next) => {
  try {
    const { studentId, status, documentType } = req.query;
    const query = { ...getDepartmentFilter(req) };

    console.log("🔍 [getDocuments] User:", req.user.email);

    if (studentId) query.studentId = studentId;
    if (status) query.status = status;
    if (documentType) query.documentType = normalizeDocumentType(documentType);

    if (req.user.role === "Student" && !studentId) {
      const student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found" });
      }
      query.studentId = student._id;
    }

    const documents = await Document.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section",
      )
      // ✅ FIXED: Use subjectName subjectCode (Subject model's real fields)
      .populate("subjects", "subjectName subjectCode")
      .sort({ uploadDate: -1 });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error("❌ [getDocuments] Error:", error);
    next(error);
  }
};

// Get Single Document by ID
const getDocumentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    const document = await Document.findOne({
      _id: id,
      ...getDepartmentFilter(req),
    })
      .populate("studentId", "studentName rollNumber email semester section")
      // ✅ FIXED
      .populate("subjects", "subjectName subjectCode")
      .populate("mentorReviewedBy", "name email")
      .populate("facultyReviewedBy", "name email");

    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    res.json({ success: true, data: document });
  } catch (error) {
    next(error);
  }
};

// Edit Document (Student - only if pending)
const editDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { description, subjects, dates, leaveStartDate, leaveEndDate } =
      req.body;

    const document = await Document.findOne({
      _id: id,
      ...getDepartmentFilter(req),
    });
    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    if (document.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Document cannot be edited as it has already been reviewed",
      });
    }

    const changes = {};

    if (description && description !== document.description) {
      changes.description = { old: document.description, new: description };
      document.description = description;
    }

    if (isAttendanceCorrectionDocument(document.documentType)) {
      if (subjects) {
        let subjectIds = [];
        if (Array.isArray(subjects)) {
          subjectIds = subjects;
        } else if (typeof subjects === "string") {
          subjectIds = subjects.split(",").filter(Boolean);
        }
        changes.subjects = { old: document.subjects, new: subjectIds };
        document.subjects = subjectIds;
      }
      if (dates) {
        const parsedDates = parseDates(dates);
        changes.dates = { old: document.dates, new: parsedDates };
        document.dates = parsedDates;
      }
    }

    if (isLeaveDocument(document.documentType)) {
      if (leaveStartDate) {
        const newDate = new Date(leaveStartDate);
        changes.leaveStartDate = { old: document.leaveStartDate, new: newDate };
        document.leaveStartDate = newDate;
      }
      if (leaveEndDate) {
        const newDate = new Date(leaveEndDate);
        changes.leaveEndDate = { old: document.leaveEndDate, new: newDate };
        document.leaveEndDate = newDate;
      }
    }

    document.editHistory.push({
      editedAt: new Date(),
      changes: changes,
      editedBy: req.user.id || req.user._id,
    });
    document.isEdited = true;

    await document.save();

    res.json({
      success: true,
      message: "Document updated successfully",
      data: document,
    });
  } catch (error) {
    console.error("Edit error:", error);
    next(error);
  }
};

const deleteDocument = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log("🔍 [deleteDocument] Document ID:", id);
    console.log("🔍 [deleteDocument] User:", req.user?.name, req.user?.role);

    const document = await Document.findOne({
      _id: id,
      ...getDepartmentFilter(req),
    });
    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    const isStudent = req.user.role === "Student";
    const isAuthorizedRole = ["Mentor", "Faculty", "HOD"].includes(
      req.user.role,
    );

    if (isStudent && document.status !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Document cannot be deleted as it has already been reviewed",
      });
    }

    if (!isStudent && !isAuthorizedRole) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to delete this document",
      });
    }

    if (document.fileName) {
      const fs = require("fs");
      const path = require("path");
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
    console.error("❌ [deleteDocument] Error:", error);
    next(error);
  }
};

// ============================================
// MENTOR DOCUMENT OPERATIONS
// ============================================

// Get Documents for Review
const getDocumentsForReview = async (req, res, next) => {
  try {
    const { status } = req.query;

    const mentorName = req.user.name || req.user.username;

    if (!mentorName) {
      return res.json({ success: true, data: [] });
    }

    const mentees = await Student.find({
      ...getDepartmentFilter(req),
      mentorName: { $regex: new RegExp("^" + mentorName + "$", "i") },
    }).select("_id");

    const menteeIds = mentees.map((mentee) => mentee._id);

    if (menteeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const query = {
      ...getDepartmentFilter(req),
      studentId: { $in: menteeIds },
    };

    if (status && status !== "all") {
      query.status = status.toLowerCase();
    }

    const documents = await Document.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section",
      )
      // ✅ FIXED
      .populate("subjects", "subjectName subjectCode")
      .sort({ uploadDate: -1 });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error("❌ [getDocumentsForReview] Error:", error);
    next(error);
  }
};

// Get Mentor Documents (pending only)
const getMentorDocuments = async (req, res, next) => {
  try {
    const mentorName = req.user.name || req.user.username;

    if (!mentorName) {
      return res.json({ success: true, data: [] });
    }

    const mentees = await Student.find({
      ...getDepartmentFilter(req),
      mentorName: { $regex: new RegExp("^" + mentorName + "$", "i") },
    }).select("_id");

    const menteeIds = mentees.map((mentee) => mentee._id);

    if (menteeIds.length === 0) {
      return res.json({ success: true, data: [] });
    }

    const query = {
      ...getDepartmentFilter(req),
      studentId: { $in: menteeIds },
      status: { $in: ["pending", "mentor-approved"] },
    };

    const documents = await Document.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section",
      )
      // ✅ FIXED
      .populate("subjects", "subjectName subjectCode")
      .sort({ uploadDate: -1 });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error("❌ [getMentorDocuments] Error:", error);
    next(error);
  }
};

// Mentor Review Document
const reviewDocument = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, priorPermission } = req.body;

    const document = await Document.findById(id).populate("studentId");
    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    const normalizedDocumentStatus = (document.status || "").toLowerCase();

    if (normalizedDocumentStatus !== "pending") {
      return res.status(400).json({
        success: false,
        error: "Document has already been reviewed",
      });
    }

    if (req.user.role === "Mentor" || req.user.role === "Faculty") {
      const mentorId = req.user._id || req.user.id;
      const isAuthorizedMentor =
        document.studentId?.mentorName === req.user.name ||
        document.studentId?.mentorId?.toString() === mentorId?.toString();

      if (!isAuthorizedMentor) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to review this document",
        });
      }
    }

    const normalizedReviewDecision = normalizeReviewDecision(status);

    if (!normalizedReviewDecision) {
      return res
        .status(422)
        .json({ success: false, error: "Status must be Approved or Rejected" });
    }

    document.remarks = remarks || document.remarks;
    document.priorPermission =
      priorPermission === true || priorPermission === "true";
    document.mentorRemarks = remarks || document.remarks;
    document.mentorReviewedBy = req.user.id || req.user._id;
    document.mentorReviewedAt = new Date();

    if (normalizedReviewDecision === "Approved") {
      if (isAttendanceCorrectionDocument(document.documentType)) {
        document.status = "mentor-approved";
        document.mentorStatus = "Approved";
        document.overallStatus = "Pending Faculty Review";

        // ✅ ADDED: Tag each subject's faculty so it appears on their dashboard
        if (document.subjectApprovals && document.subjectApprovals.length > 0) {
          for (const entry of document.subjectApprovals) {
            // Look up the faculty who teaches this subject for the student's class
            const allocation = await FacultyAllocation.findOne({
              subjectId: entry.subjectId,
              semester: document.semester || undefined,
            }).sort({ createdAt: -1 });

            // Fallback: look up by subjectName if subjectId didn't match
            let facultyAllocation = allocation;
            if (!facultyAllocation) {
              facultyAllocation = await FacultyAllocation.findOne({
                subjectName: entry.subjectName,
              }).sort({ createdAt: -1 });
            }

            if (facultyAllocation) {
              entry.facultyName = facultyAllocation.facultyName || null;
              entry.facultyId = facultyAllocation.facultyUserId || null;
            } else {
              console.log(
                `⚠️ No faculty found for subject: ${entry.subjectName}`,
              );
            }
          }
          document.markModified("subjectApprovals");
        }
      } else {
        // ✅ Leave application - directly mark as completed
        document.status = "completed";
        document.mentorStatus = "Approved";
        document.overallStatus = "Completed";
      }
    } else {
      document.status = "mentor-rejected";
      document.mentorStatus = "Rejected";
      document.overallStatus = "Rejected";
    }

    await document.save();

    const student = document.studentId;
    const leaveDates =
      document.leaveStartDate && document.leaveEndDate
        ? `${new Date(document.leaveStartDate).toLocaleDateString()} to ${new Date(document.leaveEndDate).toLocaleDateString()}`
        : document.dates && document.dates.length
          ? document.dates
              .map((date) => new Date(date).toLocaleDateString())
              .join(", ")
          : "the requested dates";

    if (normalizedReviewDecision === "Approved") {
      if (isAttendanceCorrectionDocument(document.documentType)) {
        await safeCreateStudentNotification({
          recipientId: student?._id || document.studentId,
          recipientRole: "Student",
          department: student?.department || document.department || "CS",
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: req.user.role,
          title: "📋 Attendance Correction - Approved by Mentor",
          message:
            "Your attendance correction is now pending faculty confirmation.",
          type: "document_status",
          priority: "normal",
          actionUrl: "/student/documents",
          actionText: "View Document",
          relatedId: document._id,
          relatedModel: "Document",
        });

        // ✅ ADDED: Notify each subject's faculty (they need to confirm)
        try {
          if (
            document.subjectApprovals &&
            document.subjectApprovals.length > 0
          ) {
            for (const entry of document.subjectApprovals) {
              if (entry.facultyId) {
                await safeCreateStudentNotification({
                  recipientId: entry.facultyId,
                  recipientRole: "Faculty",
                  department: document.department || "CS",
                  senderId: req.user._id,
                  senderName: req.user.name,
                  senderRole: req.user.role,
                  title: "📋 Attendance Correction Awaiting Review",
                  message: `${student?.studentName || "A student"}'s attendance correction for ${entry.subjectName} is awaiting your confirmation.`,
                  type: "document_status",
                  priority: "normal",
                  actionUrl: "/faculty/documents",
                  actionText: "Review Now",
                  relatedId: document._id,
                  relatedModel: "Document",
                });
                console.log(
                  `🔔 Notified faculty ${entry.facultyName} about ${entry.subjectName}`,
                );
              } else {
                console.log(
                  `⚠️ No facultyId for subject: ${entry.subjectName} — skipping notification`,
                );
              }
            }
          }
        } catch (notifyErr) {
          console.error("❌ Failed to notify faculty:", notifyErr.message);
        }
      } else {
        await safeCreateStudentNotification({
          recipientId: student?._id || document.studentId,
          recipientRole: "Student",
          department: student?.department || document.department || "CS",
          senderId: req.user._id,
          senderName: req.user.name,
          senderRole: req.user.role,
          title: "✅ Leave Application Approved",
          message: `Your leave application for ${leaveDates} has been approved.`,
          type: "document_approved",
          priority: "normal",
          actionUrl: "/student/documents",
          actionText: "View Document",
          relatedId: document._id,
          relatedModel: "Document",
        });
      }
    } else {
      await safeCreateStudentNotification({
        recipientId: student?._id || document.studentId,
        recipientRole: "Student",
        department: student?.department || document.department || "CS",
        senderId: req.user._id,
        senderName: req.user.name,
        senderRole: req.user.role,
        title: "❌ Document Rejected",
        message: `Your document was rejected.${remarks ? ` Remarks: ${remarks}` : ""}`,
        type: "document_rejected",
        priority: "high",
        actionUrl: "/student/documents",
        actionText: "View Document",
        relatedId: document._id,
        relatedModel: "Document",
        sendEmail: true,
      });
    }

    res.json({
      success: true,
      message: `Document ${normalizedReviewDecision.toLowerCase()} successfully`,
      data: document,
    });
  } catch (error) {
    console.error("Review error:", error);
    next(error);
  }
};

// Get Document Stats for Mentor Dashboard
const getDocumentStats = async (req, res, next) => {
  try {
    const mentorName = req.user.name || req.user.username;

    if (!mentorName) {
      return res.json({
        success: true,
        data: {
          pending: 0,
          mentorApproved: 0,
          completed: 0,
          rejected: 0,
          total: 0,
        },
      });
    }

    const mentees = await Student.find({
      mentorName: { $regex: new RegExp("^" + mentorName + "$", "i") },
    }).select("_id");

    const menteeIds = mentees.map((mentee) => mentee._id);

    if (menteeIds.length === 0) {
      return res.json({
        success: true,
        data: {
          pending: 0,
          mentorApproved: 0,
          completed: 0,
          rejected: 0,
          total: 0,
        },
      });
    }

    const query = { studentId: { $in: menteeIds } };

    const pending = await Document.countDocuments({
      ...query,
      status: "pending",
    });
    const mentorApproved = await Document.countDocuments({
      ...query,
      status: "mentor-approved",
    });
    const completed = await Document.countDocuments({
      ...query,
      status: "completed",
    });
    const rejected = await Document.countDocuments({
      ...query,
      status: "mentor-rejected",
    });

    res.json({
      success: true,
      data: {
        pending,
        mentorApproved,
        completed,
        rejected,
        total: pending + mentorApproved + completed + rejected,
      },
    });
  } catch (error) {
    console.error("❌ [getDocumentStats] Error:", error);
    next(error);
  }
};

// ============================================
// FACULTY DOCUMENT OPERATIONS
// ============================================

// Get Faculty Documents (pending attendance corrections)
// Get Faculty Documents (pending attendance corrections — per-subject view)
const getFacultyDocuments = async (req, res, next) => {
  try {
    console.log(
      "🔍 [getFacultyDocuments] User:",
      req.user?.name || req.user?.email,
    );

    const facultyName = req.user.name;
    const facultyId = req.user._id || req.user.id;

    // ✅ ADDED: Only return documents where this faculty has at least one
    // subjectApprovals entry with status "Pending"
    const query = {
      ...getDepartmentFilter(req),
      documentType: "attendance-correction",
      status: { $in: ["mentor-approved", "partially-approved"] },
      "subjectApprovals.status": "Pending",
    };

    let documents = await Document.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section department",
      )
      .populate("subjects", "subjectName subjectCode")
      .sort({ mentorReviewedAt: -1 });

    // ✅ Filter: keep only docs where this faculty has a PENDING subject
    // Also slice subjectApprovals down to only THIS faculty's entries
    const filteredDocs = documents
      .map((doc) => {
        const myEntries = (doc.subjectApprovals || []).filter(
          (sa) =>
            sa.status === "Pending" &&
            (sa.facultyId?.toString() === facultyId?.toString() ||
              sa.facultyName === facultyName),
        );
        if (myEntries.length === 0) return null;

        const obj = doc.toObject();
        obj.subjectApprovals = myEntries; // Only my pending rows
        return obj;
      })
      .filter(Boolean);

    console.log(
      `📊 [getFacultyDocuments] Faculty ${facultyName} has ${filteredDocs.length} pending subject rows`,
    );

    res.json({ success: true, data: filteredDocs });
  } catch (error) {
    console.error("❌ [getFacultyDocuments] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch faculty documents",
      details: error.message,
    });
  }
};

// Confirm Attendance Correction (Faculty) — PER SUBJECT
const confirmAttendanceCorrection = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, remarks, subjectId } = req.body;

    console.log("🔍 [confirmAttendanceCorrection] Doc:", id);
    console.log("🔍 [confirmAttendanceCorrection] Subject:", subjectId);
    console.log("🔍 [confirmAttendanceCorrection] Status:", status);

    if (!subjectId) {
      return res.status(400).json({
        success: false,
        error: "subjectId is required",
      });
    }

    const document = await Document.findById(id)
      .populate(
        "studentId",
        "studentName rollNumber semester section department",
      )
      .populate("subjects", "subjectName subjectCode");

    if (!document) {
      return res
        .status(404)
        .json({ success: false, error: "Document not found" });
    }

    if (!isAttendanceCorrectionDocument(document.documentType)) {
      return res.status(400).json({
        success: false,
        error: "This is not an attendance correction document",
      });
    }

    if (!["mentor-approved", "partially-approved"].includes(document.status)) {
      return res.status(400).json({
        success: false,
        error: "Document is not awaiting faculty review",
      });
    }

    const normalizedDecision = normalizeReviewDecision(status);
    if (!normalizedDecision) {
      return res
        .status(422)
        .json({ success: false, error: "Status must be Approved or Rejected" });
    }

    // ✅ Find the specific subject entry
    const entry = (document.subjectApprovals || []).find(
      (sa) => sa.subjectId.toString() === subjectId.toString(),
    );

    if (!entry) {
      return res.status(404).json({
        success: false,
        error: "Subject not found in this document",
      });
    }

    // ✅ Verify this faculty is authorized for this subject
    const facultyName = req.user.name;
    const facultyId = req.user._id || req.user.id;

    const isMySubject =
      (entry.facultyId &&
        entry.facultyId.toString() === facultyId.toString()) ||
      entry.facultyName === facultyName ||
      req.user.role === "HOD"; // HOD can act on any subject

    if (!isMySubject) {
      return res.status(403).json({
        success: false,
        error: "You are not authorized to review this subject",
      });
    }

    if (entry.status !== "Pending") {
      return res.status(400).json({
        success: false,
        error: `This subject was already ${entry.status.toLowerCase()}`,
      });
    }

    // ✅ Update the subject entry
    entry.status = normalizedDecision;
    entry.remarks = remarks || `${normalizedDecision} by ${facultyName}`;
    entry.facultyId = facultyId;
    entry.facultyName = facultyName;
    entry.reviewedAt = new Date();

    document.markModified("subjectApprovals");

    // ✅ If approved, update attendance for this subject only
    if (normalizedDecision === "Approved") {
      const student = document.studentId;
      const datesToUpdate =
        document.dates && document.dates.length > 0
          ? document.dates
          : [document.attendanceDate].filter(Boolean);

      const subjectName = entry.subjectName;
      console.log(
        `📊 Updating attendance: ${student.studentName} - ${subjectName}`,
      );

      // ✅ FIXED: Delete FIRST, then create (avoids race condition)
      for (const date of datesToUpdate) {
        const dateObj = new Date(date);
        dateObj.setHours(0, 0, 0, 0);

        // Step 1: Delete any existing records for this date+subject
        await Attendance.deleteMany({
          studentId: student._id,
          subjectName: subjectName,
          attendanceDate: dateObj,
        });

        // Step 2: Create the corrected record
        await Attendance.create({
          studentId: student._id,
          subjectId: entry.subjectId,
          subjectName: subjectName,
          attendanceDate: dateObj,
          status: "Present",
          facultyName: facultyName || "faculty",
          autoUpdated: true,
          documentId: document._id,
          department: student.department || document.department || "CS",
        });
      }

      // ✅ Sync hall tickets for this student
      await syncStudentHallTickets(student._id, {
        department: student.department || document.department || "CS",
        reason: "documentCorrection",
      }).catch((err) =>
        console.error("❌ Hall ticket sync error:", err.message),
      );
    }

    // ✅ Check if all subjects resolved
    const progress = document.getApprovalProgress();

    if (progress.allResolved) {
      document.status = "completed";
      document.facultyReviewedBy = facultyId;
      document.facultyConfirmedAt = new Date();
      document.facultyRemarks = `All subjects reviewed. ${progress.approved} approved, ${progress.rejected} rejected.`;
    } else {
      document.status = "partially-approved";
    }

    await document.save();

    // ✅ Notify student per-subject
    const student = document.studentId;
    const isApproved = normalizedDecision === "Approved";

    await safeCreateStudentNotification({
      recipientId: student?._id || document.studentId,
      recipientRole: "Student",
      department: student?.department || document.department || "CS",
      senderId: facultyId,
      senderName: facultyName,
      senderRole: req.user.role,
      title: isApproved
        ? `✅ ${entry.subjectName} Correction Approved`
        : `❌ ${entry.subjectName} Correction Rejected`,
      message: isApproved
        ? `${entry.subjectName} attendance has been updated by ${facultyName}.`
        : `${entry.subjectName} correction was rejected by ${facultyName}.${remarks ? ` Remarks: ${remarks}` : ""}`,
      type: isApproved ? "document_approved" : "document_rejected",
      priority: isApproved ? "normal" : "high",
      actionUrl: "/attendance-progress",
      actionText: "View Progress",
      relatedId: document._id,
      relatedModel: "Document",
      sendEmail: !isApproved, // Only email on rejection
    });

    // ✅ If all subjects resolved, send final summary notification
    if (progress.allResolved) {
      const summaryMsg = isApproved
        ? `All subjects have been reviewed. ${progress.approved} approved, ${progress.rejected} rejected.`
        : `Your attendance correction request is now complete.`;

      await safeCreateStudentNotification({
        recipientId: student?._id || document.studentId,
        recipientRole: "Student",
        department: student?.department || document.department || "CS",
        senderId: facultyId,
        senderName: facultyName,
        senderRole: req.user.role,
        title: "✅ Attendance Correction Completed",
        message: summaryMsg,
        type: "document_approved",
        priority: "normal",
        actionUrl: "/student/documents",
        actionText: "View Details",
        relatedId: document._id,
        relatedModel: "Document",
      });
    }

    res.json({
      success: true,
      message: `✅ ${entry.subjectName} ${normalizedDecision.toLowerCase()}`,
      data: document,
    });
  } catch (error) {
    console.error("❌ [confirmAttendanceCorrection] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to confirm attendance correction",
      details: error.message,
    });
  }
};

// ============================================
// ADMIN DOCUMENT OPERATIONS
// ============================================

// Get All Documents (Admin only)
const getAllDocuments = async (req, res, next) => {
  try {
    const { status, documentType, studentId } = req.query;
    const query = { ...getDepartmentFilter(req) };

    if (status) query.status = status;
    if (documentType) query.documentType = normalizeDocumentType(documentType);
    if (studentId) query.studentId = studentId;

    const documents = await Document.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section",
      )
      // ✅ FIXED
      .populate("subjects", "subjectName subjectCode")
      .populate("mentorReviewedBy", "name email")
      .populate("facultyReviewedBy", "name email")
      .sort({ createdAt: -1 });

    res.json({ success: true, data: documents });
  } catch (error) {
    console.error("❌ [getAllDocuments] Error:", error);
    next(error);
  }
};

// ✅ ADDED: Faculty-specific stats — counts this faculty's subject approvals
const getFacultyDocumentStats = async (req, res, next) => {
  try {
    const facultyName = req.user.name;
    const facultyId = req.user._id || req.user.id;

    if (!facultyName) {
      return res.json({
        success: true,
        data: { pending: 0, approved: 0, rejected: 0, total: 0 },
      });
    }

    // ✅ Count subjectApprovals entries assigned to this faculty
    const docs = await Document.find({
      ...getDepartmentFilter(req),
      documentType: "attendance-correction",
    }).select("subjectApprovals");

    let pending = 0;
    let approved = 0;
    let rejected = 0;

    for (const doc of docs) {
      for (const sa of doc.subjectApprovals || []) {
        const isMySubject =
          (sa.facultyId && sa.facultyId.toString() === facultyId.toString()) ||
          sa.facultyName === facultyName;

        if (!isMySubject) continue;

        if (sa.status === "Pending") pending++;
        else if (sa.status === "Approved") approved++;
        else if (sa.status === "Rejected") rejected++;
      }
    }

    res.json({
      success: true,
      data: {
        pending,
        approved,
        rejected,
        total: pending + approved + rejected,
      },
    });
  } catch (error) {
    console.error("❌ [getFacultyDocumentStats] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load faculty stats",
      details: error.message,
    });
  }
};

// ============================================
// EXPORT ALL FUNCTIONS
// ============================================

module.exports = {
  resolveAttendanceUpdateTargets,
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
  getFacultyDocumentStats,
  getAllDocuments,
};
