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
const searchRoutes = require('./routes/search'); 

// Import middleware
const authMiddleware = require('./middleware/authMiddleware');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/Fincraft', {
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
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/Fincraft'
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
        userID: req.session.user ? (req.session.user._id || req.session.user.id) : null,
    });
    next();
});

// Routes
app.use('/auth', authRoutes);
app.use('/dashboard', authMiddleware.requireAuth, dashboardRoutes);
app.use('/stocks', authMiddleware.requireAuth, stocksRoutes);
app.use('/trades', authMiddleware.requireAuth, tradesRoutes);
app.use('/brokers', authMiddleware.requireAuth, brokersRoutes);
app.use('/search', authMiddleware.requireAuth, searchRoutes);
const newsRoutes = require('./routes/news');
app.use('/news', newsRoutes);
const profileRoutes = require('./routes/profile');
app.use('/profile', profileRoutes);

// Home route - redirect to dashboard if logged in, otherwise show landing page
app.get('/', (req, res) => {
  if (req.session.user) {
    res.redirect('/dashboard');
  } else {
    res.render('auth/login', { 
      title: 'Fincraft - Login',
      error: null 
    });
  }
});

app.get('/test-session', (req, res) => {
  res.send(req.session.user ? `Logged in as ${req.session.user.email}` : 'Not logged in');
});

app.get('/stock/:symbol', (req, res) => {
  res.redirect(`/stocks/${req.params.symbol}`);
});
const Trade = require('./models/Trade');

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
    title: 'Error - Fincraft',
    message: err.message || 'Something went wrong!',
    error: err,
    user: req.session.user || null
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).render('error', {
    title: '404 - Fincraft',
    message: 'Page not found',
    error: {},
    user: req.session.user || null
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Fincraft server running on http://localhost:${PORT}`);
});

module.exports = app;