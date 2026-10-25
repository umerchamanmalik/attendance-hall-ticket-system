const Department = require("../models/Department");

const getAttendanceThreshold = async (departmentCode) => {
  const code = String(departmentCode || "CS")
    .trim()
    .toUpperCase();
  const department = await Department.findOne({ code })
    .select("attendanceThreshold")
    .lean();

  const storedThreshold = department?.attendanceThreshold;
  const threshold = Number(storedThreshold);
  return storedThreshold !== null &&
    storedThreshold !== undefined &&
    Number.isFinite(threshold)
    ? threshold
    : 85;
};

const getAttendanceThresholds = async (departmentCodes = []) => {
  const codes = [
    ...new Set(
      departmentCodes.map((code) =>
        String(code || "CS")
          .trim()
          .toUpperCase(),
      ),
    ),
  ];
  const departments = await Department.find({ code: { $in: codes } })
    .select("code attendanceThreshold")
    .lean();
  const thresholds = new Map(
    departments.map((department) => [
      department.code,
      department.attendanceThreshold !== null &&
      department.attendanceThreshold !== undefined &&
      Number.isFinite(Number(department.attendanceThreshold))
        ? Number(department.attendanceThreshold)
        : 85,
    ]),
  );

  return new Map(codes.map((code) => [code, thresholds.get(code) ?? 85]));
};

module.exports = { getAttendanceThreshold, getAttendanceThresholds };
