const express = require('express');
const router = express.Router();
const {
    getChapterById,
    updateChapter,
    deleteChapter
} = require('../controllers/chapterController');
const { protect, admin } = require('../../../middleware/authMiddleware');
const upload = require('../../../middleware/uploadMiddleware');

// /p/manga/chapter/:id
router.route('/:id')
    .get(getChapterById)
    .put(protect, admin, upload.array('content'), updateChapter)
    .delete(protect, admin, deleteChapter);

module.exports = router;
