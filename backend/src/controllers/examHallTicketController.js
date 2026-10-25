const ExamHallTicket = require("../models/ExamHallTicket");
const Exam = require("../models/Exam");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const FacultyAllocation = require("../models/FacultyAllocation");
const path = require("path");
const fs = require("fs");
const {
  getDepartmentFilter,
  getDepartmentCode,
} = require("../utils/departmentHelper");
const {
  getAttendanceThreshold,
  getAttendanceThresholds,
} = require("../utils/attendanceThreshold");
const { createNotification } = require("./notificationController");

const safeCreateStudentNotification = async (payload) => {
  if (!payload || !payload.recipientId) return;

  try {
    await createNotification(payload);
  } catch (error) {
    console.error("❌ Notification creation failed:", error.message);
  }
};

const getMyHallTicket = async (req, res, next) => {
  try {
    console.log("🔍 Getting hall ticket for student:", req.user.email);

    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });

    if (!student) {
      console.log("❌ Student not found for email:", req.user.email);
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    console.log("✅ Student found:", student.studentName);

    const hallTicket = await ExamHallTicket.findOne({
      ...getDepartmentFilter(req),
      studentId: student._id,
    }).sort({ createdAt: -1 });

    if (!hallTicket) {
      console.log("ℹ️ No hall ticket found for student:", student.studentName);
      return res.status(404).json({
        success: false,
        error: "No hall ticket found",
        data: {
          hasHallTicket: false,
          message: "You don't have any hall tickets yet.",
        },
      });
    }

    const exam = await Exam.findById(hallTicket.examId);

    // ✅ Remove duplicate subjects for display
    const uniqueSubjects = [];
    const seen = {};
    hallTicket.subjectEligibility.forEach((s) => {
      if (!seen[s.subjectName]) {
        seen[s.subjectName] = true;
        uniqueSubjects.push(s);
      }
    });

    // ✅ Determine department (priority: exam → hallTicket → student)
    const department =
      exam?.department || hallTicket.department || student.department || "CS";

    console.log("📋 Department:", department);

    res.json({
      success: true,
      data: {
        hallTicket: {
          _id: hallTicket._id,
          examName: exam?.examName || "Exam",
          academicYear:
            hallTicket.academicYear ||
            exam?.academicYear ||
            student.academicYear ||
            "",
          semester: hallTicket.semester || exam?.semester || student.semester,
          section: hallTicket.section || exam?.section || student.section,
          // ✅ NEW: Department
          department: department,
          generatedAt: hallTicket.generatedAt,
          generatedDate: hallTicket.generatedDate || hallTicket.createdAt,
          approvalStatus: hallTicket.approvalStatus || "Pending",
          approvedBy: hallTicket.approvedBy || "Pending",
          mentorRemarks:
            hallTicket.mentorRemarks || hallTicket.hodRemarks || "N/A",
          hodOverride: hallTicket.hodOverride || false,
          subjectEligibility: uniqueSubjects,
          pdfPath: hallTicket.pdfPath,
        },
        student: {
          name: student.studentName,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          academicYear: student.academicYear,
          // ✅ NEW: Department
          department: student.department || "CS",
          photoPath: student.photoPath,
        },
        hasHallTicket: true,
      },
    });
  } catch (error) {
    console.error("❌ Error getting hall ticket:", error);
    next(error);
  }
};

