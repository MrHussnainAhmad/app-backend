const mongoose = require('mongoose');

const mangaSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
    default: '',
  },
}, {
  timestamps: true,
});

// Cascade delete chapters when a manga is deleted
mangaSchema.pre('remove', async function (next) {
  console.log(`Chapters being removed from manga ${this._id}`);
  await this.model('Chapter').deleteMany({ manga: this._id });
  next();
});

const Manga = mongoose.model('Manga', mangaSchema);

module.exports = Manga;
