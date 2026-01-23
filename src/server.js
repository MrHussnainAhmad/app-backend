const app = require('./app');
const { createInitialAdmin } = require('./modules/auth/controllers/authController');

const PORT = process.env.PORT || 5000;

// Create initial admin if needed
createInitialAdmin();

app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
