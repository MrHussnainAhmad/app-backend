const cron = require('node-cron');
const { fetchAndSaveRates } = require('../services/exchangeRateService');

const startExchangeRateCron = () => {
    // Run every 36 minutes to stay within ~40 requests per day limit
    // 24 hours * 60 minutes = 1440 minutes. 1440 / 36 = 40 requests.
    cron.schedule('*/36 * * * *', () => {
        console.log('Running Exchange Rate Cron Job...');
        fetchAndSaveRates();
    });

    console.log('Exchange Rate Cron Job scheduled (every 36 minutes).');
};

module.exports = startExchangeRateCron;
