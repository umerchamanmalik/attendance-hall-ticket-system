// backend/src/utils/initDepartments.js
const Department = require("../models/Department");
const User = require("../models/User");
const bcrypt = require("bcryptjs");

const defaultDepartments = [
  {
    name: "Computer Science & Engineering",
    code: "CS",
    attendanceThreshold: 75,
    description: "Department of Computer Science & Engineering",
    isActive: true,
  },
  {
    name: "Electronics & Communication Engineering",
    code: "EC",
    attendanceThreshold: 75,
    description: "Department of Electronics & Communication Engineering",
    isActive: true,
  },
  {
    name: "Mechanical Engineering",
    code: "MECH",
    attendanceThreshold: 75,
    description: "Department of Mechanical Engineering",
    isActive: true,
  },
  {
    name: "Civil Engineering",
    code: "CIVIL",
    attendanceThreshold: 75,
    description: "Department of Civil Engineering",
    isActive: true,
  },
  {
    name: "Electrical & Electronics Engineering",
    code: "EEE",
    attendanceThreshold: 75,
    description: "Department of Electrical & Electronics Engineering",
    isActive: true,
  },
];

const initDepartments = async () => {
  try {
    for (const dept of defaultDepartments) {
      const exists = await Department.findOne({ code: dept.code });
      if (!exists) {
        await Department.create(dept);
        console.log(`✅ Seeded department: ${dept.code} - ${dept.name}`);
      }
    }

    // Seed default SuperAdmin if none exists
    const superAdminExists = await User.findOne({ role: "SuperAdmin" });
    if (!superAdminExists) {
      const hashedPassword = await bcrypt.hash("Admin@123", 12);
      await User.create({
        name: "College Super Admin",
        email: "superadmin@college.edu",
        password: hashedPassword,
        role: "SuperAdmin",
        department: "CS",
      });
      console.log(
        "✅ Seeded default SuperAdmin: superadmin@college.edu / Admin@123",
      );
    }
  } catch (error) {
    console.error("⚠️ Error initializing departments:", error.message);
  }
};

module.exports = initDepartments;
