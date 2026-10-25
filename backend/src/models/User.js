// backend/src/models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // ✅ FIXED: Password is now optional so HOD can pre-create faculty records
    // The password gets set when the faculty member registers/claims the account
    password: {
      type: String,
      required: false,
      default: null,
    },
    role: {
      type: String,
      required: true,
      enum: ["SuperAdmin", "HOD", "Faculty", "Mentor", "Student"],
      default: "Student",
    },
    department: {
      type: String,
      default: "CS",
      required: false,
      trim: true,
      uppercase: true,
      index: true,
    },

    // ✅ Faculty Status
    // - "pending"  → Pre-created by HOD, waiting for faculty to register
    // - "approved" → Faculty has registered/claimed their account
    // - "rejected" → HOD rejected the faculty registration
    // - null       → Not a faculty member
    facultyStatus: {
      type: String,
      enum: ["pending", "approved", "rejected", null],
      default: null,
    },

    // ✅ Assigned Role Type (for Faculty/Mentor)
    assignedRoleType: {
      type: String,
      enum: ["Faculty", "Mentor", "Both", null],
      default: null,
    },

    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      default: null,
    },

    facultyAllocationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FacultyAllocation",
      },
    ],

    isActive: {
      type: Boolean,
      default: true,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ studentId: 1 });
userSchema.index({ facultyStatus: 1 });
userSchema.index({ assignedRoleType: 1 });

userSchema.virtual("isApprovedFaculty").get(function () {
  return (
    (this.role === "Faculty" || this.role === "Mentor") &&
    this.facultyStatus === "approved"
  );
});

userSchema.virtual("isPendingFaculty").get(function () {
  return (
    (this.role === "Faculty" || this.role === "Mentor") &&
    this.facultyStatus === "pending"
  );
});

userSchema.set("toJSON", { virtuals: true });
userSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", userSchema);
