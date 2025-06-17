const express = require('express');
const analytics = require('../utils/analytics');
const Trade = require('../models/Trade');
const User = require('../models/User');

const router = express.Router();

// GET /dashboard
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get performance metrics for different periods
    const [allTime, yearData, monthData, weekData, todayData] = await Promise.all([
      analytics.calculatePerformanceMetrics(userId, 'all'),
      analytics.calculatePerformanceMetrics(userId, 'year'),
      analytics.calculatePerformanceMetrics(userId, 'month'),
      analytics.calculatePerformanceMetrics(userId, 'week'),
      analytics.calculatePerformanceMetrics(userId, 'today')
    ]);

    // Get recent trades (last 10)
    const recentTrades = await Trade.find({ userId })
      .sort({ tradeDate: -1 })
      .limit(10)
      .lean();

    // Get user's watchlist
    const user = await User.findById(userId).select('watchlist');
    const watchlist = user.watchlist || [];

    // Get monthly performance for chart
    const monthlyPerformance = await analytics.getMonthlyPerformance(userId, 6);

    // Get top and worst performers
    const [topPerformers, worstPerformers] = await Promise.all([
      analytics.getTopPerformers(userId, 3),
      analytics.getWorstPerformers(userId, 3)
    ]);
const analyticsData = await analytics.calculatePerformanceMetrics(userId, 'all');
    res.render('dashboard', {
    title: 'Dashboard - StockSage',
    analytics: allTime,      // allTime stats object
    year: yearData,          // 1 year stats object
    month: monthData,        // 1 month stats object
    week: weekData,          // 1 week stats object
    today: todayData,        // today stats object
    recentTrades,
    watchlist,
    monthlyPerformance,
    topPerformers,
    worstPerformers,
    formatCurrency: analytics.formatCurrency,
    formatPercentage: analytics.formatPercentage
      // recentTrades,
      // watchlist,
      // monthlyPerformance,
      // topPerformers,
      // worstPerformers,
      // formatCurrency: analytics.formatCurrency,
      // formatPercentage: analytics.formatPercentage
    });


  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('error', {
      title: 'Error - StockSage',
      message: 'Unable to load dashboard data'
    });
  }
});

// GET /dashboard/api/performance/:period
router.get('/api/performance/:period', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const period = req.params.period;

    const metrics = await analytics.calculatePerformanceMetrics(userId, period);
    
    res.json({
      success: true,
      data: metrics
    });

  } catch (error) {
    console.error('Performance API error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to fetch performance data'
    });
  }
});

// POST /dashboard/watchlist/add
router.post('/watchlist/add', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const { symbol, name } = req.body;

    if (!symbol || !name) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and name are required'
      });
    }

    const user = await User.findById(userId);
    
    // Check if already in watchlist
    const exists = user.watchlist.some(item => item.symbol === symbol.toUpperCase());
    if (exists) {
      return res.status(400).json({
        success: false,
        error: 'Stock is already in your watchlist'
      });
    }

    // Add to watchlist
    user.watchlist.push({
      symbol: symbol.toUpperCase(),
      name: name,
      addedAt: new Date()
    });

    await user.save();

    res.json({
      success: true,
      message: 'Stock added to watchlist'
    });

  } catch (error) {
    console.error('Add to watchlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to add stock to watchlist'
    });
  }
});

// DELETE /dashboard/watchlist/remove/:symbol
router.delete('/watchlist/remove/:symbol', async (req, res) => {
  try {
    const userId = req.session.user.id;
    const symbol = req.params.symbol.toUpperCase();

    const user = await User.findById(userId);
    user.watchlist = user.watchlist.filter(item => item.symbol !== symbol);
    await user.save();

    res.json({
      success: true,
      message: 'Stock removed from watchlist'
    });

  } catch (error) {
    console.error('Remove from watchlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to remove stock from watchlist'
    });
  }
});

module.exports = router;