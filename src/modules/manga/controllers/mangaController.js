const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');

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
    // No explicit Cloudinary folder creation needed; it's auto-created on file upload.

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
      // Logic for slug change exists, but renaming Cloudinary folders is complex.
      // We will allow the DB slug to update, but the folder might remain old 
      // until we implement a migration script. 
      // For now, new files go to new slug folder, old files stay in old slug folder.
      
      const oldSlug = manga.slug;
      manga.title = title || manga.title;
      manga.description = description || manga.description;
      
      if (title) {
        manga.slug = slugify(title, { lower: true, strict: true });
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
      // 1. Find all chapters to get public IDs
      const Chapter = require('../models/Chapter');
      const chapters = await Chapter.find({ manga: manga._id });

      // 2. Delete all files in those chapters
      for (const chapter of chapters) {
          if (chapter.files && chapter.files.length > 0) {
             const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
             if (publicIds.length > 0) {
                 await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
                 await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' });
             }
          }
          // Delete chapter folder
           try {
              await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/${chapter.slug}`);
          } catch(e) {}
      }

      // 3. Delete manga folder
      try {
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}`);
      } catch(e) {}

      // 4. Delete from DB
      await Chapter.deleteMany({ manga: manga._id });
      await manga.deleteOne(); 

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