const getMentorHallTickets = async (req, res, next) => {
  try {
    console.log("========================================");
    console.log("🔍 GET MENTOR HALL TICKETS");
    console.log("👤 User name:", req.user.name);
    console.log("👤 User role:", req.user.role);
    console.log("========================================");

    let mentorName = req.user.name;

    if (req.user.role === "Faculty") {
      const allocations = await FacultyAllocation.find({
        ...getDepartmentFilter(req),
        facultyName: req.user.name,
      });

      if (allocations.length > 0) {
        mentorName = allocations[0].facultyName;
      } else {
        return res.json({
          success: true,
          data: [],
          count: 0,
          message: "No faculty allocations found",
        });
      }
    }

    const mentees = await Student.find({
      ...getDepartmentFilter(req),
      mentorName: mentorName,
    });

    if (mentees.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0,
        message: `No students found with mentor: ${mentorName}`,
      });
    }

    const menteeIds = mentees.map((m) => m._id);

    const hallTickets = await ExamHallTicket.find({
      ...getDepartmentFilter(req),
      studentId: { $in: menteeIds },
    })
      .populate(
        "studentId",
        "studentName rollNumber email section semester department",
      )
      .populate("examId", "examName academicYear")
      .sort({ createdAt: -1 });

    // ✅ ADDED: Recompute attendancePercentage on-read so the modal never shows stale data
    const subjectNames = [
      ...new Set(
        hallTickets.flatMap((t) =>
          (t.subjectEligibility || [])
            .map((s) => s.subjectName)
            .filter(Boolean),
        ),
      ),
    ];

    let attendanceByStudentAndSubject = new Map();
    if (menteeIds.length > 0 && subjectNames.length > 0) {
      const attendanceRows = await Attendance.aggregate([
        {
          $match: {
            studentId: { $in: menteeIds },
            subjectName: { $in: subjectNames },
          },
        },
        {
          $group: {
            _id: { studentId: "$studentId", subjectName: "$subjectName" },
            totalClasses: { $sum: 1 },
            presentClasses: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
          },
        },
      ]);
      attendanceByStudentAndSubject = new Map(
        attendanceRows.map((row) => [
          `${row._id.studentId.toString()}:${row._id.subjectName}`,
          row,
        ]),
      );
    }

    const enrichedTickets = hallTickets.map((ticket) => {
      const doc = ticket.toObject();
      const studentIdStr =
        doc.studentId?._id?.toString() || doc.studentId?.toString();

      doc.subjectEligibility = (doc.subjectEligibility || []).map((subject) => {
        const attendance = attendanceByStudentAndSubject.get(
          `${studentIdStr}:${subject.subjectName}`,
        );
        const percentage = attendance?.totalClasses
          ? Math.round(
              (attendance.presentClasses / attendance.totalClasses) * 100,
            )
          : subject.attendancePercentage || 0;

        return {
          ...subject,
          attendancePercentage: percentage,
          totalClasses: attendance?.totalClasses ?? subject.totalClasses ?? 0,
          presentClasses:
            attendance?.presentClasses ?? subject.presentClasses ?? 0,
          eligible: subject.mentorOverride ? true : subject.eligible,
        };
      });

      return doc;
    });

    console.log(
      `✅ Found ${enrichedTickets.length} hall tickets (with fresh attendance %)`,
    );
    console.log("========================================");

    res.json({
      success: true,
      data: enrichedTickets,
      count: enrichedTickets.length,
    });
  } catch (error) {
    console.error("❌ Error getting mentor hall tickets:", error);
    console.log("========================================");
    next(error);
  }
};

// ============================================
// ✅ GET PENDING HALL TICKETS (For Mentor Review)
// ============================================
const getPendingHallTickets = async (req, res, next) => {
  try {
    const { semester, section } = req.query;

    const filter = {
      ...getDepartmentFilter(req),
      approvalStatus: "pending",
    };

    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;

    const hallTickets = await ExamHallTicket.find(filter)
      .populate("studentId", "studentName rollNumber email section semester")
      .populate("examId", "examName academicYear")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: hallTickets,
      count: hallTickets.length,
    });
  } catch (error) {
    console.error("❌ Error getting pending hall tickets:", error);
    next(error);
  }
};

