const { validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Attendance = require("../models/Attendance");
const ExamHallTicket = require("../models/ExamHallTicket");
const User = require("../models/User");
const path = require("path");
const fs = require("fs");
const {
  getDepartmentFilter,
  getDepartmentCode,
  isAuthorizedForDepartment,
} = require("../utils/departmentHelper");
const {
  getAttendanceThreshold,
  getAttendanceThresholds,
} = require("../utils/attendanceThreshold");

// ============================================
// ✅ Generate Registration Token
// ============================================
const generateRegistrationToken = () => {
  return crypto.randomBytes(32).toString("hex");
};

// ============================================
// ✅ Add Student - NO User Creation (For HOD)
// ============================================
const addStudent = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const {
      studentName,
      email,
      rollNumber,
      academicYear,
      semester,
      section,
      mentorName,
    } = req.body;

    // ✅ Check if student already exists (CASE-INSENSITIVE)
    const existingStudent = await Student.findOne({
      email: { $regex: `^${email.toLowerCase()}$`, $options: "i" },
    });

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        error: `Student with email ${email} already exists.`,
      });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({
      email: { $regex: `^${email.toLowerCase()}$`, $options: "i" },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: `User with email ${email} already exists. Please login directly.`,
      });
    }

    // ✅ Create Student ONLY - NO User account yet
    const studentDept = getDepartmentCode(req, req.body.department || "CS");
    const student = await Student.create({
      studentName,
      email: email.toLowerCase(),
      rollNumber,
      academicYear,
      semester,
      section,
      mentorName,
      department: studentDept,
      attendanceVisibility: "Show Percentage",
      showAttendanceProgress: true,
      isRegistered: false,
    });

    console.log(
      `✅ Student profile created: ${student.studentName} (${student.email})`,
    );

    res.status(201).json({
      success: true,
      message: `Student added successfully! Student can now register using their email.`,
      data: {
        student: {
          id: student._id,
          studentName: student.studentName,
          email: student.email,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          mentorName: student.mentorName,
          isRegistered: student.isRegistered,
        },
      },
    });
  } catch (error) {
    console.error("❌ Error adding student:", error);
    next(error);
  }
};

// ============================================
// ✅ Add Faculty - WITH AUTO APPROVAL (Flow C)
// ============================================
const addFaculty = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({ success: false, errors: errors.array() });
    }

    const {
      facultyName,
      facultyEmail,
      subjectName,
      subjectCode,
      academicYear,
      semester,
      section,
      roleType,
    } = req.body;

    const cleanEmail = facultyEmail.toLowerCase().trim();

    // ✅ Check if faculty already exists in allocation
    const existingFaculty = await FacultyAllocation.findOne({
      facultyEmail: { $regex: `^${cleanEmail}$`, $options: "i" },
      subjectName,
      semester,
      section,
    });

    if (existingFaculty) {
      return res.status(409).json({
        success: false,
        error: `Faculty allocation already exists for ${facultyName} - ${subjectName}`,
      });
    }

    // ✅ Check if user already exists with this email
    let existingUser = await User.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    // ============================================
    // ✅ FLOW C: If faculty registered but pending → Approve now
    // ============================================
    let facultyUserId = existingUser?._id || null;
    let wasPending = false;

    if (existingUser) {
      console.log(`📋 Existing user found: ${existingUser.email}`);
      console.log(`   Role: ${existingUser.role}`);
      console.log(`   Faculty Status: ${existingUser.facultyStatus}`);
      console.log(`   Assigned Role Type: ${existingUser.assignedRoleType}`);

      // ✅ If user is Faculty and pending → Update status to approved
      if (
        existingUser.role === "Faculty" &&
        existingUser.facultyStatus === "pending"
      ) {
        wasPending = true;

        // ✅ Determine new assignedRoleType based on existing + new roleType
        let newAssignedRoleType = roleType || "Faculty";

        // ✅ If already has assignedRoleType, merge with new one
        if (existingUser.assignedRoleType) {
          const existingRole = existingUser.assignedRoleType;
          if (
            (existingRole === "Faculty" && roleType === "Mentor") ||
            (existingRole === "Mentor" && roleType === "Faculty") ||
            roleType === "Both"
          ) {
            newAssignedRoleType = "Both";
          } else if (existingRole === "Both" || roleType === "Both") {
            newAssignedRoleType = "Both";
          }
        }

        existingUser.facultyStatus = "approved";
        existingUser.assignedRoleType = newAssignedRoleType;
        await existingUser.save();

        console.log(
          `✅ Faculty approved: ${existingUser.name} → Role Type: ${newAssignedRoleType}`,
        );
      }

      // ✅ If user is Faculty and approved → Update assignedRoleType if needed
      else if (
        existingUser.role === "Faculty" &&
        existingUser.facultyStatus === "approved"
      ) {
        // Merge role types
        let newAssignedRoleType = existingUser.assignedRoleType || roleType;
        if (
          (newAssignedRoleType === "Faculty" && roleType === "Mentor") ||
          (newAssignedRoleType === "Mentor" && roleType === "Faculty") ||
          roleType === "Both" ||
          newAssignedRoleType === "Both"
        ) {
          newAssignedRoleType = "Both";
        }

        if (newAssignedRoleType !== existingUser.assignedRoleType) {
          existingUser.assignedRoleType = newAssignedRoleType;
          await existingUser.save();
          console.log(
            `✅ Faculty role type updated: ${existingUser.name} → ${newAssignedRoleType}`,
          );
        }
      }
    } else {
      console.log(
        `ℹ️ No user found for ${cleanEmail}. Faculty will register later.`,
      );
    }

    // ============================================
    // ✅ Create Faculty Allocation
    // ============================================
    const facultyDept = getDepartmentCode(req, req.body.department || "CS");
    const faculty = await FacultyAllocation.create({
      facultyName,
      facultyEmail: cleanEmail,
      subjectName,
      subjectCode: subjectCode || "",
      academicYear,
      semester,
      section,
      roleType: roleType || "Faculty",
      department: facultyDept,
      isRegistered: !!existingUser,
      userId: facultyUserId,
    });

    // ✅ Link allocation to user's facultyAllocationIds
    if (existingUser) {
      await User.findByIdAndUpdate(existingUser._id, {
        $addToSet: { facultyAllocationIds: faculty._id },
      });
    }

    console.log(
      `✅ Faculty allocation created: ${faculty.facultyName} (${faculty.facultyEmail}) - ${faculty.subjectName}`,
    );

    // ============================================
    // ✅ Build response message
    // ============================================
    let message = "";
    if (wasPending) {
      message = `Faculty approved and assigned! ${facultyName} can now login and access the dashboard.`;
    } else if (existingUser) {
      message = `Faculty allocation added! ${facultyName} already has an account.`;
    } else {
      message = `Faculty added successfully! ${facultyName} can register using their email.`;
    }

    res.status(201).json({
      success: true,
      message,
      data: {
        faculty: {
          id: faculty._id,
          facultyName: faculty.facultyName,
          facultyEmail: faculty.facultyEmail,
          subjectName: faculty.subjectName,
          semester: faculty.semester,
          section: faculty.section,
          roleType: faculty.roleType,
          isRegistered: faculty.isRegistered,
        },
        facultyStatus: existingUser?.facultyStatus || null,
        assignedRoleType: existingUser?.assignedRoleType || null,
        wasPending,
      },
    });
  } catch (error) {
    console.error("❌ Error adding faculty:", error);
    next(error);
  }
};

