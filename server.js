require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
const path = require('path');
const apiRoutes = require('./routes/api');
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// const express = require('express');

const app = express();
const PORT = process.env.PORT || 3000;

// Import routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const stocksRoutes = require('./routes/stocks');
const tradesRoutes = require('./routes/trades');
const brokersRoutes = require('./routes/brokers');
const paymentRoutes = require('./routes/payment');

// Import middleware
const authMiddleware = require('./middleware/authMiddleware');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksage', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));
console.log('MongoDB URI:', process.env.MONGODB_URI);
console.log('Finnhub Key:', process.env.FINNHUB_API_KEY ? 'Loaded ✅' : 'Missing ❌');
// Set view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'your-secret-key-here',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/stocksage'
  }),
  cookie: {
    secure: false, // Set to true in production with HTTPS
    maxAge: 1000 * 60 * 60 * 24 * 7 // 1 week
  }
}));

app.use('/api', apiRoutes);
// Make user available in all templates
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  next();
});

app.use((req, res, next) => {
    console.log('🔍 Session Debug:', {
        sessionID: req.sessionID,
        hasUser: !!req.session.user,
        userID: req.session.user?._id
    });
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', authMiddleware.requireAuth, dashboardRoutes);
app.use('/stocks', authMiddleware.requireAuth, stocksRoutes);
app.use('/trades', authMiddleware.requireAuth, tradesRoutes);
app.use('/brokers', authMiddleware.requireAuth, brokersRoutes);
app.use('/payment', authMiddleware.requireAuth, paymentRoutes);
const profileRoutes = require('./routes/profile');
app.use('/profile', profileRoutes);

// Home route - redirect to dashboard if logged in, otherwise show landing page
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('auth/login', { 
      title: 'StockSage - Login',
      error: null 
    });
  }
});

// Search route
app.get('/search', authMiddleware.requireAuth, (req, res) => {
  res.render('search', {
    title: 'Search Stocks - StockSage',
    query: req.query.q || ''
  });
});

// Profile route
// app.get('/profile', authMiddleware.requireAuth, (req, res) => {
//   res.render('profile', { user: req.user});
// });
// const profileRoutes = require('./routes/profile');
// app.use('/profile', profileRoutes);

app.get('/stock/:symbol', (req, res) => {
  res.redirect(`/stocks/${req.params.symbol}`);
});
const Trade = require('./models/Trade'); // Add at the top if not already

app.get('/history', authMiddleware.requireAuth, async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }
    const trades = await Trade.find({ userId: req.session.user._id }).sort({ timestamp: -1 });
     // Calculate totalPnL and winRate for summary
    const totalPnL = trades.reduce((sum, t) => sum + (t.profitLoss || 0), 0);
    const winRate = trades.length > 0
      ? ((trades.filter(t => (t.profitLoss || 0) > 0).length / trades.length) * 100).toFixed(1)
      : 0;
    // Get unique stocks for filter dropdown
    const uniqueStocks = [...new Set(trades.map(t => t.symbol))];

    res.render('history', {
      title: 'Trade History',
      trades,
      totalPnL,
      winRate,
      uniqueStocks
    });
  } catch (error) {
    res.status(500).render('error', { message: 'Error loading trade history' });
  }
});
// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    title: 'Error - StockSage',
    message: err.message || 'Something went wrong!',
    error: err // <-- pass the error object
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - StockSage',
    message: 'Page not found',
    error: {}
  });
});

app.listen(PORT, () => {
  console.log(`🚀 StockSage server running on http://localhost:${PORT}`);
});

module.exports = app;