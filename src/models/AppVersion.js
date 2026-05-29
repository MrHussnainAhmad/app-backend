const mongoose = require('mongoose');

const appVersionSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
      default: '1.0.0',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AppVersion', appVersionSchema);