// ============================================
// ✅ REVIEW HALL TICKET (Mentor Approve/Reject)
// ============================================
const reviewHallTicket = async (req, res, next) => {
  try {
    const { hallTicketId } = req.params;
    const { action, status, remarks, subjectOverrides } = req.body;

    console.log("========================================");
    console.log("🔍 REVIEW HALL TICKET");
    console.log("📋 Hall Ticket ID:", hallTicketId);
    console.log("📋 Action:", action);
    console.log("📋 User:", req.user.name);
    console.log("📋 User ID:", req.user._id);
    console.log("========================================");

    const finalAction = action || status;

    if (!finalAction) {
      return res.status(400).json({
        success: false,
        error: "Action is required (approve or reject)",
      });
    }

    if (!["approve", "rejected", "approved", "reject"].includes(finalAction)) {
      return res.status(400).json({
        success: false,
        error: "Action must be 'approve' or 'reject'",
      });
    }

    // ✅ Get the hall ticket
    const hallTicket = await ExamHallTicket.findById(hallTicketId);
    if (!hallTicket) {
      return res.status(404).json({
        success: false,
        error: "Hall ticket not found",
      });
    }

    console.log("📋 BEFORE - Status:", hallTicket.approvalStatus);
    console.log("📋 BEFORE - Approved By:", hallTicket.approvedBy);

    // ✅ Verify this is a mentee of the mentor
    const student = await Student.findById(hallTicket.studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }
    const attendanceThreshold = await getAttendanceThreshold(
      student.department,
    );

    if (student.mentorName !== req.user.name) {
      return res.status(403).json({
        success: false,
        error: `You can only review hall tickets for your mentees.`,
      });
    }

    const isApprove = finalAction === "approve" || finalAction === "approved";

    if (isApprove) {
      // ✅ Apply subject overrides
      if (subjectOverrides && subjectOverrides.length > 0) {
        console.log("📋 Applying subject overrides...");
        subjectOverrides.forEach((override) => {
          const subject = hallTicket.subjectEligibility.find(
            (s) => s.subjectName === override.subjectName,
          );
          if (subject) {
            subject.eligible = override.eligible;
            subject.mentorOverride = true;
            subject.overrideRemarks = override.remarks || "Approved by mentor";
          }
        });
      }

      // ✅ Auto-approve eligible subjects
      hallTicket.subjectEligibility.forEach((subject) => {
        if (
          !subject.mentorOverride &&
          subject.attendancePercentage >= attendanceThreshold
        ) {
          subject.eligible = true;
        }
      });

      // ✅ Set ALL approval fields - DIRECT ASSIGNMENT
      hallTicket.approvalStatus = "Approved";
      hallTicket.approvedBy = req.user.name; // ✅ Mentor's name
      hallTicket.mentorId = req.user._id; // ✅ Mentor's ID
      hallTicket.mentorReviewedAt = new Date(); // ✅ Review timestamp
      hallTicket.mentorRemarks = remarks || "Approved by mentor";

      console.log(`✅ Hall ticket approved by: ${req.user.name}`);
    } else {
      // ✅ Reject
      hallTicket.approvalStatus = "Rejected";
      hallTicket.approvedBy = req.user.name;
      hallTicket.mentorId = req.user._id;
      hallTicket.mentorReviewedAt = new Date();
      hallTicket.mentorRemarks = remarks || "Rejected by mentor";

      console.log(`❌ Hall ticket rejected by: ${req.user.name}`);
    }

    // ✅ Mark the field as modified to force Mongoose to save it
    hallTicket.markModified("approvedBy");
    hallTicket.markModified("mentorId");
    hallTicket.markModified("mentorReviewedAt");
    hallTicket.markModified("approvalStatus");
    hallTicket.markModified("mentorRemarks");
    hallTicket.markModified("subjectEligibility");

    // ✅ Save with explicit update
    await hallTicket.save({ validateBeforeSave: true });

    // ✅ Verify save by fetching again
    const savedTicket = await ExamHallTicket.findById(hallTicketId);
    console.log("📋 AFTER - Status:", savedTicket.approvalStatus);
    console.log("📋 AFTER - Approved By:", savedTicket.approvedBy);
    console.log("📋 AFTER - Mentor ID:", savedTicket.mentorId);
    console.log("📋 AFTER - Mentor Reviewed At:", savedTicket.mentorReviewedAt);
    console.log("========================================");

    const exam = await Exam.findById(savedTicket.examId).select("examName");
    const messageText = isApprove
      ? `Your hall ticket for ${exam?.examName || "the exam"} has been approved by your mentor.`
      : `Your hall ticket for ${exam?.examName || "the exam"} was rejected by your mentor.${remarks ? ` Remarks: ${remarks}` : ""}`;

    await safeCreateStudentNotification({
      recipientId: student._id,
      recipientRole: "Student",
      department: student.department || "CS",
      senderId: req.user._id,
      senderName: req.user.name,
      senderRole: req.user.role,
      title: isApprove ? "✅ Hall Ticket Approved" : "❌ Hall Ticket Rejected",
      message: messageText,
      type: isApprove ? "hallticket_approved" : "hallticket_rejected",
      priority: isApprove ? "normal" : "high",
      actionUrl: "/student/halltickets",
      actionText: "View Hall Ticket",
      relatedId: savedTicket._id,
      relatedModel: "ExamHallTicket",
      // ✅ ADDED: send email on BOTH approve and reject
      sendEmail: true,
    });

    res.json({
      success: true,
      message: `Hall ticket ${isApprove ? "approved" : "rejected"} successfully`,
      data: savedTicket,
    });
  } catch (error) {
    console.error("❌ Error reviewing hall ticket:", error);
    console.log("========================================");
    next(error);
  }
};

