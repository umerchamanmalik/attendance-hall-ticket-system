const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
    },
    userRole: {
      type: String,
      required: true,
      enum: ["SuperAdmin", "HOD", "Faculty", "Mentor", "Student"],
    },
    action: {
      type: String,
      required: true,
      enum: [
        "LOGIN",
        "LOGOUT",
        "CREATE",
        "UPDATE",
        "DELETE",
        "APPROVE",
        "REJECT",
        "CONFIRM",
        "OVERRIDE",
        "UPLOAD",
        "DOWNLOAD",
        "GENERATE",
        "VIEW",
        "TOGGLE",
        "SYNC",
      ],
    },
    module: {
      type: String,
      required: true,
      enum: [
        "ATTENDANCE",
        "DOCUMENT",
        "HALL_TICKET",
        "STUDENT",
        "FACULTY",
        "EXAM",
        "USER",
        "PROFILE",
        "DASHBOARD",
        "SEMESTER",
        "DEPARTMENT",
      ],
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    details: {
      type: Object,
      default: {},
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },
    status: {
      type: String,
      enum: ["SUCCESS", "FAILURE", "PENDING"],
      default: "SUCCESS",
    },
    errorMessage: {
      type: String,
      default: null,
    },
    department: {
      type: String,
      default: "CS",
      required: false,
      trim: true,
      uppercase: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for faster queries
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ department: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, module: 1 });
auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userRole: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
