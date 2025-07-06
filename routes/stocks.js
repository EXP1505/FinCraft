const express = require('express');
const axios = require('axios');
const Trade = require('../models/Trade');
const User = require('../models/User');

const router = express.Router();

// Finnhub API configuration
const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
if (!FINNHUB_API_KEY) {
  throw new Error('Finnhub API key is not set in environment variables.');
}

const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

// Helper function to make Finnhub API calls
const finnhubRequest = async (endpoint, params = {}) => {
  try {
    console.log('Making Finnhub request to:', endpoint);
    const response = await axios.get(`${FINNHUB_BASE_URL}${endpoint}`, {
      params: {
        ...params,
        token: FINNHUB_API_KEY
      },
      timeout: 10000 // 10 second timeout
    });
    return response.data;
  } catch (error) {
    console.error('Finnhub API error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
    throw new Error(`Unable to fetch data from Finnhub: ${error.message}`);
  }
};

// GET /stocks - Main stocks page
router.get('/', async (req, res) => {
  try {
    // Get popular stocks (you can customize this list)
    const popularStocks = [
      'AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 
      'META', 'NVDA', 'NFLX', 'BABA', 'V'
    ];

    // Get quotes for popular stocks
    const stockPromises = popularStocks.map(async (symbol) => {
      try {
        const quote = await finnhubRequest('/quote', { symbol });
        const profile = await finnhubRequest('/stock/profile2', { symbol });
        
        return {
          symbol,
          name: profile.name || symbol,
          price: quote.c || 0,
          change: quote.d || 0,
          changePercent: quote.dp || 0,
          logo: profile.logo || '/images/default-stock.png'
        };
      } catch (error) {
        console.error(`Error fetching data for ${symbol}:`, error.message);
        return {
          symbol,
          name: symbol,
          price: 0,
          change: 0,
          changePercent: 0,
          logo: '/images/default-stock.png'
        };
      }
    });
    
    const stocks = await Promise.all(stockPromises);

    // Get user's watchlist
    const userId = req.session.user.id || req.session.user._id;
    const user = await User.findById(userId).select('watchlist');
    const watchlistRaw = user.watchlist || [];
    const axios = require('axios');
    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
    const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';
    const watchlist = await Promise.all(watchlistRaw.map(async (item) => {
      try {
        const quote = await finnhubRequest('/quote', { symbol: item.symbol });
        return {
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: quote.c || 0,
          change: quote.d || 0,
          changePercent: quote.dp || 0
        };
      } catch (error) {
        console.error(`Error fetching watchlist data for ${item.symbol}:`, error.message);
        return {
          symbol: item.symbol,
          name: item.name || item.symbol,
          price: 0,
          change: 0,
          changePercent: 0
        };
      }
    }));

    res.render('stocks', {
      title: 'Stocks - StockSage',
      stocks,
      watchlist,
      searchQuery: ''
    });

  } catch (error) {
    console.error('Stocks page error:', error);
    res.render('error', {
      title: 'Error - StockSage',
      message: 'Unable to load stocks data',
      error: {}
    });
  }
});

// GET /stocks/search - Search stocks
router.get('/search', async (req, res) => {
  try {
    const query = req.query.q;
    
    if (!query) {
      return res.redirect('/stocks');
    }

    // Search for stocks using Finnhub symbol lookup
    const searchResults = await finnhubRequest('/search', { q: query });
    
    if (!searchResults.result || searchResults.result.length === 0) {
      return res.render('stocks', {
        title: `Search Results: ${query} - StockSage`,
        stocks: [],
        watchlist: [],
        searchQuery: query
      });
    }

    // Get detailed info for first 10 results
    const stockPromises = searchResults.result.slice(0, 10).map(async (result) => {
      try {
        const quote = await finnhubRequest('/quote', { symbol: result.symbol });
        
        return {
          symbol: result.symbol,
          name: result.description,
          price: quote.c || 0,
          change: quote.d || 0,
          changePercent: quote.dp || 0,
          type: result.type
        };
      } catch (error) {
        console.error(`Error fetching quote for ${result.symbol}:`, error.message);
        return {
          symbol: result.symbol,
          name: result.description,
          price: 0,
          change: 0,
          changePercent: 0,
          type: result.type
        };
      }
    });

    const stocks = await Promise.all(stockPromises);

    // Get user's watchlist
    const userId = req.session.user.id;
    const user = await User.findById(userId).select('watchlist');
    const watchlist = user.watchlist || [];

    res.render('stocks', {
      title: `Search Results: ${query} - StockSage`,
      stocks,
      watchlist,
      searchQuery: query
    });

  } catch (error) {
    console.error('Stock search error:', error);
    res.render('error', {
      title: 'Error - StockSage',
      message: 'Unable to search stocks',
      error: {}
    });
  }
});

// GET /stocks/:symbol - Individual stock page
router.get('/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const userId = req.session.user.id;

    console.log(`Fetching data for symbol: ${symbol}`);

    // Get stock data with better error handling
    const [quote, profile, recommendation] = await Promise.allSettled([
      finnhubRequest('/quote', { symbol }),
      finnhubRequest('/stock/profile2', { symbol }),
      finnhubRequest('/stock/recommendation', { symbol })
    ]);

    // Check if quote request failed
    if (quote.status === 'rejected') {
      console.error('Quote request failed:', quote.reason);
      throw new Error('Unable to fetch stock quote');
    }

    // Check if profile request failed
    if (profile.status === 'rejected') {
      console.error('Profile request failed:', profile.reason);
      throw new Error('Unable to fetch stock profile');
    }

    const quoteData = quote.value;
    const profileData = profile.value;
    const recommendationData = recommendation.status === 'fulfilled' ? recommendation.value : [];

    // Validate that we have essential data
    if (!quoteData || quoteData.c === undefined || quoteData.c === null) {
      console.error('Invalid quote data received:', quoteData);
      throw new Error('Invalid stock data received');
    }

    if (!profileData || !profileData.name) {
      console.error('Invalid profile data received:', profileData);
      throw new Error('Invalid company profile data received');
    }

    console.log('Stock data fetched successfully');

    // Get user's trade history for this stock
    const trades = await Trade.find({ userId, symbol }).sort({ tradeDate: -1 });

    // Calculate current position
    let totalShares = 0;
    let totalInvestment = 0;
    
    trades.forEach(trade => {
      if (trade.type === 'BUY') {
        totalShares += trade.quantity;
        totalInvestment += trade.totalAmount;
      } else {
        totalShares -= trade.quantity;
        totalInvestment -= (trade.quantity * (totalInvestment / totalShares));
      }
    });

    const avgPrice = totalShares > 0 ? totalInvestment / totalShares : 0;
    const currentValue = totalShares * quoteData.c;
    const unrealizedPL = currentValue - totalInvestment;
    const unrealizedPercentage = totalInvestment > 0 ? (unrealizedPL / totalInvestment) * 100 : 0;

    // Check if in watchlist
    const user = await User.findById(userId).select('watchlist');
    const inWatchlist = user.watchlist.some(item => item.symbol === symbol);

    // Prepare stock object for template
    const stockData = {
      symbol,
      name: profileData.name,
      price: quoteData.c,
      change: quoteData.d || 0,
      changePercent: quoteData.dp || 0,
      high: quoteData.h || 0,
      low: quoteData.l || 0,
      open: quoteData.o || 0,
      previousClose: quoteData.pc || 0,
      logo: profileData.logo || '/images/default-stock.png',
      marketCap: profileData.marketCapitalization || 0,
      peRatio: profileData.peBasicExclExtraTTM || 0,
      beta: profileData.beta || 0,
      week52High: profileData['52WeekHigh'] || 0,
      week52Low: profileData['52WeekLow'] || 0,
      description: profileData.description || '',
      country: profileData.country || '',
      exchange: profileData.exchange || '',
      industry: profileData.finnhubIndustry || ''
    };

    res.render('stock', {
      title: `${symbol} - ${profileData.name} - StockSage`,
      stock: stockData,
      recommendation: recommendationData,
      position: {
        shares: totalShares,
        avgPrice,
        currentValue,
        unrealizedPL,
        unrealizedPercentage
      },
      trades,
      inWatchlist
    });

  } catch (error) {
    console.error('Individual stock error:', error);
    res.render('error', {
      title: 'Error - StockSage',
      message: 'Unable to load stock information',
      error: process.env.NODE_ENV === 'development' ? error : {}
    });
  }
});

