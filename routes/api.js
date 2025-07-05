const express = require('express');
const router = express.Router();
const axios = require('axios');
const User = require('../models/User');
const Trade = require('../models/Trade');

// Finnhub API configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Helper function to make API requests
const makeApiRequest = async (endpoint, params = {}) => {
  try {
    const response = await axios.get(`${FINNHUB_BASE_URL}${endpoint}`, {
      params: {
        ...params,
        token: FINNHUB_API_KEY
      }
    });
    return response.data;
  } catch (error) {
    console.error('API Request Error:', error.message);
    throw new Error('Failed to fetch stock data');
  }
};

router.get('/user/profile', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({
      success: false,
      message: 'Not authenticated'
    });
  }
  
  res.json({
    success: true,
    user: {
      id: req.session.user._id,
      username: req.session.user.username,
      email: req.session.user.email
    }
  });
});

// Get stock quote (real-time price)
router.get('/quote/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await makeApiRequest('/quote', { symbol: symbol.toUpperCase() });
    
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        currentPrice: data.c,
        change: data.d,
        changePercent: data.dp,
        highPrice: data.h,
        lowPrice: data.l,
        openPrice: data.o,
        previousClose: data.pc,
        timestamp: data.t
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get stock candle data (historical prices for charts)
router.get('/candle/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { resolution = 'D', from, to } = req.query;
    
    // Default to last 30 days if no dates provided
    const toTimestamp = to || Math.floor(Date.now() / 1000);
    const fromTimestamp = from || (toTimestamp - 30 * 24 * 60 * 60);
    
    const data = await makeApiRequest('/stock/candle', {
      symbol: symbol.toUpperCase(),
      resolution,
      from: fromTimestamp,
      to: toTimestamp
    });
    
    if (data.s === 'ok') {
      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          timestamps: data.t,
          open: data.o,
          high: data.h,
          low: data.l,
          close: data.c,
          volume: data.v
        }
      });
    } else {
      res.status(404).json({
        success: false,
        message: 'No data found for the specified symbol'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get stock recommendations
router.get('/recommendation/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await makeApiRequest('/stock/recommendation', { 
      symbol: symbol.toUpperCase() 
    });
    
    if (data && data.length > 0) {
      const latest = data[0];
      const total = latest.buy + latest.hold + latest.sell + latest.strongBuy + latest.strongSell;
      let recommendation = 'HOLD';
      
      if (total > 0) {
        const buyScore = (latest.strongBuy * 2 + latest.buy) / total;
        const sellScore = (latest.strongSell * 2 + latest.sell) / total;
        
        if (buyScore > 0.6) recommendation = 'BUY';
        else if (sellScore > 0.6) recommendation = 'SELL';
      }
      
      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          recommendation,
          buy: latest.buy,
          hold: latest.hold,
          sell: latest.sell,
          strongBuy: latest.strongBuy,
          strongSell: latest.strongSell,
          period: latest.period
        }
      });
    } else {
      res.json({
        success: true,
        data: {
          symbol: symbol.toUpperCase(),
          recommendation: 'HOLD',
          buy: 0,
          hold: 0,
          sell: 0,
          strongBuy: 0,
          strongSell: 0,
          period: 'N/A'
        }
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Search stocks by symbol or company name
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query;
    
    if (!q || q.trim().length < 1) {
      return res.status(400).json({
        success: false,
        message: 'Search query is required'
      });
    }
    
    const data = await makeApiRequest('/search', { q: q.trim() });
    
    // Filter and format results
    const results = data.result ? data.result.slice(0, 10).map(stock => ({
      symbol: stock.symbol,
      description: stock.description,
      displaySymbol: stock.displaySymbol,
      type: stock.type
    })) : [];
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get company profile
router.get('/profile/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const data = await makeApiRequest('/stock/profile2', { 
      symbol: symbol.toUpperCase() 
    });
    
    res.json({
      success: true,
      data: {
        symbol: symbol.toUpperCase(),
        name: data.name || symbol.toUpperCase(),
        country: data.country,
        currency: data.currency,
        exchange: data.exchange,
        ipo: data.ipo,
        marketCapitalization: data.marketCapitalization,
        shareOutstanding: data.shareOutstanding,
        ticker: data.ticker,
        weburl: data.weburl,
        logo: data.logo,
        finnhubIndustry: data.finnhubIndustry
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get popular stocks (predefined list)
router.get('/popular', async (req, res) => {
  try {
    const popularSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'META', 'NVDA', 'NFLX'];
    const stockData = [];
    
    for (const symbol of popularSymbols) {
      try {
        const quote = await makeApiRequest('/quote', { symbol });
        stockData.push({
          symbol,
          currentPrice: quote.c,
          change: quote.d,
          changePercent: quote.dp
        });
      } catch (error) {
        console.error(`Failed to fetch data for ${symbol}:`, error.message);
      }
    }
    
    res.json({
      success: true,
      data: stockData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get market news
router.get('/news', async (req, res) => {
  try {
    const { category = 'general' } = req.query;
    const data = await makeApiRequest('/news', { category });
    
    const news = data.slice(0, 20).map(article => ({
      category: article.category,
      datetime: article.datetime,
      headline: article.headline,
      id: article.id,
      image: article.image,
      related: article.related,
      source: article.source,
      summary: article.summary,
      url: article.url
    }));
    
    res.json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get stock news for specific symbol
router.get('/news/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to } = req.query;
    
    // Default to last 7 days if no dates provided
    const toDate = to || new Date().toISOString().split('T')[0];
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const data = await makeApiRequest('/company-news', {
      symbol: symbol.toUpperCase(),
      from: fromDate,
      to: toDate
    });
    
    const news = data.slice(0, 10).map(article => ({
      category: article.category,
      datetime: article.datetime,
      headline: article.headline,
      id: article.id,
      image: article.image,
      related: article.related,
      source: article.source,
      summary: article.summary,
      url: article.url
    }));
    
    res.json({
      success: true,
      data: news
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Add stock to watchlist
router.post('/watchlist/add', async (req, res) => {
  console.log('📥 Add to watchlist request:', req.body);
  console.log('👤 Session user:', req.session.user);
  
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { symbol, name } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Stock symbol is required'
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check if already in watchlist
    const exists = user.watchlist.some(item => item.symbol === symbol);
    if (exists) {
      return res.json({
        success: true,
        message: 'Stock already in watchlist'
      });
    }

    // Add to watchlist
    user.watchlist.push({
      symbol: symbol,
      name: name || symbol,
      addedAt: new Date()
    });

    await user.save();
    console.log('✅ Added to watchlist:', symbol);

    res.json({
      success: true,
      message: 'Stock added to watchlist'
    });

  } catch (error) {
    console.error('❌ Add to watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add stock to watchlist'
    });
  }
});

// Remove stock from watchlist
router.post('/watchlist/remove', async (req, res) => {
  console.log('📥 Remove from watchlist request:', req.body);
  
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const { symbol } = req.body;
    
    if (!symbol) {
      return res.status(400).json({
        success: false,
        message: 'Stock symbol is required'
      });
    }

    const user = await User.findById(req.session.user._id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Remove from watchlist
    const initialLength = user.watchlist.length;
    user.watchlist = user.watchlist.filter(item => item.symbol !== symbol);
    
    if (user.watchlist.length === initialLength) {
      return res.json({
        success: true,
        message: 'Stock was not in watchlist'
      });
    }

    await user.save();
    console.log('✅ Removed from watchlist:', symbol);

    res.json({
      success: true,
      message: 'Stock removed from watchlist'
    });

  } catch (error) {
    console.error('❌ Remove from watchlist error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to remove stock from watchlist'
    });
  }
});

// Get user's watchlist with current prices 
router.get('/watchlist', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const user = await User.findById(req.session.user._id);
    const watchlistData = [];
    
    for (const item of user.watchlist) {
      try {
        const quote = await makeApiRequest('/quote', { symbol: item.symbol });
        watchlistData.push({
          symbol: item.symbol,
          name: item.name,
          currentPrice: quote.c,
          change: quote.d,
          changePercent: quote.dp,
          addedAt: item.addedAt
        });
      } catch (error) {
        console.error(`Failed to fetch data for ${item.symbol}:`, error.message);
        // Add the stock even if we can't get current price
        watchlistData.push({
          symbol: item.symbol,
          name: item.name,
          currentPrice: null,
          change: null,
          changePercent: null,
          addedAt: item.addedAt
        });
      }
    }
    
    res.json({
      success: true,
      data: watchlistData
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Execute trade (buy/sell simulation)
router.post('/trade', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { symbol, type, quantity, price } = req.body;
    
    if (!symbol || !type || !quantity || !price) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    
    if (type !== 'BUY' && type !== 'SELL') {
      return res.status(400).json({
        success: false,
        message: 'Invalid trade type'
      });
    }
    
    if (quantity <= 0 || price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Quantity and price must be positive'
      });
    }
    
    // Create new trade
    const trade = new Trade({
      userId: req.session.user._id,
      symbol: symbol.toUpperCase(),
      type,
      quantity: parseInt(quantity),
      price: parseFloat(price),
      timestamp: new Date()
    });
    
    await trade.save();
    
    res.json({
      success: true,
      message: `${type} order executed successfully`,
      data: trade
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get user's trade history
router.get('/trades', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { symbol, period } = req.query;
    let filter = { userId: req.session.user._id };
    
    if (symbol) {
      filter.symbol = symbol.toUpperCase();
    }
    
    if (period) {
      const now = new Date();
      let fromDate;
      
      switch (period) {
        case 'today':
          fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'month':
          fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
          break;
        case 'year':
          fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          break;
        default:
          fromDate = null;
      }
      
      if (fromDate) {
        filter.timestamp = { $gte: fromDate };
      }
    }
    
    const trades = await Trade.find(filter).sort({ timestamp: -1 });
    
    res.json({
      success: true,
      data: trades
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Calculate portfolio performance
router.get('/portfolio', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const trades = await Trade.find({ userId: req.session.user._id });
    
    // Group trades by symbol
    const positions = {};
    let totalProfit = 0;
    
    for (const trade of trades) {
      if (!positions[trade.symbol]) {
        positions[trade.symbol] = {
          symbol: trade.symbol,
          quantity: 0,
          totalCost: 0,
          averagePrice: 0,
          trades: []
        };
      }
      
      const position = positions[trade.symbol];
      position.trades.push(trade);
      
      if (trade.type === 'BUY') {
        position.quantity += trade.quantity;
        position.totalCost += trade.quantity * trade.price;
      } else {
        position.quantity -= trade.quantity;
        totalProfit += (trade.price - position.averagePrice) * trade.quantity;
      }
      
      if (position.quantity > 0) {
        position.averagePrice = position.totalCost / position.quantity;
      }
    }
    
    // Get current prices for active positions
    const activePositions = [];
    for (const [symbol, position] of Object.entries(positions)) {
      if (position.quantity > 0) {
        try {
          const quote = await makeApiRequest('/quote', { symbol });
          const currentValue = position.quantity * quote.c;
          const unrealizedProfit = currentValue - position.totalCost;
          
          activePositions.push({
            ...position,
            currentPrice: quote.c,
            currentValue,
            unrealizedProfit,
            unrealizedProfitPercent: (unrealizedProfit / position.totalCost) * 100
          });
        } catch (error) {
          console.error(`Failed to fetch current price for ${symbol}`);
        }
      }
    }
    
    const totalUnrealizedProfit = activePositions.reduce((sum, pos) => sum + pos.unrealizedProfit, 0);
    const totalCurrentValue = activePositions.reduce((sum, pos) => sum + pos.currentValue, 0);
    const totalInvested = activePositions.reduce((sum, pos) => sum + pos.totalCost, 0);
    
    res.json({
      success: true,
      data: {
        totalProfit: totalProfit + totalUnrealizedProfit,
        realizedProfit: totalProfit,
        unrealizedProfit: totalUnrealizedProfit,
        totalCurrentValue,
        totalInvested,
        positions: activePositions,
        totalTrades: trades.length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Get portfolio performance by period
router.get('/portfolio/:period', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }
    
    const { period } = req.params;
    const now = new Date();
    let fromDate;
    
    switch (period) {
      case 'today':
        fromDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case 'week':
        fromDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        fromDate = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        break;
      case 'year':
        fromDate = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        break;
      case 'all':
        fromDate = null;
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid period'
        });
    }
    
    let filter = { userId: req.session.user._id };
    if (fromDate) {
      filter.timestamp = { $gte: fromDate };
    }
    
    const trades = await Trade.find(filter);
    
    // Calculate profit/loss for the period
    let profit = 0;
    const positions = {};
    
    for (const trade of trades) {
      if (!positions[trade.symbol]) {
        positions[trade.symbol] = { quantity: 0, totalCost: 0 };
      }
      
      const position = positions[trade.symbol];
      
      if (trade.type === 'BUY') {
        position.quantity += trade.quantity;
        position.totalCost += trade.quantity * trade.price;
      } else {
        const avgPrice = position.quantity > 0 ? position.totalCost / position.quantity : 0;
        profit += (trade.price - avgPrice) * trade.quantity;
        position.quantity -= trade.quantity;
        position.totalCost -= avgPrice * trade.quantity;
      }
    }
    
    res.json({
      success: true,
      data: {
        period,
        profit,
        trades: trades.length,
        positions: Object.keys(positions).length
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// Error handling middleware
router.use((error, req, res, next) => {
  console.error('API Error:', error);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

module.exports = router;