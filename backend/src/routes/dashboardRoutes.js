const express = require("express");
const {
  getHodOverview,
  getMentorOverview,
} = require("../controllers/dashboardController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/hod", protect, authorizeRoles("HOD"), getHodOverview);
router.get(
  "/mentor",
  protect,
  authorizeRoles("Mentor", "Faculty"),
  getMentorOverview,
);

module.exports = router;
