const mongoose = require('mongoose');

const exchangeRateSchema = mongoose.Schema({
    currency: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    rate: {
        type: Number,
        required: true,
    },
    lastUpdated: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: true,
});

module.exports = mongoose.model('ExchangeRate', exchangeRateSchema);
