const mongoose = require('mongoose');

const reviewSchema = mongoose.Schema({
  rating: { type: Number, required: true },
  ip: { type: String, required: false }, // Optional: track IP to prevent spam if needed basic
}, {
  timestamps: true,
});

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
  coverImage: {
    type: String, // Cloudinary URL
    default: '',
  },
  coverImagePublicId: {
    type: String, // To delete later
    default: '',
  },
  genres: [{
    type: String,
    trim: true
  }],
  reviews: [reviewSchema], // Array of reviews
  rating: {
    type: Number,
    required: true,
    default: 0,
  },
  numReviews: {
    type: Number,
    required: true,
    default: 0,
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
