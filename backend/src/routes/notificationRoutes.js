const express = require("express");
// ✅ FIXED: Removed `authorizeRoles` import — no longer needed
const { protect } = require("../middleware/authMiddleware");
const notificationController = require("../controllers/notificationController");

const router = express.Router();

// ✅ FIXED: All notifications routes use `protect` only — any authenticated user
// can access. Controller filters by recipientId so each user only sees their own.
router.use(protect);

router.get("/unread-count", notificationController.getUnreadCount);
router.get("/", notificationController.getMyNotifications);
router.get("/:id", notificationController.getNotificationById);
router.put("/read-all", notificationController.markAllAsRead);
router.put("/:id/read", notificationController.markAsRead);
router.delete("/:id", notificationController.deleteNotification);

module.exports = router;
