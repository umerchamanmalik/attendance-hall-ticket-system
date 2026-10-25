const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads/bulk");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname),
    );
  },
});

// File filter - Only accept Excel files
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
    "application/vnd.ms-excel", // .xls
    "text/csv", // .csv
  ];

  const allowedExtensions = [".xlsx", ".xls", ".csv"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExtension = allowedExtensions.includes(ext);
  const isValidMime = allowedTypes.includes(file.mimetype);

  if (isValidExtension || isValidMime) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Please upload Excel files (.xlsx, .xls, .csv)",
      ),
      false,
    );
  }
};

// Create multer instance
const uploadExcel = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

module.exports = { uploadExcel };
