const express = require('express');
const router = express.Router();
const Trade = require('../models/Trade');
const { requireAuth } = require('../middleware/authMiddleware');
const mongoose = require('mongoose');

// GET /trades - Trade History Page (Root route for /trades)
router.get('/', requireAuth, async (req, res) => {
    try {
        const { stock, period, page = 1 } = req.query;
        const limit = 50;
        const skip = (page - 1) * limit;
        
        // Get user ID from session (matching your server.js pattern)
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.redirect('/auth/login');
        }
        // Convert to ObjectId if needed
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
            
        // Build query filter
        let query = { userId: userObjectId };
        
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
                // Use tradeDate field as per your schema
                query.tradeDate = { $gte: startDate };
            }
        }
        // Get trades - sort by tradeDate (your schema field)
        const trades = await Trade.find(query)
            .sort({ tradeDate: -1, createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();
        
        // Transform trades to match your EJS template expectations
        const transformedTrades = trades.map(trade => ({
            _id: trade._id,
            symbol: trade.symbol,
            companyName: trade.companyName || trade.symbol,
            action: trade.type, // Map 'type' field to 'action' for EJS template
            type: trade.type,
            quantity: trade.quantity,
            price: trade.price,
            profitLoss: trade.profitLoss || 0,
            timestamp: trade.tradeDate, // Map tradeDate to timestamp for EJS template
            tradeDate: trade.tradeDate
        }));
        
        // Get total count for pagination
        const totalTrades = await Trade.countDocuments(query);
        const totalPages = Math.ceil(totalTrades / limit);
        
        // Calculate summary statistics using all trades for this user
        const allUserTrades = await Trade.find({ userId: userObjectId }).lean();

        const totalPnL = allUserTrades.reduce((sum, trade) => {
            const pnl = trade.profitLoss || 0;
            return sum + pnl;
        }, 0);
        
        const totalTradesCount = allUserTrades.length;
        const winningTrades = allUserTrades.filter(trade => (trade.profitLoss || 0) > 0).length;
        const winRate = totalTradesCount > 0 ? ((winningTrades / totalTradesCount) * 100).toFixed(1) : 0;
        
        // Get unique stocks for filter dropdown
        const uniqueStocks = [...new Set(allUserTrades.map(trade => trade.symbol))].sort();
        res.render('history', {
            title: 'Trade History - Fincraft',
            user: req.session.user,
            trades: transformedTrades,
            totalPnL: totalPnL,
            winRate: winRate,
            uniqueStocks: uniqueStocks,
            filters: { stock, period },
            pagination: {
                currentPage: parseInt(page),
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1
            }
        });
        
    } catch (error) {
        console.error('❌ Error fetching trade history:', error);
        res.status(500).render('error', { 
            title: 'Error - Fincraft',
            message: 'Error loading trade history', 
            user: req.session.user,
            error: process.env.NODE_ENV === 'development' ? error : {}
        });
    }
});

// POST /trades/simulate - Create a new trade
router.post('/simulate', requireAuth, async (req, res) => {
    try {
        const { symbol, action, quantity, price, companyName } = req.body;
        
        // Get user ID from session
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        // Validation
        const qty = parseInt(quantity);
        const tradePrice = parseFloat(price);
        
        if (!symbol || !action || isNaN(qty) || qty <= 0 || isNaN(tradePrice) || tradePrice <= 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid trade parameters' 
            });
        }
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        // For SELL orders, check if user has enough shares
        if (action.toUpperCase() === 'SELL') {
            const userTrades = await Trade.find({ 
                userId: userObjectId, 
                symbol: symbol.toUpperCase() 
            }).lean();
            
            let netShares = 0;
            userTrades.forEach(trade => {
                if (trade.type === 'BUY') {
                    netShares += trade.quantity;
                } else if (trade.type === 'SELL') {
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
            const buyTrades = await Trade.find({ 
                userId: userObjectId, 
                symbol: symbol.toUpperCase(),
                type: 'BUY'
            }).sort({ tradeDate: 1 }).lean();
            
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
        
        // Create new trade matching your schema exactly
        const tradeData = {
            userId: userObjectId,
            symbol: symbol.toUpperCase(),
            companyName: companyName || symbol.toUpperCase(),
            type: action.toUpperCase(), // This matches your schema
            quantity: qty,
            price: tradePrice,
            totalAmount: qty * tradePrice, // This matches your schema
            profitLoss: profitLoss,
            profitLossPercentage: tradePrice > 0 ? (profitLoss / (tradePrice * qty)) * 100 : 0,
            tradeDate: new Date(), // This matches your schema
            status: 'OPEN' // Default status from your schema
        };
        
        const newTrade = new Trade(tradeData);
        await newTrade.save();
        
        res.json({ 
            success: true, 
            message: `${action.toUpperCase()} order executed successfully`,
            trade: {
                id: newTrade._id,
                symbol: newTrade.symbol,
                type: newTrade.type,
                quantity: newTrade.quantity,
                price: newTrade.price,
                profitLoss: newTrade.profitLoss.toFixed(2),
                tradeDate: newTrade.tradeDate
            }
        });
        
    } catch (error) {
        console.error('❌ Error simulating trade:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error processing trade: ' + error.message
        });
    }
});

// GET /trades/portfolio - Get user's current portfolio
router.get('/portfolio', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
            
        // Use the static method from your schema
        const portfolio = await Trade.getUserPortfolio(userObjectId);
        
        res.json({ success: true, portfolio });
        
    } catch (error) {
        console.error('❌ Error fetching portfolio:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading portfolio: ' + error.message
        });
    }
});

// DELETE /trades/:id - Delete a trade
router.delete('/:id', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
        const trade = await Trade.findOne({ 
            _id: req.params.id, 
            userId: userObjectId
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
        console.error('❌ Error deleting trade:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error deleting trade: ' + error.message
        });
    }
});

// GET /trades/stats - Get trading statistics
router.get('/stats', requireAuth, async (req, res) => {
    try {
        const { period = 'all' } = req.query;
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'User not authenticated' });
        }
        
        const userObjectId = mongoose.Types.ObjectId.isValid(userId) 
            ? new mongoose.Types.ObjectId(userId) 
            : userId;
        
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
                dateFilter.tradeDate = { $gte: startDate }; // Use tradeDate from your schema
            }
        }
        
        const trades = await Trade.find({ 
            userId: userObjectId, 
            ...dateFilter 
        }).lean();
        
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
        console.error('❌ Error fetching trading stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Error loading statistics: ' + error.message
        });
    }
});

module.exports = router;