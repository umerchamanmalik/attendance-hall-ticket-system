const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const FacultyAllocation = require("../models/FacultyAllocation");
const User = require("../models/User");
const Subject = require("../models/Subject");
const {
  getDepartmentFilter,
  getDepartmentCode,
  isAuthorizedForDepartment,
} = require("../utils/departmentHelper");

// ============================================
// ✅ HELPER: Auto-approve faculty when assigned
// ============================================
const autoApproveFacultyIfPending = async (facultyUserId, roleType) => {
  try {
    if (!facultyUserId) return { wasPending: false, user: null };

    const user = await User.findById(facultyUserId);
    if (!user) return { wasPending: false, user: null };

    if (user.role !== "Faculty" && user.role !== "Mentor") {
      return { wasPending: false, user };
    }

    if (user.facultyStatus === "pending") {
      let newAssignedRoleType = roleType || "Faculty";
      if (
        user.assignedRoleType &&
        user.assignedRoleType !== newAssignedRoleType
      ) {
        if (
          (user.assignedRoleType === "Faculty" &&
            newAssignedRoleType === "Mentor") ||
          (user.assignedRoleType === "Mentor" &&
            newAssignedRoleType === "Faculty") ||
          newAssignedRoleType === "Both" ||
          user.assignedRoleType === "Both"
        ) {
          newAssignedRoleType = "Both";
        }
      }

      user.facultyStatus = "approved";
      user.assignedRoleType = newAssignedRoleType;
      await user.save();

      return { wasPending: true, user };
    }

    if (user.facultyStatus === "approved") {
      let newAssignedRoleType = user.assignedRoleType || roleType;

      if (roleType && newAssignedRoleType !== roleType) {
        if (
          (newAssignedRoleType === "Faculty" && roleType === "Mentor") ||
          (newAssignedRoleType === "Mentor" && roleType === "Faculty") ||
          roleType === "Both" ||
          newAssignedRoleType === "Both"
        ) {
          newAssignedRoleType = "Both";
        }
      }

      if (newAssignedRoleType !== user.assignedRoleType) {
        user.assignedRoleType = newAssignedRoleType;
        await user.save();
      }

      return { wasPending: false, user };
    }

    return { wasPending: false, user };
  } catch (error) {
    console.error("❌ Error in autoApproveFacultyIfPending:", error);
    return { wasPending: false, user: null };
  }
};

// ============================================
// ✅ NEW: PRE-CREATE FACULTY (HOD)
// ============================================
const preCreateFaculty = async (req, res, next) => {
  try {
    const { name, email, department, roleType } = req.body;

    if (!name || !email || !department) {
      return res.status(400).json({
        success: false,
        error: "Name, email, and department are required.",
      });
    }

    const cleanEmail = email.toLowerCase().trim();
    const allocationDept = getDepartmentCode(req, department);

    // ✅ Verify HOD can create faculty for this department
    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, allocationDept)
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only create faculty for your own department.",
      });
    }

    // ✅ Check if user already exists
    const existing = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: `A user with email ${cleanEmail} already exists.`,
      });
    }

    // ✅ Create pending faculty record (no password)
    const newUser = await User.create({
      name: name.trim(),
      email: cleanEmail,
      password: null, // ✅ Set later when faculty registers
      role: roleType === "Mentor" ? "Mentor" : "Faculty",
      department: allocationDept,
      facultyStatus: "pending", // ✅ Waiting for faculty to register
      assignedRoleType: roleType || "Faculty",
      isActive: false, // ✅ Inactive until they register
    });

    console.log(
      `✅ Pre-created faculty: ${newUser.name} (${newUser.email}) - Dept: ${newUser.department} - Role: ${newUser.assignedRoleType}`,
    );

    res.status(201).json({
      success: true,
      message: `Faculty "${name}" pre-created. They can register with ${cleanEmail}.`,
      data: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        department: newUser.department,
        role: newUser.role,
        assignedRoleType: newUser.assignedRoleType,
        facultyStatus: newUser.facultyStatus,
      },
    });
  } catch (error) {
    console.error("❌ Pre-create faculty error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to pre-create faculty.",
    });
  }
};

// ============================================
// ✅ NEW: GET ALL FACULTY FOR HOD (approved + pending)
// ============================================
const getAllFacultyForHOD = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);

    const users = await User.find({
      ...deptFilter,
      role: { $in: ["Faculty", "Mentor"] },
    })
      .select(
        "name email role facultyStatus assignedRoleType department isActive createdAt",
      )
      .sort({ facultyStatus: 1, name: 1 });

    // ✅ Separate into pre-created (pending) and active (approved)
    const pending = users.filter((u) => u.facultyStatus === "pending");
    const approved = users.filter((u) => u.facultyStatus === "approved");

    res.json({
      success: true,
      data: {
        all: users,
        pending,
        approved,
        counts: {
          total: users.length,
          pending: pending.length,
          approved: approved.length,
        },
      },
    });
  } catch (error) {
    console.error("❌ [getAllFacultyForHOD] Error:", error);
    next(error);
  }
};

