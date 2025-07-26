const express = require('express');
const router = express.Router();
const axios = require('axios');
const { requireAuth } = require('../middleware/authMiddleware');

const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

// Real-time search using Finnhub API
const searchStocks = async (query) => {
    if (!query || query.length < 1) {
        // Default trending stocks if no query
        const trendingSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'];
        return trendingSymbols.map(symbol => ({
            symbol,
            description: symbol,
            type: 'Common Stock',
            displaySymbol: symbol
        }));
    }
    const url = `https://finnhub.io/api/v1/search?q=${encodeURIComponent(query)}&token=${FINNHUB_API_KEY}`;
    const response = await axios.get(url);
    return response.data.result.map(stock => ({
        symbol: stock.symbol,
        description: stock.description,
        type: stock.type,
        displaySymbol: stock.displaySymbol
    }));
};

// Real-time quote using Finnhub API
const getStockQuote = async (symbol) => {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${FINNHUB_API_KEY}`;
    const response = await axios.get(url);
    return response.data;
};

// GET /search - Search page
router.get('/', requireAuth, async (req, res) => {
    try {
        const { q: query, category = 'all' } = req.query;
        let results = [];
        let searchPerformed = false;
        
        if (query) {
            searchPerformed = true;
            results = await searchStocks(query);
            
            // Add mock price data to results
            for (let stock of results) {
                const quote = await getStockQuote(stock.symbol);
                console.log(stock.symbol, quote);
                stock.currentPrice = quote.c.toFixed(2);
                stock.previousClose = quote.pc.toFixed(2);
                stock.change = (quote.c - quote.pc).toFixed(2);
                stock.changePercent = (((quote.c - quote.pc) / quote.pc) * 100).toFixed(2);
                stock.isPositive = quote.c >= quote.pc;
            }
            
            // Filter by category if specified
            if (category !== 'all') {
                switch (category) {
                    case 'gainers':
                        results = results.filter(stock => parseFloat(stock.changePercent) > 0)
                                        .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
                        break;
                    case 'losers':
                        results = results.filter(stock => parseFloat(stock.changePercent) < 0)
                                        .sort((a, b) => parseFloat(a.changePercent) - parseFloat(b.changePercent));
                        break;
                    case 'most-active':
                        // Mock sorting by volume (not implemented in mock data)
                        results = results.sort(() => Math.random() - 0.5);
                        break;
                }
            }
        }
        
        // Get trending stocks for suggestions
        const trendingStocks = await searchStocks('');
        const trending = trendingStocks.slice(0, 6);
        
        // Add price data to trending
        for (let stock of trending) {
            const quote = await getStockQuote(stock.symbol);
            console.log(stock.symbol, quote);
            stock.currentPrice = quote.c.toFixed(2);
            stock.changePercent = (((quote.c - quote.pc) / quote.pc) * 100).toFixed(2);
            stock.isPositive = quote.c >= quote.pc;
        }
        
        res.render('search', {
            user: req.user,
            query: query || '',
            results,
            searchPerformed,
            category,
            trending,
            resultCount: results.length
        });
        
    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).render('error', { 
            message: 'Error performing search', 
            user: req.user 
        });
    }
});

// GET /search/suggestions - Auto-complete suggestions
router.get('/suggestions', requireAuth, async (req, res) => {
    try {
        const { q: query } = req.query;
        
        if (!query || query.length < 2) {
            return res.json({ suggestions: [] });
        }
        
        const results = await searchStocks(query);
        const suggestions = results.slice(0, 8).map(stock => ({
            symbol: stock.symbol,
            name: stock.description,
            displayText: `${stock.symbol} - ${stock.description}`
        }));
        
        res.json({ suggestions });
        
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.json({ suggestions: [] });
    }
});

// GET /search/trending - Get trending stocks
router.get('/trending', requireAuth, async (req, res) => {
    try {
        const trendingSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX'];
        const trending = [];
        
        for (const symbol of trendingSymbols) {
            const quote = await getStockQuote(symbol);
            trending.push({
                symbol,
                currentPrice: quote.c.toFixed(2),
                change: (quote.c - quote.pc).toFixed(2),
                changePercent: (((quote.c - quote.pc) / quote.pc) * 100).toFixed(2),
                isPositive: quote.c >= quote.pc
            });
        }
        
        res.json({ trending });
        
    } catch (error) {
        console.error('Error getting trending stocks:', error);
        res.status(500).json({ error: 'Error loading trending stocks' });
    }
});

// GET /search/categories - Get stocks by category
router.get('/categories/:category', requireAuth, async (req, res) => {
    try {
        const { category } = req.params;
        const { limit = 20 } = req.query;
        
        let stocks = await searchStocks('');
        
        // Add price data
        for (let stock of stocks) {
            const quote = await getStockQuote(stock.symbol);
            console.log(stock.symbol, quote);
            stock.currentPrice = quote.c.toFixed(2);
            stock.previousClose = quote.pc.toFixed(2);
            stock.change = (quote.c - quote.pc).toFixed(2);
            stock.changePercent = (((quote.c - quote.pc) / quote.pc) * 100).toFixed(2);
            stock.isPositive = quote.c >= quote.pc;
        }
        
        // Filter and sort by category
        switch (category) {
            case 'gainers':
                stocks = stocks.filter(stock => parseFloat(stock.changePercent) > 0)
                              .sort((a, b) => parseFloat(b.changePercent) - parseFloat(a.changePercent));
                break;
            case 'losers':
                stocks = stocks.filter(stock => parseFloat(stock.changePercent) < 0)
                              .sort((a, b) => parseFloat(a.changePercent) - parseFloat(b.changePercent));
                break;
            case 'most-active':
                stocks = stocks.sort(() => Math.random() - 0.5); // Mock random sort
                break;
            case 'tech':
                const techSymbols = ['AAPL', 'GOOGL', 'MSFT', 'AMZN', 'TSLA', 'NVDA', 'META', 'NFLX', 'AMD', 'INTC'];
                stocks = stocks.filter(stock => techSymbols.includes(stock.symbol));
                break;
            default:
                stocks = stocks.sort(() => Math.random() - 0.5);
        }
        
        res.json({ 
            category,
            stocks: stocks.slice(0, parseInt(limit)),
            total: stocks.length
        });
        
    } catch (error) {
        console.error('Error getting category stocks:', error);
        res.status(500).json({ error: 'Error loading category stocks' });
    }
});

// POST /search/track - Add stock to watchlist from search
router.post('/track', requireAuth, async (req, res) => {
    try {
        const { symbol, companyName } = req.body;
        
        if (!symbol) {
            return res.status(400).json({
                success: false,
                message: 'Stock symbol is required'
            });
        }
        
        const User = require('../models/User');
        const user = await User.findById(req.user._id);
        
        // Check if already in watchlist
        const isAlreadyTracked = user.watchlist.some(item => 
            item.symbol.toLowerCase() === symbol.toLowerCase()
        );
        
        if (isAlreadyTracked) {
            return res.status(400).json({
                success: false,
                message: 'Stock is already in your watchlist'
            });
        }
        
        // Add to watchlist
        user.watchlist.push({
            symbol: symbol.toUpperCase(),
            companyName: companyName || symbol.toUpperCase(),
            addedAt: new Date()
        });
        
        await user.save();
        
        res.json({
            success: true,
            message: `${symbol.toUpperCase()} added to watchlist`,
            watchlistCount: user.watchlist.length
        });
        
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        res.status(500).json({
            success: false,
            message: 'Error adding stock to watchlist'
        });
    }
});

module.exports = router;
