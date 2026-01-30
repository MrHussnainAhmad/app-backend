const express = require('express');
const router = express.Router();
const AppConfig = require('../models/AppConfig');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get App Config
// @route   GET /p/config
// @access  Public (or Protected if needed, let's keep it public for app checks usually)
router.get('/', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json(config);
    } catch (error) {
        console.error('GetConfig Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get Manga App Version Only
// @route   GET /p/config/manga
// @access  Public
router.get('/manga', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json({ version: config.mangaAppVersion });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get Exchange Rates App Version Only
// @route   GET /p/config/exchange-rates
// @access  Public
router.get('/exchange-rates', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json({ version: config.exchangeRatesAppVersion });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get Letscode C++ Version Only
// @route   GET /p/config/letscode++
// @access  Public
router.get('/letscode\\+\\+', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json({ version: config.letscodeCppVersion });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get Letscode Python Basics Version Only
// @route   GET /p/config/letscodepythonbasics
// @access  Public
router.get('/letscodepythonbasics', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json({ version: config.letscodePythonBasicsVersion });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Get Letscode Python Basics 2 Version Only
// @route   GET /p/config/letscodepythonbasics2
// @access  Public
router.get('/letscodepythonbasics2', async (req, res) => {
    try {
        const config = await AppConfig.getSingleton();
        res.json({ version: config.letscodePythonBasics2Version });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Update App Config
// @route   PUT /p/config
// @access  Private/Admin
router.put('/', protect, admin, async (req, res) => {
    try {
        const {
            mangaAppVersion,
            exchangeRatesAppVersion,
            letscodeCppVersion,
            letscodePythonBasicsVersion,
            letscodePythonBasics2Version
        } = req.body;
        const config = await AppConfig.getSingleton();

        if (mangaAppVersion !== undefined) config.mangaAppVersion = mangaAppVersion;
        if (exchangeRatesAppVersion !== undefined) config.exchangeRatesAppVersion = exchangeRatesAppVersion;
        if (letscodeCppVersion !== undefined) config.letscodeCppVersion = letscodeCppVersion;
        if (letscodePythonBasicsVersion !== undefined) config.letscodePythonBasicsVersion = letscodePythonBasicsVersion;
        if (letscodePythonBasics2Version !== undefined) config.letscodePythonBasics2Version = letscodePythonBasics2Version;

        const updatedConfig = await config.save();
        res.json(updatedConfig);
    } catch (error) {
        console.error('UpdateConfig Error:', error);
        res.status(500).json({ message: 'Server Error' });
    }
});

module.exports = router;
