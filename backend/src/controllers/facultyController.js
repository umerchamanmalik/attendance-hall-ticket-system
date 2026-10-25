// backend/src/controllers/facultyController.js
const User = require("../models/User");
const FacultyAllocation = require("../models/FacultyAllocation");
const Student = require("../models/Student");
const { validationResult } = require("express-validator");
const { getDepartmentFilter } = require("../utils/departmentHelper");

// ============================================
// ✅ GET PENDING FACULTY (for HOD approval)
// ============================================
const getPendingFaculty = async (req, res, next) => {
  try {
    console.log("🔍 [getPendingFaculty] Fetching pending faculty...");

    const deptFilter = getDepartmentFilter(req);
    const pendingFaculty = await User.find({
      ...deptFilter,
      role: "Faculty",
      facultyStatus: "pending",
    })
      .select("name email department facultyStatus assignedRoleType createdAt lastLogin")
      .sort({ createdAt: -1 });

    console.log(`📊 Found ${pendingFaculty.length} pending faculty`);

    // ✅ For each faculty, check if they have any allocations
    const facultyWithDetails = await Promise.all(
      pendingFaculty.map(async (faculty) => {
        const allocations = await FacultyAllocation.find({
          facultyEmail: { $regex: `^${faculty.email}$`, $options: "i" },
        }).select("subjectName semester section roleType");

        return {
          _id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          department: faculty.department,
          facultyStatus: faculty.facultyStatus,
          assignedRoleType: faculty.assignedRoleType,
          createdAt: faculty.createdAt,
          lastLogin: faculty.lastLogin,
          allocationsCount: allocations.length,
          allocations: allocations,
          hasAllocations: allocations.length > 0,
        };
      }),
    );

    res.json({
      success: true,
      data: facultyWithDetails,
      count: facultyWithDetails.length,
    });
  } catch (error) {
    console.error("❌ Error in getPendingFaculty:", error);
    next(error);
  }
};

// ============================================
// ✅ GET APPROVED FACULTY (for HOD)
// ============================================
const getApprovedFaculty = async (req, res, next) => {
  try {
    console.log("🔍 [getApprovedFaculty] Fetching approved faculty...");

    const deptFilter = getDepartmentFilter(req);
    const approvedFaculty = await User.find({
      ...deptFilter,
      role: "Faculty",
      facultyStatus: "approved",
    })
      .select(
        "name email department facultyStatus assignedRoleType facultyAllocationIds createdAt lastLogin",
      )
      .sort({ name: 1 });

    console.log(`📊 Found ${approvedFaculty.length} approved faculty`);

    // ✅ For each faculty, get their allocations
    const facultyWithDetails = await Promise.all(
      approvedFaculty.map(async (faculty) => {
        const allocations = await FacultyAllocation.find({
          facultyEmail: { $regex: `^${faculty.email}$`, $options: "i" },
        }).select(
          "subjectName subjectCode academicYear semester section roleType",
        );

        return {
          _id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          facultyStatus: faculty.facultyStatus,
          assignedRoleType: faculty.assignedRoleType,
          createdAt: faculty.createdAt,
          lastLogin: faculty.lastLogin,
          allocationsCount: allocations.length,
          allocations: allocations,
        };
      }),
    );

    res.json({
      success: true,
      data: facultyWithDetails,
      count: facultyWithDetails.length,
    });
  } catch (error) {
    console.error("❌ Error in getApprovedFaculty:", error);
    next(error);
  }
};

// ============================================
// ✅ GET FACULTY STATS (for HOD Dashboard)
// ============================================
const getFacultyStats = async (req, res, next) => {
  try {
    console.log("🔍 [getFacultyStats] Fetching faculty stats...");

    const totalFaculty = await User.countDocuments({ role: "Faculty" });
    const pendingFaculty = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "pending",
    });
    const approvedFaculty = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "approved",
    });
    const rejectedFaculty = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "rejected",
    });

    const facultyOnly = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "approved",
      assignedRoleType: "Faculty",
    });

    const mentorOnly = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "approved",
      assignedRoleType: "Mentor",
    });

    const bothRoles = await User.countDocuments({
      role: "Faculty",
      facultyStatus: "approved",
      assignedRoleType: "Both",
    });

    res.json({
      success: true,
      data: {
        totalFaculty,
        pendingFaculty,
        approvedFaculty,
        rejectedFaculty,
        facultyOnly,
        mentorOnly,
        bothRoles,
      },
    });
  } catch (error) {
    console.error("❌ Error in getFacultyStats:", error);
    next(error);
  }
};

