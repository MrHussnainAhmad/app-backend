const axios = require('axios');
const ExchangeRate = require('../models/ExchangeRate');

const fetchAndSaveRates = async () => {
    const apiKey = process.env.EXCHANGE_RATE_API_KEY;
    if (!apiKey) {
        throw new Error('Exchange Rate API Key is missing.');
    }

    try {
        const url = 'https://api.exchangerateapi.net/v1/latest?base=USD';
        console.log(`Fetching exchange rates from ${url}...`);

        const response = await axios.get(url, {
            headers: { apikey: apiKey },
            timeout: 15000
        });

        const rates = response?.data?.data;
        if (!rates || typeof rates !== 'object') {
            throw new Error(`Unexpected exchange rate response shape: ${JSON.stringify(response.data)}`);
        }

        // API returns { CODE: { code, value } }, store numeric value only.
        const bulkOps = Object.entries(rates)
            .filter(([, entry]) => entry && typeof entry.value === 'number')
            .map(([currency, entry]) => ({
                updateOne: {
                    filter: { currency },
                    update: {
                        $set: {
                            rate: entry.value,
                            lastUpdated: new Date()
                        }
                    },
                    upsert: true
                }
            }));

        if (bulkOps.length === 0) {
            throw new Error('No exchange rates found in API response.');
        }

        await ExchangeRate.bulkWrite(bulkOps);
        console.log(`Successfully updated ${bulkOps.length} exchange rates.`);
        return bulkOps.length;
    } catch (error) {
        console.error('Error fetching exchange rates:', error.response?.data || error.message);
        throw error;
    }
};

const getRates = async () => {
    return await ExchangeRate.find({}).sort({ currency: 1 });
};

module.exports = {
    fetchAndSaveRates,
    getRates
};