// ============================================
// ✅ BULK APPROVE ELIGIBLE HALL TICKETS (Mentor)
// ============================================
const bulkApproveEligibleHallTickets = async (req, res, next) => {
  try {
    console.log("========================================");
    console.log("⚡ BULK APPROVE ELIGIBLE HALL TICKETS");
    console.log("👤 User name:", req.user.name);
    console.log("👤 User role:", req.user.role);
    console.log("📋 Body:", req.body);
    console.log("========================================");

    const { threshold, preview } = req.body || {};
    const customThreshold =
      threshold === undefined || threshold === null || threshold === ""
        ? null
        : Number(threshold);

    if (
      customThreshold !== null &&
      (!Number.isFinite(customThreshold) ||
        customThreshold < 0 ||
        customThreshold > 100)
    ) {
      return res.status(400).json({
        success: false,
        error: "Threshold must be a number between 0 and 100",
      });
    }

    let mentorName = req.user.name;

    // ✅ If user is Faculty, resolve mentor name from FacultyAllocation (same logic as getMentorHallTickets)
    if (req.user.role === "Faculty") {
      const allocations = await FacultyAllocation.find({
        ...getDepartmentFilter(req),
        facultyName: req.user.name,
      });

      if (allocations.length > 0) {
        mentorName = allocations[0].facultyName;
      } else {
        return res.json({
          success: true,
          approvedCount: 0,
          skippedCount: 0,
          totalPending: 0,
          eligibleStudentCount: 0,
          notEligibleStudentCount: 0,
          threshold: customThreshold,
          message: "No faculty allocations found",
          approvedTickets: [],
          skippedTickets: [],
        });
      }
    }

    // ✅ Get mentor's mentees
    const mentees = await Student.find({
      ...getDepartmentFilter(req),
      mentorName: mentorName,
    });

    if (mentees.length === 0) {
      return res.json({
        success: true,
        approvedCount: 0,
        skippedCount: 0,
        totalPending: 0,
        eligibleStudentCount: 0,
        notEligibleStudentCount: 0,
        threshold: customThreshold,
        message: `No students found with mentor: ${mentorName}`,
        approvedTickets: [],
        skippedTickets: [],
      });
    }

    const menteeIds = mentees.map((m) => m._id);

    // ✅ Get ONLY pending hall tickets
    const pendingTickets = await ExamHallTicket.find({
      ...getDepartmentFilter(req),
      studentId: { $in: menteeIds },
      approvalStatus: { $in: ["Pending", "pending"] },
    })
      .populate(
        "studentId",
        "studentName rollNumber email section semester department mentorName",
      )
      .populate("examId", "examName academicYear semester section");

    console.log(`📋 Found ${pendingTickets.length} pending hall tickets`);

    if (pendingTickets.length === 0) {
      return res.json({
        success: true,
        approvedCount: 0,
        skippedCount: 0,
        totalPending: 0,
        eligibleStudentCount: 0,
        notEligibleStudentCount: 0,
        threshold: customThreshold,
        message: "No pending hall tickets found",
        approvedTickets: [],
        skippedTickets: [],
      });
    }

    // ✅ Resolve each student's effective department threshold.
    let thresholdsByDept = new Map();
    if (customThreshold === null) {
      thresholdsByDept = await getAttendanceThresholds(
        pendingTickets.map(
          (t) => t.department || t.studentId?.department || "CS",
        ),
      );
    }

    const subjectNames = [
      ...new Set(
        pendingTickets.flatMap((ticket) =>
          (ticket.subjectEligibility || [])
            .map((subject) => subject.subjectName)
            .filter(Boolean),
        ),
      ),
    ];
    const attendanceRows = await Attendance.aggregate([
      {
        $match: {
          studentId: { $in: menteeIds },
          subjectName: { $in: subjectNames },
        },
      },
      {
        $group: {
          _id: { studentId: "$studentId", subjectName: "$subjectName" },
          totalClasses: { $sum: 1 },
          presentClasses: {
            $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
          },
        },
      },
    ]);
    const attendanceByStudentAndSubject = new Map(
      attendanceRows.map((row) => [
        `${row._id.studentId.toString()}:${row._id.subjectName}`,
        row,
      ]),
    );

    const approvedTickets = [];
    const skippedTickets = [];
    const ticketEligibility = new Map();

    for (const ticket of pendingTickets) {
      const studentDept = (
        ticket.department ||
        ticket.studentId?.department ||
        "CS"
      )
        .trim()
        .toUpperCase();

      const deptThreshold =
        customThreshold !== null
          ? customThreshold
          : (thresholdsByDept.get(studentDept) ?? 85);

      // ✅ Every subject must be >= threshold
      const allEligible =
        ticket.subjectEligibility &&
        ticket.subjectEligibility.length > 0 &&
        ticket.subjectEligibility.every((subject) => {
          const attendance = attendanceByStudentAndSubject.get(
            `${ticket.studentId._id.toString()}:${subject.subjectName}`,
          );
          const attendancePercentage = attendance?.totalClasses
            ? (attendance.presentClasses / attendance.totalClasses) * 100
            : 0;
          return attendancePercentage >= deptThreshold;
        });
      const currentSubjectAttendance = new Map(
        (ticket.subjectEligibility || []).map((subject) => {
          const attendance = attendanceByStudentAndSubject.get(
            `${ticket.studentId._id.toString()}:${subject.subjectName}`,
          );
          return [
            subject.subjectName,
            attendance?.totalClasses
              ? (attendance.presentClasses / attendance.totalClasses) * 100
              : 0,
          ];
        }),
      );

      ticketEligibility.set(ticket._id.toString(), {
        allEligible,
        threshold: deptThreshold,
        currentSubjectAttendance,
      });

      if (allEligible) {
        approvedTickets.push({ ticket, threshold: deptThreshold });
      } else {
        skippedTickets.push({ ticket, threshold: deptThreshold });
      }
    }

    const eligibleStudentIds = new Set(
      approvedTickets.map((item) => item.ticket.studentId._id.toString()),
    );
    const notEligibleStudentIds = new Set(
      skippedTickets.map((item) => item.ticket.studentId._id.toString()),
    );
    const toStudentSummaries = (items) => {
      const studentsById = new Map();
      for (const item of items) {
        const student = item.ticket.studentId;
        const id = student._id.toString();
        if (!studentsById.has(id)) {
          studentsById.set(id, {
            _id: id,
            studentName: student.studentName,
            rollNumber: student.rollNumber,
            department: item.ticket.department || student.department || "CS",
          });
        }
      }
      return [...studentsById.values()];
    };

    // ✅ If preview mode (dry-run), don't save anything
    if (preview) {
      console.log(
        `📊 PREVIEW: ${approvedTickets.length} eligible, ${skippedTickets.length} not eligible`,
      );
      return res.json({
        success: true,
        preview: true,
        totalPending: pendingTickets.length,
        eligibleStudentCount: eligibleStudentIds.size,
        notEligibleStudentCount: notEligibleStudentIds.size,
        approvedCount: approvedTickets.length,
        skippedCount: skippedTickets.length,
        threshold: customThreshold,
        approvedTickets: approvedTickets.map((a) => ({
          _id: a.ticket._id,
          studentId: a.ticket.studentId._id,
          studentName: a.ticket.studentId?.studentName,
          rollNumber: a.ticket.studentId?.rollNumber,
          department: a.ticket.department || a.ticket.studentId?.department,
          threshold: a.threshold,
        })),
        skippedTickets: skippedTickets.map((s) => ({
          _id: s.ticket._id,
          studentId: s.ticket.studentId._id,
          studentName: s.ticket.studentId?.studentName,
          rollNumber: s.ticket.studentId?.rollNumber,
          department: s.ticket.department || s.ticket.studentId?.department,
          threshold: s.threshold,
        })),
        eligibleStudents: toStudentSummaries(approvedTickets),
        notEligibleStudents: toStudentSummaries(skippedTickets),
      });
    }

    // ✅ Actual approval
    let approvedCount = 0;
    for (const item of approvedTickets) {
      const ticket = await ExamHallTicket.findOne({
        _id: item.ticket._id,
        approvalStatus: { $in: ["Pending", "pending"] },
      });
      if (!ticket) continue;

      const eligibility = ticketEligibility.get(ticket._id.toString());
      if (!eligibility?.allEligible) continue;

      ticket.approvalStatus = "Approved";
      ticket.approvedBy = req.user.name;
      ticket.mentorId = req.user._id;
      ticket.mentorReviewedAt = new Date();
      ticket.mentorRemarks =
        ticket.mentorRemarks || "Bulk approved (attendance above threshold)";

      // ✅ Auto-mark eligible subjects
      ticket.subjectEligibility.forEach((subject) => {
        const currentPercentage =
          eligibility.currentSubjectAttendance.get(subject.subjectName) || 0;
        subject.attendancePercentage = Math.round(currentPercentage);
        subject.eligible = true;
      });

      ticket.markModified("subjectEligibility");
      ticket.markModified("approvedBy");
      ticket.markModified("mentorId");
      ticket.markModified("mentorReviewedAt");
      ticket.markModified("approvalStatus");
      ticket.markModified("mentorRemarks");

      await ticket.save();
      approvedCount++;
    }

    console.log(
      `✅ Bulk approval done: ${approvedCount} approved, ${skippedTickets.length} skipped`,
    );
    console.log("========================================");

    res.json({
      success: true,
      approvedCount,
      skippedCount: skippedTickets.length,
      totalPending: pendingTickets.length,
      eligibleStudentCount: eligibleStudentIds.size,
      notEligibleStudentCount: notEligibleStudentIds.size,
      threshold: customThreshold,
      message: `${approvedCount} hall tickets approved successfully`,
      approvedTickets: approvedTickets.map((a) => ({
        _id: a.ticket._id,
        studentName: a.ticket.studentId?.studentName,
        rollNumber: a.ticket.studentId?.rollNumber,
      })),
      skippedTickets: skippedTickets.map((s) => ({
        _id: s.ticket._id,
        studentName: s.ticket.studentId?.studentName,
        rollNumber: s.ticket.studentId?.rollNumber,
      })),
    });
  } catch (error) {
    console.error("❌ Error in bulk approve:", error);
    next(error);
  }
};

