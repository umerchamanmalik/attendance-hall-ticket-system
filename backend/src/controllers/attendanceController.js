const { validationResult } = require("express-validator");
const Attendance = require("../models/Attendance");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Notification = require("../models/Notification");
const {
  getDepartmentFilter,
  getDepartmentCode,
} = require("../utils/departmentHelper");
const { getAttendanceThreshold } = require("../utils/attendanceThreshold");
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

const takeAttendance = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const {
      subjectName,
      academicYear,
      semester,
      section,
      attendanceDate,
      attendance,
    } = req.body;
    const date = new Date(attendanceDate).setHours(0, 0, 0, 0);

    const attendanceDept = getDepartmentCode(req, req.body.department || "CS");
    const students = await Student.find({
      ...getDepartmentFilter(req),
      academicYear,
      semester,
      section,
    }).select("_id");
    const studentIds = students.map((student) => student._id.toString());

    const operations = attendance
      .filter((item) => studentIds.includes(item.studentId))
      .map((item) => ({
        updateOne: {
          filter: {
            studentId: item.studentId,
            subjectName,
            attendanceDate: new Date(date),
          },
          update: {
            studentId: item.studentId,
            subjectName,
            facultyName: req.user.name,
            attendanceDate: new Date(date),
            status: item.status,
            department: attendanceDept,
          },
          upsert: true,
        },
      }));

    await Attendance.bulkWrite(operations);

    const affectedStudents = attendance.filter((item) =>
      studentIds.includes(item.studentId),
    );

    // ✅ ADDED: Sync hall tickets for all affected students (fire-and-forget)
    const uniqueAffectedStudentIds = [
      ...new Set(affectedStudents.map((item) => item.studentId.toString())),
    ];
    Promise.all(
      uniqueAffectedStudentIds.map((sid) =>
        syncStudentHallTickets(sid, {
          department: attendanceDept,
          reason: "takeAttendance",
        }),
      ),
    ).catch((err) =>
      console.error("❌ Hall ticket sync error (takeAttendance):", err.message),
    );

    for (const item of affectedStudents) {
      try {
        const student = await Student.findById(item.studentId).select(
          "_id department",
        );
        if (!student) continue;

        const department = (student.department || attendanceDept || "CS")
          .toString()
          .trim()
          .toUpperCase();
        const threshold = await getAttendanceThreshold(department);
        const updatedRecords = await Attendance.find({
          studentId: student._id,
          subjectName,
        });
        const total = updatedRecords.length;
        const present = updatedRecords.filter(
          (record) => record.status === "Present",
        ).length;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        if (total === 0 || percentage >= threshold) continue;

        const recentAlert = await Notification.findOne({
          recipientId: student._id,
          type: "attendance_alert",
          department,
          createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          message: {
            $regex: new RegExp(
              subjectName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
              "i",
            ),
          },
        });

        if (recentAlert) continue;

        await safeCreateStudentNotification({
          recipientId: student._id,
          recipientRole: "Student",
          department,
          senderId: req.user?._id || null,
          senderName: req.user?.name || "System",
          senderRole: req.user?.role || "System",
          title: `⚠️ Low Attendance in ${subjectName}`,
          message: `Your attendance is now ${percentage}%. Minimum required is ${threshold}%.`,
          type: "attendance_alert",
          priority: "urgent",
          actionUrl: "/attendance-progress",
          actionText: "View Progress",
          relatedId: null,
          relatedModel: "Attendance",
          sendEmail: true,
        });
      } catch (error) {
        console.error(
          "❌ Attendance alert notification failed:",
          error.message,
        );
      }
    }

    res.json({ success: true, message: "Attendance recorded successfully" });
  } catch (error) {
    next(error);
  }
};

const getAttendanceHistory = async (req, res, next) => {
  try {
    const { academicYear, semester, section, subjectName, attendanceDate } =
      req.query;
    const deptFilter = getDepartmentFilter(req);
    const query = { ...deptFilter };

    if (subjectName) query.subjectName = subjectName;
    if (attendanceDate)
      query.attendanceDate = new Date(attendanceDate).setHours(0, 0, 0, 0);
    if (req.user.role === "Faculty") {
      query.facultyName = req.user.name;
    }

    let attendanceList = await Attendance.find(query).populate(
      "studentId",
      "studentName rollNumber academicYear semester section attendanceVisibility",
    );

    if (academicYear || semester || section) {
      attendanceList = attendanceList.filter((record) => {
        const student = record.studentId || {};
        if (academicYear && student.academicYear !== academicYear) return false;
        if (semester && student.semester !== Number(semester)) return false;
        if (section && student.section !== section) return false;
        return true;
      });
    }

    res.json({ success: true, data: attendanceList });
  } catch (error) {
    next(error);
  }
};

