const { validationResult } = require("express-validator");
const path = require("path");
const fs = require("fs");
const Exam = require("../models/Exam");
const ExamHallTicket = require("../models/ExamHallTicket");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const FacultyAllocation = require("../models/FacultyAllocation");
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

// ✅ Create Exam - DYNAMIC (Always fetches latest subjects)
const createExam = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const examDept = getDepartmentCode(req, req.body.department || "CS");
    const deptFilter =
      examDept === "CS"
        ? {
            $or: [
              { department: "CS" },
              { department: { $exists: false } },
              { department: null },
            ],
          }
        : { department: examDept };

    // ✅ ALWAYS fetch latest subjects from FacultyAllocation
    const allocations = await FacultyAllocation.find({
      ...deptFilter,
      academicYear: req.body.academicYear,
      semester: req.body.semester,
      section: req.body.section,
    }).select("subjectName");

    const subjects = allocations.map((a) => a.subjectName);

    if (subjects.length === 0) {
      return res.status(400).json({
        success: false,
        error:
          "No subjects found for this semester and section. Please allocate faculty first.",
      });
    }

    const examData = {
      ...req.body,
      subjects: subjects,
      status: "DRAFT",
      hallTicketsGenerated: false,
      department: examDept,
      createdBy: req.user._id,
    };

    const exam = await Exam.create(examData);

    res.status(201).json({
      success: true,
      message: `Exam created with ${subjects.length} subjects from FacultyAllocation.`,
      data: exam,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Get Exams
const getExams = async (req, res, next) => {
  try {
    const { academicYear, semester, section } = req.query;
    const query = {};
    if (academicYear) query.academicYear = academicYear;
    if (semester) query.semester = parseInt(semester);
    if (section) query.section = section;

    const deptFilter = getDepartmentFilter(req);
    const exams = await Exam.find({ ...query, ...deptFilter })
      .sort({ createdAt: -1 })
      .populate("createdBy", "name email");
    res.json({ success: true, data: exams });
  } catch (error) {
    next(error);
  }
};

// ✅ Get Single Exam
const getExam = async (req, res, next) => {
  try {
    const exam = await Exam.findOne({
      _id: req.params.id,
      ...getDepartmentFilter(req),
    }).populate("createdBy", "name email");
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }
    const studentCount = await Student.countDocuments({
      ...(exam.department === "CS"
        ? {
            $or: [
              { department: "CS" },
              { department: { $exists: false } },
              { department: null },
            ],
          }
        : { department: exam.department || "CS" }),
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    });
    res.json({
      success: true,
      data: { ...exam.toObject(), studentCount },
    });
  } catch (error) {
    next(error);
  }
};

// ✅ UPDATED: Update Exam - Allow date updates in GENERATED mode
const updateExam = async (req, res, next) => {
  try {
    const exam = await Exam.findOne({
      _id: req.params.id,
      ...getDepartmentFilter(req),
    });
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    if (exam.status === "COMPLETED" || exam.status === "CANCELLED") {
      return res.status(400).json({
        success: false,
        error: "Cannot update completed or cancelled exam.",
      });
    }

    if (exam.status === "GENERATED") {
      const { startDate, endDate } = req.body;

      const allowedFields = ["startDate", "endDate"];
      const requestedFields = Object.keys(req.body);
      const invalidFields = requestedFields.filter(
        (field) => !allowedFields.includes(field),
      );

      if (invalidFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Only start date and end date can be updated after hall tickets are generated. Invalid fields: ${invalidFields.join(", ")}`,
        });
      }

      if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
        return res.status(400).json({
          success: false,
          error: "End date must be on or after the start date.",
        });
      }

      if (startDate) exam.startDate = startDate;
      if (endDate) exam.endDate = endDate;
      await exam.save();

      const hallTicketCount = await ExamHallTicket.countDocuments({
        examId: exam._id,
      });

      return res.json({
        success: true,
        message: `Exam dates updated successfully. ${hallTicketCount} hall ticket(s) validity has been extended.`,
        data: exam,
      });
    }

    if (exam.status === "DRAFT") {
      const updatedExam = await Exam.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true,
        },
      );

      return res.json({
        success: true,
        message: "Exam updated successfully",
        data: updatedExam,
      });
    }

    return res.status(400).json({
      success: false,
      error: "Cannot update exam in current state.",
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Add Subject (Manual subject like PE, Yoga)
const addSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subjectName } = req.body;
    const exam = await Exam.findOne({
      _id: id,
      ...getDepartmentFilter(req),
    });
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }
    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        error: "Cannot add subjects. Hall tickets already generated.",
      });
    }
    if (exam.subjects.includes(subjectName)) {
      return res.status(400).json({
        success: false,
        error: "Subject already exists in this exam.",
      });
    }
    exam.subjects.push(subjectName);
    await exam.save();
    res.json({
      success: true,
      message: "Subject added successfully",
      data: exam,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ Remove Subject
const removeSubject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subjectName } = req.body;
    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }
    if (exam.status !== "DRAFT") {
      return res.status(400).json({
        success: false,
        error: "Cannot remove subjects. Hall tickets already generated.",
      });
    }
    exam.subjects = exam.subjects.filter((s) => s !== subjectName);
    await exam.save();
    res.json({
      success: true,
      message: "Subject removed successfully",
      data: exam,
    });
  } catch (error) {
    next(error);
  }
};

// ✅ FIX: Merge manual subjects (PE, Yoga) + FacultyAllocation subjects
const generateHallTickets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }
    if (exam.hallTicketsGenerated) {
      return res.status(400).json({
        success: false,
        error: "Hall tickets already generated for this exam.",
      });
    }

    // ✅ Normalize department (fixes case / whitespace issues)
    const examDept = (exam.department || "CS").toString().trim().toUpperCase();
    console.log(`📚 Generating hall tickets for department: "${examDept}"`);

    // ✅ Fetch subjects from FacultyAllocation — ONLY for this exam's department
    let allocations;
    if (examDept === "CS") {
      // CS fallback: include legacy records with missing department
      allocations = await FacultyAllocation.find({
        $or: [
          { department: "CS" },
          { department: { $exists: false } },
          { department: null },
          { department: "" },
        ],
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
      }).select("subjectName");
    } else {
      // Other departments: STRICT match only
      allocations = await FacultyAllocation.find({
        department: examDept,
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
      }).select("subjectName");
    }

    console.log(
      `📊 Found ${allocations.length} allocation(s) for ${examDept} ` +
        `Sem ${exam.semester} Sec ${exam.section}`,
    );

    const allocationSubjectSet = new Set(
      allocations.map((a) => a.subjectName).filter(Boolean),
    );

    // ✅ ALSO include subjects HOD manually added (e.g., PE, Yoga, Library)
    const manualSubjectSet = new Set(
      (exam.subjects || []).map((s) => (s || "").trim()).filter(Boolean),
    );

    // ✅ MERGE both sources (no duplicates)
    const mergedSubjectSet = new Set([
      ...manualSubjectSet,
      ...allocationSubjectSet,
    ]);

    const allSubjects = Array.from(mergedSubjectSet);

    if (allSubjects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No subjects found for this semester and section.",
      });
    }

    // ✅ Save merged subjects back to exam (preserves manual subjects)
    exam.subjects = allSubjects;
    await exam.save();

    console.log(
      `✅ Merged subjects: ${allSubjects.length} total ` +
        `(${allocationSubjectSet.size} from allocations, ` +
        `${manualSubjectSet.size} manual) → ${JSON.stringify(allSubjects)}`,
    );

    const studentDeptFilter =
      examDept === "CS"
        ? {
            $or: [
              { department: "CS" },
              { department: { $exists: false } },
              { department: null },
            ],
          }
        : { department: examDept };

    const students = await Student.find({
      ...studentDeptFilter,
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    });

    if (students.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No students found for this semester and section.",
      });
    }
    const thresholdsByDepartment = await getAttendanceThresholds(
      students.map((student) => student.department || examDept),
    );

    let hallTicketsGenerated = 0;
    let pdfGeneratedCount = 0;
    let pdfFailedCount = 0;

    const { generateHallTicketPDF } = require("../services/pdfService");

    const uploadDir = path.join(process.cwd(), "uploads", "halltickets");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log("📁 Created halltickets upload directory");
    }

    for (const student of students) {
      try {
        const subjectEligibility = [];

        for (const subject of allSubjects) {
          const attendanceRecords = await Attendance.find({
            studentId: student._id,
            subjectName: subject,
          });
          const totalClasses = attendanceRecords.length;
          const presentClasses = attendanceRecords.filter(
            (a) => a.status === "Present",
          ).length;

          const percentage =
            totalClasses > 0
              ? Math.round((presentClasses / totalClasses) * 100)
              : 0;

          const studentDepartment = (student.department || examDept || "CS")
            .toString()
            .trim()
            .toUpperCase();
          const attendanceThreshold =
            thresholdsByDepartment.get(studentDepartment) ?? 85;
          const isEligible = percentage >= attendanceThreshold;

          subjectEligibility.push({
            subjectName: subject,
            attendancePercentage: percentage,
            eligible: isEligible,
          });
        }

        const hallTicket = new ExamHallTicket({
          studentId: student._id,
          examId: exam._id,
          subjectEligibility,
          approvalStatus: "Pending",
          semester: exam.semester,
          section: exam.section,
          academicYear: exam.academicYear,
          department: examDept || student.department || "CS",
          generatedDate: new Date(),
          approvedBy: "Pending",
          hodRemarks: "",
          mentorRemarks: "",
        });

        await hallTicket.save();

        try {
          const pdfPath = await generateHallTicketPDF(hallTicket);
          hallTicket.pdfPath = pdfPath;
          await hallTicket.save();
          pdfGeneratedCount++;
          console.log(`✅ PDF generated for ${student.studentName}`);
        } catch (pdfError) {
          console.error(
            `❌ PDF generation failed for ${student.studentName}:`,
            pdfError.message,
          );
          pdfFailedCount++;
        }

        hallTicketsGenerated++;

        console.log(
          `✅ Hall ticket generated for ${student.studentName} (${student.rollNumber})`,
        );
      } catch (err) {
        console.error(
          `❌ Error generating hall ticket for student ${student._id}:`,
          err,
        );
      }
    }

    exam.status = "GENERATED";
    exam.hallTicketsGenerated = true;
    await exam.save();

    res.json({
      success: true,
      message: `✅ Hall tickets generated successfully for ${hallTicketsGenerated} students! PDFs generated: ${pdfGeneratedCount}, Failed: ${pdfFailedCount}`,
      data: {
        exam,
        hallTicketsCount: hallTicketsGenerated,
        subjects: allSubjects,
        pdfGenerated: pdfGeneratedCount,
        pdfFailed: pdfFailedCount,
      },
    });
  } catch (error) {
    console.error("Error generating hall tickets:", error);
    next(error);
  }
};

// ✅ Delete Exam
const deleteExam = async (req, res, next) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }
    await ExamHallTicket.deleteMany({ examId: exam._id });
    res.json({ success: true, message: "Exam deleted successfully", data: {} });
  } catch (error) {
    next(error);
  }
};

// ✅ Get Hall Tickets for a Specific Exam
const getExamHallTickets = async (req, res, next) => {
  try {
    const { examId } = req.params;
    const { approvalStatus } = req.query;

    const exam = await Exam.findById(examId);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    if (!exam.hallTicketsGenerated) {
      return res.json({
        success: true,
        data: [],
        message: "Hall tickets not generated yet",
      });
    }

    const query = { examId, ...getDepartmentFilter(req) };
    if (approvalStatus) query.approvalStatus = approvalStatus;

    const hallTickets = await ExamHallTicket.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section mentorName",
      )
      .populate(
        "examId",
        "examName academicYear semester section startDate endDate",
      )
      .sort({ createdAt: -1 });

    res.json({ success: true, data: hallTickets });
  } catch (error) {
    console.error("Error in getExamHallTickets:", error);
    next(error);
  }
};

// ✅ GET ALL HALL TICKETS - For HOD Overview
const getAllHallTickets = async (req, res, next) => {
  try {
    const { approvalStatus } = req.query;

    console.log("📋 Fetching ALL hall tickets for HOD...");

    const query = { ...getDepartmentFilter(req) };
    if (approvalStatus) query.approvalStatus = approvalStatus;

    const hallTickets = await ExamHallTicket.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section mentorName",
      )
      .populate(
        "examId",
        "examName academicYear semester section startDate endDate",
      )
      .sort({ createdAt: -1 });

    console.log(`✅ Found ${hallTickets.length} hall tickets`);

    res.json({
      success: true,
      data: hallTickets,
    });
  } catch (error) {
    console.error("Error in getAllHallTickets:", error);
    next(error);
  }
};

// ✅ HOD Override Hall Ticket
const hodOverrideHallTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, remarks } = req.body;

    console.log("🔍 HOD override for hall ticket:", id);

    const hallTicket = await ExamHallTicket.findById(id);
    if (!hallTicket) {
      return res
        .status(404)
        .json({ success: false, error: "Hall ticket not found" });
    }

    const student = await Student.findById(hallTicket.studentId);

    if (action === "approve") {
      hallTicket.subjectEligibility.forEach((subject) => {
        subject.eligible = true;
        subject.mentorOverride = true;
        subject.overrideReason = "HOD Override";
        subject.overrideRemarks = remarks || "Approved by HOD";
      });

      hallTicket.approvalStatus = "Approved";
      hallTicket.approvedBy = req.user.name || "HOD";
      hallTicket.hodApprovedBy = req.user._id;
      hallTicket.hodRemarks = remarks || "Approved by HOD";
      hallTicket.hodOverride = true;
      hallTicket.generatedDate = new Date();

      if (!hallTicket.semester && student) {
        hallTicket.semester = student.semester;
      }
      if (!hallTicket.section && student) {
        hallTicket.section = student.section;
      }
      if (!hallTicket.academicYear && student) {
        hallTicket.academicYear = student.academicYear;
      }
    } else if (action === "reject") {
      hallTicket.approvalStatus = "Rejected";
      hallTicket.hodRemarks = remarks || "Rejected by HOD";
      hallTicket.hodOverride = true;
      hallTicket.hodApprovedBy = req.user._id;
      hallTicket.approvedBy = req.user.name || "HOD";
    }

    await hallTicket.save();

    if (hallTicket.approvalStatus === "Approved") {
      try {
        const { generateHallTicketPDF } = require("../services/pdfService");
        const pdfPath = await generateHallTicketPDF(hallTicket);
        hallTicket.pdfPath = pdfPath;
        await hallTicket.save();
      } catch (pdfError) {
        console.error("PDF generation error:", pdfError);
      }
    }

    if (student) {
      await safeCreateStudentNotification({
        recipientId: student._id,
        recipientRole: "Student",
        department: student.department || "CS",
        senderId: req.user?._id || null,
        senderName: req.user?.name || "HOD",
        senderRole: req.user?.role || "HOD",
        title: "✅ Hall Ticket Approved by HOD",
        message: `Your hall ticket has been approved by HOD${remarks ? `. Remarks: ${remarks}` : "."}`,
        type: "hallticket_approved",
        priority: "high",
        actionUrl: "/student/halltickets",
        actionText: "View Hall Ticket",
        relatedId: hallTicket._id,
        relatedModel: "ExamHallTicket",
      });
    }

    res.json({
      success: true,
      message: `Hall ticket ${action}ed successfully`,
      data: hallTicket,
    });
  } catch (error) {
    console.error("Error in hodOverrideHallTicket:", error);
    next(error);
  }
};

// ✅ Refresh Exam Subjects from FacultyAllocation
const refreshExamSubjects = async (req, res, next) => {
  try {
    const { id } = req.params;
    const exam = await Exam.findOne({
      _id: id,
      ...getDepartmentFilter(req),
    });
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    if (exam.hallTicketsGenerated) {
      return res.status(400).json({
        success: false,
        error: "Cannot refresh subjects. Hall tickets already generated.",
      });
    }

    const allocations = await FacultyAllocation.find({
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    }).select("subjectName");

    const allSubjects = allocations.map((a) => a.subjectName);

    if (allSubjects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No subjects found for this semester and section.",
      });
    }

    exam.subjects = allSubjects;
    await exam.save();

    res.json({
      success: true,
      message: `Exam subjects refreshed to ${allSubjects.length} subjects.`,
      data: exam,
    });
  } catch (error) {
    console.error("Error refreshing exam subjects:", error);
    next(error);
  }
};

// ✅ Get Hall Ticket Status for a Student
const getStudentHallTicketStatus = async (req, res, next) => {
  try {
    const { studentId, examId } = req.params;

    const hallTicket = await ExamHallTicket.findOne({
      studentId,
      examId,
    }).populate("examId", "examName startDate endDate");

    if (!hallTicket) {
      return res.json({
        success: true,
        data: null,
        message: "No hall ticket found for this student",
      });
    }

    res.json({
      success: true,
      data: hallTicket,
    });
  } catch (error) {
    console.error("Error in getStudentHallTicketStatus:", error);
    next(error);
  }
};

// ✅ Get Exam Statistics
const getExamStats = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    const totalStudents = await Student.countDocuments({
      ...(exam.department === "CS"
        ? {
            $or: [
              { department: "CS" },
              { department: { $exists: false } },
              { department: null },
            ],
          }
        : { department: exam.department || "CS" }),
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    });

    const totalHallTickets = await ExamHallTicket.countDocuments({
      examId: exam._id,
    });

    const approvedHallTickets = await ExamHallTicket.countDocuments({
      examId: exam._id,
      approvalStatus: "Approved",
    });

    const pendingHallTickets = await ExamHallTicket.countDocuments({
      examId: exam._id,
      approvalStatus: "Pending",
    });

    const rejectedHallTickets = await ExamHallTicket.countDocuments({
      examId: exam._id,
      approvalStatus: "Rejected",
    });

    let eligibleStudents = 0;
    if (exam.hallTicketsGenerated) {
      const hallTickets = await ExamHallTicket.find({
        examId: exam._id,
      }).select("subjectEligibility");

      eligibleStudents = hallTickets.filter((ticket) =>
        ticket.subjectEligibility.every((s) => s.eligible === true),
      ).length;
    }

    res.json({
      success: true,
      data: {
        totalStudents,
        totalHallTickets,
        approvedHallTickets,
        pendingHallTickets,
        rejectedHallTickets,
        eligibleStudents,
        notEligibleStudents: totalStudents - eligibleStudents,
      },
    });
  } catch (error) {
    console.error("Error in getExamStats:", error);
    next(error);
  }
};

// ✅ Regenerate Hall Tickets (All or Specific Student)
// ✅ FIX: Merge manual subjects + allocation subjects
const regenerateHallTickets = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { studentId } = req.body;

    const exam = await Exam.findById(id);
    if (!exam) {
      return res.status(404).json({ success: false, error: "Exam not found" });
    }

    if (!exam.hallTicketsGenerated) {
      return res.status(400).json({
        success: false,
        error: "Hall tickets not generated yet. Please generate first.",
      });
    }

    // ✅ Normalize department
    const examDept = (exam.department || "CS").toString().trim().toUpperCase();
    console.log(`🔄 Regenerating for department: "${examDept}"`);

    // ✅ Fetch subjects from FacultyAllocation — ONLY for this exam's department
    let allocations;
    if (examDept === "CS") {
      allocations = await FacultyAllocation.find({
        $or: [
          { department: "CS" },
          { department: { $exists: false } },
          { department: null },
          { department: "" },
        ],
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
      }).select("subjectName");
    } else {
      allocations = await FacultyAllocation.find({
        department: examDept,
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
      }).select("subjectName");
    }

    console.log(`📊 Found ${allocations.length} allocation(s) for ${examDept}`);

    const allocationSubjects = allocations
      .map((a) => a.subjectName)
      .filter(Boolean);

    const manualSubjects = (exam.subjects || [])
      .map((s) => (s || "").trim())
      .filter(Boolean);

    const allSubjects = [
      ...new Set([...manualSubjects, ...allocationSubjects]),
    ];

    if (allSubjects.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No subjects found for this semester and section.",
      });
    }

    // ✅ Save merged subjects back to exam
    exam.subjects = allSubjects;
    await exam.save();

    console.log(
      `✅ Regenerate merged: ${allSubjects.length} subjects ` +
        `(${allocationSubjects.length} allocations, ${manualSubjects.length} manual) ` +
        `→ ${JSON.stringify(allSubjects)}`,
    );

    const thresholdByDepartment = new Map();

    const query = { examId: exam._id };
    if (studentId) {
      query.studentId = studentId;
    }

    const hallTickets = await ExamHallTicket.find(query);

    if (hallTickets.length === 0) {
      return res.status(404).json({
        success: false,
        error: studentId
          ? "No hall ticket found for this student."
          : "No hall tickets found to regenerate.",
      });
    }

    let updatedCount = 0;
    const { generateHallTicketPDF } = require("../services/pdfService");

    for (const hallTicket of hallTickets) {
      const student = await Student.findById(hallTicket.studentId);
      if (!student) continue;
      const studentDepartment = (student.department || examDept || "CS")
        .toString()
        .trim()
        .toUpperCase();
      if (!thresholdByDepartment.has(studentDepartment)) {
        thresholdByDepartment.set(
          studentDepartment,
          await getAttendanceThreshold(studentDepartment),
        );
      }
      const attendanceThreshold = thresholdByDepartment.get(studentDepartment);

      const subjectEligibility = [];
      for (const subject of allSubjects) {
        const attendanceRecords = await Attendance.find({
          studentId: hallTicket.studentId,
          subjectName: subject,
        });
        const totalClasses = attendanceRecords.length;
        const presentClasses = attendanceRecords.filter(
          (a) => a.status === "Present",
        ).length;
        const percentage =
          totalClasses > 0
            ? Math.round((presentClasses / totalClasses) * 100)
            : 0;

        subjectEligibility.push({
          subjectName: subject,
          attendancePercentage: percentage,
          eligible: percentage >= attendanceThreshold,
        });
      }

      hallTicket.subjectEligibility = subjectEligibility;
      hallTicket.approvalStatus = "Pending";
      hallTicket.semester = exam.semester;
      hallTicket.section = exam.section;
      hallTicket.academicYear = exam.academicYear;
      hallTicket.department = examDept || hallTicket.department || "CS";
      hallTicket.generatedDate = new Date();
      hallTicket.approvedBy = "Pending";
      hallTicket.mentorRemarks = "N/A";
      hallTicket.hodOverride = false;
      hallTicket.hodRemarks = "";

      try {
        const pdfPath = await generateHallTicketPDF(hallTicket);
        hallTicket.pdfPath = pdfPath;
      } catch (pdfError) {
        console.error(
          `PDF generation failed for ${student.studentName}:`,
          pdfError.message,
        );
      }

      await hallTicket.save();
      updatedCount++;
    }

    if (!studentId) {
      exam.status = "GENERATED";
      await exam.save();
    }

    for (const hallTicket of hallTickets) {
      const student = await Student.findById(hallTicket.studentId).select(
        "_id department studentName",
      );
      if (!student) continue;

      await safeCreateStudentNotification({
        recipientId: student._id,
        recipientRole: "Student",
        department: student.department || exam.department || "CS",
        senderId: req.user?._id || null,
        senderName: req.user?.name || "System",
        senderRole: req.user?.role || "System",
        title: "🔄 Hall Ticket Updated",
        message: "Your hall ticket has been updated.",
        type: "hallticket_generated",
        priority: "normal",
        actionUrl: "/student/halltickets",
        actionText: "View Hall Ticket",
        relatedId: hallTicket._id,
        relatedModel: "ExamHallTicket",
      });
    }

    const message = studentId
      ? `✅ Hall ticket regenerated successfully for ${hallTickets.length} student(s)!`
      : `✅ ${updatedCount} hall tickets regenerated successfully!`;

    res.json({
      success: true,
      message: message,
      data: {
        updatedCount,
        subjects: allSubjects,
        studentId: studentId || "All",
      },
    });
  } catch (error) {
    console.error("Error in regenerateHallTickets:", error);
    next(error);
  }
};

module.exports = {
  createExam,
  getExams,
  getExam,
  updateExam,
  deleteExam,
  addSubject,
  removeSubject,
  generateHallTickets,
  getExamHallTickets,
  getAllHallTickets,
  hodOverrideHallTicket,
  refreshExamSubjects,
  getStudentHallTicketStatus,
  getExamStats,
  regenerateHallTickets,
};