// ============================================
// ✅ GET ALL HALL TICKETS (HOD)
// ============================================
const getAllHallTickets = async (req, res, next) => {
  try {
    const { semester, section, status, examId } = req.query;

    const filter = { ...getDepartmentFilter(req) };
    if (semester) filter.semester = parseInt(semester);
    if (section) filter.section = section;
    if (status) filter.approvalStatus = status;
    if (examId) filter.examId = examId;

    const hallTickets = await ExamHallTicket.find(filter)
      .populate("studentId", "studentName rollNumber email section semester")
      .populate("examId", "examName academicYear")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: hallTickets,
      count: hallTickets.length,
    });
  } catch (error) {
    console.error("❌ Error getting all hall tickets:", error);
    next(error);
  }
};

// ============================================
// ✅ FORCE APPROVE HALL TICKET (HOD Override)
// ============================================
const forceApproveHallTicket = async (req, res, next) => {
  try {
    const { hallTicketId } = req.params;

    const hallTicket = await ExamHallTicket.findById(hallTicketId);
    if (!hallTicket) {
      return res.status(404).json({
        success: false,
        error: "Hall ticket not found",
      });
    }

    hallTicket.approvalStatus = "approved";
    hallTicket.hodOverride = true;
    hallTicket.hodApprovedAt = new Date();
    hallTicket.hodId = req.user._id;

    await hallTicket.save();

    console.log(`✅ Hall ticket force approved by HOD: ${hallTicketId}`);

    res.json({
      success: true,
      message: "Hall ticket force approved by HOD",
      data: hallTicket,
    });
  } catch (error) {
    console.error("❌ Error force approving hall ticket:", error);
    next(error);
  }
};

