const Manga = require('../models/Manga');
const slugify = require('slugify');
const fs = require('fs-extra');
const path = require('path');

// @desc    Get all mangas
// @route   GET /p/manga
// @access  Admin
const getMangas = async (req, res) => {
  try {
    const mangas = await Manga.find({}).sort({ updatedAt: -1 });
    res.json(mangas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single manga
// @route   GET /p/manga/:id
// @access  Admin
const getMangaById = async (req, res) => {
  try {
    const manga = await Manga.findById(req.params.id);
    if (manga) {
      res.json(manga);
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const os = require('os');
const BASE_UPLOAD_PATH = path.join(os.tmpdir(), 'manga-uploads');

// Ensure base dir exists
fs.ensureDirSync(BASE_UPLOAD_PATH);

// @desc    Create a manga
// @route   POST /p/manga
// @access  Admin
const createManga = async (req, res) => {
  const { title, description } = req.body;

  try {
    const slug = slugify(title, { lower: true, strict: true });
    
    const mangaExists = await Manga.findOne({ slug });
    if (mangaExists) {
      return res.status(400).json({ message: 'Manga with this title/slug already exists' });
    }

    const manga = new Manga({
      title,
      slug,
      description,
    });

    const createdManga = await manga.save();

    // Create folder structure (in /tmp)
    const mangaDir = path.join(BASE_UPLOAD_PATH, slug);
    await fs.ensureDir(mangaDir);

    res.status(201).json(createdManga);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a manga
// @route   PUT /p/manga/:id
// @access  Admin
const updateManga = async (req, res) => {
  const { title, description } = req.body;

  try {
    const manga = await Manga.findById(req.params.id);

    if (manga) {
      const oldSlug = manga.slug;
      manga.title = title || manga.title;
      manga.description = description || manga.description;
      
      if (title) {
        manga.slug = slugify(title, { lower: true, strict: true });
      }

      // If slug changed, move directory
      if (oldSlug !== manga.slug) {
         const oldDir = path.join(BASE_UPLOAD_PATH, oldSlug);
         const newDir = path.join(BASE_UPLOAD_PATH, manga.slug);
         
         // Only attempt move if old dir exists (it might not on Vercel fresh boot)
         if (await fs.pathExists(oldDir)) {
             await fs.move(oldDir, newDir, { overwrite: true });
         } else {
             await fs.ensureDir(newDir);
         }
      }

      const updatedManga = await manga.save();
      res.json(updatedManga);
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a manga
// @route   DELETE /p/manga/:id
// @access  Admin
const deleteManga = async (req, res) => {
  try {
    const manga = await Manga.findById(req.params.id);

    if (manga) {
      // Delete directory
      const mangaDir = path.join(BASE_UPLOAD_PATH, manga.slug);
      await fs.remove(mangaDir);
      
      await manga.deleteOne(); 
      const Chapter = require('../models/Chapter');
      await Chapter.deleteMany({ manga: manga._id });

      res.json({ message: 'Manga and associated chapters/files removed' });
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getMangas,
  getMangaById,
  createManga,
  updateManga,
  deleteManga,
};
