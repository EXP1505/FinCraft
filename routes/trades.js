const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const { requireAuth } = require('../middleware/authMiddleware');
const { calculateProfit } = require('../utils/analytics');

// GET /trades - Trade History Page
router.get('/', requireAuth, async (req, res) => {
    try {
        const { stock, period, page = 1 } = req.query;
        const limit = 20;
        const skip = (page - 1) * limit;
        
        // Build query filter
        let query = { userId: req.user._id };
        
        // Filter by stock symbol if provided
        if (stock && stock.trim()) {
            query.symbol = new RegExp(stock.trim(), 'i');
        }
        
        // Filter by time period if provided
        if (period) {
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = null;
            }
            
            if (startDate) {
                query.timestamp = { $gte: startDate };
            }
        }
        
        // Get trades with pagination
        const trades = await Trade.find(query)
            .sort({ timestamp: -1 })
            .limit(limit)
            .skip(skip);
        
        // Get total count for pagination
        const totalTrades = await Trade.countDocuments(query);
        const totalPages = Math.ceil(totalTrades / limit);
        
        // Calculate summary statistics
        const allUserTrades = await Trade.find({ userId: req.user._id });
        const totalProfit = allUserTrades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
        const totalTrades_count = allUserTrades.length;
        const winningTrades = allUserTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
        const winRate = totalTrades_count > 0 ? ((winningTrades / totalTrades_count) * 100).toFixed(1) : 0;
        
        res.render('history', {
            user: req.user,
            trades,
            filters: { stock, period },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            },
            summary: {
                totalProfit: totalProfit.toFixed(2),
                totalTrades: totalTrades_count,
                winRate
            }
        });
        
    } catch (error) {
        console.error('Error fetching trade history:', error);
        res.status(500).render('error', { 
            message: 'Error loading trade history', 
            user: req.user 
        });
    }
});

