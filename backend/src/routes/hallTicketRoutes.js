const express = require("express");
const { body } = require("express-validator");
const {
  createHallTicket,
  getHallTickets,
  getPendingHallTickets,
  approveHallTicket,
  downloadHallTicket,
} = require("../controllers/hallTicketController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect);

router.post(
  "/",
  authorizeRoles("Mentor", "HOD"),
  [body("studentId").notEmpty().withMessage("Student ID is required")],
  createHallTicket,
);
router.get("/", getHallTickets);
router.get(
  "/review",
  authorizeRoles("Mentor", "Faculty", "HOD"),
  getPendingHallTickets,
);
router.put(
  "/review/:id",
  authorizeRoles("Mentor", "Faculty", "HOD"),
  approveHallTicket,
);
router.get("/download/:id", downloadHallTicket);

module.exports = router;
