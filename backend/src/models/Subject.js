const mongoose = require("mongoose");

const subjectSchema = new mongoose.Schema(
  {
    subjectCode: {
      type: String,
      required: true,
      trim: true,
    },
    subjectName: {
      type: String,
      required: true,
      trim: true,
    },
    semester: {
      type: Number,
      required: true,
      min: 1,
      max: 8,
    },
    academicYear: {
      type: String,
      required: true,
      enum: ["First Year", "Second Year", "Third Year", "Final Year"],
    },
    section: {
      type: String,
      required: true,
      enum: ["A", "B", "C", "D"],
    },
    isElective: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
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
  { timestamps: true },
);

subjectSchema.index(
  { subjectCode: 1, semester: 1, section: 1 },
  { unique: true },
);
subjectSchema.index({ department: 1, semester: 1, section: 1 });

module.exports = mongoose.model("Subject", subjectSchema);
