const axios = require('axios');
const ExchangeRate = require('../models/ExchangeRate');

const fetchAndSaveRates = async () => {
    try {
        const apiKey = process.env.EXCHANGE_RATE_API_KEY;
        if (!apiKey) {
            console.error('Exchange Rate API Key is missing. Skipping fetch.');
            return;
        }

        // Example using exchangerate-api.com
        const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/USD`;

        console.log(`Fetching exchange rates from ${url}...`);
        const response = await axios.get(url);

        if (response.data && response.data.result === 'success') {
            const rates = response.data.conversion_rates;

            // Prepare bulk operations for efficient upsert
            const bulkOps = Object.entries(rates).map(([currency, rate]) => ({
                updateOne: {
                    filter: { currency },
                    update: {
                        $set: {
                            rate,
                            lastUpdated: new Date()
                        }
                    },
                    upsert: true
                }
            }));

            if (bulkOps.length > 0) {
                await ExchangeRate.bulkWrite(bulkOps);
                console.log(`Successfully updated ${bulkOps.length} exchange rates.`);
            }
        } else {
            console.error('Failed to fetch rates:', response.data);
        }

    } catch (error) {
        console.error('Error fetching exchange rates:', error.message);
    }
};

const getRates = async () => {
    return await ExchangeRate.find({}).sort({ currency: 1 });
};

module.exports = {
    fetchAndSaveRates,
    getRates
};
