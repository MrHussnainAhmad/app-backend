const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');

// Ensure temp directory exists
const tempDir = path.join(path.resolve(), 'uploads', 'temp');
fs.ensureDirSync(tempDir);

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    // Keep original extension, add unique identifier
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const checkFileType = (file, cb) => {
  // Allowed ext
  const filetypes = /jpg|jpeg|png|webp|pdf/;
  // Check ext
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  // Check mime
  const mimetype = filetypes.test(file.mimetype) || file.mimetype === 'application/pdf';

  if (extname && mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Images and PDFs only!'));
  }
};

const upload = multer({
  storage,
  fileFilter: function (req, file, cb) {
    checkFileType(file, cb);
  },
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit per file? Adjust as needed.
});

module.exports = upload;