// ============================================
// ✅ NEW: DELETE PRE-CREATED FACULTY (if still pending)
// ============================================
const deletePendingFaculty = async (req, res, next) => {
  try {
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    // ✅ Only allow deleting unclaimed (pending) faculty
    if (user.facultyStatus !== "pending" || user.password) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot delete an active faculty. Only pending (unregistered) faculty can be removed.",
      });
    }

    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, user.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "You can only delete faculty from your department.",
      });
    }

    await user.deleteOne();

    res.json({
      success: true,
      message: `Pending faculty "${user.name}" removed.`,
    });
  } catch (error) {
    console.error("❌ [deletePendingFaculty] Error:", error);
    next(error);
  }
};

// ============================================
// ✅ CREATE ALLOCATION
// ============================================
const createAllocation = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const {
      academicYear,
      semester,
      section,
      subjectName,
      facultyName,
      facultyUserId,
      roleType,
    } = req.body;

    let facultyId = null;
    let finalFacultyName = facultyName;
    let finalFacultyEmail = null;

    if (facultyUserId) {
      const user = await User.findById(facultyUserId);
      if (user && ["Faculty", "Mentor"].includes(user.role)) {
        facultyId = user._id;
        finalFacultyName = user.name;
        finalFacultyEmail = user.email;
      }
    }

    if (!facultyId && finalFacultyName) {
      const user = await User.findOne({
        name: finalFacultyName,
        role: { $in: ["Faculty", "Mentor"] },
      });
      if (user) {
        facultyId = user._id;
        finalFacultyName = user.name;
        finalFacultyEmail = user.email;
      }
    }

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: "Faculty not found. Please select a valid faculty member.",
      });
    }

    if (!finalFacultyEmail) {
      return res.status(400).json({
        success: false,
        error: "Faculty email not found. Please contact support.",
      });
    }

    const allocationDept = getDepartmentCode(req, req.body.department || "CS");
    let subject = await Subject.findOne({
      subjectName: subjectName,
      semester: parseInt(semester),
      section: section,
      $or: [{ department: allocationDept }, { department: { $exists: false } }],
    });

    if (!subject) {
      subject = await Subject.create({
        subjectCode: subjectName.substring(0, 4).toUpperCase() + semester,
        subjectName: subjectName,
        semester: parseInt(semester),
        academicYear: academicYear,
        section: section,
        department: allocationDept,
        isElective: false,
        isActive: true,
        createdBy: req.user._id,
      });
    }

    const { wasPending } = await autoApproveFacultyIfPending(
      facultyId,
      roleType || "Faculty",
    );

    const allocationData = {
      academicYear: academicYear,
      semester: parseInt(semester),
      section: section,
      subjectName: subjectName,
      subjectId: subject._id,
      facultyName: finalFacultyName,
      facultyEmail: finalFacultyEmail,
      facultyId: facultyId,
      facultyUserId: facultyId,
      roleType: roleType || "Both",
      department: allocationDept,
      totalClasses: req.body.totalClasses || 0,
      classesConducted: req.body.classesConducted || 0,
      classesPerWeek: req.body.classesPerWeek || 3,
    };

    const allocation = await FacultyAllocation.create(allocationData);

    await User.findByIdAndUpdate(facultyId, {
      $addToSet: { facultyAllocationIds: allocation._id },
    });

    const message = wasPending
      ? `✅ Faculty approved and assigned! ${finalFacultyName} can now login and access the dashboard.`
      : `✅ Allocation created successfully for ${finalFacultyName}.`;

    res.status(201).json({
      success: true,
      message: message,
      wasPending: wasPending,
      data: allocation,
    });
  } catch (error) {
    console.error("❌ [createAllocation] Error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create allocation",
    });
  }
};

// ============================================
// ✅ GET ALL ALLOCATIONS
// ============================================
const getAllocations = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const allocations = await FacultyAllocation.find(deptFilter).sort({
      createdAt: -1,
    });
    res.json({ success: true, data: allocations });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ GET FACULTY USERS (for allocation dropdown)
