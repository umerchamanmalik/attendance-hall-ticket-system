// backend/src/controllers/authController.js
const bcrypt = require("bcryptjs");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const { generateToken } = require("../utils/jwt");
const { getAttendanceThreshold } = require("../utils/attendanceThreshold");

// ============================================
// ✅ REGISTER - Self-Registration Flow (Student & Faculty)
// ============================================
const register = async (req, res, next) => {
  try {
    console.log("📝 Registration request received:");
    console.log("   Body:", req.body);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      console.log("❌ Validation errors:", errors.array());
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { name, email, password, role } = req.body;

    const cleanEmail = email.toLowerCase().trim();
    console.log(`🔍 Checking registration for: ${cleanEmail}`);
    console.log(`🔍 Role requested: ${role}`);

    // ============================================
    // ✅ STUDENT REGISTRATION FLOW
    // ============================================
    if (role === "Student") {
      const student = await Student.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
      });

      if (!student) {
        console.log("❌ Student not found:", cleanEmail);
        return res.status(404).json({
          success: false,
          error: "Student not found. Please contact your HOD.",
        });
      }

      const studentName = student.studentName || student.name;
      console.log(`✅ Student found: ${studentName}`);

      if (student.isRegistered) {
        console.log("❌ Student already registered:", cleanEmail);
        return res.status(409).json({
          success: false,
          error: "Student already registered. Please login.",
        });
      }

      const existing = await User.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
      });

      if (existing) {
        console.log("❌ User already exists:", cleanEmail);
        return res.status(409).json({
          success: false,
          error: "User already exists. Please login.",
        });
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const studentDepartment =
        student.department || req.body.department || "CS";
      const user = await User.create({
        name: name.trim() || studentName,
        email: student.email,
        password: hashedPassword,
        role: "Student",
        department: studentDepartment,
        studentId: student._id,
      });

      console.log(
        `✅ Student user created: ${user.name} (${user.email}) - Dept: ${user.department}`,
      );

      student.isRegistered = true;
      student.registeredAt = new Date();
      student.userId = user._id;
      if (!student.department) student.department = studentDepartment;
      await student.save();

      console.log(`✅ Student marked as registered: ${studentName}`);

      const token = generateToken(user);

      return res.status(201).json({
        success: true,
        message: "Student registration successful!",
        data: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department,
          token: token,
        },
      });
    }

    // ============================================
    // ✅ FACULTY REGISTRATION FLOW (Flow A — Claim Pre-Created Record)
    // ============================================
    if (role === "Faculty") {
      // ✅ NEW: Look for HOD pre-created faculty record
      //   It must exist with: email match, role: "Faculty", no password yet
      const existingUser = await User.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
        role: { $in: ["Faculty", "Mentor"] },
      });

      if (!existingUser) {
        console.log("❌ No pre-created faculty record for:", cleanEmail);
        return res.status(404).json({
          success: false,
          error:
            "Faculty account not found. Your HOD must add you first. Please contact your department HOD.",
        });
      }

      // ✅ If a password already exists → they already registered
      if (existingUser.password) {
        console.log("❌ Faculty already registered:", cleanEmail);
        return res.status(409).json({
          success: false,
          error: "Faculty already registered. Please login.",
        });
      }

      // ✅ Claim the pre-created record
      const hashedPassword = await bcrypt.hash(password, 12);
      existingUser.password = hashedPassword;
      existingUser.name = name.trim() || existingUser.name;
      existingUser.facultyStatus = "approved"; // ✅ Auto-approve
      existingUser.isActive = true;
      // Note: `assignedRoleType` and `department` come from what HOD set
      // when creating the record — don't let faculty override these.

      await existingUser.save();

      console.log(
        `✅ Faculty account claimed: ${existingUser.name} (${existingUser.email}) - Dept: ${existingUser.department} - Role: ${existingUser.assignedRoleType || "Faculty"}`,
      );

      const token = generateToken(existingUser);

      return res.status(201).json({
        success: true,
        message:
          "Faculty registration successful! You now have access to the system.",
        data: {
          id: existingUser._id,
          name: existingUser.name,
          email: existingUser.email,
          role: existingUser.role,
          department: existingUser.department,
          facultyStatus: existingUser.facultyStatus,
          assignedRoleType: existingUser.assignedRoleType,
          token: token,
        },
      });
    }

    // ============================================
    // ❌ INVALID ROLE
    // ============================================
    return res.status(400).json({
      success: false,
      error: "Invalid role. Must be 'Student' or 'Faculty'.",
    });
  } catch (error) {
    console.error("❌ Registration error:", error);
    next(error);
  }
};

