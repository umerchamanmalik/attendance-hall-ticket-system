/**
 * Calculate attendance percentage
 * @param {number} presentClasses - Number of classes attended
 * @param {number} totalClasses - Total number of classes
 * @returns {number} Attendance percentage
 */
const calculateAttendancePercentage = (presentClasses, totalClasses) => {
  if (totalClasses === 0) return 0;
  return Math.round((presentClasses / totalClasses) * 100);
};

/**
 * Determine if student is eligible based on attendance
 * @param {number} percentage - Attendance percentage
 * @returns {boolean} Eligibility status
 */
const isEligible = (percentage, attendanceThreshold = 85) => {
  return percentage >= attendanceThreshold;
};

/**
 * Calculate eligibility for all subjects
 * @param {Array} subjects - List of subjects with attendance data
 * @returns {Array} Subjects with eligibility status
 */
const calculateSubjectEligibility = (subjects, attendanceThreshold = 85) => {
  return subjects.map((subject) => ({
    ...subject,
    eligibility: {
      eligible: isEligible(subject.attendancePercentage, attendanceThreshold),
      percentage: subject.attendancePercentage,
    },
  }));
};

module.exports = {
  calculateAttendancePercentage,
  isEligible,
  calculateSubjectEligibility,
};
