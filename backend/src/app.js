const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const morgan = require("morgan");
const authRoutes = require("./routes/authRoutes");
const allocationRoutes = require("./routes/facultyAllocationRoutes");
const studentRoutes = require("./routes/studentRoutes");
const attendanceRoutes = require("./routes/attendanceRoutes");
const documentRoutes = require("./routes/documentRoutes");
const hallTicketRoutes = require("./routes/hallTicketRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const debugRoutes = require("./routes/debugRoutes");
const { errorHandler } = require("./middleware/errorHandler");

// ✅ NEW IMPORTS
const examRoutes = require("./routes/examRoutes");
const examHallTicketRoutes = require("./routes/examHallTicketRoutes");
const bulkRoutes = require("./routes/bulkRoutes");
const semesterRoutes = require("./routes/semesterRoutes");
const mentorRoutes = require("./routes/mentorRoutes");

// ✅ ADD AUDIT ROUTES
const auditRoutes = require("./routes/auditRoutes");

// ✅ NEW: FACULTY ROUTES (Flow C)
const facultyRoutes = require("./routes/facultyRoute");
const notificationRoutes = require("./routes/notificationRoutes");

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use("/uploads", express.static("uploads"));

// Health Route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Server is running!",
    timestamp: new Date().toISOString(),
  });
});

// ✅ EXISTING ROUTES
app.use("/api/auth", authRoutes);
app.use("/api/allocations", allocationRoutes);
app.use("/api/students", studentRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/halltickets", hallTicketRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/debug", debugRoutes);

// Add this line with other route registrations (after authentication routes)
app.use("/api/mentor", mentorRoutes);

// ✅ NEW ROUTES - Exam Management
app.use("/api/exams", examRoutes);
app.use("/api/exam-halltickets", examHallTicketRoutes);

// ✅ Bulk Operations Routes
app.use("/api/bulk", bulkRoutes);

// ✅ NEW ROUTES - Semester Management
app.use("/api/semesters", semesterRoutes);

// ✅ NEW ROUTES - AuditLog
app.use("/api/audit", auditRoutes);

// ✅ NEW ROUTES - Faculty Management (Flow C)
app.use("/api/faculty", facultyRoutes);

// ✅ NEW ROUTES - Multi-Department Support & Super Admin
const departmentRoutes = require("./routes/departmentRoutes");
const superAdminRoutes = require("./routes/superAdminRoutes");
app.use("/api/departments", departmentRoutes);
app.use("/api/super-admin", superAdminRoutes);
app.use("/api/notifications", notificationRoutes);

app.use(errorHandler);

module.exports = app;