// ============================================
// ✅ Check if Student Exists (CASE-INSENSITIVE)
// ============================================
const checkStudentExists = async (req, res, next) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: "Email is required",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    console.log("🔍 Searching for email:", cleanEmail);

    // ✅ Case-insensitive search for Student
    const student = await Student.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (student) {
      console.log("✅ Student found:", student.studentName);
      return res.json({
        success: true,
        data: {
          exists: true,
          isRegistered: student.isRegistered || false,
          name: student.studentName,
          email: student.email,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          mentorName: student.mentorName,
          role: "Student",
          message: student.isRegistered
            ? "Already registered. Please login."
            : "Student found. You can register.",
        },
      });
    }

    // ✅ Check if Faculty exists
    const faculty = await FacultyAllocation.findOne({
      facultyEmail: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (faculty) {
      const user = await User.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
        role: "Faculty",
      });

      console.log("✅ Faculty found:", faculty.facultyName);
      return res.json({
        success: true,
        data: {
          exists: true,
          isRegistered: !!user || faculty.isRegistered || false,
          name: faculty.facultyName,
          email: faculty.facultyEmail,
          role: "Faculty",
          subjects: faculty.subjectName ? [faculty.subjectName] : [],
          semester: faculty.semester,
          section: faculty.section,
          message:
            !!user || faculty.isRegistered
              ? "Already registered. Please login."
              : "Faculty found. You can register.",
        },
      });
    }

    // ✅ Not found
    console.log("❌ No account found for email:", cleanEmail);
    res.json({
      success: true,
      data: {
        exists: false,
        isRegistered: false,
        name: null,
        email: cleanEmail,
        message: "No account found with this email. Please contact your HOD.",
      },
    });
  } catch (error) {
    console.error("❌ Error checking account:", error);
    next(error);
  }
};

// ============================================
// ✅ Mark Student as Registered
// ============================================
const markStudentAsRegistered = async (req, res, next) => {
  try {
    const { email } = req.body;

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
      if (student.isRegistered) {
        return res.json({
          success: true,
          message: "Student is already registered",
          data: student,
        });
      }

      student.isRegistered = true;
      student.registeredAt = new Date();
      student.registrationToken = undefined;
      student.registrationExpires = undefined;
      await student.save();

      console.log(
        `✅ Student marked as registered: ${student.studentName} (${student.email})`,
      );

      return res.json({
        success: true,
        message: "Student marked as registered successfully",
        data: student,
      });
    }

    // ✅ Check Faculty
    const faculty = await FacultyAllocation.findOne({
      facultyEmail: { $regex: `^${cleanEmail}$`, $options: "i" },
    });

    if (faculty) {
      if (faculty.isRegistered) {
        return res.json({
          success: true,
          message: "Faculty is already registered",
          data: faculty,
        });
      }

      faculty.isRegistered = true;
      faculty.registeredAt = new Date();
      await faculty.save();

      console.log(
        `✅ Faculty marked as registered: ${faculty.facultyName} (${faculty.facultyEmail})`,
      );

      return res.json({
        success: true,
        message: "Faculty marked as registered successfully",
        data: faculty,
      });
    }

    return res.status(404).json({
      success: false,
      error: "Account not found",
    });
  } catch (error) {
    console.error("❌ Error marking as registered:", error);
    next(error);
  }
};

