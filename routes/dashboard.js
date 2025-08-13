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

    // Fetch news data for dashboard
    let newsData = [];
    try {
      console.log('Attempting to fetch news data...');
      
      // Option 1: Try using your existing news API endpoint
      const newsApiUrl = `${req.protocol}://${req.get('host')}/api/news?category=general&limit=10`;
      console.log('Fetching from:', newsApiUrl);
      
      const newsResponse = await fetch(newsApiUrl);
      const newsResult = await newsResponse.json();
      
      if (newsResult.success && newsResult.data) {
        newsData = newsResult.data.slice(0, 10);
        console.log(`Successfully fetched ${newsData.length} news articles from API`);
      } else {
        console.log('API response unsuccessful, trying direct Finnhub...');
        throw new Error('API response not successful');
      }
      
    } catch (apiError) {
      console.log('API fetch failed, trying direct Finnhub access...');
      
      // Option 2: Direct Finnhub API call as fallback
      try {
        const axios = require('axios');
        const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
        
        if (!FINNHUB_API_KEY) {
          console.error('FINNHUB_API_KEY not found in environment variables');
          throw new Error('Missing API key');
        }
        
        console.log('Making direct Finnhub API call...');
        const directResponse = await axios.get('https://finnhub.io/api/v1/news', {
          params: {
            category: 'general',
            token: FINNHUB_API_KEY
          },
          timeout: 10000
        });
        
        if (directResponse.data && Array.isArray(directResponse.data)) {
          newsData = directResponse.data.slice(0, 10);
          console.log(`Successfully fetched ${newsData.length} news articles from direct Finnhub`);
        }
        
      } catch (directError) {
        console.error('Direct Finnhub API call failed:', directError.message);
        newsData = [];
      }
    }

    // If still no news, create some mock data for testing
    if (newsData.length === 0) {
      console.log('No news data available, using fallback mock data');
      newsData = [
        {
          headline: "Market Update: Stocks Show Mixed Performance",
          summary: "Major indices show varied performance as investors await economic data.",
          source: "Market News",
          datetime: Math.floor(Date.now() / 1000),
          url: "#",
          image: null,
          category: "general"
        }
      ];
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
        'GS', 'SNAP', 'MSFT', 'AMZN', 'BMW.HA', 'RS','BAC',
        'LMT', 'NVDA', 'NFLX', 'JPM', 'V'
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

    console.log(`Rendering dashboard with ${newsData.length} news articles`);

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
      news: newsData, // This should now have data
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

// Rest of your existing routes...
router.get('/api/fetch', async (req, res) => {
  try {
    const { category = 'general', symbol, from, to } = req.query;
    let apiPath;
    const queryParams = new URLSearchParams();
    if (symbol) {
      apiPath = `/api/news/${symbol.toUpperCase()}`;
      if (from) queryParams.append('from', from);
      if (to) queryParams.append('to', to);
    } else {
      apiPath = '/api/news';
      queryParams.append('category', category);
    }
    const queryString = queryParams.toString();
    const fullUrl = `${req.protocol}://${req.get('host')}${apiPath}${queryString ? '?' + queryString : ''}`;
    const response = await fetch(fullUrl);
    const result = await response.json();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

module.exports = router;