// ============================================
// ✅ UPDATE FACULTY STATUS (Approve/Reject)
// ============================================
const updateFacultyStatus = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { id } = req.params;
    const { facultyStatus, assignedRoleType, remarks } = req.body;

    console.log("🔍 [updateFacultyStatus] Updating faculty:", id);
    console.log("   New Status:", facultyStatus);
    console.log("   Assigned Role Type:", assignedRoleType);

    // ✅ Find faculty user
    const faculty = await User.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: "Faculty not found",
      });
    }

    if (faculty.role !== "Faculty") {
      return res.status(400).json({
        success: false,
        error: "User is not a faculty member",
      });
    }

    // ✅ Validate status
    if (!["approved", "rejected"].includes(facultyStatus)) {
      return res.status(400).json({
        success: false,
        error: "Status must be 'approved' or 'rejected'",
      });
    }

    // ✅ If approving, require assignedRoleType
    if (facultyStatus === "approved") {
      if (
        !assignedRoleType ||
        !["Faculty", "Mentor", "Both"].includes(assignedRoleType)
      ) {
        return res.status(400).json({
          success: false,
          error:
            "When approving, 'assignedRoleType' is required. Must be 'Faculty', 'Mentor', or 'Both'",
        });
      }
    }

    // ✅ Update faculty status
    const oldStatus = faculty.facultyStatus;
    faculty.facultyStatus = facultyStatus;

    if (facultyStatus === "approved") {
      faculty.assignedRoleType = assignedRoleType;
    } else {
      faculty.assignedRoleType = null;
    }

    await faculty.save();

    console.log(
      `✅ Faculty ${faculty.name} status updated: ${oldStatus} → ${facultyStatus}`,
    );

    res.json({
      success: true,
      message: `Faculty ${facultyStatus === "approved" ? "approved" : "rejected"} successfully`,
      data: {
        _id: faculty._id,
        name: faculty.name,
        email: faculty.email,
        facultyStatus: faculty.facultyStatus,
        assignedRoleType: faculty.assignedRoleType,
        remarks: remarks || "",
      },
    });
  } catch (error) {
    console.error("❌ Error in updateFacultyStatus:", error);
    next(error);
  }
};

// ============================================
// ✅ GET FACULTY BY EMAIL (for verification)
// ============================================
const getFacultyByEmail = async (req, res, next) => {
  try {
    const { email } = req.params;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const faculty = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
      role: "Faculty",
    }).select(
      "name email facultyStatus assignedRoleType facultyAllocationIds createdAt lastLogin",
    );

    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: "Faculty not found",
      });
    }

    // ✅ Get allocations
    const allocations = await FacultyAllocation.find({
      facultyEmail: { $regex: `^${cleanEmail}$`, $options: "i" },
    }).select("subjectName semester section roleType academicYear");

    res.json({
      success: true,
      data: {
        ...faculty.toObject(),
        allocations,
        allocationsCount: allocations.length,
      },
    });
  } catch (error) {
    console.error("❌ Error in getFacultyByEmail:", error);
    next(error);
  }
};

// ============================================
// ✅ GET FACULTY ALLOCATIONS (for a specific faculty)
// ============================================
const getFacultyAllocationsById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const faculty = await User.findById(id);
    if (!faculty) {
      return res.status(404).json({
        success: false,
        error: "Faculty not found",
      });
    }

    const allocations = await FacultyAllocation.find({
      facultyEmail: { $regex: `^${faculty.email}$`, $options: "i" },
    }).sort({ semester: 1, section: 1, subjectName: 1 });

    res.json({
      success: true,
      data: {
        faculty: {
          _id: faculty._id,
          name: faculty.name,
          email: faculty.email,
          facultyStatus: faculty.facultyStatus,
          assignedRoleType: faculty.assignedRoleType,
        },
        allocations,
        count: allocations.length,
      },
    });
  } catch (error) {
    console.error("❌ Error in getFacultyAllocationsById:", error);
    next(error);
  }
};

// ============================================
// ✅ EXPORTS
// ============================================
module.exports = {
  getPendingFaculty,
  getApprovedFaculty,
  getFacultyStats,
  updateFacultyStatus,
  getFacultyByEmail,
  getFacultyAllocationsById,
};
