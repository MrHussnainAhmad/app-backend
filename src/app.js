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
const authRoutes = require('./modules/auth/routes/authRoutes');
const mangaRoutes = require('./modules/manga/routes/mangaRoutes');
const chapterRoutes = require('./modules/manga/routes/chapterRoutes');
const interactionRoutes = require('./modules/interactions/routes/interactionRoutes');

// Mount Auth
app.use('/p/manga/auth', authRoutes);

// Mount Interaction Routes
app.use('/p/interactions', interactionRoutes);

// Mount Chapter Operations (Direct ID access)
app.use('/p/manga/chapter', chapterRoutes);

// Mount Manga Operations (and nested chapter creation)
app.use('/p/manga', mangaRoutes);



// Static content serving (Protected)
// Removed: Using Cloudinary for storage now.
// app.use('/p/manga', protect, admin, express.static(BASE_UPLOAD_PATH));

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
    const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
    res.status(statusCode);
    res.json({
        message: err.message,
        stack: process.env.NODE_ENV === 'production' ? null : err.stack,
    });
});

module.exports = app;
