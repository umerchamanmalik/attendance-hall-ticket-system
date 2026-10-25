const Student = require("../models/Student");
const User = require("../models/User");

// ✅ Get mentor settings
const getMentorSettings = async (req, res, next) => {
  try {
    const mentorName = req.user.name;

    // Get all mentees for this mentor
    const students = await Student.find({ mentorName: mentorName });

    // Check if all students have attendanceVisibility = "Show Percentage"
    const allVisible = students.every(
      (s) => s.attendanceVisibility === "Show Percentage",
    );

    res.json({
      success: true,
      data: {
        showAttendancePercentage: allVisible,
        menteesCount: students.length,
        mentorName: mentorName,
      },
    });
  } catch (error) {
    console.error("Error getting mentor settings:", error);
    next(error);
  }
};

// ✅ Toggle attendance visibility for all mentees
const toggleAttendanceVisibility = async (req, res, next) => {
  try {
    const { showPercentage } = req.body;
    const mentorName = req.user.name;

    console.log("🔍 Toggling visibility for mentor:", mentorName);
    console.log("📊 Show percentage:", showPercentage);

    if (typeof showPercentage !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "showPercentage must be a boolean",
      });
    }

    const visibility = showPercentage ? "Show Percentage" : "Hide Percentage";

    // Update all mentees' attendanceVisibility
    const result = await Student.updateMany(
      { mentorName: mentorName },
      { $set: { attendanceVisibility: visibility } },
    );

    console.log(
      `✅ Updated ${result.modifiedCount} mentees to "${visibility}"`,
    );

    res.json({
      success: true,
      message: `Attendance ${showPercentage ? "shown" : "hidden"} for all mentees`,
      data: {
        showAttendancePercentage: showPercentage,
        updatedCount: result.modifiedCount,
        menteesCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error("Error toggling attendance visibility:", error);
    next(error);
  }
};

module.exports = {
  getMentorSettings,
  toggleAttendanceVisibility,
};
