const app = require('./app');
const { createInitialAdmin } = require('./modules/auth/controllers/authController');
const connectDB = require('./config/db'); // Import connectDB

const PORT = process.env.PORT || 5000;

// Global Error Catcher for Uncaught Exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

const startServer = async () => {
  try {
    // Await the database connection before starting the server
    await connectDB();
    console.log('MongoDB connection successfully established.');

    // Create initial admin if needed
    await createInitialAdmin().catch(err => console.error('Admin Init Failed:', err));

    app.listen(PORT, () => {
      console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error.message);
    process.exit(1); // Exit if DB connection fails
  }
};

startServer();
