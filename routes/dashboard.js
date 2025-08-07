const express = require('express');
const analytics = require('../utils/analytics');
const Trade = require('../models/Trade');
const User = require('../models/User');

const router = express.Router();

// GET /dashboard
router.get('/', async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.id; 

    if (!userId) {
      return res.redirect('/login');
    }

    // Get performance metrics for different periods with error handling
    const [allTime, yearData, monthData, weekData, todayData] = await Promise.allSettled([
      analytics.calculatePerformanceMetrics(userId, 'all'),
      analytics.calculatePerformanceMetrics(userId, 'year'),
      analytics.calculatePerformanceMetrics(userId, 'month'),
      analytics.calculatePerformanceMetrics(userId, 'week'),
      analytics.calculatePerformanceMetrics(userId, 'today')
    ]);

    // Extract resolved values or use defaults
    const analytics_data = {
      allTime: allTime.status === 'fulfilled' ? allTime.value : { totalValue: 0, totalProfitLoss: 0, totalTrades: 0 },
      year: yearData.status === 'fulfilled' ? yearData.value : { totalValue: 0, totalProfitLoss: 0, totalTrades: 0 },
      month: monthData.status === 'fulfilled' ? monthData.value : { totalValue: 0, totalProfitLoss: 0, totalTrades: 0 },
      week: weekData.status === 'fulfilled' ? weekData.value : { totalValue: 0, totalProfitLoss: 0, totalTrades: 0 },
      today: todayData.status === 'fulfilled' ? todayData.value : { totalValue: 0, totalProfitLoss: 0, totalTrades: 0 }
    };

    const mongoose = require('mongoose');
    const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
      ? new mongoose.Types.ObjectId(userId) 
      : userId;
      
    // Get recent trades (last 10)
    let recentTrades = [];
    try {
      recentTrades = await Trade.find({ userId: userObjectId })
        .sort({ tradeDate: -1 })
        .limit(10)
        .lean();
      
      console.log(`Found ${recentTrades.length} recent trades for user ${userId}`);
    } catch (tradeError) {
      console.error('Error fetching recent trades:', tradeError);
    }

    // Get user's watchlist with error handling
    let watchlist = [];
    try {
      const user = await User.findById(userId).select('watchlist');
      const watchlistRaw = user?.watchlist || [];

      const axios = require('axios');
      const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
      const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

      watchlist = await Promise.allSettled(
        watchlistRaw.map(async (item) => {
          try {
            const response = await axios.get(`${FINNHUB_BASE_URL}/quote`, {
              params: { symbol: item.symbol, token: FINNHUB_API_KEY },
              timeout: 5000
            });
            return {
              symbol: item.symbol,
              name: item.name,
              currentPrice: response.data.c || 0,
              change: response.data.d || 0,
              changePercent: response.data.dp || 0,
              addedAt: item.addedAt
            };
          } catch (err) {
            return {
              symbol: item.symbol,
              name: item.name,
              currentPrice: 0,
              change: 0,
              changePercent: 0,
              addedAt: item.addedAt
            };
          }
        })
      );

      watchlist = watchlist
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (watchlistError) {
      console.error('Watchlist error:', watchlistError);
      watchlist = [];
    }

    // Get popular stocks with error handling
    let popularStocks = [];
    try {
      const popularStocksList = [
        'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 
        'META', 'NVDA', 'NFLX', 'JPM', 'V'
      ];

      const axios = require('axios');
      const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
      const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

      popularStocks = await Promise.allSettled(popularStocksList.map(async (symbol) => {
        try {
          const response = await axios.get(
            `${FINNHUB_BASE_URL}/quote`,
            { 
              params: { symbol, token: FINNHUB_API_KEY },
              timeout: 5000
            }
          );
          return {
            symbol,
            price: response.data.c || 0,
            change: response.data.d || 0,
            changePercent: response.data.dp || 0
          };
        } catch (error) {
          return {
            symbol,
            price: 0,
            change: 0,
            changePercent: 0
          };
        }
      }));

      popularStocks = popularStocks
        .filter(result => result.status === 'fulfilled')
        .map(result => result.value);

    } catch (popularError) {
      console.error('Popular stocks error:', popularError);
      popularStocks = [];
    }

    // Get additional analytics with error handling
    let monthlyPerformance = [];
    let topPerformers = [];
    let worstPerformers = [];

    try {
      [monthlyPerformance, topPerformers, worstPerformers] = await Promise.allSettled([
        analytics.getMonthlyPerformance ? analytics.getMonthlyPerformance(userId, 6) : Promise.resolve([]),
        analytics.getTopPerformers ? analytics.getTopPerformers(userId, 3) : Promise.resolve([]),
        analytics.getWorstPerformers ? analytics.getWorstPerformers(userId, 3) : Promise.resolve([])
      ]);

      monthlyPerformance = monthlyPerformance.status === 'fulfilled' ? monthlyPerformance.value : [];
      topPerformers = topPerformers.status === 'fulfilled' ? topPerformers.value : [];
      worstPerformers = worstPerformers.status === 'fulfilled' ? worstPerformers.value : [];
    } catch (analyticsError) {
      console.error('Analytics error:', analyticsError);
    }

    res.render('dashboard', {
      title: 'Dashboard - Fincraft',
      analytics: analytics_data.allTime,
      year: analytics_data.year,
      month: analytics_data.month,
      week: analytics_data.week,
      today: analytics_data.today,
      recentTrades: recentTrades || [],
      popularStocks: popularStocks || [],
      watchlist: watchlist || [],
      monthlyPerformance: monthlyPerformance || [],
      topPerformers: topPerformers || [],
      worstPerformers: worstPerformers || [],
      formatCurrency: analytics.formatCurrency || ((val) => `$${val.toFixed(2)}`),
      formatPercentage: analytics.formatPercentage || ((val) => `${val.toFixed(2)}%`)
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.render('error', {
      title: 'Error - Fincraft',
      message: 'Unable to load dashboard data',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /dashboard/api/performance/:period
router.get('/api/performance/:period', async (req, res) => {
  try {
    const userId = req.session.user._id || req.session.user.id;
    const period = req.params.period;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

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
    const userId = req.session.user._id || req.session.user.id;
    const { symbol, name } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    if (!symbol || !name) {
      return res.status(400).json({
        success: false,
        error: 'Symbol and name are required'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }
    
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
    const userId = req.session.user._id || req.session.user.id;
    const symbol = req.params.symbol.toUpperCase();

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User not authenticated'
      });
    }

    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

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