// backend/src/routes/departmentRoutes.js
const express = require("express");
const { body } = require("express-validator");
const {
  getDepartments,
  getPublicDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  deleteDepartment,
  assignHod,
} = require("../controllers/departmentController");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");

const router = express.Router();

// Public route for registration dropdowns
router.get("/public", getPublicDepartments);

// Protected routes
router.use(protect);

router.get("/", getDepartments);
router.get("/:id", getDepartmentById);

// SuperAdmin only routes
router.post(
  "/",
  authorizeRoles("SuperAdmin"),
  [
    body("name").notEmpty().withMessage("Department name is required"),
    body("code").notEmpty().withMessage("Department code is required"),
  ],
  createDepartment,
);

router.put("/:id", authorizeRoles("SuperAdmin"), updateDepartment);
router.delete("/:id", authorizeRoles("SuperAdmin"), deleteDepartment);
router.post("/:id/assign-hod", authorizeRoles("SuperAdmin"), assignHod);

module.exports = router;
