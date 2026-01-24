const Chapter = require('../models/Chapter');
const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');

const PREVIEW_IMAGE_COUNT = 5; // 4/5 images (we use 5)
const PREVIEW_PDF_PAGE_COUNT = 10;
const PREVIEW_FILES_SLICE = 20; // Fetch a small slice and derive previews from it

const injectCloudinaryTransform = (url, transform) => {
    if (!url || typeof url !== 'string') return null;
    const marker = '/upload/';
    const idx = url.indexOf(marker);
    if (idx === -1) return url;

    const prefix = url.slice(0, idx + marker.length);
    const suffix = url.slice(idx + marker.length);
    return `${prefix}${transform}/${suffix}`;
};

const pdfToPageJpgUrls = (pdfUrl, pageCountToReturn) => {
    if (!pdfUrl) return [];
    const pages = Math.max(0, Math.min(pageCountToReturn, PREVIEW_PDF_PAGE_COUNT));

    const urls = [];
    for (let i = 1; i <= pages; i++) {
        // IMPORTANT: Keep URLs aligned with the mobile reader logic:
        // reader builds: /upload/pg_${i}/...pdf -> .jpg
        const transformed = injectCloudinaryTransform(pdfUrl, `pg_${i}`);
        if (!transformed) continue;
        urls.push(transformed.replace(/\.pdf(\?|$)/i, '.jpg$1'));
    }
    return urls;
};

const buildChapterPreviewUrls = (chapter) => {
    if (!chapter) return [];

    if (chapter.contentType === 'images') {
        const files = Array.isArray(chapter.files) ? chapter.files : [];
        const sorted = files
            .slice()
            .sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0));

        return sorted
            .slice(0, PREVIEW_IMAGE_COUNT)
            .map((f) => f?.path)
            .filter(Boolean);
    }

    if (chapter.contentType === 'pdf') {
        const pdfUrl = chapter.files?.[0]?.path;
        const count = Number.isFinite(chapter.pageCount) && chapter.pageCount > 0
            ? chapter.pageCount
            : PREVIEW_PDF_PAGE_COUNT;

        return pdfToPageJpgUrls(pdfUrl, count);
    }

    return [];
};

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

    const normalizedFiles = Array.isArray(files)
        ? files.slice().sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
        : (files || []);

    let contentType = (normalizedFiles && normalizedFiles.length > 0)
        ? (normalizedFiles[0].mimetype === 'application/pdf' ? 'pdf' : 'images')
        : 'none';

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
      files: normalizedFiles || [],
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
            const normalizedFiles = Array.isArray(files)
                ? files.slice().sort((a, b) => (a?.index ?? 0) - (b?.index ?? 0))
                : files;

            chapter.files = normalizedFiles;
            chapter.contentType = (Array.isArray(normalizedFiles) && normalizedFiles[0]?.mimetype === 'application/pdf'
                ? 'pdf'
                : 'images');
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
        const now = new Date();
        const finalQuery = {
            $or: [
                { isPublished: true },
                { releaseDate: { $ne: null, $lte: now } }
            ]
        };

        if (req.params.mangaId) finalQuery.manga = req.params.mangaId;

        // Cache for a short time at CDN/edge (safe for public content)
        res.set('Cache-Control', 'public, max-age=60, s-maxage=60, stale-while-revalidate=300');

        // IMPORTANT: do not return full `files` arrays for every chapter (can be huge).
        const chapters = await Chapter.find(finalQuery)
            .sort({ chapterNumber: 1 })
            .select('title slug chapterNumber contentType pageCount isPublished releaseDate files.path files.index files.mimetype')
            .slice('files', PREVIEW_FILES_SLICE)
            .lean();

        const payload = (chapters || []).map((ch) => ({
            _id: ch._id,
            title: ch.title,
            slug: ch.slug,
            chapterNumber: ch.chapterNumber,
            contentType: ch.contentType,
            pageCount: ch.pageCount,
            isPublished: ch.isPublished,
            releaseDate: ch.releaseDate,
            previewUrls: buildChapterPreviewUrls(ch),
        }));

        res.json(payload);
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
