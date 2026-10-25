const Exam = require("../models/Exam");
const Student = require("../models/Student");
const Attendance = require("../models/Attendance");
const Notification = require("../models/Notification");
const { getAttendanceThreshold } = require("../utils/attendanceThreshold");
const { createNotification } = require("../controllers/notificationController");
const { sendEmail } = require("./emailService");

const getExamReminderWindow = () => {
  const now = new Date();
  const start = new Date(now);
  const end = new Date(now);

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + 7);

  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + 8);

  return { start, end };
};

const calculateOverallAttendance = async (studentId) => {
  const records = await Attendance.find({ studentId }).select("status");
  const totalClasses = records.length;
  const presentClasses = records.filter(
    (record) => record.status === "Present",
  ).length;
  const percentage =
    totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 0;

  return { totalClasses, presentClasses, percentage };
};

const buildReminderHtml = ({
  examName,
  percentage,
  threshold,
  neededClasses,
  isBelowThreshold = true, // ✅ ADDED
  studentName = "Student", // ✅ ADDED
}) => {
  const baseUrl = process.env.FRONTEND_URL || "http://localhost:3000";
  const actionUrl = `${baseUrl}/attendance-progress`;

  // ✅ CHANGED: Different header + accent for safe vs at-risk
  const headerText = isBelowThreshold
    ? "Attendance Alert"
    : "Attendance Status";
  const headerColor = isBelowThreshold
    ? "linear-gradient(135deg, #0f172a, #1d4ed8)"
    : "linear-gradient(135deg, #064e3b, #10b981)";

  const statusLine = isBelowThreshold
    ? `<p style="margin: 0 0 12px;">Your overall attendance is <strong>${percentage}%</strong>. Minimum required is <strong>${threshold}%</strong>.</p>
       <p style="margin: 0 0 18px;">You need to attend <strong>${neededClasses}</strong> more classes to become eligible.</p>
       <p style="margin: 0 0 18px; color: #b91c1c;"><strong>If you have genuine absences, please apply for attendance correction from your dashboard.</strong></p>`
    : `<p style="margin: 0 0 12px;">Your overall attendance is <strong>${percentage}%</strong> — above the required <strong>${threshold}%</strong>.</p>
       <p style="margin: 0 0 18px;">✅ You are eligible for <strong>${examName}</strong>. Keep it up!</p>`;

  return `
    <div style="font-family: Arial, sans-serif; background: #f4f7fb; padding: 24px;">
      <div style="max-width: 620px; margin: 0 auto; background: #ffffff; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb;">
        <div style="background: ${headerColor}; color: #ffffff; padding: 24px 28px;">
          <div style="font-size: 12px; letter-spacing: 1.2px; text-transform: uppercase; opacity: 0.9;">EduTrack</div>
          <h2 style="margin: 10px 0 0; font-size: 28px;">${headerText}</h2>
          <p style="margin: 8px 0 0; opacity: 0.9;">Exam: ${examName} — 7 days away</p>
        </div>
        <div style="padding: 28px; color: #1f2937; line-height: 1.7; font-size: 16px;">
          <p style="margin: 0 0 12px;">Hi <strong>${studentName}</strong>,</p>
          ${statusLine}
          <a href="${actionUrl}" style="display:inline-block;padding:12px 20px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">View Attendance Progress</a>
        </div>
        <div style="padding: 0 28px 24px; color: #6b7280; font-size: 12px; border-top: 1px solid #e5e7eb;">
          EduTrack - Attendance Hall Ticket System
        </div>
      </div>
    </div>
  `;
};

const checkUpcomingExamsAndNotify = async () => {
  try {
    const { start, end } = getExamReminderWindow();

    const exams = await Exam.find({
      startDate: {
        $gte: start,
        $lt: end,
      },
      status: { $in: ["GENERATED", "DRAFT"] },
    }).sort({ startDate: 1 });

    for (const exam of exams) {
      const query = {
        academicYear: exam.academicYear,
        semester: exam.semester,
        section: exam.section,
      };

      if (exam.department === "CS") {
        query.$or = [
          { department: "CS" },
          { department: { $exists: false } },
          { department: null },
          { department: "" },
        ];
      } else {
        query.department = exam.department || "CS";
      }

      const students = await Student.find(query).select(
        "_id studentName email department",
      );

      for (const student of students) {
        const studentDepartment = (
          student.department ||
          exam.department ||
          "CS"
        )
          .toString()
          .trim()
          .toUpperCase();

        const threshold = await getAttendanceThreshold(studentDepartment);
        const attendance = await calculateOverallAttendance(student._id);

        // ✅ CHANGED: Notify EVERY student (not only those below threshold)
        // The dedupe check below still prevents spam — only one reminder
        // per student per exam within 7 days.

        const existingReminder = await Notification.findOne({
          recipientId: student._id,
          relatedId: exam._id,
          type: "attendance_alert",
          createdAt: {
            $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        });

        if (existingReminder) continue;

        const requiredPresent = Math.ceil(
          (threshold / 100) * attendance.totalClasses,
        );
        const neededClasses = Math.max(
          0,
          requiredPresent - attendance.presentClasses,
        );

        // ✅ CHANGED: Message wording — personalized based on whether student is safe or not
        const isBelowThreshold = attendance.percentage < threshold;

        const title = isBelowThreshold
          ? `📊 Attendance Alert: ${exam.examName} in 7 Days`
          : `✅ Attendance Status: ${exam.examName} in 7 Days`;

        const message = isBelowThreshold
          ? `Your overall attendance is ${attendance.percentage}%. Minimum required is ${threshold}%. You need to attend ${neededClasses} more classes to become eligible. If you have genuine absences, please apply for attendance correction.`
          : `Your overall attendance is ${attendance.percentage}% — above the required ${threshold}%. You are eligible for ${exam.examName}. Keep it up!`;

        const priority = isBelowThreshold ? "urgent" : "normal";

        try {
          const notification = await createNotification({
            recipientId: student._id,
            recipientRole: "Student",
            department: studentDepartment,
            senderId: null,
            senderName: "System",
            senderRole: "System",
            title,
            message,
            type: "attendance_alert",
            priority,
            actionUrl: "/attendance-progress",
            actionText: "View Progress",
            relatedId: exam._id,
            relatedModel: "Exam",
            sendEmail: true,
            recipientEmail: student.email,
          });

          if (notification?._id && student.email) {
            await sendEmail({
              to: student.email,
              subject: title,
              html: buildReminderHtml({
                examName: exam.examName,
                percentage: attendance.percentage,
                threshold,
                neededClasses,
                isBelowThreshold, // ✅ ADDED: Pass to template
                studentName: student.studentName, // ✅ ADDED
              }),
              title,
              message,
              actionText: "View Attendance Progress",
              actionUrl: "/attendance-progress",
            });

            await Notification.findByIdAndUpdate(notification._id, {
              emailSent: true,
            });
          }
        } catch (error) {
          console.error(
            `❌ Reminder notification failed for student ${student._id}:`,
            error.message,
          );
        }
      }
    }

    return {
      success: true,
      checkedExams: exams.length,
    };
  } catch (error) {
    console.error("❌ Error in checkUpcomingExamsAndNotify:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  checkUpcomingExamsAndNotify,
};
