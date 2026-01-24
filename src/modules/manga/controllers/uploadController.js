const cloudinary = require('../../../config/cloudinary');

// @desc    Get Cloudinary Signature for client-side upload
// @route   GET /p/manga/upload-signature
// @access  Admin
const getUploadSignature = (req, res) => {
  const timestamp = Math.round((new Date).getTime() / 1000);
  
  // We want to sign a request that uses these parameters
  // You can restrict folders here if you want strict security
  const signature = cloudinary.utils.api_sign_request({
    timestamp: timestamp,
    // eager: 'c_pad,h_300,w_400|c_crop,h_200,w_260', // Example transformations
    // folder: 'manga-platform' // If we want to force folder
  }, process.env.CLOUDINARY_API_SECRET);

  res.json({
    signature,
    timestamp,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY
  });
};

module.exports = { getUploadSignature };
