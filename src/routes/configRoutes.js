const express = require('express');
const router = express.Router();
const slugify = require('slugify');
const AppVersion = require('../models/AppVersion');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get all apps with versions
// @route   GET /p/config/apps
// @access  Public
router.get('/apps', async (req, res) => {
  try {
    const apps = await AppVersion.find({}).sort({ createdAt: 1 });
    res.json(apps);
  } catch (error) {
    console.error('Get Apps Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Create app
// @route   POST /p/config/apps
// @access  Private/Admin
router.post('/apps', protect, admin, async (req, res) => {
  try {
    const { name, version } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'App name is required.' });
    }

    const slug = slugify(name, { lower: true, strict: true, trim: true });
    if (!slug) {
      return res.status(400).json({ message: 'Invalid app name.' });
    }

    const exists = await AppVersion.findOne({ slug });
    if (exists) {
      return res.status(400).json({ message: 'App already exists.' });
    }

    const created = await AppVersion.create({
      name: name.trim(),
      slug,
      version: (version || '1.0.0').trim(),
    });

    res.status(201).json(created);
  } catch (error) {
    console.error('Create App Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Update app version/name
// @route   PUT /p/config/apps/:id
// @access  Private/Admin
router.put('/apps/:id', protect, admin, async (req, res) => {
  try {
    const { name, version } = req.body;
    const app = await AppVersion.findById(req.params.id);

    if (!app) {
      return res.status(404).json({ message: 'App not found.' });
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) {
        return res.status(400).json({ message: 'App name cannot be empty.' });
      }

      const nextSlug = slugify(trimmedName, { lower: true, strict: true, trim: true });
      if (!nextSlug) {
        return res.status(400).json({ message: 'Invalid app name.' });
      }

      const duplicate = await AppVersion.findOne({ slug: nextSlug, _id: { $ne: app._id } });
      if (duplicate) {
        return res.status(400).json({ message: 'Another app already uses this name.' });
      }

      app.name = trimmedName;
      app.slug = nextSlug;
    }

    if (version !== undefined) {
      const trimmedVersion = version.trim();
      if (!trimmedVersion) {
        return res.status(400).json({ message: 'Version cannot be empty.' });
      }
      app.version = trimmedVersion;
    }

    const updated = await app.save();
    res.json(updated);
  } catch (error) {
    console.error('Update App Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

// @desc    Public endpoint for version testing
// @route   GET /p/config/apps/:slug/version
// @access  Public
router.get('/apps/:slug/version', async (req, res) => {
  try {
    const app = await AppVersion.findOne({ slug: req.params.slug.toLowerCase().trim() });
    if (!app) {
      return res.status(404).json({ message: 'App not found.' });
    }

    res.json({
      appName: app.name,
      appSlug: app.slug,
      version: app.version,
      updatedAt: app.updatedAt,
    });
  } catch (error) {
    console.error('Get App Version Error:', error);
    res.status(500).json({ message: 'Server Error' });
  }
});

module.exports = router;
