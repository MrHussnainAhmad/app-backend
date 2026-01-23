const jwt = require('jsonwebtoken');
const User = require('../../../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'secret', {
    expiresIn: '30d',
  });
};

// @desc    Auth user & get token
// @route   POST /p/manga/auth/login
// @access  Public
const authUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (user && (await user.matchPassword(password))) {
      res.json({
        _id: user._id,
        username: user.username,
        role: user.role,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid username or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Internal utility to seed admin
const createInitialAdmin = async () => {
    try {
        const count = await User.countDocuments();
        if (count === 0) {
            const admin = new User({
                username: 'admin',
                password: 'password123', // Change this!
                role: 'admin'
            });
            await admin.save();
            console.log('Initial admin created: admin / password123');
        }
    } catch (error) {
        console.error('Error creating initial admin:', error);
    }
};

module.exports = { authUser, createInitialAdmin };
