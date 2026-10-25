const mongoose = require("mongoose");

const departmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Department name is required"],
      unique: true,
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },
    hodId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    hodName: {
      type: String,
      trim: true,
      default: "",
    },
    hodEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
    },
    logo: {
      type: String,
      default: null,
    },
    attendanceThreshold: {
      type: Number,
      default: 75,
      min: 0,
      max: 100,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
  },
);

departmentSchema.index({ code: 1 });
departmentSchema.index({ isActive: 1 });

module.exports = mongoose.model("Department", departmentSchema);
