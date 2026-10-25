// backend/src/controllers/departmentController.js
const Department = require("../models/Department");
const User = require("../models/User");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Exam = require("../models/Exam");
const { validationResult } = require("express-validator");

// ============================================
// ✅ HELPER: Enrich department with auto-computed data
// ============================================
const enrichDepartment = async (dept) => {
  // ✅ Auto-detect HOD from User table (in case Department.hodId wasn't set)
  let hod = null;
  if (dept.hodId) {
    hod = await User.findById(dept.hodId).select("name email role");
  }
  // Fallback: find HOD by department code
  if (!hod) {
    hod = await User.findOne({
      role: "HOD",
      department: dept.code,
    }).select("name email role");
  }

  // ✅ Department filter (CS treats missing/legacy data as CS)
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

  const [studentCount, facultyNames, examCount] = await Promise.all([
    Student.countDocuments(deptFilter),
    FacultyAllocation.distinct("facultyName", deptFilter),
    Exam.countDocuments(deptFilter),
  ]);

  const facultyCount = facultyNames.length;

  // ✅ Auto-compute isActive: Active if has HOD OR students OR faculty
  const hasData = !!hod || studentCount > 0 || facultyCount > 0;
  const computedIsActive = hasData
    ? true
    : dept.isActive === true
      ? false
      : false;

  return {
    ...dept.toObject(),
    hodId: hod
      ? { _id: hod._id, name: hod.name, email: hod.email, role: hod.role }
      : null,
    hodName: hod?.name || null,
    hodEmail: hod?.email || null,
    // ✅ Auto-computed status (overrides stored isActive for display)
    isActive: hasData,
    computedStatus: hasData ? "active" : "inactive",
    stats: {
      totalStudents: studentCount,
      totalFaculty: facultyCount,
      totalExams: examCount,
    },
  };
};

// ============================================
// ✅ GET ALL DEPARTMENTS (Protected)
// ============================================
const getDepartments = async (req, res, next) => {
  try {
    const { status, search } = req.query;
    const query = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { code: { $regex: search, $options: "i" } },
      ];
    }

    let departments = await Department.find(query).sort({ name: 1 });

    // ✅ Enrich all departments
    let enriched = await Promise.all(departments.map(enrichDepartment));

    // ✅ Apply status filter AFTER enrichment (based on computed status)
    if (status === "active") {
      enriched = enriched.filter((d) => d.isActive === true);
    } else if (status === "inactive") {
      enriched = enriched.filter((d) => d.isActive === false);
    }

    res.json({
      success: true,
      data: enriched,
      count: enriched.length,
    });
  } catch (error) {
    console.error("❌ Error fetching departments:", error);
    next(error);
  }
};

// ============================================
// ✅ GET PUBLIC DEPARTMENTS (For registration)
// ============================================
const getPublicDepartments = async (req, res, next) => {
  try {
    let departments = await Department.find({ isActive: true })
      .select("code name attendanceThreshold")
      .sort({ code: 1 });

    if (!departments || departments.length === 0) {
      departments = [
        {
          code: "CS",
          name: "Computer Science & Engineering",
          attendanceThreshold: 75,
        },
      ];
    }

    res.json({
      success: true,
      data: departments,
    });
  } catch (error) {
    console.error("❌ Error fetching public departments:", error);
    next(error);
  }
};

// ============================================
// ✅ GET SINGLE DEPARTMENT
// ============================================
const getDepartmentById = async (req, res, next) => {
  try {
    const { id } = req.params;
    let department;

    if (id.match(/^[0-9a-fA-F]{24}$/)) {
      department = await Department.findById(id);
    } else {
      department = await Department.findOne({ code: id.toUpperCase() });
    }

    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    const enriched = await enrichDepartment(department);

    res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error("❌ Error fetching department details:", error);
    next(error);
  }
};

// ============================================
// ✅ CREATE DEPARTMENT (SuperAdmin only)
// ============================================
const createDepartment = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, code, attendanceThreshold, description, logo } = req.body;
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();

    const existing = await Department.findOne({
      $or: [
        { code: cleanCode },
        { name: { $regex: `^${cleanName}$`, $options: "i" } },
      ],
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        error:
          existing.code === cleanCode
            ? `Department with code "${cleanCode}" already exists`
            : `Department with name "${cleanName}" already exists`,
      });
    }

    const department = await Department.create({
      name: cleanName,
      code: cleanCode,
      attendanceThreshold: attendanceThreshold || 75,
      description: description || "",
      logo: logo || null,
      isActive: true,
    });

    res.status(201).json({
      success: true,
      message: `Department ${department.name} (${department.code}) created successfully`,
      data: department,
    });
  } catch (error) {
    console.error("❌ Error creating department:", error);
    next(error);
  }
};

// ============================================
// ✅ UPDATE DEPARTMENT (SuperAdmin only)
// ============================================
const updateDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, attendanceThreshold, isActive, description, logo } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    if (name && name.trim().toLowerCase() !== department.name.toLowerCase()) {
      const existing = await Department.findOne({
        name: { $regex: `^${name.trim()}$`, $options: "i" },
        _id: { $ne: id },
      });
      if (existing) {
        return res.status(409).json({
          success: false,
          error: `Department name "${name}" is already in use`,
        });
      }
      department.name = name.trim();
    }

    if (attendanceThreshold !== undefined)
      department.attendanceThreshold = attendanceThreshold;
    if (isActive !== undefined) department.isActive = isActive;
    if (description !== undefined) department.description = description.trim();
    if (logo !== undefined) department.logo = logo;

    await department.save();

    res.json({
      success: true,
      message: "Department updated successfully",
      data: department,
    });
  } catch (error) {
    console.error("❌ Error updating department:", error);
    next(error);
  }
};

// ============================================
// ✅ DELETE / DEACTIVATE DEPARTMENT (SuperAdmin only)
// ============================================
const deleteDepartment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const department = await Department.findById(id);

    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
      });
    }

    if (department.code === "CS") {
      return res.status(400).json({
        success: false,
        error:
          "The primary Computer Science (CS) department cannot be deleted.",
      });
    }

    const studentCount = await Student.countDocuments({
      department: department.code,
    });

    if (studentCount > 0) {
      department.isActive = false;
      await department.save();
      return res.json({
        success: true,
        message: `Department has ${studentCount} students. Deactivated instead of permanent deletion.`,
        data: department,
      });
    }

    await Department.findByIdAndDelete(id);

    res.json({
      success: true,
      message: "Department deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("❌ Error deleting department:", error);
    next(error);
  }
};

// ============================================
// ✅ ASSIGN HOD TO DEPARTMENT (SuperAdmin only)
// ============================================
const assignHod = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { userId, email } = req.body;

    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({
        success: false,
        error: "Department not found",
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
        error: "User not found to assign as HOD",
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
      message: `${user.name} assigned as HOD for ${department.name}`,
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
  getDepartments,
  getPublicDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignHod,
};