// ============================================
const getFacultyUsers = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);

    // ✅ Return both approved AND pending faculty
    const users = await User.find({
      ...deptFilter,
      role: { $in: ["Faculty", "Mentor"] },
    })
      .select(
        "name email role facultyStatus assignedRoleType department isActive",
      )
      .sort({ name: 1 });

    res.json({ success: true, data: users });
  } catch (error) {
    console.error("❌ [getFacultyUsers] Error:", error);
    next(error);
  }
};

// ============================================
// ✅ GET SINGLE ALLOCATION
// ============================================
const getAllocation = async (req, res, next) => {
  try {
    const allocation = await FacultyAllocation.findById(req.params.id);
    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }
    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, allocation.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }
    res.json({ success: true, data: allocation });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ UPDATE ALLOCATION
// ============================================
const updateAllocation = async (req, res, next) => {
  try {
    const existingAllocation = await FacultyAllocation.findById(req.params.id);
    if (!existingAllocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }

    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, existingAllocation.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }

    const allocationDept =
      req.user.role === "HOD"
        ? existingAllocation.department || req.user.department || "CS"
        : getDepartmentCode(
            req,
            req.body.department || existingAllocation.department || "CS",
          );
    let facultyUserId = req.body.facultyUserId || null;
    let facultyName = req.body.facultyName;
    let facultyEmail = null;
    const subjectName = req.body.subjectName;
    const academicYear = req.body.academicYear;
    const semester = parseInt(req.body.semester);
    const section = req.body.section;

    let facultyId = null;

    if (facultyUserId) {
      const user = await User.findById(facultyUserId);
      if (
        user &&
        ["Faculty", "Mentor"].includes(user.role) &&
        isAuthorizedForDepartment({ ...req, user }, allocationDept)
      ) {
        facultyId = user._id;
        facultyName = user.name;
        facultyEmail = user.email;
      }
    }

    if (!facultyId && facultyName) {
      const user = await User.findOne({
        name: facultyName,
        role: { $in: ["Faculty", "Mentor"] },
        ...getDepartmentFilter({
          ...req,
          user: { ...req.user, department: allocationDept },
        }),
      });
      if (user) {
        facultyId = user._id;
        facultyName = user.name;
        facultyEmail = user.email;
        facultyUserId = user._id;
      }
    }

    if (!facultyId) {
      return res.status(400).json({
        success: false,
        error: "Faculty not found. Please select a valid faculty member.",
      });
    }

    if (!facultyEmail) {
      if (existingAllocation.facultyEmail) {
        facultyEmail = existingAllocation.facultyEmail;
      } else {
        return res.status(400).json({
          success: false,
          error: "Faculty email not found. Please contact support.",
        });
      }
    }

    let subject = await Subject.findOne({
      subjectName: subjectName,
      semester: semester,
      section: section,
      ...getDepartmentFilter({
        ...req,
        user: { ...req.user, department: allocationDept },
      }),
    });

    if (!subject) {
      subject = await Subject.create({
        subjectCode: subjectName.substring(0, 4).toUpperCase() + semester,
        subjectName: subjectName,
        semester: semester,
        academicYear: academicYear,
        section: section,
        department: allocationDept,
        isElective: false,
        isActive: true,
        createdBy: req.user._id,
      });
    }

    await autoApproveFacultyIfPending(
      facultyId,
      req.body.roleType || "Faculty",
    );

    const allocation = await FacultyAllocation.findByIdAndUpdate(
      req.params.id,
      {
        academicYear: academicYear,
        semester: semester,
        section: section,
        subjectName: subjectName,
        subjectId: subject._id,
        facultyName: facultyName,
        facultyEmail: facultyEmail,
        facultyId: facultyId,
        facultyUserId: facultyUserId,
        roleType: req.body.roleType || "Both",
        department: allocationDept,
      },
      {
        new: true,
        runValidators: true,
      },
    );

    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }
    res.json({ success: true, data: allocation });
  } catch (error) {
    console.error("❌ [updateAllocation] Error:", error);
    next(error);
  }
};