// ============================================
// ✅ Verify Registration Token
// ============================================
const verifyRegistrationToken = async (req, res, next) => {
  try {
    const { token } = req.params;

    const student = await Student.findOne({
      registrationToken: token,
      registrationExpires: { $gt: new Date() },
      isRegistered: false,
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired registration link. Please contact your HOD.",
      });
    }

    res.json({
      success: true,
      data: {
        studentName: student.studentName,
        email: student.email,
        rollNumber: student.rollNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error verifying registration token:", error);
    next(error);
  }
};

// ============================================
// ✅ Complete Registration (Student Sets Password)
// ============================================
const completeRegistration = async (req, res, next) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: "Registration token is required",
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match",
      });
    }

    // ✅ Find student by registration token
    const student = await Student.findOne({
      registrationToken: token,
      registrationExpires: { $gt: new Date() },
      isRegistered: false,
    });

    if (!student) {
      return res.status(400).json({
        success: false,
        error: "Invalid or expired registration link. Please contact your HOD.",
      });
    }

    // ✅ Check if user already exists
    const existingUser = await User.findOne({
      email: { $regex: `^${student.email}$`, $options: "i" },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: "User already registered. Please login.",
      });
    }

    // ✅ Create User account with student's chosen password
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: student.studentName,
      email: student.email,
      password: hashedPassword,
      role: "Student",
      studentId: student._id,
    });

    // ✅ Update student registration status
    student.isRegistered = true;
    student.registeredAt = new Date();
    student.registrationToken = undefined;
    student.registrationExpires = undefined;
    student.userId = user._id;
    await student.save();

    console.log(
      `✅ Student registered successfully: ${user.name} (${user.email})`,
    );

    res.json({
      success: true,
      message: "Registration completed successfully! Please login.",
      data: {
        email: user.email,
        role: user.role,
        name: user.name,
      },
    });
  } catch (error) {
    console.error("❌ Error completing registration:", error);
    next(error);
  }
};

// ============================================
// ✅ Resend Registration Email
// ============================================
const resendRegistrationEmail = async (req, res, next) => {
  try {
    const { email } = req.body;

    const cleanEmail = email.toLowerCase().trim();

    // ✅ Check Student
    const student = await Student.findOne({
      email: { $regex: `^${cleanEmail}$`, $options: "i" },
      isRegistered: false,
    });

    if (student) {
      // ✅ Generate new token
      const registrationToken = generateRegistrationToken();
      const registrationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      student.registrationToken = registrationToken;
      student.registrationExpires = registrationExpires;
      await student.save();

      console.log(`📧 Resent registration email to student: ${email}`);
      return res.json({
        success: true,
        message: `Registration email resent to ${email}. Please check your inbox.`,
        data: { role: "Student" },
      });
    }

    // ✅ Check Faculty
    const faculty = await FacultyAllocation.findOne({
      facultyEmail: { $regex: `^${cleanEmail}$`, $options: "i" },
      isRegistered: false,
    });

    if (faculty) {
      // ✅ Generate new token for faculty
      const registrationToken = generateRegistrationToken();
      const registrationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

      // Store token in faculty allocation
      faculty.registrationToken = registrationToken;
      faculty.registrationExpires = registrationExpires;
      await faculty.save();

      console.log(`📧 Resent registration email to faculty: ${email}`);
      return res.json({
        success: true,
        message: `Registration email resent to ${email}. Please check your inbox.`,
        data: { role: "Faculty" },
      });
    }

    return res.status(404).json({
      success: false,
      error: "Account not found or already registered.",
    });
  } catch (error) {
    console.error("❌ Error resending registration email:", error);
    next(error);
  }
};

// ============================================
// ✅ Get Unregistered Students (for HOD)
// ============================================
const getUnregisteredStudents = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const students = await Student.find({
      ...deptFilter,
      isRegistered: false,
    }).select(
      "studentName email rollNumber semester section mentorName department createdAt",
    );

    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("❌ Error fetching unregistered students:", error);
    next(error);
  }
};

// ============================================
// ✅ Get Unregistered Faculty (for HOD)
// ============================================
const getUnregisteredFaculty = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const faculty = await FacultyAllocation.find({
      ...deptFilter,
      isRegistered: false,
    }).select(
      "facultyName facultyEmail subjectName semester section roleType department createdAt",
    );

    res.json({
      success: true,
      data: faculty,
    });
  } catch (error) {
    console.error("❌ Error fetching unregistered faculty:", error);
    next(error);
  }
};

// ============================================
// ✅ DELETE Student
// ============================================
const deleteStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    // ✅ ADDED: Restrict HOD deletion to their department
    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, student.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }

    // ✅ Delete User account if exists
    await User.findOneAndDelete({
      email: { $regex: `^${student.email}$`, $options: "i" },
    });

    // ✅ Delete Student record
    await Student.findByIdAndDelete(req.params.id);

    // ✅ Delete student photo if exists
    if (student.photoPath) {
      const photoPath = path.join(process.cwd(), student.photoPath);
      if (fs.existsSync(photoPath)) {
        fs.unlinkSync(photoPath);
        console.log(`🗑️ Deleted photo: ${photoPath}`);
      }
    }

    res.json({
      success: true,
      message: "Student and associated user account deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("❌ Error deleting student:", error);
    next(error);
  }
};

// ============================================
// ✅ DELETE Faculty Allocation
// ============================================
const deleteFaculty = async (req, res, next) => {
  try {
    const faculty = await FacultyAllocation.findById(req.params.id);
    if (!faculty) {
      return res
        .status(404)
        .json({ success: false, error: "Faculty allocation not found" });
    }

    // ✅ Check if any other allocations exist for this faculty
    const otherAllocations = await FacultyAllocation.findOne({
      facultyEmail: { $regex: `^${faculty.facultyEmail}$`, $options: "i" },
      _id: { $ne: faculty._id },
    });

    // ✅ Only delete User if no other allocations exist
    if (!otherAllocations) {
      await User.findOneAndDelete({
        email: { $regex: `^${faculty.facultyEmail}$`, $options: "i" },
        role: "Faculty",
      });
      console.log(`🗑️ Deleted faculty user: ${faculty.facultyEmail}`);
    }

    // ✅ Delete Faculty allocation
    await FacultyAllocation.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: "Faculty allocation deleted successfully",
      data: {},
    });
  } catch (error) {
    console.error("❌ Error deleting faculty:", error);
    next(error);
  }
};

// ============================================
// ✅ GET Students
// ============================================
const getStudents = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const students = await Student.find(deptFilter)
      .sort({ createdAt: -1 })
      .select(
        "studentName rollNumber email academicYear semester section mentorName department isRegistered createdAt",
      );
    res.json({ success: true, data: students });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ GET All Faculty Allocations