// GET /stocks/:symbol/chart - Chart data endpoint
router.get('/:symbol/chart', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const { resolution = 'D', from, to } = req.query;

    const candles = await finnhubRequest('/stock/candle', {
      symbol,
      resolution,
      from: from || Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60), // 30 days ago
      to: to || Math.floor(Date.now() / 1000)
    });

    if (!candles || !candles.t || !candles.c || candles.s === 'no_data') {
      return res.json({ 
        success: false, 
        error: 'No chart data available' 
      });
    }

    res.json({
      success: true,
      data: {
        timestamps: candles.t,
        close: candles.c,
        open: candles.o,
        high: candles.h,
        low: candles.l,
        volume: candles.v
      }
    });

  } catch (error) {
    console.error('Chart data error:', error);
    res.json({ 
      success: false, 
      error: 'Failed to load chart data' 
    });
  }
});

// POST /stocks/:symbol/trade - Execute a trade
router.post('/:symbol/trade', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase();
    const userId = req.session.user.id;
    const { type, quantity, notes } = req.body;

    // Validate input
    if (!type || !quantity || quantity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid trade parameters'
      });
    }

    // Get current stock price
    const [quote, profile] = await Promise.all([
      finnhubRequest('/quote', { symbol }),
      finnhubRequest('/stock/profile2', { symbol })
    ]);
    
    const currentPrice = quote.c;
    const totalAmount = currentPrice * parseInt(quantity);

    // Create trade record
    const trade = new Trade({
      userId,
      symbol,
      companyName: profile.name || symbol,
      type: type.toUpperCase(),
      quantity: parseInt(quantity),
      price: currentPrice,
      totalAmount,
      notes: notes || ''
    });

    // If selling, calculate profit/loss
    if (type.toUpperCase() === 'SELL') {
      // Get user's buy trades for this stock to calculate profit/loss
      const buyTrades = await Trade.find({
        userId,
        symbol,
        type: 'BUY'
      }).sort({ tradeDate: 1 });

      // Calculate average buy price (FIFO method)
      let remainingShares = parseInt(quantity);
      let totalCost = 0;
      
      for (const buyTrade of buyTrades) {
        if (remainingShares <= 0) break;
        
        const sharesToUse = Math.min(remainingShares, buyTrade.quantity);
        totalCost += sharesToUse * buyTrade.price;
        remainingShares -= sharesToUse;
      }

      const avgBuyPrice = totalCost / parseInt(quantity);
      trade.buyPrice = avgBuyPrice;
      trade.sellPrice = currentPrice;
      trade.profitLoss = (currentPrice - avgBuyPrice) * parseInt(quantity);
      trade.profitLossPercentage = ((currentPrice - avgBuyPrice) / avgBuyPrice) * 100;
    }

    await trade.save();

    res.json({
      success: true,
      message: `${type.toUpperCase()} order executed successfully`,
      trade: {
        id: trade._id,
        symbol: trade.symbol,
        type: trade.type,
        quantity: trade.quantity,
        price: trade.price,
        totalAmount: trade.totalAmount,
        profitLoss: trade.profitLoss
      }
    });

  } catch (error) {
    console.error('Trade execution error:', error);
    res.status(500).json({
      success: false,
      error: 'Unable to execute trade'
    });
  }
});

module.exports = router;