const mongoose = require("mongoose");

const examHallTicketSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      required: true,
    },
    subjectEligibility: [
      {
        subjectName: {
          type: String,
          required: true,
        },
        attendancePercentage: {
          type: Number,
          min: 0,
          max: 100,
          default: 0,
        },
        // ✅ ADDED: Store class counts so hall ticket reflects exact attendance
        totalClasses: {
          type: Number,
          default: 0,
        },
        presentClasses: {
          type: Number,
          default: 0,
        },
        absentClasses: {
          type: Number,
          default: 0,
        },
        eligible: {
          type: Boolean,
          default: false,
        },
        mentorOverride: {
          type: Boolean,
          default: false,
        },
        overrideReason: {
          type: String,
          trim: true,
        },
        overrideRemarks: {
          type: String,
          trim: true,
        },
      },
    ],
    // ✅ Approval fields
    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: {
      type: String,
      default: "Pending",
    },
    mentorRemarks: {
      type: String,
      default: "N/A",
    },
    generatedDate: {
      type: Date,
      default: Date.now, // ✅ Automatically set on creation
    },
    pdfPath: {
      type: String,
      default: null,
    },

    // ✅ HOD override fields
    hodOverride: {
      type: Boolean,
      default: false,
    },
    hodRemarks: {
      type: String,
      default: "",
    },
    hodApprovedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // ✅ Semester and section fields
    semester: {
      type: Number,
      default: null,
    },
    section: {
      type: String,
      default: null,
    },
    academicYear: {
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

examHallTicketSchema.index({ studentId: 1, examId: 1 }, { unique: true });
examHallTicketSchema.index({ approvalStatus: 1 });
examHallTicketSchema.index({ department: 1, approvalStatus: 1 });

module.exports = mongoose.model("ExamHallTicket", examHallTicketSchema);
