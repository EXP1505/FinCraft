const express = require('express');
const router = express.Router();

// Display general market news page
router.get('/', async (req, res) => {
  try {
    const { category = 'general' } = req.query;
    
    // Fetch news data from your API
    const response = await fetch(`${req.protocol}://${req.get('host')}/api/news?category=${category}`);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    res.render('news', {
      title: 'Market News',
      news: result.data,
      category: category,
      currentPage: 'news',
      symbol: null
    });
  } catch (error) {
    console.error('Error fetching news:', error);
    res.render('news', {
      title: 'Market News',
      news: [],
      category: req.query.category || 'general',
      currentPage: 'news',
      symbol: null,
      error: 'Failed to load news. Please try again later.'
    });
  }
});

// Display stock-specific news page
router.get('/stock/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { from, to } = req.query;
    
    // Build query parameters
    const queryParams = new URLSearchParams();
    if (from) queryParams.append('from', from);
    if (to) queryParams.append('to', to);
    
    const queryString = queryParams.toString();
    const url = `${req.protocol}://${req.get('host')}/api/news/${symbol}${queryString ? '?' + queryString : ''}`;
    
    // Fetch stock news data from your API
    const response = await fetch(url);
    const result = await response.json();
    
    if (!result.success) {
      throw new Error(result.message);
    }
    
    res.render('news', {
      title: `${symbol.toUpperCase()} News`,
      news: result.data,
      category: 'stock',
      currentPage: 'news',
      symbol: symbol.toUpperCase(),
      dateRange: { from, to }
    });
  } catch (error) {
    console.error('Error fetching stock news:', error);
    res.render('news', {
      title: `${req.params.symbol.toUpperCase()} News`,
      news: [],
      category: 'stock',
      currentPage: 'news',
      symbol: req.params.symbol.toUpperCase(),
      dateRange: { from: req.query.from, to: req.query.to },
      error: 'Failed to load stock news. Please try again later.'
    });
  }
});

// API endpoint for AJAX requests (if needed for dynamic loading)
// Note: This assumes your API routes are mounted at /api
// You can remove this if you don't need AJAX functionality
router.get('/api/fetch', async (req, res) => {
  try {
    const { category = 'general', symbol, from, to } = req.query;
    
    let apiPath;
    const queryParams = new URLSearchParams();
    
    if (symbol) {
      // Redirect to stock-specific API endpoint
      apiPath = `/api/news/${symbol.toUpperCase()}`;
      if (from) queryParams.append('from', from);
      if (to) queryParams.append('to', to);
    } else {
      // Redirect to general news API endpoint
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