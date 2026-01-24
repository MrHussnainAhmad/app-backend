const express = require('express');
const router = express.Router();
const {
  getMangas,
  createManga,
  getMangaById,
  updateManga,
  deleteManga,
} = require('../controllers/mangaController');
const { protect, admin } = require('../../../middleware/authMiddleware');
const { getChapters, createChapter } = require('../controllers/chapterController'); // Nested resource
const { getUploadSignature } = require('../controllers/uploadController');
const upload = require('../../../middleware/uploadMiddleware');

router.get('/upload-signature', protect, admin, getUploadSignature);

// /p/manga
router.route('/')
    .get(getMangas)
    .post(protect, admin, upload.single('coverImage'), createManga);

router.route('/:id')
    .get(getMangaById)
    .put(protect, admin, upload.single('coverImage'), updateManga)
    .delete(protect, admin, deleteManga);

// Nested routes for chapters (creation context requires mangaId)
router.route('/:mangaId/chapters')
    .get(getChapters);

router.route('/:mangaId/chapter')
    .post(protect, admin, upload.array('content'), createChapter);

module.exports = router;
