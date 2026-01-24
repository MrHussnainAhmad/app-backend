const Suggestion = require('../models/Suggestion');
const Request = require('../models/Request');
const cloudinary = require('../../../config/cloudinary');
const fs = require('fs-extra');

// Helper to cleanup
const cleanup = (files) => {
    if (files) files.forEach(f => fs.remove(f.path).catch(()=>{}));
};

// @desc Create Suggestion
// @route POST /p/interactions/suggest
// @access Public
const createSuggestion = async (req, res) => {
    const { title, description, genre, email } = req.body;
    const files = req.files;

    try {
        const uploadedImages = [];

        if (files && files.length > 0) {
            // Upload to Cloudinary
            const uploadPromises = files.map(file => {
                return cloudinary.uploader.upload(file.path, {
                    folder: 'manga-platform/suggestions',
                    resource_type: 'image'
                });
            });

            const results = await Promise.all(uploadPromises);
            
            results.forEach((result, index) => {
                uploadedImages.push({
                    path: result.secure_url,
                    publicId: result.public_id
                });
                // Cleanup local
                fs.remove(files[index].path).catch(()=>{});
            });
        }

        const suggestion = new Suggestion({
            title,
            description,
            genre,
            email,
            images: uploadedImages
        });

        await suggestion.save();
        res.status(201).json(suggestion);

    } catch (error) {
        cleanup(files);
        res.status(500).json({ message: error.message });
    }
};

// @desc Create Request
// @route POST /p/interactions/request
// @access Public
const createRequest = async (req, res) => {
    const { title, description } = req.body;
    try {
        const newRequest = new Request({ title, description });
        await newRequest.save();
        res.status(201).json(newRequest);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get All Suggestions
// @route GET /p/interactions/suggestions
// @access Admin
const getSuggestions = async (req, res) => {
    try {
        const suggestions = await Suggestion.find({}).sort({ createdAt: -1 });
        res.json(suggestions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Get All Requests
// @route GET /p/interactions/requests
// @access Admin
const getRequests = async (req, res) => {
    try {
        const requests = await Request.find({}).sort({ createdAt: -1 });
        res.json(requests);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Delete Suggestion
// @route DELETE /p/interactions/suggestions/:id
// @access Admin
const deleteSuggestion = async (req, res) => {
    try {
        const suggestion = await Suggestion.findById(req.params.id);
        if (suggestion) {
            if (suggestion.images && suggestion.images.length > 0) {
                const publicIds = suggestion.images.map(img => img.publicId).filter(id => id);
                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds);
                }
            }
            await suggestion.deleteOne();
            res.json({ message: 'Suggestion removed' });
        } else {
            res.status(404).json({ message: 'Not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc Delete Request
// @route DELETE /p/interactions/requests/:id
// @access Admin
const deleteRequest = async (req, res) => {
    try {
        await Request.findByIdAndDelete(req.params.id);
        res.json({ message: 'Request removed' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createSuggestion,
    createRequest,
    getSuggestions,
    getRequests,
    deleteSuggestion,
    deleteRequest
};
