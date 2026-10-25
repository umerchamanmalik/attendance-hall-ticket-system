// ✅ NEW FILE: Syncs a student's hall ticket attendance percentages
// whenever their Attendance records change (new attendance or correction).
// Called from attendanceController.takeAttendance/editAttendance
// and documentController.confirmAttendanceCorrection.

const ExamHallTicket = require("../models/ExamHallTicket");
const Attendance = require("../models/Attendance");
const { getAttendanceThreshold } = require("../utils/attendanceThreshold");

/**
 * Recompute attendancePercentage for every hall ticket belonging to a student.
 * Updates each subject's percentage based on current Attendance records.
 * Silent-fails (never throws) so it can't break the main operation.
 *
 * @param {ObjectId|String} studentId - The student whose hall tickets to refresh
 * @param {Object} options
 * @param {String} [options.department] - Student's department code (for threshold fallback)
 * @param {String} [options.reason] - Log label ("takeAttendance" / "editAttendance" / "documentCorrection")
 * @returns {Promise<{ updatedCount: number }>}
 */
const syncStudentHallTickets = async (studentId, options = {}) => {
  const { department = "CS", reason = "unknown" } = options;

  if (!studentId) return { updatedCount: 0 };

  try {
    const hallTickets = await ExamHallTicket.find({ studentId });

    if (!hallTickets.length) {
      return { updatedCount: 0 };
    }

    // ✅ Pre-fetch attendance aggregates for ALL subjects across all tickets
    const allSubjectNames = [
      ...new Set(
        hallTickets.flatMap((t) =>
          (t.subjectEligibility || [])
            .map((s) => s.subjectName)
            .filter(Boolean),
        ),
      ),
    ];

    let bySubject = new Map();
    if (allSubjectNames.length > 0) {
      const attendanceRows = await Attendance.aggregate([
        {
          $match: {
            studentId: hallTickets[0].studentId,
            subjectName: { $in: allSubjectNames },
          },
        },
        {
          $group: {
            _id: "$subjectName",
            totalClasses: { $sum: 1 },
            presentClasses: {
              $sum: { $cond: [{ $eq: ["$status", "Present"] }, 1, 0] },
            },
          },
        },
      ]);

      bySubject = new Map(attendanceRows.map((row) => [row._id, row]));
    }

    // ✅ Resolve threshold once (same student → same dept)
    const threshold = await getAttendanceThreshold(department);

    let updatedCount = 0;

    for (const ticket of hallTickets) {
      let changed = false;

      ticket.subjectEligibility.forEach((subject) => {
        const row = bySubject.get(subject.subjectName);
        const total = row?.totalClasses ?? 0;
        const present = row?.presentClasses ?? 0;
        const percentage = total > 0 ? Math.round((present / total) * 100) : 0;

        // ✅ Update stored percentage (only touch if changed)
        if (subject.attendancePercentage !== percentage) {
          subject.attendancePercentage = percentage;
          changed = true;
        }

        // ✅ Update stored class counts (schema fix adds these fields)
        if (subject.totalClasses !== total) {
          subject.totalClasses = total;
          changed = true;
        }
        if (subject.presentClasses !== present) {
          subject.presentClasses = present;
          changed = true;
        }
        if (subject.absentClasses !== total - present) {
          subject.absentClasses = total - present;
          changed = true;
        }

        // ✅ Re-evaluate eligibility (respecting mentor overrides)
        if (!subject.mentorOverride) {
          const shouldBeEligible = total > 0 && percentage >= threshold;
          if (subject.eligible !== shouldBeEligible) {
            subject.eligible = shouldBeEligible;
            changed = true;
          }
        }
      });

      if (changed) {
        ticket.markModified("subjectEligibility");
        await ticket.save();
        updatedCount++;
      }
    }

    if (updatedCount > 0) {
      console.log(
        `🔄 Synced ${updatedCount} hall ticket(s) for student ${studentId} (${reason})`,
      );
    }

    return { updatedCount };
  } catch (error) {
    console.error(
      `❌ hallTicketAttendanceSync failed for student ${studentId}:`,
      error.message,
    );
    return { updatedCount: 0 };
  }
};

module.exports = { syncStudentHallTickets };
