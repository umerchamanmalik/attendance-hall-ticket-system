const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const auditController = require("../controllers/auditController");

// All audit routes require authentication and HOD role
router.use(protect);
router.use(authorizeRoles("HOD"));

// Get audit logs with filters
router.get("/", auditController.getAuditLogs);

// Get audit summary
router.get("/summary", auditController.getAuditSummary);

// Get user activity
router.get("/user/:userId", auditController.getUserActivity);

// Get module activity
router.get("/module/:module", auditController.getModuleActivity);

module.exports = router;
