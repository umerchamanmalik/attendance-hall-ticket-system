const path = require("path");
const HallTicket = require("../models/HallTicket");
const { generateHallTicketPdf } = require("../utils/pdfGenerator");
const { calculateAttendancePercentage } = require("./attendanceService");

const createHallTicketRecord = async (student, createdBy) => {
  const attendancePercentage = await calculateAttendancePercentage(student._id);
  const pdfPath = path.join(
    "uploads",
    "halltickets",
    `${student._id}-${Date.now()}.pdf`,
  );

  const hallTicketData = {
    studentId: student._id,
    department: student.department || "CS",
    attendancePercentage,
    approvalStatus: "Pending",
    approvedBy: "",
    pdfPath,
    generatedDate: new Date(),
  };

  const hallTicket = await HallTicket.findOneAndUpdate(
    { studentId: student._id },
    hallTicketData,
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await generateHallTicketPdf({ student, hallTicket, outputPath: pdfPath });
  hallTicket.pdfPath = pdfPath;
  await hallTicket.save();

  return hallTicket;
};

module.exports = {
  createHallTicketRecord,
};
