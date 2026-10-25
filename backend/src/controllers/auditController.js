const AuditLog = require("../models/AuditLog");
const { getDepartmentFilter } = require("../utils/departmentHelper");

// ✅ Get Audit Logs with Filters
const getAuditLogs = async (req, res, next) => {
  try {
    const {
      userId,
      action,
      module,
      userRole,
      startDate,
      endDate,
      limit = 50,
      page = 1,
    } = req.query;

    const query = { ...getDepartmentFilter(req) };
    if (userId) query.userId = userId;
    if (action) query.action = action;
    if (module) query.module = module;
    if (userRole) query.userRole = userRole;

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      AuditLog.find(query)
        .populate("userId", "name email role")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      AuditLog.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: {
        logs,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit logs:", error);
    next(error);
  }
};

// ✅ Get Audit Log Summary
const getAuditSummary = async (req, res, next) => {
  try {
    const departmentFilter = getDepartmentFilter(req);
    const [totalLogs, byAction, byModule, byRole, recentLogs] =
      await Promise.all([
        AuditLog.countDocuments(departmentFilter),
        AuditLog.aggregate([
          { $match: departmentFilter },
          { $group: { _id: "$action", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.aggregate([
          { $match: departmentFilter },
          { $group: { _id: "$module", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 10 },
        ]),
        AuditLog.aggregate([
          { $match: departmentFilter },
          { $group: { _id: "$userRole", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        AuditLog.find(departmentFilter)
          .populate("userId", "name email")
          .sort({ createdAt: -1 })
          .limit(10),
      ]);

    // Get today's logs count
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayLogs = await AuditLog.countDocuments({
      ...departmentFilter,
      createdAt: { $gte: today },
    });

    res.json({
      success: true,
      data: {
        totalLogs,
        todayLogs,
        byAction,
        byModule,
        byRole,
        recentLogs,
      },
    });
  } catch (error) {
    console.error("❌ Error fetching audit summary:", error);
    next(error);
  }
};

// ✅ Get User Activity Log
const getUserActivity = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { limit = 20 } = req.query;

    const logs = await AuditLog.find({
      ...getDepartmentFilter(req),
      userId,
    })
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("❌ Error fetching user activity:", error);
    next(error);
  }
};

// ✅ Get Module Activity Log
const getModuleActivity = async (req, res, next) => {
  try {
    const { module } = req.params;
    const { limit = 20 } = req.query;

    const logs = await AuditLog.find({
      ...getDepartmentFilter(req),
      module,
    })
      .populate("userId", "name email")
      .sort({ createdAt: -1 })
      .limit(parseInt(limit));

    res.json({
      success: true,
      data: logs,
    });
  } catch (error) {
    console.error("❌ Error fetching module activity:", error);
    next(error);
  }
};

module.exports = {
  getAuditLogs,
  getAuditSummary,
  getUserActivity,
  getModuleActivity,
};
