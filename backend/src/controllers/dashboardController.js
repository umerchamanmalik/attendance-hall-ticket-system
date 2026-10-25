const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const ExamHallTicket = require("../models/ExamHallTicket");
const HallTicket = require("../models/HallTicket");
const { getDepartmentFilter } = require("../utils/departmentHelper");
const { getAttendanceThreshold } = require("../utils/attendanceThreshold");

const getHodOverview = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const department = req.user?.department || "CS";
    const attendanceThreshold = await getAttendanceThreshold(department);

    const totalStudents = await Student.countDocuments(deptFilter);
    const totalAllocations = await FacultyAllocation.countDocuments(deptFilter);
    const totalMentors = await FacultyAllocation.distinct("facultyName", {
      ...deptFilter,
      roleType: { $in: ["Mentor", "Both"] },
    }).then((names) => names.length);

    // ✅ Get hall ticket counts from ExamHallTicket
    const approved = await ExamHallTicket.countDocuments({
      ...deptFilter,
      approvalStatus: "Approved",
    });
    const pending = await ExamHallTicket.countDocuments({
      ...deptFilter,
      approvalStatus: "Pending",
    });
    const rejected = await ExamHallTicket.countDocuments({
      ...deptFilter,
      approvalStatus: "Rejected",
    });

    // ✅ Fallback: If no ExamHallTickets, check HallTicket model
    let totalApproved = approved;
    let totalPending = pending;
    let totalRejected = rejected;

    if (approved === 0 && pending === 0 && rejected === 0) {
      // Try the old HallTicket model as fallback
      const oldApproved = await HallTicket.countDocuments({
        ...deptFilter,
        approvalStatus: "Approved",
      });
      const oldPending = await HallTicket.countDocuments({
        ...deptFilter,
        approvalStatus: "Pending",
      });
      const oldRejected = await HallTicket.countDocuments({
        ...deptFilter,
        approvalStatus: "Rejected",
      });

      totalApproved = oldApproved || 0;
      totalPending = oldPending || 0;
      totalRejected = oldRejected || 0;
    }

    res.json({
      success: true,
      data: {
        department,
        attendanceThreshold,
        totalStudents,
        totalAllocations,
        totalMentors,
        approvedHallTickets: totalApproved,
        pendingHallTickets: totalPending,
        rejectedHallTickets: totalRejected,
      },
    });
  } catch (error) {
    console.error("Error in getHodOverview:", error);
    next(error);
  }
};

const getMentorOverview = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const mentees = await Student.find({
      ...deptFilter,
      mentorName: req.user.name,
    }).select("_id");
    const menteeIds = mentees.map((student) => student._id);

    // ✅ Get hall ticket counts from ExamHallTicket
    const approved = await ExamHallTicket.countDocuments({
      ...deptFilter,
      studentId: { $in: menteeIds },
      approvalStatus: "Approved",
    });
    const pending = await ExamHallTicket.countDocuments({
      ...deptFilter,
      studentId: { $in: menteeIds },
      approvalStatus: "Pending",
    });
    const rejected = await ExamHallTicket.countDocuments({
      ...deptFilter,
      studentId: { $in: menteeIds },
      approvalStatus: "Rejected",
    });

    // ✅ Fallback: Try old HallTicket model
    let totalApproved = approved;
    let totalPending = pending;
    let totalRejected = rejected;

    if (approved === 0 && pending === 0 && rejected === 0) {
      const oldApproved = await HallTicket.countDocuments({
        ...deptFilter,
        studentId: { $in: menteeIds },
        approvalStatus: "Approved",
      });
      const oldPending = await HallTicket.countDocuments({
        ...deptFilter,
        studentId: { $in: menteeIds },
        approvalStatus: "Pending",
      });
      const oldRejected = await HallTicket.countDocuments({
        ...deptFilter,
        studentId: { $in: menteeIds },
        approvalStatus: "Rejected",
      });

      totalApproved = oldApproved || 0;
      totalPending = oldPending || 0;
      totalRejected = oldRejected || 0;
    }

    res.json({
      success: true,
      data: {
        totalAssignedStudents: mentees.length,
        approvedHallTickets: totalApproved,
        pendingHallTickets: totalPending,
        rejectedHallTickets: totalRejected,
      },
    });
  } catch (error) {
    console.error("Error in getMentorOverview:", error);
    next(error);
  }
};

module.exports = {
  getHodOverview,
  getMentorOverview,
};
