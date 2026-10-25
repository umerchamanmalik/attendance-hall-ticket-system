// backend/src/routes/superAdminRoutes.js
const express = require("express");
const {
  getSuperAdminOverview,
  getAllDepartmentStats,
  getAllUsers,
  assignHodToDepartment,
} = require("../controllers/superAdminController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// All SuperAdmin routes require authentication and SuperAdmin role
router.use(protect);
router.use(authorizeRoles("SuperAdmin"));

router.get("/overview", getSuperAdminOverview);
router.get("/stats", getAllDepartmentStats);
router.get("/users", getAllUsers);
router.post("/assign-hod", assignHodToDepartment);

module.exports = router;
