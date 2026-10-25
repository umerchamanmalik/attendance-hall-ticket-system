// backend/src/utils/departmentHelper.js

/**
 * Builds a query filter for department scoping.
 * Handles backward compatibility: if department is "CS", records with missing/null department are included.
 * If user is SuperAdmin:
 *   - uses query param or x-department header if specified (and not 'ALL')
 *   - returns {} if 'ALL' or unspecified (SuperAdmin sees all)
 * If user is HOD/Faculty/Mentor/Student:
 *   - scopes strictly to user's assigned department
 * 
 * @param {Object} req Express request object
 * @param {String} fieldName Field name in database model (default: "department")
 * @returns {Object} MongoDB query filter object
 */
const getDepartmentFilter = (req, fieldName = "department") => {
  const user = req?.user;
  const isSuperAdmin = user?.role === "SuperAdmin";

  if (isSuperAdmin) {
    const requestedDept = (
      req.query?.department ||
      req.headers?.["x-department"] ||
      ""
    ).trim().toUpperCase();

    if (!requestedDept || requestedDept === "ALL") {
      return {};
    }

    if (requestedDept === "CS") {
      return {
        $or: [
          { [fieldName]: "CS" },
          { [fieldName]: { $exists: false } },
          { [fieldName]: null },
        ],
      };
    }

    return { [fieldName]: requestedDept };
  }

  // Regular user (HOD, Faculty, Mentor, Student)
  const userDept = (user?.department || "CS").trim().toUpperCase();

  if (userDept === "CS") {
    return {
      $or: [
        { [fieldName]: "CS" },
        { [fieldName]: { $exists: false } },
        { [fieldName]: null },
      ],
    };
  }

  return { [fieldName]: userDept };
};

/**
 * Resolves the department code to use for creating new records
 * 
 * @param {Object} req Express request object
 * @param {String} fallback Fallback department code (default: "CS")
 * @returns {String} Department code
 */
const getDepartmentCode = (req, fallback = "CS") => {
  const user = req?.user;

  if (user?.role === "SuperAdmin") {
    return (
      req.body?.department ||
      req.query?.department ||
      req.headers?.["x-department"] ||
      fallback
    ).trim().toUpperCase();
  }

  return (user?.department || req.body?.department || fallback).trim().toUpperCase();
};

/**
 * Checks if current user has permission to access a specific department
 * 
 * @param {Object} req Express request object
 * @param {String} targetDept Department code to check against
 * @returns {Boolean}
 */
const isAuthorizedForDepartment = (req, targetDept) => {
  if (!req?.user) return false;
  if (req.user.role === "SuperAdmin") return true;

  const userDept = (req.user.department || "CS").trim().toUpperCase();
  const checkDept = (targetDept || "CS").trim().toUpperCase();

  return userDept === checkDept;
};

module.exports = {
  getDepartmentFilter,
  getDepartmentCode,
  isAuthorizedForDepartment,
};
