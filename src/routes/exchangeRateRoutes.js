const express = require('express');
const router = express.Router();
const { getRates, fetchAndSaveRates } = require('../services/exchangeRateService');
const { protect, admin } = require('../middleware/authMiddleware');

// @desc    Get all exchange rates
// @route   GET /p/general/exchange-rates
// @access  Public (or Protected depending on requirements? User asked for Admin UI, so maybe protected?)
//          Let's make it public for now as it's general info, or protect if strictly for admin.
//          User said "in admin-ui create exchchnage rate", implying admin views it.
//          I'll follow pattern: Public for read, Admin for trigger (optional)
router.get('/', async (req, res) => {
    try {
        const rates = await getRates();
        res.json(rates);
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Manually trigger update (Optional, helpful for testing/admin)
// @route   POST /p/general/exchange-rates/refresh
// @access  Private/Admin
router.post('/refresh', protect, admin, async (req, res) => {
    try {
        await fetchAndSaveRates();
        res.json({ message: 'Exchange rates update triggered.' });
    } catch (error) {
        res.status(500).json({ message: 'Server Error' });
    }
});

// @desc    Cron Job Endpoint for Vercel (GET)
// @route   GET /p/general/exchange-rates/cron-job
// @access  Public (Vercel invokes it)
router.get('/cron-job', async (req, res) => {
    try {
        console.log('Vercel Cron: Triggering exchange rate update...');
        await fetchAndSaveRates();
        res.status(200).json({ message: 'Vercel Cron Triggered successfully.' });
    } catch (error) {
        console.error('Vercel Cron Error:', error);
        res.status(500).json({ message: 'Cron Failed' });
    }
});

module.exports = router;
