const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const { protect, admin } = require('./middleware/authMiddleware');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Attempt DB Connection
// connectDB(); // Removed - now handled in server.js before app.listen()

// Routes
const authRoutes = require('./modules/auth/routes/authRoutes');
const mangaRoutes = require('./modules/manga/routes/mangaRoutes');
const chapterRoutes = require('./modules/manga/routes/chapterRoutes');
const interactionRoutes = require('./modules/interactions/routes/interactionRoutes');

// Mount Auth
app.use('/p/manga/auth', authRoutes);

// Mount Interaction Routes (Manga specific)
app.use('/p/manga/interactions', interactionRoutes);

// Mount Chapter Operations (Direct ID access)
app.use('/p/manga/chapter', chapterRoutes);

// Mount Manga Operations (and nested chapter creation)
app.use('/p/manga', mangaRoutes);

// Exchange Rate Routes
app.use('/p/general/exchange-rates', require('./routes/exchangeRateRoutes'));

// App Configuration Routes (Versions, Settings)
app.use('/p/config', require('./routes/configRoutes'));

// Health Check
app.get('/', (req, res) => {
    res.send('API is running...');
});

// 404 for unknown API routes
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

// Error Handling
app.use((err, req, res, next) => {
    console.error('SERVER ERROR:', err.stack); // LOG THIS
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;