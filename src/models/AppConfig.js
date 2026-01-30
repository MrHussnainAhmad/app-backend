const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema({
    mangaAppVersion: {
        type: String,
        default: '1.0.0', // Default version
    },
    exchangeRatesAppVersion: {
        type: String,
        default: '1.0.0', // Default version
    },
    letscodeCppVersion: {
        type: String,
        default: '1.0.0',
    },
    letscodePythonBasicsVersion: {
        type: String,
        default: '1.0.0',
    },
    letscodePythonBasics2Version: {
        type: String,
        default: '1.0.0',
    },
}, {
    timestamps: true,
});

// Ensure only one config document exists
appConfigSchema.statics.getSingleton = async function () {
    const config = await this.findOne();
    if (config) return config;
    return await this.create({});
};

const AppConfig = mongoose.model('AppConfig', appConfigSchema);

module.exports = AppConfig;
