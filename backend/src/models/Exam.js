const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    examName: {
      type: String,
      required: [true, "Exam name is required"],
      trim: true,
    },
    academicYear: {
      type: String,
      required: [true, "Academic year is required"],
      enum: ["First Year", "Second Year", "Third Year", "Final Year"],
    },
    semester: {
      type: Number,
      required: [true, "Semester is required"],
      min: 1,
      max: 8,
    },
    section: {
      type: String,
      required: [true, "Section is required"],
      enum: ["A", "B", "C", "D"],
    },
    startDate: {
      type: Date,
      required: [true, "Start date is required"],
    },
    endDate: {
      type: Date,
      required: [true, "End date is required"],
    },
    status: {
      type: String,
      enum: ["DRAFT", "GENERATED", "COMPLETED", "CANCELLED"],
      default: "DRAFT",
    },
    subjects: [
      {
        type: String,
        trim: true,
      },
    ],
    hallTicketsGenerated: {
      type: Boolean,
      default: false,
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
  {
    timestamps: true,
  },
);

examSchema.index({ department: 1, academicYear: 1, semester: 1, section: 1 });
examSchema.index({ academicYear: 1, semester: 1, section: 1 });

module.exports = mongoose.model("Exam", examSchema);
