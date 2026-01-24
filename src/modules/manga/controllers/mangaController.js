const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');
const fs = require('fs-extra');

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
  const file = req.file;

  try {
    const slug = slugify(title, { lower: true, strict: true });
    
    const mangaExists = await Manga.findOne({ slug });
    if (mangaExists) {
      if(file) fs.remove(file.path).catch(()=>{});
      return res.status(400).json({ message: 'Manga with this title/slug already exists' });
    }

    let coverImage = '';
    let coverImagePublicId = '';

    if (file) {
        try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: `manga-platform/${slug}/cover`,
                resource_type: 'image'
            });
            coverImage = result.secure_url;
            coverImagePublicId = result.public_id;
            fs.remove(file.path).catch(()=>{});
        } catch (uploadError) {
            fs.remove(file.path).catch(()=>{});
            return res.status(500).json({ message: 'Image upload failed' });
        }
    }

    const manga = new Manga({
      title,
      slug,
      description,
      coverImage,
      coverImagePublicId
    });

    const createdManga = await manga.save();
    res.status(201).json(createdManga);
  } catch (error) {
    if(file) fs.remove(file.path).catch(()=>{});
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a manga
// @route   PUT /p/manga/:id
// @access  Admin
const updateManga = async (req, res) => {
  const { title, description } = req.body;
  const file = req.file;

  try {
    const manga = await Manga.findById(req.params.id);

    if (manga) {
      const oldSlug = manga.slug;
      manga.title = title || manga.title;
      manga.description = description || manga.description;
      
      let newSlug = manga.slug;
      if (title) {
        newSlug = slugify(title, { lower: true, strict: true });
        manga.slug = newSlug;
      }

      if (file) {
          // Delete old image
          if (manga.coverImagePublicId) {
              await cloudinary.uploader.destroy(manga.coverImagePublicId);
          }
          // Upload new
           try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: `manga-platform/${newSlug}/cover`, // Use new slug
                resource_type: 'image'
            });
            manga.coverImage = result.secure_url;
            manga.coverImagePublicId = result.public_id;
            fs.remove(file.path).catch(()=>{});
        } catch (uploadError) {
            fs.remove(file.path).catch(()=>{});
            return res.status(500).json({ message: 'Image upload failed' });
        }
      }

      const updatedManga = await manga.save();
      res.json(updatedManga);
    } else {
      if(file) fs.remove(file.path).catch(()=>{});
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    if(file) fs.remove(file.path).catch(()=>{});
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
      // 1. Delete Cover Image
      if (manga.coverImagePublicId) {
          await cloudinary.uploader.destroy(manga.coverImagePublicId);
      }

      // 2. Find all chapters to get public IDs
      const Chapter = require('../models/Chapter');
      const chapters = await Chapter.find({ manga: manga._id });

      // 3. Delete all files in those chapters
      for (const chapter of chapters) {
          if (chapter.files && chapter.files.length > 0) {
             const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
             if (publicIds.length > 0) {
                 await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
                 await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' });
             }
          }
           try {
              await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/${chapter.slug}`);
          } catch(e) {}
      }

      // 4. Delete manga folder
      try {
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/cover`);
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}`);
      } catch(e) {}

      // 5. Delete from DB
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
