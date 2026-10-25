const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    academicYear: {
      type: String,
      required: true,
      enum: ["First Year", "Second Year", "Third Year", "Final Year"],
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    mentorName: {
      type: String,
      required: true,
      trim: true,
    },
    department: {
      type: String,
      default: "CS",
      required: false,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ============================================
    // ✅ NEW: Self-Registration Fields
    // ============================================
    registrationToken: {
      type: String,
      default: null,
      index: true,
    },
    registrationExpires: {
      type: Date,
      default: null,
    },
    isRegistered: {
      type: Boolean,
      default: false,
    },
    registeredAt: {
      type: Date,
      default: null,
    },

    // ============================================
    // ✅ Attendance Progress Toggle (Mentor controlled)
    // ============================================
    showAttendanceProgress: {
      type: Boolean,
      default: true,
    },

    // ============================================
    // ✅ Mentor ID Reference
    // ============================================
    mentorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // Legacy field - keeping for backward compatibility
    attendanceVisibility: {
      type: String,
      required: true,
      enum: ["Show Percentage", "Hide Percentage"],
      default: "Show Percentage",
    },

    // ============================================
    // Student Profile Management
    // ============================================
    photoPath: {
      type: String,
      default: null,
    },
    contactNumber: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    guardianName: {
      type: String,
      trim: true,
      default: "",
    },
    guardianContact: {
      type: String,
      trim: true,
      default: "",
    },
    guardianRelation: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyContact: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyContactName: {
      type: String,
      trim: true,
      default: "",
    },
    dateOfBirth: {
      type: Date,
      default: null,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other", ""],
      default: "",
    },

    // ============================================
    // Semester & Batch Management
    // ============================================
    batch: {
      type: String,
      trim: true,
      default: "",
    },
    joiningYear: {
      type: Number,
      default: null,
    },
    expectedGraduation: {
      type: Number,
      default: null,
    },
    isPromoted: {
      type: Boolean,
      default: false,
    },
    promotionDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Index for faster queries
studentSchema.index({ mentorId: 1, semester: 1, section: 1 });
studentSchema.index({ department: 1, semester: 1, section: 1 });
studentSchema.index({ rollNumber: 1 });
studentSchema.index({ email: 1 });
studentSchema.index({ registrationToken: 1 });
studentSchema.index({ isRegistered: 1 });

module.exports = mongoose.model("Student", studentSchema);
