const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');
const fs = require('fs-extra');

// @desc    Get all mangas (with optional genre filter)
// @route   GET /p/manga
// @access  Public (Updated to be public previously)
const getMangas = async (req, res) => {
  try {
    const { genre } = req.query;
    let query = {};

    if (genre && genre !== 'All') {
        query.genres = genre;
    }

    const mangas = await Manga.find(query).sort({ updatedAt: -1 });
    res.json(mangas);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all unique genres
// @route   GET /p/manga/genres
// @access  Public
const getGenres = async (req, res) => {
    try {
        const genres = await Manga.distinct('genres');
        res.json(genres.sort());
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Get single manga
// @route   GET /p/manga/:id
// @access  Public
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
  const { title, description, genres } = req.body;
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

    // Process genres (comma separated string -> array)
    let genreArray = [];
    if (genres) {
        genreArray = genres.split(',').map(g => g.trim()).filter(g => g);
    }

    const manga = new Manga({
      title,
      slug,
      description,
      genres: genreArray,
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
  const { title, description, genres } = req.body;
  const file = req.file;

  try {
    const manga = await Manga.findById(req.params.id);

    if (manga) {
      manga.title = title || manga.title;
      manga.description = description || manga.description;
      
      if (title) {
        manga.slug = slugify(title, { lower: true, strict: true });
      }

      if (genres !== undefined) {
         manga.genres = genres.split(',').map(g => g.trim()).filter(g => g);
      }

      if (file) {
          // Delete old image
          if (manga.coverImagePublicId) {
              await cloudinary.uploader.destroy(manga.coverImagePublicId);
          }
          // Upload new
           try {
            const result = await cloudinary.uploader.upload(file.path, {
                folder: `manga-platform/${manga.slug}/cover`,
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
      if (manga.coverImagePublicId) {
          await cloudinary.uploader.destroy(manga.coverImagePublicId);
      }

      const Chapter = require('../models/Chapter');
      const chapters = await Chapter.find({ manga: manga._id });

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

      try {
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/cover`);
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}`);
      } catch(e) {}

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
  getGenres,
  getMangaById,
  createManga,
  updateManga,
  deleteManga,
};