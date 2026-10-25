const path = require("path");
const HallTicket = require("../models/HallTicket");
const Student = require("../models/Student");
const { createHallTicketRecord } = require("../services/hallTicketService");
const { getAttendanceThresholds } = require("../utils/attendanceThreshold");

const createHallTicket = async (req, res, next) => {
  try {
    const { studentId } = req.body;
    const student = await Student.findById(studentId);
    if (!student) {
      return res
        .status(404)
        .json({ success: false, error: "Student not found" });
    }

    const hallTicket = await createHallTicketRecord(student, req.user.name);
    res.status(201).json({ success: true, data: hallTicket });
  } catch (error) {
    next(error);
  }
};

const getHallTickets = async (req, res, next) => {
  try {
    const { studentId, approvalStatus } = req.query;
    const query = {};

    if (studentId) query.studentId = studentId;
    if (approvalStatus) query.approvalStatus = approvalStatus;

    if (req.user.role === "Student") {
      const student = await Student.findOne({ email: req.user.email });
      if (!student) {
        return res
          .status(404)
          .json({ success: false, error: "Student profile not found" });
      }
      query.studentId = student._id;
    }

    if (req.user.role === "Mentor" || req.user.role === "Faculty") {
      const mentees = await Student.find({ mentorName: req.user.name }).select(
        "_id",
      );
      query.studentId = { $in: mentees.map((mentee) => mentee._id) };
    }

    const hallTickets = await HallTicket.find(query).populate(
      "studentId",
      "studentName rollNumber academicYear semester section department",
    );
    const thresholds = await getAttendanceThresholds(
      hallTickets.map(
        (ticket) => ticket.department || ticket.studentId?.department || "CS",
      ),
    );
    res.json({
      success: true,
      data: hallTickets.map((ticket) => ({
        ...ticket.toObject(),
        department: ticket.department || ticket.studentId?.department || "CS",
        attendanceThreshold:
          thresholds.get(
            (ticket.department || ticket.studentId?.department || "CS")
              .trim()
              .toUpperCase(),
          ) ?? 85,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const getPendingHallTickets = async (req, res, next) => {
  try {
    const query = { approvalStatus: "Pending" };

    if (req.user.role === "Mentor" || req.user.role === "Faculty") {
      const mentees = await Student.find({ mentorName: req.user.name }).select(
        "_id",
      );
      query.studentId = { $in: mentees.map((mentee) => mentee._id) };
    }

    const hallTickets = await HallTicket.find(query).populate(
      "studentId",
      "studentName rollNumber academicYear semester section department",
    );
    const thresholds = await getAttendanceThresholds(
      hallTickets.map(
        (ticket) => ticket.department || ticket.studentId?.department || "CS",
      ),
    );
    res.json({
      success: true,
      data: hallTickets.map((ticket) => ({
        ...ticket.toObject(),
        department: ticket.department || ticket.studentId?.department || "CS",
        attendanceThreshold:
          thresholds.get(
            (ticket.department || ticket.studentId?.department || "CS")
              .trim()
              .toUpperCase(),
          ) ?? 85,
      })),
    });
  } catch (error) {
    next(error);
  }
};

const approveHallTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const hallTicket = await HallTicket.findById(id);
    if (!hallTicket) {
      return res
        .status(404)
        .json({ success: false, error: "Hall ticket not found" });
    }

    if (!["Approved", "Rejected"].includes(status)) {
      return res
        .status(422)
        .json({ success: false, error: "Status must be Approved or Rejected" });
    }

    if (req.user.role === "Mentor" || req.user.role === "Faculty") {
      const student = await Student.findById(hallTicket.studentId);
      if (!student || student.mentorName !== req.user.name) {
        return res
          .status(403)
          .json({ success: false, error: "Forbidden: not your mentee" });
      }
    }

    hallTicket.approvalStatus = status;
    hallTicket.approvedBy = req.user.name;
    hallTicket.generatedDate = new Date();
    await hallTicket.save();

    res.json({ success: true, data: hallTicket });
  } catch (error) {
    next(error);
  }
};

const downloadHallTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const hallTicket = await HallTicket.findById(id).populate(
      "studentId",
      "studentName",
    );
    if (!hallTicket || !hallTicket.pdfPath) {
      return res
        .status(404)
        .json({ success: false, error: "Hall ticket PDF not found" });
    }

    res.download(path.resolve(process.cwd(), hallTicket.pdfPath));
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createHallTicket,
  getHallTickets,
  getPendingHallTickets,
  approveHallTicket,
  downloadHallTicket,
};
