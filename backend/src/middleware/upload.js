const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Ensure uploads directory exists
const uploadDir = path.join(process.cwd(), "uploads/students");
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
    cb(null, "student-" + uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter - Only accept images
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/gif",
    "image/webp",
  ];
  const allowedExtensions = [".jpeg", ".jpg", ".png", ".gif", ".webp"];

  const ext = path.extname(file.originalname).toLowerCase();
  const isValidExtension = allowedExtensions.includes(ext);
  const isValidMime = allowedTypes.includes(file.mimetype);

  if (isValidExtension && isValidMime) {
    cb(null, true);
  } else {
    cb(new Error("Only image files (JPG, PNG, GIF, WEBP) are allowed"), false);
  }
};

// Create multer instance with limits
const uploadPhoto = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max
  },
});

module.exports = { uploadPhoto };
