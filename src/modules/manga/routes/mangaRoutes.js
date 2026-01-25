const express = require('express');
const router = express.Router();
const {
    getMangas,
    getGenres,
    createManga,
    getMangaById,
    updateManga,
    deleteManga,
    createMangaReview,
} = require('../controllers/mangaController');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { getChapters, getAllChapters, createChapter } = require('../controllers/chapterController');
const { getUploadSignature } = require('../controllers/uploadController');
const upload = require('../../../middleware/uploadMiddleware');

router.get('/upload-signature', protect, admin, getUploadSignature);
router.get('/genres', getGenres);

// /p/manga
router.route('/')
    .get(getMangas)
    .post(protect, admin, upload.single('coverImage'), createManga);

router.route('/:id')
    .get(getMangaById)
    .put(protect, admin, upload.single('coverImage'), updateManga)
    .put(protect, admin, upload.single('coverImage'), updateManga)
    .delete(protect, admin, deleteManga);

router.route('/:id/reviews').post(createMangaReview);

// Public: Released Chapters
router.route('/:mangaId/chapters')
    .get(getChapters);

// Admin: All Chapters
router.route('/:mangaId/chapters/all')
    .get(protect, admin, getAllChapters);

// Create Chapter (Metadata Only)
router.route('/:mangaId/chapter')
    .post(protect, admin, createChapter);

module.exports = router;