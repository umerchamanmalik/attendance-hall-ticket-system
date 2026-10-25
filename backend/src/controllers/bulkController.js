const ExcelJS = require("exceljs");
const bcrypt = require("bcryptjs");
const path = require("path");
const fs = require("fs");
const Student = require("../models/Student");
const User = require("../models/User");
const Subject = require("../models/Subject");
const FacultyAllocation = require("../models/FacultyAllocation");
const Exam = require("../models/Exam");
const ExamHallTicket = require("../models/ExamHallTicket");
const Attendance = require("../models/Attendance");
const {
  calculateAttendancePercentage,
} = require("../utils/attendanceCalculator");
const { getDepartmentCode } = require("../utils/departmentHelper");
const { getAttendanceThresholds } = require("../utils/attendanceThreshold");

// ============================================
// 1. BULK UPLOAD STUDENTS
// ============================================

const downloadStudentTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Students");

    // Headers
    const headers = [
      "Student Name",
      "Roll Number",
      "Email",
      "Password",
      "Academic Year",
      "Semester",
      "Section",
      "Mentor Name",
      "Department",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // Sample row
    worksheet.addRow([
      "John Doe",
      "2JR23CS001",
      "john@test.com",
      "123456",
      "Third Year",
      6,
      "A",
      "faculty01",
      "CS",
    ]);

    // Data validation
    const academicYearCol = worksheet.getColumn(5);
    academicYearCol.eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: "list",
          formulae: ['"First Year,Second Year,Third Year,Final Year"'],
          showErrorMessage: true,
          errorTitle: "Invalid Academic Year",
          error: "Please select from the dropdown",
        };
      }
    });

    const semesterCol = worksheet.getColumn(6);
    semesterCol.eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: "list",
          formulae: ['"1,2,3,4,5,6,7,8"'],
          showErrorMessage: true,
          errorTitle: "Invalid Semester",
          error: "Please select from 1-8",
        };
      }
    });

    const sectionCol = worksheet.getColumn(7);
    sectionCol.eachCell((cell, rowNumber) => {
      if (rowNumber > 1) {
        cell.dataValidation = {
          type: "list",
          formulae: ['"A,B,C,D"'],
          showErrorMessage: true,
          errorTitle: "Invalid Section",
          error: "Please select from A-D",
        };
      }
    });

    // Column widths
    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 18;
    worksheet.getColumn(3).width = 25;
    worksheet.getColumn(4).width = 15;
    worksheet.getColumn(5).width = 18;
    worksheet.getColumn(6).width = 12;
    worksheet.getColumn(7).width = 12;
    worksheet.getColumn(8).width = 18;
    worksheet.getColumn(9).width = 15;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=student_template.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkUploadStudents = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    const success = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // ✅ FIX: Get cell values safely and convert semester to number
      const semesterValue = row.getCell(6).value;
      const semester = semesterValue ? parseInt(semesterValue) : NaN;

      const studentData = {
        studentName: row.getCell(1).value?.toString().trim() || "",
        rollNumber: row.getCell(2).value?.toString().trim() || "",
        email: row.getCell(3).value?.toString().trim() || "",
        password: row.getCell(4).value?.toString().trim() || "",
        academicYear: row.getCell(5).value?.toString().trim() || "",
        semester: semester,
        section: row.getCell(7).value?.toString().trim() || "",
        mentorName: row.getCell(8).value?.toString().trim() || "",
        department: row.getCell(9).value?.toString().trim() || "",
      };
      studentData.department = getDepartmentCode(
        req,
        studentData.department || "CS",
      );

      // Validate
      const validationErrors = [];
      if (!studentData.studentName)
        validationErrors.push("Student Name is required");
      if (!studentData.rollNumber)
        validationErrors.push("Roll Number is required");
      if (!studentData.email) validationErrors.push("Email is required");
      if (!studentData.password) validationErrors.push("Password is required");
      if (!studentData.academicYear)
        validationErrors.push("Academic Year is required");
      if (
        isNaN(studentData.semester) ||
        studentData.semester < 1 ||
        studentData.semester > 8
      )
        validationErrors.push("Valid Semester is required (1-8)");
      if (!studentData.section) validationErrors.push("Section is required");

      if (validationErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: validationErrors,
          data: studentData,
        });
        continue;
      }

      // Check if user exists
      const existingUser = await User.findOne({ email: studentData.email });
      if (existingUser) {
        errors.push({
          row: rowNumber,
          errors: ["Email already registered"],
          data: studentData,
        });
        continue;
      }

      // Check if student exists
      const existingStudent = await Student.findOne({
        rollNumber: studentData.rollNumber,
      });
      if (existingStudent) {
        errors.push({
          row: rowNumber,
          errors: ["Roll Number already exists"],
          data: studentData,
        });
        continue;
      }

      // Create User
      const hashedPassword = await bcrypt.hash(studentData.password, 12);
      const user = await User.create({
        name: studentData.studentName,
        email: studentData.email,
        password: hashedPassword,
        role: "Student",
        department: studentData.department,
      });

      // Create Student
      await Student.create({
        studentName: studentData.studentName,
        rollNumber: studentData.rollNumber,
        email: studentData.email,
        academicYear: studentData.academicYear,
        semester: studentData.semester,
        section: studentData.section,
        mentorName: studentData.mentorName || "",
        department: studentData.department,
      });

      success.push({
        row: rowNumber,
        studentName: studentData.studentName,
        rollNumber: studentData.rollNumber,
        email: studentData.email,
      });
    }

    // Delete uploaded file
    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Bulk upload completed",
      data: {
        total: worksheet.rowCount - 1,
        success: success.length,
        errors: errors.length,
        successDetails: success,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// 2. BULK UPLOAD SUBJECTS - FIXED
// ============================================

const downloadSubjectTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Subjects");

    const headers = [
      "Subject Code",
      "Subject Name",
      "Semester",
      "Academic Year",
      "Section",
      "Is Elective (Yes/No)",
      "Department",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    worksheet.addRow([
      "CS301",
      "Mathematics-III",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);
    worksheet.addRow([
      "CS302",
      "Data Structures",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);
    worksheet.addRow([
      "CS303",
      "Digital Electronics",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);
    worksheet.addRow([
      "CS304",
      "Object Oriented Programming",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);
    worksheet.addRow([
      "CS305",
      "Environmental Science",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);
    worksheet.addRow([
      "CS306",
      "Probability & Statistics",
      3,
      "Second Year",
      "A",
      "No",
      "CS",
    ]);

    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 12;
    worksheet.getColumn(4).width = 18;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 18;
    worksheet.getColumn(7).width = 15;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=subject_template.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkUploadSubjects = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    const success = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // ✅ FIX: Get cell values safely and convert semester to number
      const semesterValue = row.getCell(3).value;
      const semester = semesterValue ? parseInt(semesterValue) : NaN;

      const subjectData = {
        subjectCode: row.getCell(1).value?.toString().trim() || "",
        subjectName: row.getCell(2).value?.toString().trim() || "",
        semester: semester,
        academicYear: row.getCell(4).value?.toString().trim() || "",
        section: row.getCell(5).value?.toString().trim() || "",
        isElective:
          row.getCell(6).value?.toString().trim().toLowerCase() === "yes",
        department: row.getCell(7).value?.toString().trim() || "",
      };
      subjectData.department = getDepartmentCode(
        req,
        subjectData.department || "CS",
      );

      console.log(`📊 Processing row ${rowNumber}:`, subjectData);

      const validationErrors = [];
      if (!subjectData.subjectCode)
        validationErrors.push("Subject Code is required");
      if (!subjectData.subjectName)
        validationErrors.push("Subject Name is required");
      if (
        isNaN(subjectData.semester) ||
        subjectData.semester < 1 ||
        subjectData.semester > 8
      )
        validationErrors.push(
          `Valid Semester is required (1-8). Got: ${subjectData.semester}`,
        );
      if (!subjectData.academicYear)
        validationErrors.push("Academic Year is required");
      if (!subjectData.section) validationErrors.push("Section is required");

      if (validationErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: validationErrors,
          data: subjectData,
        });
        continue;
      }

      // Check if subject exists
      const existingSubject = await Subject.findOne({
        subjectCode: subjectData.subjectCode,
        semester: subjectData.semester,
        section: subjectData.section,
        department: subjectData.department,
      });

      if (existingSubject) {
        errors.push({
          row: rowNumber,
          errors: ["Subject already exists for this semester and section"],
          data: subjectData,
        });
        continue;
      }

      await Subject.create({
        subjectCode: subjectData.subjectCode,
        subjectName: subjectData.subjectName,
        semester: subjectData.semester,
        academicYear: subjectData.academicYear,
        section: subjectData.section,
        isElective: subjectData.isElective || false,
        department: subjectData.department,
        createdBy: req.user._id,
      });

      success.push({
        row: rowNumber,
        subjectCode: subjectData.subjectCode,
        subjectName: subjectData.subjectName,
      });
    }

    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Bulk subject upload completed",
      data: {
        total: worksheet.rowCount - 1,
        success: success.length,
        errors: errors.length,
        successDetails: success,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error("❌ Error in bulkUploadSubjects:", error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// 3. BULK UPLOAD FACULTY ALLOCATION - FIXED
// ============================================

const downloadFacultyAllocationTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("FacultyAllocations");

    // ✅ Updated headers - Use Email instead of Name
    const headers = [
      "Subject Code",
      "Subject Name",
      "Faculty Email",
      "Semester",
      "Section",
      "Role Type (Faculty/Mentor/Both)",
      "Department",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    // ✅ Sample rows with EMAILS
    worksheet.addRow([
      "CS301",
      "Mathematics-III",
      "faculty03@test.com",
      3,
      "A",
      "Both",
      "CS",
    ]);
    worksheet.addRow([
      "CS302",
      "Data Structures",
      "faculty03@test.com",
      3,
      "A",
      "Both",
      "CS",
    ]);
    worksheet.addRow([
      "CS303",
      "Digital Electronics",
      "faculty03@test.com",
      3,
      "A",
      "Both",
      "CS",
    ]);

    worksheet.getColumn(1).width = 15;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 30; // ✅ Wider for email
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 12;
    worksheet.getColumn(6).width = 20;
    worksheet.getColumn(7).width = 15;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=faculty_allocation_template.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkUploadFacultyAllocation = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    const success = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      const allocationData = {
        subjectCode: row.getCell(1).value?.toString().trim(),
        subjectName: row.getCell(2).value?.toString().trim(),
        facultyEmail: row.getCell(3).value?.toString().trim(), // ✅ Email
        semester: parseInt(row.getCell(4).value),
        section: row.getCell(5).value?.toString().trim(),
        roleType: row.getCell(6).value?.toString().trim(),
        department: row.getCell(7).value?.toString().trim() || "",
      };
      allocationData.department = getDepartmentCode(
        req,
        allocationData.department || "CS",
      );

      const validationErrors = [];
      if (!allocationData.subjectCode)
        validationErrors.push("Subject Code is required");
      if (!allocationData.subjectName)
        validationErrors.push("Subject Name is required");
      if (!allocationData.facultyEmail)
        validationErrors.push("Faculty Email is required");
      if (!allocationData.semester || isNaN(allocationData.semester))
        validationErrors.push("Valid Semester is required");
      if (!allocationData.section) validationErrors.push("Section is required");
      if (!["Faculty", "Mentor", "Both"].includes(allocationData.roleType))
        validationErrors.push("Role Type must be Faculty, Mentor, or Both");

      if (validationErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: validationErrors,
          data: allocationData,
        });
        continue;
      }

      // ✅ STEP 1: Find faculty user by EMAIL (case-insensitive)
      const cleanEmail = allocationData.facultyEmail.toLowerCase();

      const user = await User.findOne({
        email: { $regex: `^${cleanEmail}$`, $options: "i" },
        role: { $in: ["Faculty", "Mentor"] },
        department: allocationData.department,
      });

      if (!user) {
        errors.push({
          row: rowNumber,
          errors: [
            `Faculty with email "${allocationData.facultyEmail}" not found. Please register the faculty first.`,
          ],
          data: allocationData,
        });
        continue;
      }

      console.log(`✅ Faculty found: ${user.name} (${user.email})`);
      console.log(`   Faculty Status: ${user.facultyStatus}`);
      console.log(`   Assigned Role Type: ${user.assignedRoleType}`);

      // ✅ STEP 2: Find or create subject
      let subject = await Subject.findOne({
        subjectCode: allocationData.subjectCode,
        semester: allocationData.semester,
        section: allocationData.section,
        department: allocationData.department,
      });

      if (!subject) {
        subject = await Subject.create({
          subjectCode: allocationData.subjectCode,
          subjectName: allocationData.subjectName,
          semester: allocationData.semester,
          academicYear: getAcademicYear(allocationData.semester),
          section: allocationData.section,
          department: allocationData.department,
          isElective: false,
          createdBy: req.user._id,
        });
        console.log(`✅ Created subject: ${allocationData.subjectName}`);
      }

      // ✅ STEP 3: AUTO-APPROVE FACULTY IF PENDING (Flow C)
      let wasPending = false;
      if (user.role === "Faculty" && user.facultyStatus === "pending") {
        wasPending = true;

        // Merge role types
        let newAssignedRoleType = allocationData.roleType || "Faculty";
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

        console.log(
          `✅ Auto-approved faculty: ${user.name} → ${newAssignedRoleType}`,
        );
      }

      // ✅ STEP 4: Check if allocation exists
      const existingAllocation = await FacultyAllocation.findOne({
        subjectName: allocationData.subjectName,
        semester: allocationData.semester,
        section: allocationData.section,
        department: allocationData.department,
      });

      if (existingAllocation) {
        // Update existing allocation
        existingAllocation.facultyName = user.name;
        existingAllocation.facultyEmail = user.email; // ✅ CRITICAL
        existingAllocation.facultyId = user._id;
        existingAllocation.facultyUserId = user._id;
        existingAllocation.subjectId = subject._id;
        existingAllocation.roleType = allocationData.roleType;
        existingAllocation.department = allocationData.department;
        await existingAllocation.save();

        success.push({
          row: rowNumber,
          subjectName: allocationData.subjectName,
          facultyName: user.name,
          facultyEmail: user.email,
          action: "Updated",
          wasPending: wasPending,
        });
      } else {
        // ✅ Create new allocation with ALL required fields
        const allocation = await FacultyAllocation.create({
          subjectName: allocationData.subjectName,
          subjectId: subject._id,
          facultyName: user.name,
          facultyEmail: user.email, // ✅ CRITICAL
          facultyId: user._id,
          facultyUserId: user._id,
          semester: allocationData.semester,
          section: allocationData.section,
          academicYear: getAcademicYear(allocationData.semester),
          roleType: allocationData.roleType,
          department: allocationData.department,
        });

        // Link allocation to user
        await User.findByIdAndUpdate(user._id, {
          $addToSet: { facultyAllocationIds: allocation._id },
        });

        success.push({
          row: rowNumber,
          subjectName: allocationData.subjectName,
          facultyName: user.name,
          facultyEmail: user.email,
          action: "Created",
          wasPending: wasPending,
        });
      }
    }

    fs.unlinkSync(file.path);

    // ✅ Helper function
    function getAcademicYear(semester) {
      if (semester <= 2) return "First Year";
      if (semester <= 4) return "Second Year";
      if (semester <= 6) return "Third Year";
      return "Final Year";
    }

    // Count auto-approved
    const autoApprovedCount = success.filter((s) => s.wasPending).length;

    res.json({
      success: true,
      message: `Bulk faculty allocation completed. ${autoApprovedCount > 0 ? `${autoApprovedCount} faculty auto-approved.` : ""}`,
      data: {
        total: worksheet.rowCount - 1,
        success: success.length,
        errors: errors.length,
        autoApproved: autoApprovedCount,
        successDetails: success,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// ============================================
// 4. BULK HALL TICKET GENERATION
// ============================================

const downloadHallTicketTemplate = async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("HallTickets");

    const headers = [
      "Exam Name",
      "Academic Year",
      "Semester",
      "Section",
      "Start Date (YYYY-MM-DD)",
      "End Date (YYYY-MM-DD)",
      "Department",
    ];

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4472C4" },
      };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });

    worksheet.addRow([
      "Internal Test 1",
      "Third Year",
      6,
      "A",
      "2026-06-20",
      "2026-06-25",
      "CS",
    ]);

    worksheet.getColumn(1).width = 20;
    worksheet.getColumn(2).width = 18;
    worksheet.getColumn(3).width = 12;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 20;
    worksheet.getColumn(6).width = 20;
    worksheet.getColumn(7).width = 15;

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=hallticket_template.xlsx",
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

const bulkGenerateHallTickets = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res
        .status(400)
        .json({ success: false, error: "No file uploaded" });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(file.path);
    const worksheet = workbook.getWorksheet(1);

    const errors = [];
    const success = [];

    for (let rowNumber = 2; rowNumber <= worksheet.rowCount; rowNumber++) {
      const row = worksheet.getRow(rowNumber);

      // ✅ FIX: Get cell values safely and convert semester to number
      const semesterValue = row.getCell(3).value;
      const semester = semesterValue ? parseInt(semesterValue) : NaN;

      const examData = {
        examName: row.getCell(1).value?.toString().trim() || "",
        academicYear: row.getCell(2).value?.toString().trim() || "",
        semester: semester,
        section: row.getCell(4).value?.toString().trim() || "",
        startDate: row.getCell(5).value,
        endDate: row.getCell(6).value,
        department: row.getCell(7).value?.toString().trim() || "",
      };
      examData.department = getDepartmentCode(req, examData.department || "CS");

      const validationErrors = [];
      if (!examData.examName) validationErrors.push("Exam Name is required");
      if (!examData.academicYear)
        validationErrors.push("Academic Year is required");
      if (
        isNaN(examData.semester) ||
        examData.semester < 1 ||
        examData.semester > 8
      )
        validationErrors.push(
          `Valid Semester is required (1-8). Got: ${examData.semester}`,
        );
      if (!examData.section) validationErrors.push("Section is required");
      if (!examData.startDate) validationErrors.push("Start Date is required");
      if (!examData.endDate) validationErrors.push("End Date is required");

      if (validationErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: validationErrors,
          data: examData,
        });
        continue;
      }

      // Create Exam
      const exam = await Exam.create({
        examName: examData.examName,
        academicYear: examData.academicYear,
        semester: examData.semester,
        section: examData.section,
        startDate: new Date(examData.startDate),
        endDate: new Date(examData.endDate),
        createdBy: req.user._id,
        status: "ACTIVE",
        department: examData.department,
      });

      // Generate Hall Tickets
      await generateHallTicketsForExam(exam);

      success.push({
        row: rowNumber,
        examName: examData.examName,
        semester: examData.semester,
        section: examData.section,
        hallTicketsGenerated: true,
      });
    }

    fs.unlinkSync(file.path);

    res.json({
      success: true,
      message: "Bulk hall ticket generation completed",
      data: {
        total: worksheet.rowCount - 1,
        success: success.length,
        errors: errors.length,
        successDetails: success,
        errorDetails: errors,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
};

// Helper function to generate hall tickets for an exam
const generateHallTicketsForExam = async (exam) => {
  try {
    const students = await Student.find({
      department: exam.department || "CS",
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    });

    const allocations = await FacultyAllocation.find({
      department: exam.department || "CS",
      academicYear: exam.academicYear,
      semester: exam.semester,
      section: exam.section,
    });

    const subjects = allocations.map((a) => a.subjectName);
    const thresholdsByDepartment = await getAttendanceThresholds(
      students.map((student) => student.department || exam.department || "CS"),
    );

    for (const student of students) {
      const studentDepartment = (student.department || exam.department || "CS")
        .trim()
        .toUpperCase();
      const attendanceThreshold =
        thresholdsByDepartment.get(studentDepartment) ?? 85;
      const subjectEligibility = [];

      for (const subject of subjects) {
        const attendanceRecords = await Attendance.find({
          studentId: student._id,
          subjectName: subject,
        });

        const totalClasses = attendanceRecords.length;
        const presentClasses = attendanceRecords.filter(
          (a) => a.status === "Present",
        ).length;

        const percentage = calculateAttendancePercentage(
          presentClasses,
          totalClasses,
        );

        subjectEligibility.push({
          subjectName: subject,
          attendancePercentage: percentage,
          eligible: percentage >= attendanceThreshold,
        });
      }

      await ExamHallTicket.create({
        studentId: student._id,
        examId: exam._id,
        subjectEligibility,
        approvalStatus: "Pending",
        department: exam.department || student.department || "CS",
      });
    }
  } catch (error) {
    console.error("Error generating hall tickets:", error);
    throw error;
  }
};

module.exports = {
  downloadStudentTemplate,
  bulkUploadStudents,
  downloadSubjectTemplate,
  bulkUploadSubjects,
  downloadFacultyAllocationTemplate,
  bulkUploadFacultyAllocation,
  downloadHallTicketTemplate,
  bulkGenerateHallTickets,
};
