const Student = require("../models/Student");
const Subject = require("../models/Subject");
const FacultyAllocation = require("../models/FacultyAllocation");
const Exam = require("../models/Exam");
const ExamHallTicket = require("../models/ExamHallTicket");

// Helper function to get academic year
const getAcademicYear = (semester) => {
  if (semester <= 2) return "First Year";
  if (semester <= 4) return "Second Year";
  if (semester <= 6) return "Third Year";
  return "Final Year";
};

// ✅ Get All Semesters with Student Counts
const getAllSemesters = async (req, res, next) => {
  try {
    const semesterData = [];

    for (let sem = 1; sem <= 8; sem++) {
      // Get students count for this semester
      const studentCount = await Student.countDocuments({ semester: sem });

      // ✅ Count unique subjects from FacultyAllocation
      const subjectCount = await FacultyAllocation.distinct("subjectName", {
        semester: sem,
      }).then((names) => names.length);

      // Get faculty allocations count for this semester
      const facultyCount = await FacultyAllocation.distinct("facultyName", {
        semester: sem,
      }).then((names) => names.length);

      let academicYear = "";
      if (sem <= 2) academicYear = "First Year";
      else if (sem <= 4) academicYear = "Second Year";
      else if (sem <= 6) academicYear = "Third Year";
      else academicYear = "Final Year";

      semesterData.push({
        semester: sem,
        studentCount,
        subjectCount,
        facultyCount,
        academicYear,
        status: studentCount > 0 ? "Active" : "Empty",
      });
    }

    res.json({
      success: true,
      data: semesterData,
    });
  } catch (error) {
    console.error("Error in getAllSemesters:", error);
    next(error);
  }
};

// ✅ Get Students for a Specific Semester
const getStudentsBySemester = async (req, res, next) => {
  try {
    const { semester } = req.params;

    const students = await Student.find({ semester: parseInt(semester) })
      .select(
        "studentName rollNumber email academicYear semester section mentorName",
      )
      .sort({ rollNumber: 1 });

    res.json({
      success: true,
      data: students,
    });
  } catch (error) {
    console.error("Error in getStudentsBySemester:", error);
    next(error);
  }
};

// ✅ Promote Students from One Semester to Next (with Next Steps guidance)
const promoteStudents = async (req, res, next) => {
  try {
    const { semester } = req.params;
    const currentSemester = parseInt(semester);

    // Validate semester
    if (currentSemester < 1 || currentSemester >= 8) {
      return res.status(400).json({
        success: false,
        error: "Invalid semester. Cannot promote beyond Semester 8.",
      });
    }

    const nextSemester = currentSemester + 1;

    // Check if there are students in this semester
    const studentCount = await Student.countDocuments({
      semester: currentSemester,
    });

    if (studentCount === 0) {
      return res.status(400).json({
        success: false,
        error: `No students found in Semester ${currentSemester}.`,
      });
    }

    // Update all students in this semester to next semester
    const result = await Student.updateMany(
      { semester: currentSemester },
      {
        $set: {
          semester: nextSemester,
          academicYear: getAcademicYear(nextSemester),
          isPromoted: true,
          promotionDate: new Date(),
        },
      },
    );

    // Get list of promoted students
    const promotedStudents = await Student.find({ semester: nextSemester })
      .select("studentName rollNumber semester academicYear")
      .sort({ rollNumber: 1 });

    // Get subjects for the new semester (if any)
    const subjects = await Subject.find({ semester: nextSemester });
    const facultyAllocations = await FacultyAllocation.find({
      semester: nextSemester,
    });

    res.json({
      success: true,
      message: `✅ ${result.modifiedCount} students promoted from Semester ${currentSemester} to Semester ${nextSemester}`,
      data: {
        fromSemester: currentSemester,
        toSemester: nextSemester,
        promotedCount: result.modifiedCount,
        students: promotedStudents,
        // ✅ Next Steps guidance
        nextSteps: {
          subjectsExist: subjects.length > 0,
          facultyExist: facultyAllocations.length > 0,
          subjectsCount: subjects.length,
          facultyCount: facultyAllocations.length,
          message:
            subjects.length === 0
              ? `⚠️ No subjects added for Semester ${nextSemester}. Please go to "Exam Management" to add subjects.`
              : `✅ ${subjects.length} subjects already added for Semester ${nextSemester}.`,
        },
      },
    });
  } catch (error) {
    console.error("Error in promoteStudents:", error);
    next(error);
  }
};

// ✅ Promote All Students (Bulk Promotion)
const promoteAllStudents = async (req, res, next) => {
  try {
    const results = [];
    let totalPromoted = 0;

    // Promote from Semester 1 to 7 (skip Semester 8)
    for (let sem = 1; sem <= 7; sem++) {
      const studentCount = await Student.countDocuments({ semester: sem });

      if (studentCount > 0) {
        const nextSemester = sem + 1;
        const result = await Student.updateMany(
          { semester: sem },
          {
            $set: {
              semester: nextSemester,
              academicYear: getAcademicYear(nextSemester),
              isPromoted: true,
              promotionDate: new Date(),
            },
          },
        );

        results.push({
          fromSemester: sem,
          toSemester: nextSemester,
          promotedCount: result.modifiedCount,
        });
        totalPromoted += result.modifiedCount;
      }
    }

    res.json({
      success: true,
      message: `✅ ${totalPromoted} students promoted across all semesters`,
      data: {
        totalPromoted,
        details: results,
      },
    });
  } catch (error) {
    console.error("Error in promoteAllStudents:", error);
    next(error);
  }
};

// ✅ Get Semester Stats (for dashboard)
const getSemesterStats = async (req, res, next) => {
  try {
    const stats = [];

    for (let sem = 1; sem <= 8; sem++) {
      const studentCount = await Student.countDocuments({ semester: sem });
      const subjectCount = await Subject.countDocuments({ semester: sem });
      const examCount = await Exam.countDocuments({ semester: sem });
      const hallTicketCount = await ExamHallTicket.countDocuments({
        semester: sem,
      });

      stats.push({
        semester: sem,
        studentCount,
        subjectCount,
        examCount,
        hallTicketCount,
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error("Error in getSemesterStats:", error);
    next(error);
  }
};

module.exports = {
  getAllSemesters,
  getStudentsBySemester,
  promoteStudents,
  promoteAllStudents,
  getSemesterStats,
};
