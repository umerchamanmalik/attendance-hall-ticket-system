const mongoose = require("mongoose");

const facultyAllocationSchema = new mongoose.Schema(
  {
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

    // ============================================
    // ✅ Subject Reference
    // ============================================
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

    // ============================================
    // ✅ Faculty Reference
    // ============================================
    facultyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    facultyName: {
      type: String,
      required: true,
      trim: true,
    },

    // ✅ NEW: Faculty Email for registration
    facultyEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    // Legacy field - keeping for backward compatibility
    facultyUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    roleType: {
      type: String,
      required: true,
      enum: ["Faculty", "Mentor", "Both"],
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
    // ✅ NEW: Registration Fields for Faculty Self-Registration
    // ============================================
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    isRegistered: {
      type: Boolean,
      default: false,
      index: true,
    },
    registeredAt: {
      type: Date,
      default: null,
    },
    registrationToken: {
      type: String,
      default: null,
      index: true,
    },
    registrationExpires: {
      type: Date,
      default: null,
    },

    // ============================================
    // ✅ Total Classes for attendance calculation
    // ============================================
    totalClasses: {
      type: Number,
      default: 0,
    },

    // ============================================
    // ✅ Class schedule tracking
    // ============================================
    classesConducted: {
      type: Number,
      default: 0,
    },
    classesPerWeek: {
      type: Number,
      default: 3,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================
// ✅ Indexes for faster queries
// ============================================
facultyAllocationSchema.index({ semester: 1, section: 1 });
facultyAllocationSchema.index({ department: 1, semester: 1, section: 1 });
facultyAllocationSchema.index({ facultyId: 1 });
facultyAllocationSchema.index({ subjectId: 1 });
facultyAllocationSchema.index({ facultyEmail: 1 });
facultyAllocationSchema.index({ userId: 1 });
facultyAllocationSchema.index({ isRegistered: 1 });
facultyAllocationSchema.index({ registrationToken: 1 });

// ============================================
// ✅ Virtual to get total classes conducted
// ============================================
facultyAllocationSchema.virtual("totalClassesConducted").get(function () {
  return this.classesConducted || 0;
});

// Set toJSON to include virtuals
facultyAllocationSchema.set("toJSON", { virtuals: true });
facultyAllocationSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("FacultyAllocation", facultyAllocationSchema);
