const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    subjectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    facultyName: {
      type: String,
      required: true,
      trim: true,
    },
    attendanceDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["Present", "Absent"],
      required: true,
      default: "Present",
    },
    // Track if attendance was auto-updated via document correction
    autoUpdated: {
      type: Boolean,
      default: false,
    },
    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Document",
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
attendanceSchema.index({ studentId: 1, subjectId: 1, attendanceDate: 1 });
attendanceSchema.index({ studentId: 1, attendanceDate: 1 });
attendanceSchema.index({ subjectId: 1, attendanceDate: 1 });
attendanceSchema.index({ department: 1, attendanceDate: 1 });

module.exports = mongoose.model("Attendance", attendanceSchema);
