const mongoose = require('mongoose');

const chapterSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
  },
  chapterNumber: {
    type: Number,
  },
  manga: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Manga',
    required: true,
  },
  contentType: {
    type: String,
    enum: ['pdf', 'images', 'none'],
    default: 'none',
  },
  // Store metadata about files
  files: [{
    path: String,       // Relative path from root or uploads
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    index: Number // For ordering images
  }],
}, {
  timestamps: true,
});

// Ensure uniqueness of chapter slug per manga?
// The prompt says "chapterTitle is derived from chapter title (slug)" and URL pattern is /p/manga/:mangaTitle/:chapterTitle/
// So (manga, slug) must be unique.
chapterSchema.index({ manga: 1, slug: 1 }, { unique: true });

const Chapter = mongoose.model('Chapter', chapterSchema);

module.exports = Chapter;
