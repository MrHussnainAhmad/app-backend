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

    // Create folder structure
    const mangaDir = path.join(path.resolve(), 'uploads', 'manga', slug);
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
         const oldDir = path.join(path.resolve(), 'uploads', 'manga', oldSlug);
         const newDir = path.join(path.resolve(), 'uploads', 'manga', manga.slug);
         
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
      const mangaDir = path.join(path.resolve(), 'uploads', 'manga', manga.slug);
      await fs.remove(mangaDir);
      
      // Trigger cascade delete (requires fetching the document to trigger pre remove hook? 
      // Actually Mongoose middleware on 'remove' is deprecated in newer versions or requires document.remove() which is not on model. 
      // Let's use deleteOne and manually trigger or just manual cleanup here.)
      
      await manga.deleteOne(); // or findByIdAndDelete. deleteOne on doc *does* not always trigger middleware depending on version. 
      // To be safe and explicit:
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
