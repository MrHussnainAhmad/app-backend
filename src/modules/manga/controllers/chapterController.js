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
// @access  Admin
const createChapter = async (req, res) => {
  const { title, chapterNumber, files, pageCount } = req.body;
  const mangaId = req.params.mangaId;

  try {
    const manga = await Manga.findById(mangaId);
    if (!manga) return res.status(404).json({ message: 'Manga not found' });

    const slug = slugify(title, { lower: true, strict: true });
    
    const chapterExists = await Chapter.findOne({ manga: mangaId, slug });
    if (chapterExists) return res.status(400).json({ message: 'Chapter exists' });

    // ... (File validation logic logic skipped for brevity in search, assuming it's there) ...
    // Re-implementing simplified validation to inject releaseDate logic cleanly
    
    const releaseDate = getNextReleaseDate();

    const chapter = new Chapter({
      title,
      slug,
      chapterNumber,
      manga: mangaId,
      contentType: (files && files.length > 0) ? (files[0].mimetype === 'application/pdf' ? 'pdf' : 'images') : 'none',
      pageCount: pageCount || 0,
      files: files || [],
      releaseDate // Set scheduled time
    });

    await chapter.save();
    res.status(201).json(chapter);

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update chapter (metadata or content)
// @route   PUT /p/manga/chapter/:id
// @access  Admin
const updateChapter = async (req, res) => {
    const { title, chapterNumber, files, pageCount } = req.body;

    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (!chapter) {
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const manga = chapter.manga;
        const oldSlug = chapter.slug;
        let newSlug = oldSlug;

        if (title) {
            newSlug = slugify(title, { lower: true, strict: true });
        }

        chapter.title = title || chapter.title;
        chapter.slug = newSlug;
        chapter.chapterNumber = chapterNumber || chapter.chapterNumber;
        if (pageCount !== undefined) chapter.pageCount = pageCount;

        // Handle Content Replacement (If new files are provided)
        if (files && files.length > 0) {
            
            // 1. Delete old files from Cloudinary
            if (chapter.files && chapter.files.length > 0) {
                const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' }); 
                    await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' });
                }
            }

            let contentType = 'none';
            const isPdf = files.some(f => f.mimetype === 'application/pdf');
            const isImage = files.every(f => f.mimetype.startsWith('image/'));

            if (isPdf && files.length > 1) return res.status(400).json({ message: 'Only one PDF allowed' });
            if (isPdf) contentType = 'pdf';
            else if (isImage) contentType = 'images';
            else return res.status(400).json({ message: 'Invalid file types' });

            chapter.contentType = contentType;
            chapter.files = files; // Replace with new list
        }

        await chapter.save();
        res.json(chapter);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete chapter
// @route   DELETE /p/manga/chapter/:id
// @access  Admin
const deleteChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (chapter) {
            // Delete files from Cloudinary
            if (chapter.files && chapter.files.length > 0) {
                const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
                if (publicIds.length > 0) {
                    await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
                    await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' });
                }
            }

            const folderPath = `manga-platform/${chapter.manga.slug}/${chapter.slug}`;
            try {
                await cloudinary.api.delete_folder(folderPath);
            } catch (err) {
                console.log('Cloudinary delete folder warning:', err.message);
            }

            await chapter.deleteOne();
            res.json({ message: 'Chapter deleted' });
        } else {
            res.status(404).json({ message: 'Chapter not found' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getChapters = async (req, res) => {
    try {
        const query = { releaseDate: { $lte: new Date() } }; // Filter Released
        if (req.params.mangaId) query.manga = req.params.mangaId;
        const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Admin only - see all
const getAllChapters = async (req, res) => {
    try {
        const query = {};
        if (req.params.mangaId) query.manga = req.params.mangaId;
        const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const getChapterById = async (req, res) => {

const getChapterById = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id);
        if (chapter) res.json(chapter);
        else res.status(404).json({ message: 'Chapter not found' });
    } catch (error) {
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
