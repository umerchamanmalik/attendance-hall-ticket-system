// backend/src/middleware/auth.js
const { verifyToken } = require("../utils/jwt");
const User = require("../models/User");
const FacultyAllocation = require("../models/FacultyAllocation");

const protect = async (req, res, next) => {
  let token = null;
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  }

  if (!token) {
    return res
      .status(401)
      .json({ success: false, error: "Not authorized, token missing" });
  }

  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res
        .status(401)
        .json({ success: false, error: "Not authorized, user not found" });
    }

    req.user = user;
    console.log("✅ User authenticated:", user.email, "Role:", user.role);
    next();
  } catch (error) {
    console.error("❌ Auth error:", error);
    return res
      .status(401)
      .json({ success: false, error: "Not authorized, token invalid" });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ success: false, error: "Not authenticated" });
    }

    console.log("🔍 Authorizing roles...");
    console.log("👤 User email:", req.user.email);
    console.log("👤 User role from User table:", req.user.role);
    console.log("🔓 Allowed roles:", allowedRoles);

    // ✅ Check if user has direct role match
    const hasDirectRole = allowedRoles.includes(req.user.role);

    // ✅ If user is Faculty, check FacultyAllocation for additional roles
    let hasAdditionalRole = false;
    let additionalRoles = [];

    if (req.user.role === "Faculty") {
      try {
        const allocations = await FacultyAllocation.find({
          facultyEmail: { $regex: `^${req.user.email}$`, $options: "i" },
        }).select("roleType subjectName semester section");

        if (allocations.length > 0) {
          console.log(`📊 Found ${allocations.length} faculty allocations`);

          // ✅ Check if any allocation has Mentor or Both role
          const hasMentorRole = allocations.some(
            (alloc) => alloc.roleType === "Mentor" || alloc.roleType === "Both",
          );

          if (hasMentorRole) {
            additionalRoles.push("Mentor");
            hasAdditionalRole = true;
            console.log(
              "✅ Faculty also has Mentor role via FacultyAllocation",
            );
          }

          // ✅ Log all roles found
          allocations.forEach((alloc) => {
            console.log(`   - ${alloc.subjectName} (${alloc.roleType})`);
          });
        }
      } catch (err) {
        console.log("⚠️ Error checking FacultyAllocation:", err.message);
      }
    }

    // ✅ Combine direct role + additional roles
    const userRoles = [req.user.role, ...additionalRoles];
    console.log("📋 User's effective roles:", userRoles);

    // ✅ Check if any role matches allowed roles
    const hasAccess = userRoles.some((role) => allowedRoles.includes(role));

    // ✅ SuperAdmin has read access to HOD endpoints, or direct role match
    const isSuperAdminAllowed =
      req.user.role === "SuperAdmin" &&
      (allowedRoles.includes("SuperAdmin") || (req.method === "GET" && allowedRoles.includes("HOD")));

    if (!hasAccess && !isSuperAdminAllowed) {
      console.log("❌ No matching role found");
      return res.status(403).json({
        success: false,
        error: `Forbidden: User has roles [${userRoles.join(", ")}]. Required: ${allowedRoles.join(", ")}`,
      });
    }

    console.log("✅ Access granted");
    next();
  };
};

// ============================================
// ✅ Check department access
// ============================================
const authorizeDepartment = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, error: "Not authenticated" });
  }

  // SuperAdmin has college-wide access across all departments
  if (req.user.role === "SuperAdmin") {
    return next();
  }

  const requestedDept = (
    req.params.department ||
    req.query.department ||
    req.body.department ||
    req.headers["x-department"]
  );

  const userDept = (req.user.department || "CS").trim().toUpperCase();

  if (
    requestedDept &&
    requestedDept !== "ALL" &&
    requestedDept.trim().toUpperCase() !== userDept
  ) {
    return res.status(403).json({
      success: false,
      error: `Forbidden: You only have access to department ${userDept}`,
    });
  }

  next();
};

module.exports = {
  protect,
  authorizeRoles,
  authorizeDepartment,
};
