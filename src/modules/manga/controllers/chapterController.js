const Chapter = require('../models/Chapter');
const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');

// Helper to get next 5:00 AM PKT (which is 00:00 UTC)
const getNextReleaseDate = () => {
    const now = new Date();
    const release = new Date(now);
    release.setUTCHours(0, 0, 0, 0); // Set to 00:00 UTC today
    
    // If now is already past 00:00 UTC (which is 5 AM PKT), schedule for tomorrow
    if (now > release) {
        release.setDate(release.getDate() + 1);
    }
    return release;
};

// @desc    Create a chapter
// @route   POST /p/manga/:mangaId/chapter
const createChapter = async (req, res) => {
  const { title, chapterNumber, files, pageCount } = req.body;
  const mangaId = req.params.mangaId;

  try {
    const manga = await Manga.findById(mangaId);
    if (!manga) return res.status(404).json({ message: 'Manga not found' });

    const slug = slugify(title, { lower: true, strict: true });
    const chapterExists = await Chapter.findOne({ manga: mangaId, slug });
    if (chapterExists) return res.status(400).json({ message: 'Chapter with this title already exists' });

    const releaseDate = getNextReleaseDate();

    const chapter = new Chapter({
      title,
      slug,
      chapterNumber,
      manga: mangaId,
      contentType: (files && files.length > 0) ? (files[0].mimetype === 'application/pdf' ? 'pdf' : 'images') : 'none',
      pageCount: pageCount || 0,
      files: files || [],
      releaseDate
    });

    await chapter.save();
    res.status(201).json(chapter);
  } catch (error) {
    console.error('CreateChapter Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update chapter
// @route   PUT /p/manga/chapter/:id
const updateChapter = async (req, res) => {
    const { title, chapterNumber, files, pageCount } = req.body;

    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        const manga = chapter.manga;
        if (title) {
            chapter.title = title;
            chapter.slug = slugify(title, { lower: true, strict: true });
        }
        if (chapterNumber !== undefined) chapter.chapterNumber = chapterNumber;
        if (pageCount !== undefined) chapter.pageCount = pageCount;

        if (files && files.length > 0) {
            // Delete old files from Cloudinary
            if (chapter.files && chapter.files.length > 0) {
                const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds).catch(err => console.error('Cloudinary delete error:', err));
                }
            }
            chapter.files = files;
            chapter.contentType = (files[0].mimetype === 'application/pdf' ? 'pdf' : 'images');
        }

        await chapter.save();
        res.json(chapter);
    } catch (error) {
        console.error('UpdateChapter Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete chapter
// @route   DELETE /p/manga/chapter/:id
const deleteChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (chapter) {
            if (chapter.files && chapter.files.length > 0) {
                const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds).catch(err => console.error('Cloudinary delete error:', err));
                }
            }
            const folderPath = `manga-platform/${chapter.manga.slug}/${chapter.slug}`;
            await cloudinary.api.delete_folder(folderPath).catch(() => {});
            await chapter.deleteOne();
            res.json({ message: 'Chapter deleted' });
        } else {
            res.status(404).json({ message: 'Chapter not found' });
        }
    } catch (error) {
        console.error('DeleteChapter Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get chapters (released only)
const getChapters = async (req, res) => {
    try {
        const query = { releaseDate: { $lte: new Date() } };
        if (req.params.mangaId) query.manga = req.params.mangaId;
        const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        console.error('GetChapters Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all chapters (admin)
const getAllChapters = async (req, res) => {
    try {
        const query = {};
        if (req.params.mangaId) query.manga = req.params.mangaId;
        const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        console.error('GetAllChapters Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single chapter by ID
const getChapterById = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id);
        if (chapter) res.json(chapter);
        else res.status(404).json({ message: 'Chapter not found' });
    } catch (error) {
        console.error('GetChapterById Error:', error);
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    createChapter,
    updateChapter,
    deleteChapter,
    getChapters,
    getAllChapters,
    getChapterById
};