// ============================================
// ✅ GENERATE HALL TICKETS FOR EXAM (HOD) - WITH PDF
// ============================================
const generateHallTicketsForExam = async (req, res, next) => {
  try {
    const { examId } = req.params;

    const exam = await Exam.findOne({
      _id: examId,
      ...getDepartmentFilter(req),
    });
    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    const existingTickets = await ExamHallTicket.find({
      ...getDepartmentFilter(req),
      examId,
    });
    if (existingTickets.length > 0) {
      return res.status(409).json({
        success: false,
        error: `Hall tickets already generated for this exam (${existingTickets.length} tickets)`,
      });
    }

    const studentDeptFilter =
      exam.department === "CS"
        ? {
            $or: [
              { department: "CS" },
              { department: { $exists: false } },
              { department: null },
            ],
          }
        : { department: exam.department || "CS" };

    const students = await Student.find({
      ...studentDeptFilter,
      semester: exam.semester,
      section: exam.section,
    });

    if (students.length === 0) {
      return res.status(404).json({
        success: false,
        error: "No students found for this semester and section",
      });
    }
    const thresholdsByDepartment = await getAttendanceThresholds(
      students.map((student) => student.department || exam.department || "CS"),
    );

    console.log(`📊 Found ${students.length} students for exam`);

    const hallTickets = [];
    let generatedCount = 0;
    let skippedCount = 0;

    // ✅ Ensure uploads directory exists
    const uploadDir = path.join(process.cwd(), "uploads", "halltickets");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Created halltickets upload directory");
    }

    // ✅ Import PDF service once
    const { generateHallTicketPDF } = require("../services/pdfService");

    for (const student of students) {
      try {
        const attendanceRecords = await Attendance.find({
          studentId: student._id,
        });

        const subjectAttendance = {};
        attendanceRecords.forEach((record) => {
          if (!subjectAttendance[record.subjectName]) {
            subjectAttendance[record.subjectName] = {
              total: 0,
              present: 0,
              absent: 0,
            };
          }
          subjectAttendance[record.subjectName].total++;
          if (record.status === "Present") {
            subjectAttendance[record.subjectName].present++;
          } else {
            subjectAttendance[record.subjectName].absent++;
          }
        });

        // ✅ Get unique subjects from exam
        const uniqueSubjects = [...new Set(exam.subjects)];
        const studentDepartment = (
          student.department ||
          exam.department ||
          "CS"
        )
          .trim()
          .toUpperCase();
        const attendanceThreshold =
          thresholdsByDepartment.get(studentDepartment) ?? 85;

        const subjectEligibility = uniqueSubjects.map((subjectName) => {
          const data = subjectAttendance[subjectName] || {
            total: 0,
            present: 0,
            absent: 0,
          };
          const percentage =
            data.total > 0 ? Math.round((data.present / data.total) * 100) : 0;
          const isEligible = percentage >= attendanceThreshold;

          return {
            subjectName,
            totalClasses: data.total,
            presentClasses: data.present,
            absentClasses: data.absent,
            attendancePercentage: percentage,
            isEligible,
          };
        });

        const allEligible = subjectEligibility.every((s) => s.isEligible);

        // ✅ Create hall ticket first
        const hallTicket = new ExamHallTicket({
          studentId: student._id,
          examId: exam._id,
          subjectEligibility,
          approvalStatus: allEligible ? "pending" : "rejected",
          generatedAt: new Date(),
          generatedDate: new Date(),
          semester: exam.semester,
          section: exam.section,
          academicYear: exam.academicYear,
          department: exam.department || student.department || "CS",
          isEligible: allEligible,
          rejectionReason: allEligible
            ? ""
            : `Attendance below ${attendanceThreshold}% in one or more subjects`,
          approvedBy: "Pending",
        });

        // ✅ Save hall ticket first to get ID
        await hallTicket.save();

        // ✅ Generate PDF using the saved hall ticket
        try {
          const pdfPath = await generateHallTicketPDF(hallTicket);
          hallTicket.pdfPath = pdfPath; // Store relative path
          await hallTicket.save();
          console.log(`✅ PDF generated for ${student.studentName}`);
        } catch (pdfError) {
          console.error(
            `❌ PDF generation failed for ${student.studentName}:`,
            pdfError.message,
          );
          // Continue without PDF - hall ticket still exists
        }

        hallTickets.push(hallTicket);
        generatedCount++;

        console.log(
          `✅ Hall ticket generated for ${student.studentName} (${student.rollNumber}) - ${allEligible ? "Eligible" : "Not Eligible"}`,
        );
      } catch (err) {
        console.error(
          `❌ Error generating hall ticket for student ${student._id}:`,
          err,
        );
        skippedCount++;
      }
    }

    exam.hallTicketsGenerated = true;
    exam.hallTicketsGeneratedAt = new Date();
    exam.totalHallTickets = generatedCount;
    await exam.save();

    console.log(
      `✅ Hall tickets generated: ${generatedCount} created, ${skippedCount} skipped`,
    );

    const examName = exam.examName || "the exam";
    for (const student of students) {
      await safeCreateStudentNotification({
        recipientId: student._id,
        recipientRole: "Student",
        department: student.department || exam.department || "CS",
        senderId: req.user?._id || null,
        senderName: req.user?.name || "System",
        senderRole: req.user?.role || "System",
        title: "📄 Hall Ticket Generated",
        message: `Hall ticket for ${examName} is ready. Awaiting mentor approval.`,
        type: "hallticket_generated",
        priority: "normal",
        actionUrl: "/student/halltickets",
        actionText: "View Hall Ticket",
        relatedId:
          hallTickets.find(
            (ticket) => ticket.studentId?.toString() === student._id.toString(),
          )?._id || null,
        relatedModel: "ExamHallTicket",
      });
    }

    res.status(201).json({
      success: true,
      message: `Hall tickets generated successfully! ${generatedCount} tickets created.`,
      data: {
        examId: exam._id,
        examName: exam.examName,
        totalStudents: students.length,
        generatedCount,
        skippedCount,
        hallTickets,
      },
    });
  } catch (error) {
    console.error("❌ Error generating hall tickets:", error);
    next(error);
  }
};