// ============================================
const getFacultyAllocations = async (req, res, next) => {
  try {
    const deptFilter = getDepartmentFilter(req);
    const faculty = await FacultyAllocation.find(deptFilter)
      .sort({ createdAt: -1 })
      .select(
        "facultyName facultyEmail subjectName subjectCode academicYear semester section roleType department isRegistered userId createdAt",
      );
    res.json({ success: true, data: faculty });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ GET Single Student
// ============================================
const getStudent = async (req, res, next) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    // ✅ ADDED: Restrict HOD access to students in their department
    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, student.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }

    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ UPDATE Student
// ============================================
const updateStudent = async (req, res, next) => {
  try {
    const existingStudent = await Student.findById(req.params.id);
    if (!existingStudent) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    // ✅ ADDED: Restrict HOD updates to their department
    if (
      req.user.role === "HOD" &&
      !isAuthorizedForDepartment(req, existingStudent.department)
    ) {
      return res.status(403).json({
        success: false,
        error: "Access denied: Not your department's record",
      });
    }

    // ✅ ADDED: Keep HOD updates within the student's existing department
    const updates =
      req.user.role === "HOD"
        ? {
            ...req.body,
            department:
              existingStudent.department || req.user.department || "CS",
          }
        : req.body;
    const student = await Student.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ GET Mentors List
// ============================================
const getMentors = async (req, res, next) => {
  try {
    console.log("🔍 [getMentors] Fetching mentors...");

    const deptFilter = getDepartmentFilter(req);
    const allocations = await FacultyAllocation.find({
      ...deptFilter,
      roleType: { $in: ["Mentor", "Both"] },
    }).select("facultyName facultyEmail department");

    const mentorNames = [...new Set(allocations.map((a) => a.facultyName))];
    console.log(
      `📊 [getMentors] Found ${mentorNames.length} mentors from FacultyAllocation`,
    );

    const mentors = mentorNames.map((name) => ({
      facultyName: name,
      roleType: "Mentor",
      value: name,
      label: name,
    }));

    if (mentors.length === 0) {
      const users = await User.find({
        ...deptFilter,
        role: { $in: ["Mentor", "Faculty"] },
      }).select("name department");

      users.forEach((user) => {
        mentors.push({
          facultyName: user.name,
          roleType: "Mentor",
          value: user.name,
          label: user.name,
        });
      });
      console.log(
        `📊 [getMentors] Found ${mentors.length} mentors from Users table`,
      );
    }

    res.json({ success: true, data: mentors });
  } catch (error) {
    console.error("❌ [getMentors] Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch mentors",
      details: error.message,
    });
  }
};

// ============================================
// ✅ GET Current Student Profile
// ============================================
const getCurrentStudentProfile = async (req, res, next) => {
  try {
    console.log("🔍 Getting current student profile for:", req.user?.email);

    if (!req.user || !req.user.email) {
      return res.status(401).json({
        success: false,
        error: "User not authenticated",
      });
    }

    // ✅ Case-insensitive search
    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });

    if (!student) {
      console.log("❌ Student profile not found for email:", req.user.email);
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    console.log("✅ Student profile found:", student.studentName);
    res.json({ success: true, data: student });
  } catch (error) {
    console.error("❌ Error getting student profile:", error);
    next(error);
  }
};

// ============================================
// ✅ GET Mentor Mentees - WITH FILTERS
// ============================================
const getMentorMentees = async (req, res, next) => {
  try {
    console.log("🔍 Getting mentees for user:", req.user);
    const mentorName = req.user.name;

    console.log("📌 Using mentor name:", mentorName);

    if (!mentorName) {
      return res.status(400).json({
        success: false,
        error: "Mentor name not found in user profile",
      });
    }

    // ✅ Build filter with query parameters
    const { semester, section, search } = req.query;
    let filter = { ...getDepartmentFilter(req), mentorName: mentorName };

    if (semester) {
      filter.semester = parseInt(semester);
    }
    if (section) {
      filter.section = section;
    }
    if (search) {
      const searchRegex = new RegExp(search, "i");
      filter.$and = [
        ...(filter.$and || []),
        {
          $or: [
            { studentName: searchRegex },
            { rollNumber: searchRegex },
            { email: searchRegex },
          ],
        },
      ];
    }

    // ✅ FIX: Include mentorName in the select
    const mentees = await Student.find(filter).select(
      "studentName rollNumber academicYear semester section department mentorName attendanceVisibility showAttendanceProgress isRegistered",
    );
    const attendanceThreshold = await getAttendanceThreshold(
      req.user.department,
    );

    console.log(`📊 Found ${mentees.length} mentees for mentor: ${mentorName}`);

    res.json({
      success: true,
      data: mentees.map((student) => ({
        ...student.toObject(),
        attendanceThreshold,
      })),
    });
  } catch (error) {
    console.error("❌ Error getting mentees:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch mentees",
      details: error.message,
    });
  }
};

