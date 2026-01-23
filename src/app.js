const express = require('express');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const connectDB = require('./config/db');
const { protect, admin } = require('./middleware/authMiddleware');

dotenv.config();

connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const mangaRoutes = require('./routes/mangaRoutes');
const chapterRoutes = require('./routes/chapterRoutes');

// Mount Auth
app.use('/p/manga/auth', authRoutes);

// Mount Chapter Operations (Direct ID access)
app.use('/p/manga/chapter', chapterRoutes);

// Mount Manga Operations (and nested chapter creation)
app.use('/p/manga', mangaRoutes);

// Static content serving (Protected)
// URL: /p/manga/:mangaSlug/:chapterSlug/filename
// We map /p/manga to uploads/manga
app.use('/p/manga', protect, admin, express.static(path.join(path.resolve(), 'uploads', 'manga')));

// 404 for unknown API routes
app.use((req, res, next) => {
    const error = new Error(`Not Found - ${req.originalUrl}`);
    res.status(404);
    next(error);
});

// Error Handling
app.use((err, req, res, next) => {
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;
