const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  genre: { type: String, required: true },
  email: { type: String, required: true },
  images: [{
    path: String,
    publicId: String
  }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  }
}, { timestamps: true });

module.exports = mongoose.model('Suggestion', suggestionSchema);
