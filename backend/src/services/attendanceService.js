const Attendance = require("../models/Attendance");

const calculateAttendancePercentage = async (studentId) => {
  const attendanceRecords = await Attendance.find({ studentId });
  const totalDays = attendanceRecords.length;
  if (!totalDays) return 0;
  const presentDays = attendanceRecords.filter(
    (record) => record.status === "Present",
  ).length;
  return (presentDays / totalDays) * 100;
};

module.exports = {
  calculateAttendancePercentage,
};
