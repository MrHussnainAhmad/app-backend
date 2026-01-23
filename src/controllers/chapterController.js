const Chapter = require('../models/Chapter');
const Manga = require('../models/Manga');
const slugify = require('slugify');
const fs = require('fs-extra');
const path = require('path');
const os = require('os');

const BASE_UPLOAD_PATH = path.join(os.tmpdir(), 'manga-uploads');
// Ensure base dir exists for safety, though createManga should have made it or we make it on fly
fs.ensureDirSync(BASE_UPLOAD_PATH);

// @desc    Create a chapter
// @route   POST /p/manga/:mangaId/chapter
// @access  Admin
const createChapter = async (req, res) => {
  const { title, chapterNumber } = req.body;
  const mangaId = req.params.mangaId;
  const files = req.files; // Array of files

  try {
    const manga = await Manga.findById(mangaId);
    if (!manga) {
      if (files) files.forEach(f => fs.remove(f.path).catch(() => {}));
      return res.status(404).json({ message: 'Manga not found' });
    }

    const slug = slugify(title, { lower: true, strict: true });
    
    // Check if chapter exists
    const chapterExists = await Chapter.findOne({ manga: mangaId, slug });
    if (chapterExists) {
        if (files) files.forEach(f => fs.remove(f.path).catch(() => {}));
        return res.status(400).json({ message: 'Chapter with this title already exists in this manga' });
    }

    // Determine content type
    let contentType = 'none';
    const processedFiles = [];

    if (files && files.length > 0) {
      const isPdf = files.some(f => f.mimetype === 'application/pdf');
      const isImage = files.every(f => f.mimetype.startsWith('image/'));

      if (isPdf && files.length > 1) {
         if (files) files.forEach(f => fs.remove(f.path).catch(() => {}));
         return res.status(400).json({ message: 'Only one PDF allowed per chapter' });
      }

      if (isPdf) contentType = 'pdf';
      else if (isImage) contentType = 'images';
      else {
         if (files) files.forEach(f => fs.remove(f.path).catch(() => {}));
         return res.status(400).json({ message: 'Invalid file types mixed' });
      }

      // Move files
      const targetDir = path.join(BASE_UPLOAD_PATH, manga.slug, slug);
      await fs.ensureDir(targetDir);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Use index prefix for images to ensure order
        const newFilename = contentType === 'images' 
            ? `${String(i).padStart(3, '0')}-${file.originalname}`
            : file.originalname;
        
        const targetPath = path.join(targetDir, newFilename);
        
        // Move file from multer temp to structured temp
        await fs.move(file.path, targetPath, { overwrite: true });

        processedFiles.push({
            // Note: This path is relative to the "virtual" root for serving. 
            // Since serving static files from /tmp is tricky on Vercel without custom routes, 
            // these files might not be accessible via URL immediately. 
            // But this stops the crash.
            path: path.join('manga', manga.slug, slug, newFilename), 
            filename: newFilename,
            originalName: file.originalname,
            mimetype: file.mimetype,
            size: file.size,
            index: i
        });
      }
    }

    const chapter = new Chapter({
      title,
      slug,
      chapterNumber,
      manga: mangaId,
      contentType,
      files: processedFiles
    });

    await chapter.save();
    res.status(201).json(chapter);

  } catch (error) {
    if (files) files.forEach(f => fs.remove(f.path).catch(e => console.error(e)));
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update chapter (metadata or content)
// @route   PUT /p/manga/chapter/:id
// @access  Admin
const updateChapter = async (req, res) => {
    const { title, chapterNumber } = req.body;
    const files = req.files;

    try {
        const chapter = await Chapter.findById(req.params.id).populate('manga');
        if (!chapter) {
            if (files) files.forEach(f => fs.remove(f.path).catch(() => {}));
            return res.status(404).json({ message: 'Chapter not found' });
        }

        const manga = chapter.manga;
        const oldSlug = chapter.slug;
        let newSlug = oldSlug;

        if (title) {
            newSlug = slugify(title, { lower: true, strict: true });
        }

        // Handle rename
        if (newSlug !== oldSlug) {
            const oldDir = path.join(BASE_UPLOAD_PATH, manga.slug, oldSlug);
            const newDir = path.join(BASE_UPLOAD_PATH, manga.slug, newSlug);
            
            if (await fs.pathExists(oldDir)) {
                await fs.move(oldDir, newDir, { overwrite: true });
            } else {
                await fs.ensureDir(newDir);
            }
            
            // Update paths in file objects
            chapter.files.forEach(f => {
                // Update internal reference
                 f.path = path.join('manga', manga.slug, newSlug, f.filename);
            });
        }

        // Update Fields
        chapter.title = title || chapter.title;
        chapter.slug = newSlug;
        chapter.chapterNumber = chapterNumber || chapter.chapterNumber;

        // Handle Content Replacement
        if (files && files.length > 0) {
            // Delete old files from disk
            const targetDir = path.join(BASE_UPLOAD_PATH, manga.slug, newSlug);
            await fs.emptyDir(targetDir); // Clear directory

            let contentType = 'none';
            const processedFiles = [];

            const isPdf = files.some(f => f.mimetype === 'application/pdf');
            const isImage = files.every(f => f.mimetype.startsWith('image/'));

            if (isPdf && files.length > 1) return res.status(400).json({ message: 'Only one PDF allowed' });
            if (isPdf) contentType = 'pdf';
            else if (isImage) contentType = 'images';
            else return res.status(400).json({ message: 'Invalid file types' });

            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                const newFilename = contentType === 'images' 
                    ? `${String(i).padStart(3, '0')}-${file.originalname}`
                    : file.originalname;
                
                const targetPath = path.join(targetDir, newFilename);
                await fs.move(file.path, targetPath, { overwrite: true });

                processedFiles.push({
                    path: path.join('manga', manga.slug, newSlug, newFilename),
                    filename: newFilename,
                    originalName: file.originalname,
                    mimetype: file.mimetype,
                    size: file.size,
                    index: i
                });
            }

            chapter.contentType = contentType;
            chapter.files = processedFiles;
        }

        await chapter.save();
        res.json(chapter);

    } catch (error) {
        if (files) files.forEach(f => fs.remove(f.path).catch(e => console.error(e)));
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
            const dir = path.join(BASE_UPLOAD_PATH, chapter.manga.slug, chapter.slug);
            await fs.remove(dir); // Won't fail if dir doesn't exist
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
        const query = {};
        if (req.params.mangaId) {
            query.manga = req.params.mangaId;
        }
        const chapters = await Chapter.find(query).sort({ chapterNumber: 1 });
        res.json(chapters);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

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
    getChapterById
};