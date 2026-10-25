const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });

const mongoose = require("mongoose");
const Department = require("../models/Department");
const User = require("../models/User");
const Student = require("../models/Student");
const FacultyAllocation = require("../models/FacultyAllocation");
const Attendance = require("../models/Attendance");
const Exam = require("../models/Exam");
const ExamHallTicket = require("../models/ExamHallTicket");
const Document = require("../models/Document");
const AuditLog = require("../models/AuditLog");
const Subject = require("../models/Subject");

const migrate = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured in backend/.env");
  }

  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  await Department.updateOne(
    { code: "CS" },
    {
      $setOnInsert: {
        name: "Computer Science & Engineering",
        code: "CS",
        attendanceThreshold: 75,
        description: "Department of Computer Science & Engineering",
        isActive: true,
      },
    },
    { upsert: true },
  );
  console.log("Ensured CS department exists");

  const models = [
    User,
    Student,
    FacultyAllocation,
    Attendance,
    Exam,
    ExamHallTicket,
    Document,
    AuditLog,
    Subject,
  ];

  for (const Model of models) {
    const result = await Model.updateMany(
      {
        $or: [
          { department: { $exists: false } },
          { department: null },
          { department: "" },
        ],
      },
      { $set: { department: "CS" } },
    );
    console.log(
      `Updated ${result.modifiedCount} records in ${Model.modelName}`,
    );
  }
};

migrate()
  .then(async () => {
    await mongoose.disconnect();
    console.log("Multi-department migration completed");
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("Multi-department migration failed:", error);
    await mongoose.disconnect().catch(() => {});
    process.exit(1);
  });