// ============================================
// ✅ GET Students by Class
// ============================================
const getStudentsByClass = async (req, res, next) => {
  try {
    const { academicYear, semester, section } = req.query;
    if (!academicYear || !semester || !section) {
      return res.status(422).json({
        success: false,
        error: "academicYear, semester and section required",
      });
    }

    if (!["HOD", "Faculty", "Mentor"].includes(req.user.role)) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    // ✅ ADDED: Scope class results to the user's department
    const students = await Student.find({
      ...getDepartmentFilter(req),
      academicYear,
      semester: Number(semester),
      section,
    }).select(
      "_id studentName rollNumber academicYear semester section attendanceVisibility department",
    );

    const attendanceThreshold = await getAttendanceThreshold(
      req.user.department,
    );

    res.json({
      success: true,
      data: students.map((student) => ({
        ...student.toObject(),
        attendanceThreshold,
      })),
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ UPDATE Attendance Visibility
// ============================================
const updateAttendanceVisibility = async (req, res, next) => {
  try {
    const { attendanceVisibility } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    if (req.user.role === "Mentor" && student.mentorName !== req.user.name) {
      return res
        .status(403)
        .json({ success: false, error: "Forbidden: not your mentee" });
    }

    if (
      !["Show Percentage", "Hide Percentage"].includes(attendanceVisibility)
    ) {
      return res.status(422).json({
        success: false,
        error: "Invalid attendance visibility option",
      });
    }

    student.attendanceVisibility = attendanceVisibility;
    await student.save();
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ Student Profile Management
// ============================================
const getStudentProfile = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }
    res.json({ success: true, data: student });
  } catch (error) {
    next(error);
  }
};

const updateStudentProfile = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });
    if (!student) {
      return res.status(404).json({
        success: false,
        error: "Student profile not found",
      });
    }

    const allowedUpdates = [
      "contactNumber",
      "address",
      "guardianName",
      "guardianContact",
      "guardianRelation",
      "emergencyContact",
      "emergencyContactName",
      "dateOfBirth",
      "gender",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    const updatedStudent = await Student.findByIdAndUpdate(
      student._id,
      { $set: updates },
      { new: true, runValidators: true },
    );

    res.json({
      success: true,
      message: "Profile updated successfully",
      data: updatedStudent,
    });
  } catch (error) {
    next(error);
  }
};

