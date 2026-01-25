const Manga = require('../models/Manga');
const slugify = require('slugify');
const cloudinary = require('../../../config/cloudinary');
const fs = require('fs-extra');

// @desc    Get all mangas (with optional genre filter)
// @route   GET /p/manga
const getMangas = async (req, res) => {
  try {
    const { genre } = req.query;
    let query = {};

    if (genre && genre !== 'All' && genre !== 'undefined') {
      query.genres = genre;
    }

    const mangas = await Manga.find(query).sort({ updatedAt: -1 });
    res.json(mangas || []);
  } catch (error) {
    console.error('GetMangas Error:', error);
    res.status(500).json({ message: 'Error fetching manga list', error: error.message });
  }
};

// @desc    Get all unique genres
// @route   GET /p/manga/genres
const getGenres = async (req, res) => {
  try {
    const genres = await Manga.distinct('genres');
    const filteredGenres = genres ? genres.filter(g => g && g !== '') : [];
    res.json(filteredGenres.sort());
  } catch (error) {
    console.error('GetGenres Error:', error);
    res.status(500).json({ message: 'Error fetching genres', error: error.message });
  }
};

// @desc    Get single manga
// @route   GET /p/manga/:id
const getMangaById = async (req, res) => {
  try {
    if (!req.params.id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: 'Invalid Manga ID format' });
    }
    const manga = await Manga.findById(req.params.id);
    if (manga) {
      res.json(manga);
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    console.error('GetMangaById Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a manga
// @route   POST /p/manga
const createManga = async (req, res) => {
  const { title, description, genres } = req.body;
  const file = req.file;

  try {
    if (!title) return res.status(400).json({ message: 'Title is required' });

    const slug = slugify(title, { lower: true, strict: true });
    const mangaExists = await Manga.findOne({ slug });

    if (mangaExists) {
      if (file) fs.remove(file.path).catch(() => { });
      return res.status(400).json({ message: 'Manga with this title/slug already exists' });
    }

    let coverImage = '';
    let coverImagePublicId = '';

    if (file) {
      const result = await cloudinary.uploader.upload(file.path, {
        folder: `manga-platform/${slug}/cover`,
        resource_type: 'image'
      });
      coverImage = result.secure_url;
      coverImagePublicId = result.public_id;
      fs.remove(file.path).catch(() => { });
    }

    let genreArray = [];
    if (genres) {
      genreArray = genres.split(',').map(g => g.trim()).filter(g => g);
    }

    const manga = new Manga({
      title,
      slug,
      description: description || '',
      genres: genreArray,
      coverImage,
      coverImagePublicId
    });

    const createdManga = await manga.save();
    res.status(201).json(createdManga);
  } catch (error) {
    if (file) fs.remove(file.path).catch(() => { });
    console.error('CreateManga Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update a manga
// @route   PUT /p/manga/:id
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
        if (manga.coverImagePublicId) {
          await cloudinary.uploader.destroy(manga.coverImagePublicId).catch(() => { });
        }
        const result = await cloudinary.uploader.upload(file.path, {
          folder: `manga-platform/${manga.slug}/cover`,
          resource_type: 'image'
        });
        manga.coverImage = result.secure_url;
        manga.coverImagePublicId = result.public_id;
        fs.remove(file.path).catch(() => { });
      }

      const updatedManga = await manga.save();
      res.json(updatedManga);
    } else {
      if (file) fs.remove(file.path).catch(() => { });
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    if (file) fs.remove(file.path).catch(() => { });
    console.error('UpdateManga Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a manga
// @route   DELETE /p/manga/:id
const deleteManga = async (req, res) => {
  try {
    const manga = await Manga.findById(req.params.id);

    if (manga) {
      if (manga.coverImagePublicId) {
        await cloudinary.uploader.destroy(manga.coverImagePublicId).catch(() => { });
      }

      const Chapter = require('../models/Chapter');
      const chapters = await Chapter.find({ manga: manga._id });

      for (const chapter of chapters) {
        if (chapter.files && chapter.files.length > 0) {
          const publicIds = chapter.files.map(f => f.publicId).filter(id => id);
          if (publicIds.length > 0) {
            await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' }).catch(() => { });
            await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' }).catch(() => { });
          }
        }
        try {
          await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/${chapter.slug}`).catch(() => { });
        } catch (e) { }
      }

      try {
        await cloudinary.api.delete_folder(`manga-platform/${manga.slug}/cover`).catch(() => { });
        await cloudinary.api.delete_folder(`manga-platform/${manga.slug}`).catch(() => { });
      } catch (e) { }

      await Chapter.deleteMany({ manga: manga._id });
      await manga.deleteOne();

      res.json({ message: 'Manga and associated chapters/files removed' });
    } else {
      res.status(404).json({ message: 'Manga not found' });
    }
  } catch (error) {
    console.error('DeleteManga Error:', error);
    res.status(500).json({ message: error.message });
  }
  res.status(500).json({ message: error.message });
}
};

// @desc    Create new review
// @route   POST /p/manga/:id/reviews
const createMangaReview = async (req, res) => {
  const { rating } = req.body;
  const manga = await Manga.findById(req.params.id);

  if (manga) {
    const review = {
      rating: Number(rating),
      ip: req.ip
    };

    manga.reviews.push(review);
    manga.numReviews = manga.reviews.length;
    manga.rating =
      manga.reviews.reduce((acc, item) => item.rating + acc, 0) /
      manga.reviews.length;

    await manga.save();
    res.status(201).json({ message: 'Review added' });
  } else {
    res.status(404).json({ message: 'Manga not found' });
  }
};

module.exports = {
  getMangas,
  getGenres,
  getMangaById,
  createManga,
  updateManga,
  deleteManga,
  createMangaReview
};
