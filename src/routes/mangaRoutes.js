const express = require('express');
const router = express.Router();
const {
  getMangas,
  createManga,
  getMangaById,
  updateManga,
  deleteManga,
} = require('../controllers/mangaController');
const { protect, admin } = require('../middleware/authMiddleware');
const { getChapters, createChapter } = require('../controllers/chapterController'); // Nested resource
const upload = require('../middleware/uploadMiddleware');

// /p/manga
router.route('/')
    .get(protect, admin, getMangas)
    .post(protect, admin, createManga);

router.route('/:id')
    .get(protect, admin, getMangaById)
    .put(protect, admin, updateManga)
    .delete(protect, admin, deleteManga);

// Nested routes for chapters (creation context requires mangaId)
router.route('/:mangaId/chapters')
    .get(protect, admin, getChapters);

router.route('/:mangaId/chapter')
    .post(protect, admin, upload.array('content'), createChapter);

module.exports = router;
