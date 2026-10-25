const mongoose = require("mongoose");

const hallTicketSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
      unique: true,
    },
    attendancePercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    approvalStatus: {
      type: String,
      required: true,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approvedBy: {
      type: String,
      trim: true,
      default: "",
    },
    pdfPath: {
      type: String,
      default: "",
    },
    generatedDate: {
      type: Date,
      default: Date.now,
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

hallTicketSchema.index({ department: 1, approvalStatus: 1 });

module.exports = mongoose.model("HallTicket", hallTicketSchema);