// POST /trades/simulate - Simulate a trade (Buy/Sell)
router.post('/simulate', requireAuth, async (req, res) => {
    try {
        const { symbol, action, quantity, price, companyName } = req.body;
        
        // Validate input
        if (!symbol || !action || !quantity || !price) {
            return res.status(400).json({ 
                success: false, 
                message: 'Missing required fields' 
            });
        }
        
        const qty = parseInt(quantity);
        const tradePrice = parseFloat(price);
        
        if (qty <= 0 || tradePrice <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Quantity and price must be positive numbers' 
            });
        }
        
        if (!['BUY', 'SELL'].includes(action.toUpperCase())) {
            return res.status(400).json({ 
                success: false, 
                message: 'Action must be BUY or SELL' 
            });
        }
        
        // For SELL orders, check if user has enough shares
        if (action.toUpperCase() === 'SELL') {
            const userTrades = await Trade.find({ 
                userId: req.user._id, 
                symbol: symbol.toUpperCase() 
            });
            
            let netShares = 0;
            userTrades.forEach(trade => {
                if (trade.action === 'BUY') {
                    netShares += trade.quantity;
                } else if (trade.action === 'SELL') {
                    netShares -= trade.quantity;
                }
            });
            
            if (netShares < qty) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Insufficient shares. You own ${netShares} shares of ${symbol}` 
                });
            }
        }
        
        // Calculate profit/loss for SELL orders
        let profitLoss = 0;
        if (action.toUpperCase() === 'SELL') {
            // Get user's buy trades for this stock (FIFO method)
            const buyTrades = await Trade.find({ 
                userId: req.user._id, 
                symbol: symbol.toUpperCase(),
                action: 'BUY'
            }).sort({ timestamp: 1 });
            
            // Calculate average buy price
            let totalCost = 0;
            let totalShares = 0;
            
            buyTrades.forEach(trade => {
                totalCost += trade.price * trade.quantity;
                totalShares += trade.quantity;
            });
            
            if (totalShares > 0) {
                const avgBuyPrice = totalCost / totalShares;
                profitLoss = (tradePrice - avgBuyPrice) * qty;
            }
        }
        
        // Create new trade
        const newTrade = new Trade({
            userId: req.user._id,
            symbol: symbol.toUpperCase(),
            companyName: companyName || symbol.toUpperCase(),
            action: action.toUpperCase(),
            quantity: qty,
            price: tradePrice,
            profitLoss: profitLoss,
            timestamp: new Date()
        });
        
        await newTrade.save();
        
        res.json({ 
            success: true, 
            message: `${action.toUpperCase()} order executed successfully`,
            trade: {
                id: newTrade._id,
                symbol: newTrade.symbol,
                action: newTrade.action,
                quantity: newTrade.quantity,
                price: newTrade.price,
                profitLoss: newTrade.profitLoss.toFixed(2),
                timestamp: newTrade.timestamp
            }
        });
        
    } catch (error) {
        console.error('Error simulating trade:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing trade' 
        });
    }
});

// GET /trades/portfolio - Get user's current portfolio
router.get('/portfolio', requireAuth, async (req, res) => {
    try {
        const trades = await Trade.find({ userId: req.user._id });
        
        // Calculate current holdings
        const holdings = {};
        
        trades.forEach(trade => {
            if (!holdings[trade.symbol]) {
                holdings[trade.symbol] = {
                    symbol: trade.symbol,
                    companyName: trade.companyName,
                    quantity: 0,
                    totalCost: 0,
                    averagePrice: 0
                };
            }
            
            if (trade.action === 'BUY') {
                holdings[trade.symbol].quantity += trade.quantity;
                holdings[trade.symbol].totalCost += (trade.price * trade.quantity);
            } else if (trade.action === 'SELL') {
                holdings[trade.symbol].quantity -= trade.quantity;
                // Adjust total cost proportionally
                const sellRatio = trade.quantity / (holdings[trade.symbol].quantity + trade.quantity);
                holdings[trade.symbol].totalCost -= (holdings[trade.symbol].totalCost * sellRatio);
            }
        });
        
        // Calculate average prices and filter out zero holdings
        const portfolio = Object.values(holdings)
            .filter(holding => holding.quantity > 0)
            .map(holding => ({
                ...holding,
                averagePrice: holding.quantity > 0 ? (holding.totalCost / holding.quantity).toFixed(2) : 0
            }));
        
        res.json({ success: true, portfolio });
        
    } catch (error) {
        console.error('Error fetching portfolio:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading portfolio' 
        });
    }
});

// DELETE /trades/:id - Delete a trade (for correction purposes)
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const trade = await Trade.findOne({ 
            _id: req.params.id, 
            userId: req.user._id 
        });
        
        if (!trade) {
            return res.status(404).json({ 
                success: false, 
                message: 'Trade not found' 
            });
        }
        
        await Trade.findByIdAndDelete(req.params.id);
        
        res.json({ 
            success: true, 
            message: 'Trade deleted successfully' 
        });
        
    } catch (error) {
        console.error('Error deleting trade:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting trade' 
        });
    }
});

// GET /trades/stats - Get trading statistics
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const { period = 'all' } = req.query;
        
        // Build date filter
        let dateFilter = {};
        if (period !== 'all') {
            const now = new Date();
            let startDate;
            
            switch (period) {
                case 'today':
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case 'week':
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case 'month':
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case 'year':
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
            }
            
            if (startDate) {
                dateFilter.timestamp = { $gte: startDate };
            }
        }
        
        const trades = await Trade.find({ 
            userId: req.user._id, 
            ...dateFilter 
        });
        
        // Calculate statistics
        const totalTrades = trades.length;
        const totalProfit = trades.reduce((sum, trade) => sum + (trade.profitLoss || 0), 0);
        const winningTrades = trades.filter(trade => (trade.profitLoss || 0) > 0);
        const losingTrades = trades.filter(trade => (trade.profitLoss || 0) < 0);
        
        const stats = {
            totalTrades,
            totalProfit: totalProfit.toFixed(2),
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: totalTrades > 0 ? ((winningTrades.length / totalTrades) * 100).toFixed(1) : 0,
            avgProfit: totalTrades > 0 ? (totalProfit / totalTrades).toFixed(2) : 0,
            bestTrade: trades.length > 0 ? Math.max(...trades.map(t => t.profitLoss || 0)).toFixed(2) : 0,
            worstTrade: trades.length > 0 ? Math.min(...trades.map(t => t.profitLoss || 0)).toFixed(2) : 0
        };
        
        res.json({ success: true, stats });
        
    } catch (error) {
        console.error('Error fetching trading stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading statistics' 
        });
    }
});

module.exports = router;