// ============================================
// ✅ DELETE ALLOCATION
// ============================================
const deleteAllocation = async (req, res, next) => {
  try {
    const allocation = await FacultyAllocation.findById(req.params.id);
    if (!allocation) {
      return res
        .status(404)
        .json({ success: false, error: "Allocation not found" });
    }

    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, allocation.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }
    await FacultyAllocation.findByIdAndDelete(req.params.id);

    if (allocation.facultyId) {
      await User.findByIdAndUpdate(allocation.facultyId, {
        $pull: { facultyAllocationIds: allocation._id },
      });
    }

    res.json({ success: true, data: {} });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ DELETE ALL ALLOCATIONS
// ============================================
const deleteAllAllocations = async (req, res, next) => {
  try {
    const { semester, section } = req.query;
    const query = { ...getDepartmentFilter(req) };

    if (semester) query.semester = parseInt(semester);
    if (section) query.section = section;

    const result = await FacultyAllocation.deleteMany(query);

    res.json({
      success: true,
      message: `✅ ${result.deletedCount} allocations deleted successfully.`,
      data: {
        deletedCount: result.deletedCount,
        query: query,
      },
    });
  } catch (error) {
    console.error("Error in deleteAllAllocations:", error);
    next(error);
  }
};

// ============================================
// ✅ GET ALLOCATION SUMMARY BY SEMESTER
// ============================================
const getAllocationSummary = async (req, res, next) => {
  try {
    const summary = [];

    for (let sem = 1; sem <= 8; sem++) {
      const allocations = await FacultyAllocation.find({
        ...getDepartmentFilter(req),
        semester: sem,
      });

      const subjects = [...new Set(allocations.map((a) => a.subjectName))];
      const faculty = [...new Set(allocations.map((a) => a.facultyName))];
      const sections = [...new Set(allocations.map((a) => a.section))];

      summary.push({
        semester: sem,
        totalAllocations: allocations.length,
        totalSubjects: subjects.length,
        totalFaculty: faculty.length,
        totalSections: sections.length,
        subjects: subjects,
        faculty: faculty,
        sections: sections,
        hasAllocations: allocations.length > 0,
      });
    }

    res.json({ success: true, data: summary });
  } catch (error) {
    console.error("Error in getAllocationSummary:", error);
    next(error);
  }
};

// ============================================
// ✅ COPY ALLOCATIONS FROM PREVIOUS SEMESTER
// ============================================
const copyAllocationsFromPrevious = async (req, res, next) => {
  try {
    const { fromSemester, toSemester, section } = req.body;

    if (!fromSemester || !toSemester) {
      return res.status(400).json({
        success: false,
        error: "Both fromSemester and toSemester are required.",
      });
    }

    const sourceAllocations = await FacultyAllocation.find({
      ...getDepartmentFilter(req),
      semester: parseInt(fromSemester),
      section: section || { $exists: true },
    });

    if (sourceAllocations.length === 0) {
      return res.status(404).json({
        success: false,
        error: `No allocations found in Semester ${fromSemester}.`,
      });
    }

    const existingAllocations = await FacultyAllocation.countDocuments({
      ...getDepartmentFilter(req),
      semester: parseInt(toSemester),
    });

    if (existingAllocations > 0) {
      return res.status(400).json({
        success: false,
        error: `Semester ${toSemester} already has ${existingAllocations} allocations. Please delete them first.`,
      });
    }

    const newAllocations = [];
    for (const allocation of sourceAllocations) {
      let subject = await Subject.findOne({
        subjectName: allocation.subjectName,
        semester: parseInt(toSemester),
        section: allocation.section,
        department: allocation.department || "CS",
      });

      if (!subject) {
        subject = await Subject.create({
          subjectCode:
            allocation.subjectName.substring(0, 4).toUpperCase() + toSemester,
          subjectName: allocation.subjectName,
          semester: parseInt(toSemester),
          academicYear: allocation.academicYear,
          section: allocation.section,
          department: allocation.department || "CS",
          isElective: false,
          isActive: true,
          createdBy: req.user._id,
        });
      }

      newAllocations.push({
        subjectName: allocation.subjectName,
        subjectId: subject._id,
        facultyName: allocation.facultyName,
        facultyId: allocation.facultyId,
        facultyUserId: allocation.facultyUserId,
        semester: parseInt(toSemester),
        section: allocation.section,
        academicYear: allocation.academicYear,
        roleType: allocation.roleType,
        department: allocation.department || "CS",
      });
    }

    const result = await FacultyAllocation.insertMany(newAllocations);

    res.json({
      success: true,
      message: `✅ ${result.length} allocations copied from Semester ${fromSemester} to Semester ${toSemester}.`,
      data: {
        copiedCount: result.length,
        fromSemester: parseInt(fromSemester),
        toSemester: parseInt(toSemester),
      },
    });
  } catch (error) {
    console.error("Error in copyAllocationsFromPrevious:", error);
    next(error);
  }
};

module.exports = {
  createAllocation,
  getAllocations,
  getAllocation,
  updateAllocation,
  deleteAllocation,
  getFacultyUsers,
  deleteAllAllocations,
  getAllocationSummary,
  copyAllocationsFromPrevious,
  // ✅ NEW EXPORTS
  preCreateFaculty,
  getAllFacultyForHOD,
  deletePendingFaculty,
};