const uploadStudentPhoto = async (req, res, next) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student profile not found" });
    }

    if (student.photoPath) {
      const oldPhotoPath = path.join(process.cwd(), student.photoPath);
      if (fs.existsSync(oldPhotoPath)) {
        fs.unlinkSync(oldPhotoPath);
        console.log("🗑️ Deleted old photo:", oldPhotoPath);
      }
    }

    const photoPath = `/uploads/students/${req.file.filename}`;
    student.photoPath = photoPath;
    await student.save();

    const baseUrl = process.env.REACT_APP_API_URL || "http://localhost:5000";
    const photoUrl = `${baseUrl}${photoPath}`;

    res.json({
      success: true,
      message: "Photo uploaded successfully",
      data: {
        photoPath: photoPath,
        photoUrl: photoUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

const deleteStudentPhoto = async (req, res, next) => {
  try {
    const student = await Student.findOne({
      email: { $regex: `^${req.user.email}$`, $options: "i" },
    });
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student profile not found" });
    }

    if (!student.photoPath) {
      return res
        .status(400)
        .json({ success: false, error: "No photo to delete" });
    }

    const photoPath = path.join(process.cwd(), student.photoPath);
    if (fs.existsSync(photoPath)) {
      fs.unlinkSync(photoPath);
      console.log("🗑️ Deleted photo:", photoPath);
    }

    student.photoPath = null;
    await student.save();

    res.json({
      success: true,
      message: "Photo deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ Search Students - FILTERED BY MENTOR
// ============================================
const searchStudents = async (req, res, next) => {
  try {
    const { query } = req.query;

    console.log("🔍 Search query:", query);
    console.log("👤 User role:", req.user?.role);
    console.log("👤 User name:", req.user?.name);

    if (!query || query.trim() === "") {
      return res.json({ success: true, data: [] });
    }

    const searchRegex = new RegExp(query, "i");

    // ✅ Build filter
    // ✅ ADDED: Combine department scope with the search conditions
    let filter = {
      $and: [
        getDepartmentFilter(req),
        {
          $or: [
            { studentName: searchRegex },
            { rollNumber: searchRegex },
            { email: searchRegex },
          ],
        },
      ],
    };

    // ✅ If user is Mentor or Faculty, only show their mentees
    if (req.user.role === "Mentor" || req.user.role === "Faculty") {
      filter.mentorName = req.user.name;
      console.log("🔍 Filtering by mentor:", req.user.name);
    }

    const students = await Student.find(filter)
      .select(
        "studentName rollNumber email academicYear semester section mentorName isRegistered department",
      )
      .limit(20);

    const thresholdsByDepartment = await getAttendanceThresholds(
      students.map((student) => student.department || "CS"),
    );

    console.log(`📋 Found ${students.length} students matching search`);

    const studentsWithInfo = await Promise.all(
      students.map(async (student) => {
        const attendanceRecords = await Attendance.find({
          studentId: student._id,
        });
        const total = attendanceRecords.length;
        const present = attendanceRecords.filter(
          (r) => r.status === "Present",
        ).length;
        const attendancePercentage =
          total > 0 ? Math.round((present / total) * 100) : 0;

        const hallTicket = await ExamHallTicket.findOne({
          studentId: student._id,
        }).sort({ createdAt: -1 });

        return {
          ...student.toObject(),
          attendancePercentage,
          attendanceThreshold:
            thresholdsByDepartment.get(
              (student.department || "CS").trim().toUpperCase(),
            ) ?? 85,
          hallTicketStatus: hallTicket?.approvalStatus || "N/A",
        };
      }),
    );

    res.json({ success: true, data: studentsWithInfo });
  } catch (error) {
    console.error("Search error:", error);
    next(error);
  }
};

// ============================================
// ✅ Get Student Attendance Details
// ============================================
const getStudentAttendanceDetails = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    console.log("🔍 Fetching attendance details for student ID:", studentId);

    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, error: "Student ID is required" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      console.log("❌ Student not found:", studentId);
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    console.log("✅ Found student:", student.studentName);
    const attendanceThreshold = await getAttendanceThreshold(
      student.department,
    );

    const attendanceRecords = await Attendance.find({
      studentId: student._id,
    }).sort({ attendanceDate: -1 });

    console.log(`📊 Found ${attendanceRecords.length} attendance records`);

    if (attendanceRecords.length === 0) {
      return res.json({
        success: true,
        data: {
          attendanceThreshold,
          student: {
            name: student.studentName,
            rollNumber: student.rollNumber,
            semester: student.semester,
            section: student.section,
            mentorName: student.mentorName,
          },
          summary: {
            total: 0,
            present: 0,
            absent: 0,
            percentage: 0,
          },
          subjectSummary: [],
          records: [],
          message: "No attendance records found for this student.",
        },
      });
    }

    const total = attendanceRecords.length;
    const present = attendanceRecords.filter(
      (r) => r.status === "Present",
    ).length;
    const absent = attendanceRecords.filter(
      (r) => r.status === "Absent",
    ).length;
    const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

    const subjects = {};
    attendanceRecords.forEach((record) => {
      if (!subjects[record.subjectName]) {
        subjects[record.subjectName] = {
          subjectName: record.subjectName,
          total: 0,
          present: 0,
          absent: 0,
          records: [],
        };
      }
      subjects[record.subjectName].total++;
      if (record.status === "Present") {
        subjects[record.subjectName].present++;
      } else {
        subjects[record.subjectName].absent++;
      }
      subjects[record.subjectName].records.push({
        date: record.attendanceDate,
        status: record.status,
        facultyName: record.facultyName,
      });
    });

    const subjectSummary = Object.values(subjects);

    res.json({
      success: true,
      data: {
        attendanceThreshold,
        student: {
          name: student.studentName,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          mentorName: student.mentorName,
        },
        summary: {
          total,
          present,
          absent,
          percentage,
        },
        subjectSummary,
        records: attendanceRecords,
      },
    });
  } catch (error) {
    console.error("Error fetching student attendance details:", error);
    next(error);
  }
};

// ============================================
// ✅ Attendance Progress Tracker - FILTERED BY SEMESTER
// ============================================
const getAttendanceProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    console.log("========================================");
    console.log("🔍 GET ATTENDANCE PROGRESS");
    console.log("📋 Student ID:", studentId);
    console.log("👤 User:", req.user?.email);
    console.log("👤 Role:", req.user?.role);
    console.log("========================================");

    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, error: "Student ID is required" });
    }

    // ✅ Check if user is authorized - FIXED with case-insensitive
    if (req.user.role === "Student") {
      const currentStudent = await Student.findOne({
        email: { $regex: `^${req.user.email}$`, $options: "i" },
      });

      if (!currentStudent) {
        console.log("❌ Student not found for email:", req.user.email);
        return res.status(404).json({
          success: false,
          error: "Student profile not found",
        });
      }

      console.log("🔍 Current Student ID:", currentStudent._id.toString());
      console.log("🔍 Requested Student ID:", studentId);

      if (currentStudent._id.toString() !== studentId) {
        console.log("❌ Student ID mismatch - Forbidden");
        return res.status(403).json({
          success: false,
          error: "Forbidden: You can only view your own attendance",
        });
      }

      console.log("✅ Student authorized:", currentStudent.studentName);
    }

    const student = await Student.findById(studentId);
    if (!student) {
      console.log("❌ Student not found:", studentId);
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    console.log("✅ Student found:", student.studentName);
    const attendanceThreshold = await getAttendanceThreshold(
      student.department,
    );
    console.log("📋 Semester:", student.semester);
    console.log("📋 Section:", student.section);
    console.log("📋 Academic Year:", student.academicYear);
    console.log("📋 showAttendanceProgress:", student.showAttendanceProgress);
    console.log("📋 attendanceVisibility:", student.attendanceVisibility);

    const isProgressVisible = student.showAttendanceProgress !== false;
    const isPercentageVisible =
      student.attendanceVisibility === "Show Percentage";

    if (!isProgressVisible || !isPercentageVisible) {
      console.log("ℹ️ Attendance progress is disabled for this student");
      return res.json({
        success: true,
        data: {
          studentName: student.studentName,
          attendanceThreshold,
          semester: student.semester,
          section: student.section,
          subjectProgress: [],
          summary: {
            totalSubjects: 0,
            eligibleSubjects: 0,
            notEligibleSubjects: 0,
            overallAttendance: 0,
          },
          alerts: [],
          message: "Attendance progress is disabled by your mentor.",
          disabled: true,
        },
      });
    }

    // ✅ Get attendance records
    const attendanceRecords = await Attendance.find({
      studentId: student._id,
    }).sort({ attendanceDate: 1 });

    console.log(`📊 Found ${attendanceRecords.length} attendance records`);

    if (attendanceRecords.length === 0) {
      console.log("ℹ️ No attendance records found");
      return res.json({
        success: true,
        data: {
          studentName: student.studentName,
          attendanceThreshold,
          semester: student.semester,
          section: student.section,
          subjectProgress: [],
          summary: {
            totalSubjects: 0,
            eligibleSubjects: 0,
            notEligibleSubjects: 0,
            overallAttendance: 0,
          },
          alerts: [],
          message: "No attendance records found yet. Please attend classes.",
        },
      });
    }

    // ✅ Get faculty allocations for student's current semester
    const allocations = await FacultyAllocation.find({
      academicYear: student.academicYear,
      semester: student.semester,
      section: student.section,
    }).select("subjectName facultyName roleType");

    console.log(
      `📊 Found ${allocations.length} faculty allocations for Semester ${student.semester}`,
    );

    // ✅ Get the list of subjects for current semester
    const semesterSubjects = allocations.map((a) => a.subjectName);
    console.log(`📋 Semester ${student.semester} Subjects:`, semesterSubjects);

    // ✅ Calculate subject-wise attendance
    const subjectTotals = {};
    attendanceRecords.forEach((record) => {
      const subjectName = record.subjectName || "Unknown";

      // ✅ ONLY include subjects from current semester
      if (semesterSubjects.includes(subjectName)) {
        if (!subjectTotals[subjectName]) {
          subjectTotals[subjectName] = {
            total: 0,
            present: 0,
            absent: 0,
          };
        }
        subjectTotals[subjectName].total += 1;
        if (record.status === "Present") {
          subjectTotals[subjectName].present += 1;
        } else {
          subjectTotals[subjectName].absent += 1;
        }
      }
    });

    const subjectNames = Object.keys(subjectTotals);
    console.log(
      `📋 Subjects with attendance (Semester ${student.semester} only):`,
      subjectNames,
    );

    if (subjectNames.length === 0) {
      console.log("ℹ️ No attendance records for current semester subjects");
      return res.json({
        success: true,
        data: {
          studentName: student.studentName,
          attendanceThreshold,
          semester: student.semester,
          section: student.section,
          subjectProgress: [],
          summary: {
            totalSubjects: 0,
            eligibleSubjects: 0,
            notEligibleSubjects: 0,
            overallAttendance: 0,
          },
          alerts: [],
          message: `No attendance records found for Semester ${student.semester} subjects yet.`,
        },
      });
    }

    const subjectProgress = subjectNames.map((subjectName) => {
      const subjectData = subjectTotals[subjectName] || {
        total: 0,
        present: 0,
        absent: 0,
      };

      const totalClasses = subjectData.total;
      const presentClasses = subjectData.present;
      const absentClasses = subjectData.absent;

      const attendancePercentage =
        totalClasses > 0
          ? Math.round((presentClasses / totalClasses) * 100)
          : 0;

      let classesNeeded = 0;
      if (attendancePercentage < attendanceThreshold && totalClasses > 0) {
        const targetPresent = Math.ceil(
          (attendanceThreshold / 100) * totalClasses,
        );
        classesNeeded = Math.max(0, targetPresent - presentClasses);
      }

      let safeToSkip = 0;
      if (
        attendanceThreshold > 0 &&
        attendancePercentage > attendanceThreshold &&
        totalClasses > 0
      ) {
        const thresholdRatio = attendanceThreshold / 100;
        const maxAbsent = Math.floor(
          (presentClasses - thresholdRatio * totalClasses) / thresholdRatio,
        );
        safeToSkip = Math.max(0, maxAbsent);
      }

      let color = "danger";
      let statusText = "Needs Attention";
      if (attendancePercentage >= attendanceThreshold) {
        color = "success";
        statusText = "Eligible";
      } else if (attendancePercentage >= attendanceThreshold - 10) {
        color = "warning";
        statusText = "At Risk";
      } else {
        color = "danger";
        statusText = "Critical";
      }

      const facultyName =
        allocations.find((allocation) => allocation.subjectName === subjectName)
          ?.facultyName || "N/A";

      return {
        subjectId: subjectName,
        subjectName: subjectName,
        subjectCode: "",
        facultyName: facultyName,
        totalClasses: totalClasses,
        presentClasses: presentClasses,
        absentClasses: absentClasses,
        attendancePercentage: attendancePercentage,
        classesNeeded: classesNeeded,
        safeToSkip: safeToSkip,
        color: color,
        statusText: statusText,
        isEligible: attendancePercentage >= attendanceThreshold,
      };
    });

    const totalSubjects = subjectProgress.length;
    const eligibleSubjects = subjectProgress.filter((s) => s.isEligible).length;
    const notEligibleSubjects = totalSubjects - eligibleSubjects;

    const avgAttendance =
      totalSubjects > 0
        ? Math.round(
            subjectProgress.reduce(
              (sum, s) => sum + s.attendancePercentage,
              0,
            ) / totalSubjects,
          )
        : 0;

    const alerts = subjectProgress
      .filter((s) => s.attendancePercentage < attendanceThreshold)
      .map((s) => ({
        subjectName: s.subjectName,
        attendancePercentage: s.attendancePercentage,
        classesNeeded: s.classesNeeded,
        severity:
          s.attendancePercentage < attendanceThreshold - 10
            ? "critical"
            : "warning",
      }));

    console.log(
      `✅ Returning ${subjectProgress.length} subjects (Semester ${student.semester} only)`,
    );
    console.log("========================================");

    res.json({
      success: true,
      data: {
        studentName: student.studentName,
        attendanceThreshold,
        semester: student.semester,
        section: student.section,
        subjectProgress: subjectProgress,
        summary: {
          totalSubjects: totalSubjects,
          eligibleSubjects: eligibleSubjects,
          notEligibleSubjects: notEligibleSubjects,
          overallAttendance: avgAttendance,
        },
        alerts: alerts,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching attendance progress:", error);
    console.log("========================================");
    next(error);
  }
};
// ============================================
// ✅ Toggle Attendance Progress
// ============================================
const toggleAttendanceProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { show } = req.body;

    console.log("🔧 Toggling attendance progress for student:", studentId);
    console.log("   Show:", show);

    const student = await Student.findById(studentId);
    if (!student) {
      return res.status(404).json({
        success: false,
        message: "Student not found",
      });
    }

    student.showAttendanceProgress = show;
    student.attendanceVisibility = show ? "Show Percentage" : "Hide Percentage";
    await student.save();

    console.log(
      `✅ Attendance progress ${show ? "enabled" : "disabled"} for ${student.studentName}`,
    );

    res.json({
      success: true,
      message: `Attendance progress ${show ? "enabled" : "disabled"} successfully`,
      data: {
        showAttendanceProgress: student.showAttendanceProgress,
        attendanceVisibility: student.attendanceVisibility,
        studentName: student.studentName,
        rollNumber: student.rollNumber,
      },
    });
  } catch (error) {
    console.error("❌ Error toggling attendance progress:", error);
    res.status(500).json({
      success: false,
      message: "Error toggling attendance progress",
      error: error.message,
    });
  }
};

// ============================================
// ✅ GET Student Analytics
// ============================================
const getStudentAnalytics = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    if (!studentId) {
      return res
        .status(400)
        .json({ success: false, error: "Student ID is required" });
    }

    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    const attendanceThreshold = await getAttendanceThreshold(
      student.department,
    );

    const records = await Attendance.find({ studentId: student._id }).sort({
      attendanceDate: 1,
    });

    const subjectBreakdown = {};
    const dailyData = {};
    let totalRecords = records.length;
    let presentRecords = 0;

    for (const record of records) {
      const subject = record.subjectName || "Unknown";
      const date = record.attendanceDate.toISOString().split("T")[0];

      if (!subjectBreakdown[subject]) {
        subjectBreakdown[subject] = { total: 0, present: 0, absent: 0 };
      }
      subjectBreakdown[subject].total++;
      if (record.status === "Present") {
        subjectBreakdown[subject].present++;
        presentRecords++;
      } else {
        subjectBreakdown[subject].absent++;
      }

      if (!dailyData[date]) {
        dailyData[date] = { present: 0, absent: 0, total: 0 };
      }
      dailyData[date].total++;
      if (record.status === "Present") {
        dailyData[date].present++;
      } else {
        dailyData[date].absent++;
      }
    }

    const subjectStats = Object.keys(subjectBreakdown).map((key) => ({
      subjectName: key,
      ...subjectBreakdown[key],
      percentage:
        subjectBreakdown[key].total > 0
          ? Math.round(
              (subjectBreakdown[key].present / subjectBreakdown[key].total) *
                100,
            )
          : 0,
      status:
        subjectBreakdown[key].total > 0
          ? (subjectBreakdown[key].present / subjectBreakdown[key].total) *
              100 >=
            attendanceThreshold
            ? "Eligible"
            : (subjectBreakdown[key].present / subjectBreakdown[key].total) *
                  100 >=
                attendanceThreshold - 10
              ? "At Risk"
              : "Needs Attention"
          : "No Data",
    }));

    const today = new Date();
    const trendData = [];
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split("T")[0];
      const dayData = dailyData[dateStr] || { present: 0, absent: 0, total: 0 };
      trendData.push({
        date: dateStr,
        day: date.toLocaleDateString("en-US", { weekday: "short" }),
        ...dayData,
        percentage:
          dayData.total > 0
            ? Math.round((dayData.present / dayData.total) * 100)
            : 0,
      });
    }

    const overallPercentage =
      totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

    let overallStatus = "No Data";
    let statusColor = "secondary";
    if (totalRecords > 0) {
      if (overallPercentage >= attendanceThreshold) {
        overallStatus = "Eligible ✅";
        statusColor = "success";
      } else if (overallPercentage >= attendanceThreshold - 10) {
        overallStatus = "At Risk ⚠️";
        statusColor = "warning";
      } else {
        overallStatus = "Needs Attention 🔴";
        statusColor = "danger";
      }
    }

    let safeToSkip = 0;
    if (
      attendanceThreshold > 0 &&
      overallPercentage > attendanceThreshold &&
      totalRecords > 0
    ) {
      const thresholdRatio = attendanceThreshold / 100;
      safeToSkip = Math.floor(
        (presentRecords - thresholdRatio * totalRecords) / thresholdRatio,
      );
      safeToSkip = Math.max(0, safeToSkip);
    }

    let classesNeeded = 0;
    if (overallPercentage < attendanceThreshold && totalRecords > 0) {
      const targetPresent = Math.ceil(
        (attendanceThreshold / 100) * totalRecords,
      );
      classesNeeded = Math.max(0, targetPresent - presentRecords);
    }

    const sortedSubjects = [...subjectStats].sort(
      (a, b) => b.percentage - a.percentage,
    );
    const bestSubject = sortedSubjects.length > 0 ? sortedSubjects[0] : null;
    const worstSubject =
      sortedSubjects.length > 0
        ? sortedSubjects[sortedSubjects.length - 1]
        : null;

    res.json({
      success: true,
      data: {
        attendanceThreshold,
        student: {
          name: student.studentName,
          rollNumber: student.rollNumber,
          semester: student.semester,
          section: student.section,
          mentorName: student.mentorName,
        },
        summary: {
          totalRecords,
          presentRecords,
          absentRecords: totalRecords - presentRecords,
          overallPercentage,
          overallStatus,
          statusColor,
          safeToSkip,
          classesNeeded,
        },
        subjectStats,
        trendData,
        bestSubject,
        worstSubject,
      },
    });
  } catch (error) {
    console.error("Error in getStudentAnalytics:", error);
    next(error);
  }
};

