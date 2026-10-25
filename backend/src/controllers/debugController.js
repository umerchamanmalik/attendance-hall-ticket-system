const User = require("../models/User");

const clearUsers = async (req, res, next) => {
  try {
    const { secret } = req.body || {};
    const expected = process.env.DEBUG_SECRET || "dev-reset";
    if (secret !== expected) {
      return res.status(403).json({ success: false, error: "Forbidden" });
    }

    const rolesToRemove = ["HOD", "Faculty", "Mentor", "Student"];
    const result = await User.deleteMany({ role: { $in: rolesToRemove } });
    res.json({ success: true, removed: result.deletedCount });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  clearUsers,
};
