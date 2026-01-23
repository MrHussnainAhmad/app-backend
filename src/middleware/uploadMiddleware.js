const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

// Use system temp dir (Writable on Vercel)
const tempDir = os.tmpdir();

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, tempDir);
  },
  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const checkFileType = (file, cb) => {
  const filetypes = /jpg|jpeg|png|webp|pdf/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
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
  limits: { fileSize: 50 * 1024 * 1024 },
});

module.exports = upload;