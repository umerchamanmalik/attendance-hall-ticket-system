// backend/src/controllers/superAdminController.js
const Department = require("../models/Department");
const User = require("../models/User");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Exam = require("../models/Exam");
const ExamHallTicket = require("../models/ExamHallTicket");
const AuditLog = require("../models/AuditLog");
const Attendance = require("../models/Attendance");

// ============================================
// ✅ HELPER: Auto-detect HOD + compute active status
// ============================================
const enrichDepartment = async (dept) => {
  // ✅ Auto-detect HOD from User table
  let hod = null;
  if (dept.hodId) {
    hod = await User.findById(dept.hodId).select("name email role");
  }
  if (!hod) {
    hod = await User.findOne({
      role: "HOD",
      department: dept.code,
    }).select("name email role");
  }

  const deptFilter =
    dept.code === "CS"
      ? {
          $or: [
            { department: "CS" },
            { department: { $exists: false } },
            { department: null },
            { department: "" },
          ],
        }
      : { department: dept.code };

  const [students, facultyNames, exams, hallTickets, approvedTickets] =
    await Promise.all([
      Student.countDocuments(deptFilter),
      FacultyAllocation.distinct("facultyName", deptFilter),
      Exam.countDocuments(deptFilter),
      ExamHallTicket.countDocuments(deptFilter),
      ExamHallTicket.countDocuments({
        ...deptFilter,
        approvalStatus: "Approved",
      }),
    ]);

  const facultyCount = facultyNames.length;

  // ✅ Auto-compute active status
  const hasData = !!hod || students > 0 || facultyCount > 0;

  return {
    id: dept._id,
    name: dept.name,
    code: dept.code,
    isActive: hasData, // ✅ Auto-computed
    attendanceThreshold: dept.attendanceThreshold,
    hodName: hod?.name || null,
    hodEmail: hod?.email || null,
    stats: {
      students,
      faculty: facultyCount,
      exams,
      hallTickets,
      approvedTickets,
      approvalRate:
        hallTickets > 0 ? Math.round((approvedTickets / hallTickets) * 100) : 0,
    },
  };
};

// ============================================
// ✅ GET SUPER ADMIN OVERVIEW
// ============================================
const getSuperAdminOverview = async (req, res, next) => {
  try {
    const [
      totalDepartments,
      totalStudents,
      totalFacultyUsers,
      totalHods,
      totalExams,
      totalHallTickets,
      approvedHallTickets,
      departments,
    ] = await Promise.all([
      Department.countDocuments(),
      Student.countDocuments(),
      User.countDocuments({ role: "Faculty" }),
      User.countDocuments({ role: "HOD" }),
      Exam.countDocuments(),
      ExamHallTicket.countDocuments(),
      ExamHallTicket.countDocuments({ approvalStatus: "Approved" }),
      Department.find().sort({ name: 1 }),
    ]);

    // ✅ Enrich each department
    const departmentBreakdown = await Promise.all(
      departments.map(enrichDepartment),
    );

    // ✅ Active departments count (auto-computed)
    const activeDepartments = departmentBreakdown.filter(
      (d) => d.isActive === true,
    ).length;

    const recentActivity = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(10)
      .populate("userId", "name email role");

    res.json({
      success: true,
      data: {
        summary: {
          totalDepartments,
          activeDepartments,
          totalStudents,
          totalFaculty: totalFacultyUsers,
          totalHods,
          totalExams,
          totalHallTickets,
          approvedHallTickets,
          overallApprovalRate:
            totalHallTickets > 0
              ? Math.round((approvedHallTickets / totalHallTickets) * 100)
              : 0,
        },
        departmentBreakdown,
        recentActivity,
      },
    });
  } catch (error) {
    console.error("❌ Error in getSuperAdminOverview:", error);
    next(error);
  }
};

// ============================================
// ✅ GET CROSS-DEPARTMENT ANALYTICS
// ============================================
const getAllDepartmentStats = async (req, res, next) => {
  try {
    const departments = await Department.find({ isActive: true }).sort({
      name: 1,
    });

    const stats = await Promise.all(
      departments.map(async (dept) => {
        const deptFilter =
          dept.code === "CS"
            ? {
                $or: [
                  { department: "CS" },
                  { department: { $exists: false } },
                  { department: null },
                ],
              }
            : { department: dept.code };

        const [
          studentCount,
          facultyNames,
          examCount,
          totalTickets,
          approvedTickets,
          pendingTickets,
          rejectedTickets,
        ] = await Promise.all([
          Student.countDocuments(deptFilter),
          FacultyAllocation.distinct("facultyName", deptFilter),
          Exam.countDocuments(deptFilter),
          ExamHallTicket.countDocuments(deptFilter),
          ExamHallTicket.countDocuments({
            ...deptFilter,
            approvalStatus: "Approved",
          }),
          ExamHallTicket.countDocuments({
            ...deptFilter,
            approvalStatus: "Pending",
          }),
          ExamHallTicket.countDocuments({
            ...deptFilter,
            approvalStatus: "Rejected",
          }),
        ]);

        const facultyCount = facultyNames.length;

        return {
          departmentId: dept._id,
          code: dept.code,
          name: dept.name,
          attendanceThreshold: dept.attendanceThreshold,
          studentCount,
          facultyCount,
          examCount,
          hallTickets: {
            total: totalTickets,
            approved: approvedTickets,
            pending: pendingTickets,
            rejected: rejectedTickets,
            approvalRate:
              totalTickets > 0
                ? Math.round((approvedTickets / totalTickets) * 100)
                : 0,
          },
        };
      }),
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("❌ Error in getAllDepartmentStats:", error);
    next(error);
  }
};

// ============================================
// ✅ GET ALL USERS (Filtered by department and role)
// ============================================
const getAllUsers = async (req, res, next) => {
  try {
    const { role, department, search, limit = 50, page = 1 } = req.query;
    const query = {};

    if (role && role !== "ALL") query.role = role;

    if (department && department !== "ALL") {
      if (department === "CS") {
        query.$or = [
          { department: "CS" },
          { department: { $exists: false } },
          { department: null },
        ];
      } else {
        query.department = department.toUpperCase();
      }
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [users, total] = await Promise.all([
      User.find(query)
        .select("-password")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching users:", error);
    next(error);
  }
};

// ============================================
// ✅ ASSIGN HOD TO DEPARTMENT
// ============================================
const assignHodToDepartment = async (req, res, next) => {
  try {
    const { departmentCode, userId, email } = req.body;

    if (!departmentCode) {
      return res.status(400).json({
        success: false,
        error: "Department code is required",
      });
    }

    const department = await Department.findOne({
      code: departmentCode.toUpperCase(),
    });

    if (!department) {
      return res.status(404).json({
        success: false,
        error: `Department with code "${departmentCode}" not found`,
      });
    }

    let user;
    if (userId) {
      user = await User.findById(userId);
    } else if (email) {
      user = await User.findOne({
        email: { $regex: `^${email.trim()}$`, $options: "i" },
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found",
      });
    }

    user.role = "HOD";
    user.department = department.code;
    await user.save();

    department.hodId = user._id;
    department.hodName = user.name;
    department.hodEmail = user.email;
    await department.save();

    res.json({
      success: true,
      message: `${user.name} successfully assigned as HOD for ${department.name} (${department.code})`,
      data: {
        department,
        hod: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error assigning HOD:", error);
    next(error);
  }
};

module.exports = {
  getSuperAdminOverview,
  getAllDepartmentStats,
  getAllUsers,
  assignHodToDepartment,
};
