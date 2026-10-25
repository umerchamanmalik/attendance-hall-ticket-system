const AuditLog = require("../models/AuditLog");

// ✅ Create Audit Log Entry
const createAuditLog = async (
  req,
  userId,
  userName,
  userRole,
  action,
  module,
  description,
  details = {},
  status = "SUCCESS",
  errorMessage = null,
) => {
  try {
    const ipAddress =
      req.ip ||
      req.connection?.remoteAddress ||
      req.headers?.["x-forwarded-for"] ||
      null;

    const userAgent = req.headers?.["user-agent"] || null;
    const department =
      req.user?.department ||
      req.department ||
      req.body?.department ||
      req.query?.department ||
      "CS";

    const auditLog = await AuditLog.create({
      userId,
      userName,
      userRole,
      department,
      action,
      module,
      description,
      details,
      ipAddress,
      userAgent,
      status,
      errorMessage,
    });

    console.log(`📝 [AUDIT] ${userName} (${userRole}) - ${action} - ${module}`);
    return auditLog;
  } catch (error) {
    console.error("❌ Error creating audit log:", error);
    return null;
  }
};

// ✅ Middleware to log API requests
const auditMiddleware = (module) => {
  return async (req, res, next) => {
    // Store original send function
    const originalJson = res.json;

    // Override json to capture response
    res.json = function (data) {
      // Check if this is a success or failure
      const isSuccess = data?.success !== false;
      const status = isSuccess ? "SUCCESS" : "FAILURE";
      const errorMessage = !isSuccess
        ? data?.error || data?.message || null
        : null;

      // Determine action based on HTTP method
      let action = "VIEW";
      if (req.method === "POST") action = "CREATE";
      else if (req.method === "PUT") action = "UPDATE";
      else if (req.method === "DELETE") action = "DELETE";

      // Log the action if user is authenticated
      if (req.user && req.user._id) {
        createAuditLog(
          req,
          req.user._id,
          req.user.name || "Unknown",
          req.user.role || "Unknown",
          action,
          module,
          `${action} ${module} - ${req.originalUrl}`,
          {
            url: req.originalUrl,
            method: req.method,
            body: req.body,
            query: req.query,
            params: req.params,
            responseStatus: isSuccess ? "SUCCESS" : "FAILURE",
          },
          status,
          errorMessage,
        );
      }

      originalJson.call(this, data);
    };

    next();
  };
};

module.exports = {
  createAuditLog,
  auditMiddleware,
};
