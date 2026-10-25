const errorHandler = (err, req, res, next) => {
  // ✅ Default values
  let statusCode = err.statusCode || 500;
  let message = err.message || "Something went wrong on the server";
  let errors = [];
  let details = err.details || null;

  // ✅ Log error for debugging
  console.error("❌ Error:", err);
  console.error("❌ Stack:", err.stack);

  // ✅ Handle Mongoose Validation Errors
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
    errors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
      value: e.value,
    }));
  }

  // ✅ Handle Mongoose Duplicate Key Error
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyPattern)[0];
    const value = err.keyValue[field];
    message = `Duplicate value for ${field}`;
    errors = [
      {
        field: field,
        message: `${field} "${value}" already exists. Please use a unique value.`,
        value: value,
      },
    ];
  }

  // ✅ Handle Cast Error (Invalid ObjectId)
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
    errors = [
      {
        field: err.path,
        message: `Invalid ${err.path}: "${err.value}". Please provide a valid ID.`,
        value: err.value,
      },
    ];
  }

  // ✅ Handle JWT Errors
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token. Please login again.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired. Please login again.";
  }

  // ✅ Handle Multer File Upload Errors
  if (err.code === "LIMIT_FILE_SIZE") {
    statusCode = 400;
    message = "File too large";
    errors = [
      {
        field: "file",
        message:
          "File size exceeds the allowed limit (5MB). Please upload a smaller file.",
      },
    ];
  }

  if (err.code === "LIMIT_UNEXPECTED_FILE") {
    statusCode = 400;
    message = "Unexpected file field";
    errors = [
      {
        field: "file",
        message: "Please upload a valid file.",
      },
    ];
  }

  // ✅ Handle Custom Validation Errors (from controllers)
  if (err.type === "validation") {
    statusCode = err.statusCode || 400;
    message = err.message || "Validation Error";
    errors = err.errors || [];
  }

  // ✅ Handle Authorization Errors
  if (err.name === "UnauthorizedError" || err.statusCode === 401) {
    statusCode = 401;
    message = "You are not authorized. Please login.";
  }

  if (err.statusCode === 403) {
    statusCode = 403;
    message = "You don't have permission to perform this action.";
  }

  // ✅ Handle Not Found Errors
  if (err.statusCode === 404) {
    statusCode = 404;
    message = err.message || "Resource not found.";
  }

  // ✅ Handle Database Connection Errors
  if (err.name === "MongoError" || err.name === "MongoNetworkError") {
    statusCode = 503;
    message = "Database connection issue. Please try again later.";
  }

  // ✅ Build response
  const response = {
    success: false,
    message: message,
    statusCode: statusCode,
    timestamp: new Date().toISOString(),
  };

  // ✅ Add errors if present
  if (errors.length > 0) {
    response.errors = errors;
  }

  // ✅ Add details if present
  if (details) {
    response.details = details;
  }

  // ✅ Add stack trace in development
  if (process.env.NODE_ENV === "development") {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

// ✅ Custom Error Classes
class AppError extends Error {
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.type = "validation";
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(`${resource} not found`, 404);
    this.type = "not-found";
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, errors);
    this.type = "validation";
  }
}

class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized access") {
    super(message, 401);
    this.type = "unauthorized";
  }
}

class ForbiddenError extends AppError {
  constructor(message = "You don't have permission") {
    super(message, 403);
    this.type = "forbidden";
  }
}

module.exports = {
  errorHandler,
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
};
