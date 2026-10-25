const mongoose = require("mongoose");
const Notification = require("../models/Notification");
// ✅ ADDED: Imports for email delivery
const Student = require("../models/Student");
const User = require("../models/User");
const { sendEmail } = require("../services/emailService");

const notificationTypes = [
  "attendance_alert",
  "hallticket_generated",
  "hallticket_approved",
  "hallticket_rejected",
  "document_approved",
  "document_rejected",
  "document_status",
  "general",
];

const respondWithError = (res, status, error) =>
  res.status(status).json({ success: false, data: null, error });

// ✅ ADDED: Resolve recipient's email from either explicit param, Student, or User
// Priority: recipientEmail (if passed) → Student.email → User.email
const resolveRecipientEmail = async ({ recipientId, recipientEmail }) => {
  try {
    if (recipientEmail) return recipientEmail;

    if (!recipientId) return null;

    // Try Student first (callers often pass Student._id)
    const student = await Student.findById(recipientId).select("email").lean();
    if (student?.email) return student.email;

    // Fallback: User (for User._id-based callers)
    const user = await User.findById(recipientId).select("email").lean();
    if (user?.email) return user.email;

    return null;
  } catch (error) {
    console.error("❌ Failed to resolve recipient email:", error.message);
    return null;
  }
};

// ✅ ADDED: Resolve all possible recipient IDs for the current user.
// - Always includes req.user._id (User._id)
// - If role is Student, ALSO includes the matching Student._id (via email)
// This makes read queries tolerant to whether the notification was written
// with Student._id or User._id.
const resolveRecipientIds = async (req) => {
  const ids = [req.user._id];

  if (req.user.role === "Student") {
    try {
      const student = await Student.findOne({ email: req.user.email })
        .select("_id")
        .lean();
      if (student?._id) ids.push(student._id);
    } catch (error) {
      console.error("❌ Failed to resolve Student._id:", error.message);
    }
  }

  return ids;
};

const createNotification = async ({
  recipientId,
  recipientRole = "Student",
  department = "CS",
  senderId = null,
  senderName = "System",
  senderRole = "System",
  title,
  message,
  type = "general",
  priority = "normal",
  actionUrl = "",
  actionText = "",
  relatedId = null,
  relatedModel = null,
  sendEmail: shouldSendEmail = false,
  // ✅ ADDED: Optional explicit recipient email (used by examReminderService)
  recipientEmail = null,
}) => {
  const notification = await Notification.create({
    recipientId,
    recipientRole,
    department: (department || "CS").trim().toUpperCase(),
    senderId,
    senderName,
    senderRole,
    title,
    message,
    type,
    priority,
    actionUrl,
    actionText,
    relatedId,
    relatedModel,
    emailSent: false,
  });

  // ✅ ADDED: Actual email delivery when requested
  if (shouldSendEmail) {
    try {
      const to = await resolveRecipientEmail({
        recipientId,
        recipientEmail,
      });

      if (!to) {
        console.warn(
          "⚠️ Email requested but no recipient email found for:",
          recipientId,
        );
      } else {
        const result = await sendEmail({
          to,
          subject: title,
          title,
          message,
          actionText: actionText || "View Details",
          actionUrl: actionUrl || "/",
        });

        if (result?.success) {
          await Notification.findByIdAndUpdate(notification._id, {
            emailSent: true,
          });
          console.log("📧 Notification email sent to:", to);
        } else {
          console.warn(
            "⚠️ Notification email not sent:",
            result?.message || result?.error || "unknown",
          );
        }
      }
    } catch (emailError) {
      // Never let email failure break notification creation
      console.error("❌ Notification email send failed:", emailError.message);
    }
  }

  return notification;
};

const getMyNotifications = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 20, 1),
      100,
    );

    // ✅ ADDED: Query with BOTH User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const query = {
      recipientId: { $in: recipientIds },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    };

    if (req.query.status === "unread") query.isRead = false;
    if (req.query.type) {
      if (!notificationTypes.includes(req.query.type)) {
        return respondWithError(res, 400, "Invalid notification type");
      }
      query.type = req.query.type;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Notification.countDocuments(query),
      Notification.countDocuments({
        recipientId: { $in: recipientIds },
        isRead: false,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      }),
    ]);

    return res.json({
      success: true,
      data: {
        notifications,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
        unreadCount,
      },
      error: null,
    });
  } catch (error) {
    console.error("❌ Error fetching student notifications:", error);
    return respondWithError(res, 500, "Failed to load notifications");
  }
};

const getUnreadCount = async (req, res) => {
  try {
    // ✅ ADDED: Match both User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const count = await Notification.countDocuments({
      recipientId: { $in: recipientIds },
      isRead: false,
      $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
    });
    return res.json({ success: true, data: { count }, error: null });
  } catch (error) {
    console.error("❌ Error counting student notifications:", error);
    return respondWithError(res, 500, "Failed to load unread count");
  }
};

const getNotificationById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return respondWithError(res, 400, "Invalid notification ID");
    }

    // ✅ ADDED: Match both User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const notification = await Notification.findOne({
      _id: req.params.id,
      recipientId: { $in: recipientIds },
    });
    if (!notification) {
      return respondWithError(res, 404, "Notification not found");
    }

    return res.json({ success: true, data: { notification }, error: null });
  } catch (error) {
    console.error("❌ Error fetching student notification:", error);
    return respondWithError(res, 500, "Failed to load notification");
  }
};

const markAsRead = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return respondWithError(res, 400, "Invalid notification ID");
    }

    // ✅ ADDED: Match both User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: { $in: recipientIds } },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!notification) {
      return respondWithError(res, 404, "Notification not found");
    }

    return res.json({ success: true, data: { notification }, error: null });
  } catch (error) {
    console.error("❌ Error marking student notification as read:", error);
    return respondWithError(res, 500, "Failed to mark notification as read");
  }
};

const markAllAsRead = async (req, res) => {
  try {
    // ✅ ADDED: Match both User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const result = await Notification.updateMany(
      { recipientId: { $in: recipientIds }, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    return res.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      error: null,
    });
  } catch (error) {
    console.error("❌ Error marking all student notifications as read:", error);
    return respondWithError(res, 500, "Failed to mark notifications as read");
  }
};

const deleteNotification = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return respondWithError(res, 400, "Invalid notification ID");
    }

    // ✅ ADDED: Match both User._id and (for Student) Student._id
    const recipientIds = await resolveRecipientIds(req);
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipientId: { $in: recipientIds },
    });
    if (!notification) {
      return respondWithError(res, 404, "Notification not found");
    }

    return res.json({
      success: true,
      data: { id: req.params.id },
      error: null,
    });
  } catch (error) {
    console.error("❌ Error deleting student notification:", error);
    return respondWithError(res, 500, "Failed to delete notification");
  }
};

module.exports = {
  createNotification,
  getMyNotifications,
  getUnreadCount,
  getNotificationById,
  markAsRead,
  markAllAsRead,
  deleteNotification,
};