// ============================================
// ✅ Placeholder functions
// ============================================
const getAttendanceTrend = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

const getSafeToSkip = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    res.json({ success: true, data: [] });
  } catch (error) {
    next(error);
  }
};

const getSubjectDetails = async (req, res, next) => {
  try {
    const { studentId, subjectId } = req.params;
    res.json({
      success: true,
      data: {
        subjectName: subjectId || "Subject",
        totalClasses: 0,
        presentClasses: 0,
        absentClasses: 0,
        percentage: 0,
        records: [],
      },
    });
  } catch (error) {
    next(error);
  }
};

// ============================================
// ✅ EXPORTS
// ============================================
module.exports = {
  // Student operations
  addStudent,
  getStudents,
  getStudent,
  updateStudent,
  deleteStudent,
  getCurrentStudentProfile,
  getStudentProfile,
  updateStudentProfile,
  uploadStudentPhoto,
  deleteStudentPhoto,
  searchStudents,
  getStudentAttendanceDetails,
  getAttendanceProgress,
  getAttendanceTrend,
  getSafeToSkip,
  getSubjectDetails,
  toggleAttendanceProgress,
  getStudentAnalytics,

  // Faculty operations
  addFaculty,
  getFacultyAllocations,
  deleteFaculty,
  getUnregisteredFaculty,

  // Mentor operations
  getMentors,
  getMentorMentees,
  updateAttendanceVisibility,
  getStudentsByClass,

  // Registration operations
  checkStudentExists,
  markStudentAsRegistered,
  verifyRegistrationToken,
  completeRegistration,
  resendRegistrationEmail,
  getUnregisteredStudents,
};
