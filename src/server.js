const app = require('./app');
const { createInitialAdmin } = require('./modules/auth/controllers/authController');

const PORT = process.env.PORT || 5000;

// Global Error Catcher for Uncaught Exceptions
process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
    // On Vercel, this log will show up in the Function Logs
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

// Create initial admin if needed
createInitialAdmin().catch(err => console.error('Admin Init Failed:', err));

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});