// ============================================
// ✅ BULK GENERATE HALL TICKETS (HOD)
// ============================================
const bulkGenerateHallTickets = async (req, res, next) => {
  try {
    const { semester, section, examName, academicYear, subjects } = req.body;

    if (
      !semester ||
      !section ||
      !examName ||
      !subjects ||
      subjects.length === 0
    ) {
      return res.status(400).json({
        success: false,
        error: "Semester, section, exam name, and subjects are required",
      });
    }

    const exam = await Exam.create({
      examName,
      academicYear,
      semester,
      section,
      subjects,
      status: "active",
      hallTicketsGenerated: false,
      department: getDepartmentCode(req, req.body.department || "CS"),
    });

    req.params.examId = exam._id;
    return generateHallTicketsForExam(req, res, next);
  } catch (error) {
    console.error("❌ Error bulk generating hall tickets:", error);
    next(error);
  }
};

// ============================================
// ✅ DOWNLOAD HALL TICKET PDF - FIXED
// ============================================
const downloadHallTicket = async (req, res, next) => {
  try {
    const { hallTicketId } = req.params;

    console.log("========================================");
    console.log("🔍 DOWNLOADING HALL TICKET");
    console.log("📋 Hall Ticket ID:", hallTicketId);
    console.log("========================================");

    const hallTicket = await ExamHallTicket.findById(hallTicketId);
    if (!hallTicket) {
      return res.status(404).json({
        success: false,
        error: "Hall ticket not found",
      });
    }

    // ✅ Check if user is authorized to download
    if (req.user.role === "Student") {
      const student = await Student.findOne({ email: req.user.email });
      if (
        !student ||
        student._id.toString() !== hallTicket.studentId.toString()
      ) {
        return res.status(403).json({
          success: false,
          error: "You can only download your own hall ticket",
        });
      }
    }

    // ============================================
    // ✅ Check if student has uploaded photo
    // ============================================
    const studentForPhoto = await Student.findById(hallTicket.studentId);

    if (!studentForPhoto) {
      return res.status(404).json({
        success: false,
        error: "Student not found",
      });
    }

    if (!studentForPhoto.photoPath) {
      console.log(
        "❌ Download blocked: Student has no photo. Student:",
        studentForPhoto.studentName,
      );
      return res.status(400).json({
        success: false,
        error:
          "Please upload your profile photo before downloading the hall ticket.",
        code: "PHOTO_REQUIRED",
        action: "UPLOAD_PHOTO",
      });
    }

    console.log("✅ Student has photo:", studentForPhoto.photoPath);

    // ============================================
    // ✅ ALWAYS REGENERATE PDF (to include latest photo, subjects, etc.)
    // ============================================
    console.log("🔄 Regenerating PDF to ensure latest data...");
    try {
      const { generateHallTicketPDF } = require("../services/pdfService");
      const pdfPath = await generateHallTicketPDF(hallTicket);
      hallTicket.pdfPath = pdfPath;
      await hallTicket.save();
      console.log("✅ PDF regenerated:", pdfPath);
    } catch (pdfError) {
      console.error("❌ PDF regeneration failed:", pdfError.message);
      return res.status(500).json({
        success: false,
        error: "Failed to generate PDF. Please try again.",
      });
    }

    // ✅ Get the PDF path
    let pdfPath = hallTicket.pdfPath;

    // ✅ Fix path if it contains full path
    if (pdfPath.includes("AttendanceHallTicketSystem")) {
      const parts = pdfPath.split("AttendanceHallTicketSystem\\backend\\");
      if (parts.length > 1) {
        pdfPath = parts[parts.length - 1];
        console.log("📁 Extracted relative path:", pdfPath);
      }
    }

    // ✅ Build full path
    const fullPath = path.join(process.cwd(), pdfPath);
    console.log("📁 Looking for PDF at:", fullPath);

    // ✅ Check if file exists
    if (!fs.existsSync(fullPath)) {
      // ✅ Try alternative path with forward slashes
      const altPath = pdfPath.replace(/\\/g, "/");
      const fullAltPath = path.join(process.cwd(), altPath);

      if (fs.existsSync(fullAltPath)) {
        console.log("✅ PDF found at alternative path");
        return res.download(fullAltPath);
      }

      console.log("❌ PDF file not found at:", fullPath);
      return res.status(404).json({
        success: false,
        error: "PDF file not found. Please try again.",
      });
    }

    console.log("✅ PDF found, downloading...");
    console.log("========================================");
    res.download(fullPath);
  } catch (error) {
    console.error("❌ Error downloading hall ticket:", error);
    next(error);
  }
};

