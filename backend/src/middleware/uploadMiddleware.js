const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadPath = process.env.UPLOAD_PATH || "uploads";
const documentPath = path.join(uploadPath, "documents");

if (!fs.existsSync(uploadPath)) fs.mkdirSync(uploadPath, { recursive: true });
if (!fs.existsSync(documentPath))
  fs.mkdirSync(documentPath, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, documentPath),
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const cleanName = file.originalname.replace(/\s+/g, "_");
    cb(null, `${timestamp}-${cleanName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "application/pdf",
    "image/png",
    "image/jpg",
    "image/jpeg",
  ];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("Unsupported file type. Use PDF or JPG/JPEG/PNG."), false);
  }
};

const uploadDocument = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

module.exports = {
  uploadDocument,
};
