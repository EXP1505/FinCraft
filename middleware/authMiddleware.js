const User = require('../models/User');

const authMiddleware = {
  // Check if user is authenticated
  requireAuth: async (req, res, next) => {
  if (req.session && req.session.user) {
    try {
      const user = await User.findById(req.session.user.id).select('-password');
      if (!user) {
        req.session.destroy();
        return res.redirect('/auth/login');
      }
      req.user = user;
      res.locals.user = user;
      next();
    } catch (error) {
      console.error('Error fetching user:', error);
      req.session.destroy();
      return res.redirect('/auth/login');
    }
  } else {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
},
  // Check if user is already logged in (for login/register pages)
  redirectIfAuthenticated: (req, res, next) => {
    if (req.session && req.session.user) {
      return res.redirect('/dashboard');
    }
    return next();
  },

  // Attach user object to request
  attachUser: async (req, res, next) => {
    if (req.session && req.session.user) {
      try {
        const user = await User.findById(req.session.user.id).select('-password');
        req.user = user;
        res.locals.user = user;
      } catch (error) {
        console.error('Error fetching user:', error);
        // Clear invalid session
        req.session.destroy();
        return res.redirect('/auth/login');
      }
    }
    next();
  },

  // Check for premium features
  requirePremium: (req, res, next) => {
    if (req.session && req.session.user) {
      if (req.session.user.accountType === 'premium' || req.session.user.accountType === 'pro') {
        return next();
      } else {
        return res.render('payment', {
          title: 'Upgrade Required - StockSage',
          message: 'This feature requires a premium account. Please upgrade to continue.',
          returnUrl: req.originalUrl
        });
      }
    } else {
      return res.redirect('/auth/login');
    }
  },

  // Check for pro features
  requirePro: (req, res, next) => {
    if (req.session && req.session.user) {
      if (req.session.user.accountType === 'pro') {
        return next();
      } else {
        return res.render('payment', {
          title: 'Pro Account Required - StockSage',
          message: 'This feature requires a pro account. Please upgrade to continue.',
          returnUrl: req.originalUrl
        });
      }
    } else {
      return res.redirect('/auth/login');
    }
  },

  // Validate user session and refresh user data
  validateSession: async (req, res, next) => {
    if (req.session && req.session.user) {
      try {
        const user = await User.findById(req.session.user.id).select('-password');
        if (!user) {
          // User no longer exists
          req.session.destroy();
          return res.redirect('/auth/login');
        }
        
        // Update session with latest user data
        req.session.user = {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          accountType: user.accountType,
          profileImage: user.profileImage
        };
        
        req.user = user;
        res.locals.user = user;
      } catch (error) {
        console.error('Session validation error:', error);
        req.session.destroy();
        return res.redirect('/auth/login');
      }
    }
    next();
  }
};
module.exports = authMiddleware;