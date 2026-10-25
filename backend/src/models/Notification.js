const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: ["HOD", "Faculty", "Mentor", "Student", "SuperAdmin"],
      default: "Student",
    },
    department: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: "CS",
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    senderName: {
      type: String,
      trim: true,
      default: "System",
    },
    senderRole: {
      type: String,
      trim: true,
      default: "System",
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    type: {
      type: String,
      enum: [
        "attendance_alert",
        "hallticket_generated",
        "hallticket_approved",
        "hallticket_rejected",
        "document_approved",
        "document_rejected",
        "document_status",
        "general",
      ],
      default: "general",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    actionUrl: {
      type: String,
      trim: true,
      default: "",
    },
    actionText: {
      type: String,
      trim: true,
      default: "",
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
      default: null,
    },
    relatedId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    relatedModel: {
      type: String,
      trim: true,
      default: null,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
