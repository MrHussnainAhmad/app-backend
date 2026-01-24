const express = require('express');
const router = express.Router();
const {
    createSuggestion,
    createRequest,
    getSuggestions,
    getRequests,
    deleteSuggestion,
    deleteRequest
} = require('../controllers/interactionController');
const { protect, admin } = require('../../../middleware/authMiddleware');
const upload = require('../../../middleware/uploadMiddleware');

// Public Routes
router.post('/suggest', upload.array('images', 3), createSuggestion);
router.post('/request', createRequest);

// Admin Routes
router.get('/suggestions', protect, admin, getSuggestions);
router.get('/requests', protect, admin, getRequests);
router.delete('/suggestions/:id', protect, admin, deleteSuggestion);
router.delete('/requests/:id', protect, admin, deleteRequest);

module.exports = router;
