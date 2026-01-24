const Chapter = require('../models/Chapter');
const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');

// Helper to calculate next 5:00 AM PKT (00:00 UTC)
const calculateNextFiveAMPKT = () => {
    const now = new Date();
    const targetTime = new Date(now);
    targetTime.setUTCHours(0, 0, 0, 0); // 00:00 UTC = 5:00 AM PKT
    
    // If current time is already past 00:00 UTC, schedule for tomorrow
    if (now.getTime() > targetTime.getTime()) {
        targetTime.setUTCDate(targetTime.getUTCDate() + 1);
    }
    return targetTime;
};

// @desc    Create a chapter
// @route   POST /p/manga/:mangaId/chapter
// @access  Admin
const createChapter = async (req, res) => {
  const { title, chapterNumber, files, pageCount, isPublished, scheduleForLater } = req.body;
  const mangaId = req.params.mangaId;

  try {
    const manga = await Manga.findById(mangaId);
    if (!manga) return res.status(404).json({ message: 'Manga not found' });

    const slug = slugify(title, { lower: true, strict: true });
    const chapterExists = await Chapter.findOne({ manga: mangaId, slug });
    if (chapterExists) return res.status(400).json({ message: 'Chapter with this title already exists' });

    let contentType = (files && files.length > 0) ? (files[0].mimetype === 'application/pdf' ? 'pdf' : 'images') : 'none';

    let finalIsPublishedStatus = isPublished === true || isPublished === 'true'; // Convert from string or boolean
    let finalReleaseDate = null;

    if (finalIsPublishedStatus) {
        finalReleaseDate = new Date(); // Publish now
    } else if (scheduleForLater === true || scheduleForLater === 'true') {
        finalReleaseDate = calculateNextFiveAMPKT(); // Schedule for next 5 AM PKT
    }
    // If neither, then isPublished is false and releaseDate is null

    const chapter = new Chapter({
      title,
      slug,
      chapterNumber,
      manga: mangaId,
      contentType,
      pageCount: pageCount || 0,
      files: files || [],
      isPublished: finalIsPublishedStatus, // Set based on admin choice
      releaseDate: finalReleaseDate, // Set based on admin choice
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
// @access  Admin
const updateChapter = async (req, res) => {
    const { title, chapterNumber, files, pageCount, isPublished, scheduleForLater } = req.body;

    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

        if (title) {
            chapter.title = title;
            chapter.slug = slugify(title, { lower: true, strict: true });
        }
        if (chapterNumber !== undefined) chapter.chapterNumber = chapterNumber;
        if (pageCount !== undefined) chapter.pageCount = pageCount;

        // Handle publication status based on new options
        let finalIsPublishedStatus = isPublished === true || isPublished === 'true';
        let finalReleaseDate = null;

        if (finalIsPublishedStatus) {
            finalReleaseDate = new Date(); // Publish now
        } else if (scheduleForLater === true || scheduleForLater === 'true') {
            finalReleaseDate = calculateNextFiveAMPKT(); // Schedule for next 5 AM PKT
        }
        // If neither, then finalIsPublishedStatus is false and finalReleaseDate is null

        chapter.isPublished = finalIsPublishedStatus;
        chapter.releaseDate = finalReleaseDate;


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
// @access  Admin
const deleteChapter = async (req, res) => {
    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (!chapter) return res.status(404).json({ message: 'Chapter not found' });

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
    } catch (error) {
        console.error('DeleteChapter Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get chapters (public)
const getChapters = async (req, res) => {
    try {
        const query = {
            $or: [
                { isPublished: true, releaseDate: { $lte: new Date() } }, // Explicitly published and released
                { isPublished: false, releaseDate: { $lte: new Date() } } // Or just scheduled and released (isPublished=false)
            ]
        };
        // Simplified query logic: if isPublished is true, it means immediate. If releaseDate is set, it's scheduled.
        // We want all where: (isPublished=true AND released) OR (isPublished=false AND scheduled AND released)
        // Which simplifies to (isPublished=true AND releaseDate <= now) OR (releaseDate <= now AND isPublished=false)
        // Which is just: (releaseDate <= now) -- if releaseDate is set, it is visible. If isPublished is true, releaseDate is now.

        const filterQuery = {
            $or: [
                { isPublished: true }, // Explicitly marked as published immediately
                { releaseDate: { $lte: new Date() } } // Or has a release date that has passed
            ]
        };
        // This is still too complex if isPublished=true also sets releaseDate.
        // Let's simplify the backend logic to be:
        // A chapter is visible if:
        // 1. isPublished is true (meaning it was published immediately, releaseDate would be Date.now())
        // 2. OR releaseDate is set AND releaseDate is in the past ($lte new Date())

        // The query should be simply:
        // If isPublished is true -> always visible
        // If isPublished is false and releaseDate is in the past -> visible
        // If isPublished is false and releaseDate is in the future -> not visible
        // If isPublished is false and releaseDate is null -> not visible

        // So, chapters should be visible if (isPublished === true) OR (releaseDate !== null AND releaseDate <= new Date())
        const finalQuery = {
            $or: [
                { isPublished: true },
                { releaseDate: { $ne: null, $lte: new Date() } }
            ]
        };

        if (req.params.mangaId) finalQuery.manga = req.params.mangaId;
        const chapters = await Chapter.find(finalQuery).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        console.error('GetChapters Error:', error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get all chapters (admin - sees all)
const getAllChapters = async (req, res) => {
    try {
        const query = {}; // Admin sees all regardless of status or date
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