// ============================================
// ✅ LOGIN
// ============================================
const login = async (req, res, next) => {
  try {
    console.log("🔐 Login request received for:", req.body.email);

    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const { email, password } = req.body;
    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (!user) {
      // Check if student exists but hasn't registered yet
      const student = await Student.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
      });

      if (student && !student.isRegistered) {
        console.log("⚠️ Student exists but not registered:", cleanEmail);
        return res.status(403).json({
          success: false,
          error:
            "Please complete your registration first. Go to Register page.",
          code: "REGISTRATION_REQUIRED",
          role: "Student",
          data: {
            email: student.email,
            name: student.studentName || student.name,
          },
        });
      }

      console.log("❌ Invalid credentials - user not found:", cleanEmail);
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    // ✅ If faculty was pre-created but password not set yet
    if (!user.password) {
      console.log("⚠️ Pre-created faculty not yet registered:", cleanEmail);
      return res.status(403).json({
        success: false,
        error:
          "Your account was created by HOD but you haven't registered yet. Please go to the Register page and use this email.",
        code: "REGISTRATION_REQUIRED",
        role: user.role,
        data: {
          email: user.email,
          name: user.name,
        },
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log("❌ Invalid credentials - wrong password:", cleanEmail);
      return res.status(401).json({
        success: false,
        error: "Invalid credentials",
        code: "INVALID_CREDENTIALS",
      });
    }

    user.lastLogin = new Date();
    await user.save();

    console.log(`✅ User logged in: ${user.name} (${user.email})`);
    console.log(`📋 Role: ${user.role}`);

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        department: user.department || "CS",
        facultyStatus: user.facultyStatus || null,
        assignedRoleType: user.assignedRoleType || null,
        token: generateToken(user),
      },
    });
  } catch (error) {
    console.error("❌ Login error:", error);
    next(error);
  }
};

// ============================================
// ✅ GET PROFILE
// ============================================
const getProfile = async (req, res, next) => {
  try {
    const attendanceThreshold = await getAttendanceThreshold(
      req.user.department,
    );
    let userData = {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      department: req.user.department || "CS",
      attendanceThreshold,
      facultyStatus: req.user.facultyStatus || null,
      assignedRoleType: req.user.assignedRoleType || null,
    };

    if (req.user.role === "Student") {
      const student = await Student.findOne({
        email: { $regex: `^${req.user.email}$`, $options: "i" },
      });

      if (student) {
        userData = {
          ...userData,
          isRegistered: student.isRegistered,
          studentId: student._id,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
        };
      }
    }

    if (req.user.role === "Faculty" || req.user.role === "Mentor") {
      const allocations = await FacultyAllocation.find({
        facultyEmail: { $regex: `^${req.user.email}$`, $options: "i" },
      });

      if (allocations.length > 0) {
        userData = {
          ...userData,
          facultyId: allocations[0]._id,
          subjects: allocations.map((a) => a.subjectName),
          semesters: [...new Set(allocations.map((a) => a.semester))],
          sections: [...new Set(allocations.map((a) => a.section))],
          roleTypes: [...new Set(allocations.map((a) => a.roleType))],
          hasAllocations: true,
        };
      } else {
        userData = {
          ...userData,
          facultyId: null,
          subjects: [],
          semesters: [],
          sections: [],
          roleTypes: [],
          hasAllocations: false,
        };
      }
    }

    res.json({
      success: true,
      data: userData,
    });
  } catch (error) {
    console.error("❌ Get profile error:", error);
    next(error);
  }
};

// ============================================
// ✅ CHECK REGISTRATION STATUS
// ============================================
const checkRegistrationStatus = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    // ✅ Check Student
    const student = await Student.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (student) {
      return res.json({
        success: true,
        data: {
          exists: true,
          isRegistered: student.isRegistered || false,
          name: student.studentName || student.name,
          email: student.email,
          role: "Student",
          department: student.department || "CS",
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          message: student.isRegistered
            ? "Student is already registered. Please login."
            : "Student needs to complete registration.",
        },
      });
    }

    // ✅ Check User (includes pre-created faculty, registered faculty, etc.)
    const user = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (user) {
      const isPreCreatedFaculty =
        (user.role === "Faculty" || user.role === "Mentor") && !user.password;

      if (isPreCreatedFaculty) {
        // ✅ NEW: HOD pre-created this faculty — they should claim it
        return res.json({
          success: true,
          data: {
            exists: true,
            isRegistered: false,
            isPreCreatedFaculty: true,
            name: user.name,
            email: user.email,
            role: user.role,
            department: user.department || "CS",
            assignedRoleType: user.assignedRoleType || null,
            facultyStatus: user.facultyStatus || null,
            message:
              "Your faculty account has been created by HOD. Please set a password to activate it.",
          },
        });
      }

      // Regular registered user
      return res.json({
        success: true,
        data: {
          exists: true,
          isRegistered: true,
          name: user.name,
          email: user.email,
          role: user.role,
          department: user.department || "CS",
          facultyStatus: user.facultyStatus || null,
          assignedRoleType: user.assignedRoleType || null,
          message: "User is already registered. Please login.",
        },
      });
    }

    // ✅ Not found
    res.json({
      success: true,
      data: {
        exists: false,
        isRegistered: false,
        message: "No account found with this email.",
      },
    });
  } catch (error) {
    console.error("❌ Error checking registration status:", error);
    next(error);
  }
};

// ============================================
// ✅ CHECK USER EXISTS
// ============================================
const checkUserExists = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const cleanEmail = email.toLowerCase().trim();

    const user = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    console.log(`🔍 Checking user exists: ${cleanEmail} -> ${!!user}`);

    res.json({
      success: true,
      data: {
        exists: !!user,
        email: cleanEmail,
        role: user?.role || null,
        facultyStatus: user?.facultyStatus || null,
        hasPassword: !!user?.password,
        isPreCreatedFaculty: user?.isActive === false && !user?.password,
        message: user
          ? "User already exists. Please login."
          : "User not found. You can register.",
      },
    });
  } catch (error) {
    console.error("❌ Error checking user existence:", error);
    next(error);
  }
};

module.exports = {
  register,
  login,
  getProfile,
  checkRegistrationStatus,
  checkUserExists,
};