// ============================================
// ✅ GET HALL TICKETS BY CLASS (Faculty)
// ============================================
const getHallTicketsByClass = async (req, res, next) => {
  try {
    const { semester, section, academicYear } = req.query;

    if (!semester || !section) {
      return res.status(400).json({
        success: false,
        error: "Semester and section are required",
      });
    }

    const filter = {
      ...getDepartmentFilter(req),
      semester: parseInt(semester),
      section,
    };

    if (academicYear) filter.academicYear = academicYear;

    const hallTickets = await ExamHallTicket.find(filter)
      .populate("studentId", "studentName rollNumber email")
      .populate("examId", "examName")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: hallTickets,
      count: hallTickets.length,
    });
  } catch (error) {
    console.error("❌ Error getting hall tickets by class:", error);
    next(error);
  }
};

// ============================================
// ✅ EXPORTS
// ============================================
module.exports = {
  getMyHallTicket,
  getMentorHallTickets, // ✅ ADDED - For mentor dashboard
  getPendingHallTickets,
  reviewHallTicket,
  bulkApproveEligibleHallTickets, // ✅ ADDED - Bulk approve
  getAllHallTickets,
  forceApproveHallTicket,
  generateHallTicketsForExam,
  bulkGenerateHallTickets,
  downloadHallTicket,
  getHallTicketsByClass,
};
