const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// GET /auth/login
router.get('/login', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', {
    title: 'Login - StockSage',
    error: null,
    success: null
  });
});



// POST /auth/login
router.post('/login', authMiddleware.redirectIfAuthenticated, async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Login - StockSage',
        error: 'Please provide both email and password',
        success: null
      });
    }

    // Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.render('auth/login', {
        title: 'Login - StockSage',
        error: 'Invalid email or password',
        success: null
      });
    }

    // Check password
    const isValidPassword = await user.comparePassword(password);
    if (!isValidPassword) {
      return res.render('auth/login', {
        title: 'Login - StockSage',
        error: 'Invalid email or password',
        success: null
      });
    }

    // Create session
    req.session.user = {
      id: user._id,
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      accountType: user.accountType,
      profileImage: user.profileImage
    };
    req.session.userId = user._id;

    // Redirect to intended page or dashboard
    const redirectTo = req.session.returnTo || '/dashboard';
    delete req.session.returnTo;
    res.redirect(redirectTo);

  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login - StockSage',
      error: 'An error occurred. Please try again.',
      success: null
    });
  }
});

// GET /auth/register
router.get('/register', authMiddleware.redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', {
    title: 'Register - StockSage',
    error: null,
    success: null,
    formData: {}
  });
});

// POST /auth/register
router.post('/register', authMiddleware.redirectIfAuthenticated, async (req, res) => {
  try {
    const { username, email, password, confirmPassword, firstName, lastName } = req.body;

    // Validate input
    const errors = [];
    
    if (!username || username.length < 3) {
      errors.push('Username must be at least 3 characters long');
    }
    
    if (!email || !email.includes('@')) {
      errors.push('Please provide a valid email address');
    }
    
    if (!password || password.length < 6) {
      errors.push('Password must be at least 6 characters long');
    }
    
    if (password !== confirmPassword) {
      errors.push('Passwords do not match');
    }
    
    if (!firstName || !lastName) {
      errors.push('Please provide both first and last name');
    }

    if (errors.length > 0) {
      return res.render('auth/register', {
        title: 'Register - StockSage',
        error: errors.join(', '),
        success: null,
        formData: { username, email, firstName, lastName }
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { email: email.toLowerCase() },
        { username: username.toLowerCase() }
      ]
    });

    if (existingUser) {
      const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
      return res.render('auth/register', {
        title: 'Register - StockSage',
        error: `A user with that ${field} already exists`,
        success: null,
        formData: { username, email, firstName, lastName }
      });
    }

    // Create new user
    const newUser = new User({
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      firstName,
      lastName
    });

    await newUser.save();

    // Auto-login after registration
    req.session.user = {
      id: newUser._id,
      username: newUser.username,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      accountType: newUser.accountType,
      profileImage: newUser.profileImage
    };

    res.redirect('/dashboard');

  } catch (error) {
    console.error('Registration error:', error);
    res.render('auth/register', {
      title: 'Register - StockSage',
      error: 'An error occurred during registration. Please try again.',
      success: null,
      formData: req.body
    });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

// GET /auth/logout (for convenience)
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/dashboard');
    }
    res.clearCookie('connect.sid');
    res.redirect('/');
  });
});

module.exports = router;