const getAssignedClasses = async (req, res, next) => {
  try {
    let classes = [];

    if (req.user.role === "HOD" || req.user.role === "SuperAdmin") {
      classes = await FacultyAllocation.find(getDepartmentFilter(req));
    } else if (req.user.role === "Faculty") {
      classes = await FacultyAllocation.find({
        $and: [
          getDepartmentFilter(req),
          {
            $or: [
              {
                facultyUserId: req.user._id,
                roleType: { $in: ["Faculty", "Both"] },
              },
              {
                facultyName: req.user.name,
                roleType: { $in: ["Faculty", "Both"] },
              },
            ],
          },
        ],
      });
    } else if (req.user.role === "Mentor") {
      classes = await FacultyAllocation.find({
        $and: [
          getDepartmentFilter(req),
          {
            $or: [
              {
                facultyUserId: req.user._id,
                roleType: { $in: ["Mentor", "Both"] },
              },
              {
                facultyName: req.user.name,
                roleType: { $in: ["Mentor", "Both"] },
              },
            ],
          },
        ],
      });
    }

    res.json({ success: true, data: classes });
  } catch (error) {
    next(error);
  }
};

// ✅ Edit Attendance - Enhanced with subjectName
const editAttendance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!["Present", "Absent"].includes(status)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'Present' or 'Absent'",
      });
    }

    const attendance = await Attendance.findById(id);
    if (!attendance) {
      return res
        .status(404)
        .json({ success: false, error: "Attendance record not found" });
    }

    // Check if user is authorized
    if (req.user.role === "Faculty" || req.user.role === "Mentor") {
      const classes = await FacultyAllocation.find({
        ...getDepartmentFilter(req),
        facultyName: req.user.name,
        subjectName: attendance.subjectName,
      });
      if (classes.length === 0) {
        return res.status(403).json({
          success: false,
          error: "You are not authorized to edit this attendance record",
        });
      }
    }

    // ✅ CHANGED: Use updateOne to bypass full-document validation.
    // Some existing records (from takeAttendance bulkWrite or document
    // corrections) were saved without subjectId. Using updateOne avoids
    // Mongoose re-validating the whole document on save().
    await Attendance.updateOne({ _id: id }, { $set: { status } });

    const updatedAttendance = await Attendance.findById(id);

    // ✅ ADDED: Sync hall tickets for this student after edit
    syncStudentHallTickets(updatedAttendance.studentId, {
      department: updatedAttendance.department || "CS",
      reason: "editAttendance",
    }).catch((err) =>
      console.error("❌ Hall ticket sync error (editAttendance):", err.message),
    );

    res.json({
      success: true,
      message: "Attendance updated successfully",
      data: updatedAttendance,
    });
  } catch (error) {
    console.error("Error in editAttendance:", error);
    next(error);
  }
};

// ✅ Get Attendance (with filters) - FIXED
const getAttendance = async (req, res, next) => {
  try {
    const { studentId, subjectName, attendanceDate, startDate, endDate } =
      req.query;
    const query = { ...getDepartmentFilter(req) };

    if (studentId) query.studentId = studentId;
    if (subjectName) query.subjectName = subjectName;
    if (attendanceDate) {
      query.attendanceDate = {
        $gte: new Date(attendanceDate),
        $lt: new Date(new Date(attendanceDate).setHours(23, 59, 59, 999)),
      };
    }
    if (startDate && endDate) {
      query.attendanceDate = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    // ✅ If studentId is provided, return ALL records for that student (no filtering)
    if (!studentId) {
      // Only filter by faculty when no specific student is requested
      if (req.user.role === "Faculty" || req.user.role === "Mentor") {
        const classes = await FacultyAllocation.find({
          $or: [
            { facultyUserId: req.user._id },
            { facultyName: req.user.name },
          ],
        });
        const subjectNames = classes.map((c) => c.subjectName);
        if (subjectNames.length > 0 && !subjectName) {
          query.subjectName = { $in: subjectNames };
        }
      }
    }

    const attendance = await Attendance.find(query)
      .populate(
        "studentId",
        "studentName rollNumber academicYear semester section",
      )
      .sort({ attendanceDate: -1 });

    // Enrich data with subjectName if missing
    const enrichedAttendance = await Promise.all(
      attendance.map(async (record) => {
        const recordObj = record.toObject ? record.toObject() : record;
        if (!recordObj.subjectName && recordObj.studentId) {
          try {
            const student = recordObj.studentId;
            const allocation = await FacultyAllocation.findOne({
              semester: student.semester || 1,
              section: student.section || "A",
            }).select("subjectName");
            if (allocation) {
              recordObj.subjectName =
                allocation.subjectName || "Unknown Subject";
            } else {
              recordObj.subjectName = "Unknown Subject";
            }
          } catch (e) {
            recordObj.subjectName = "Unknown Subject";
          }
        }
        return recordObj;
      }),
    );

    res.json({ success: true, data: enrichedAttendance });
  } catch (error) {
    console.error("Error in getAttendance:", error);
    next(error);
  }
};

module.exports = {
  takeAttendance,
  getAttendanceHistory,
  getAssignedClasses,
  editAttendance,
  getAttendance,
};
