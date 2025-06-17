const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Trade = require('../models/Trade');
const { requireAuth } = require('../middleware/authMiddleware');
const bcrypt = require('bcrypt');

const multer = require('multer');
const path = require('path');

// Set up multer storage
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, req.session.userId + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.post('/upload-image', requireAuth, upload.single('profileImage'), async (req, res) => {
    try {
        const imagePath = '/uploads/' + req.file.filename;
        await User.findByIdAndUpdate(req.session.userId, { profileImage: imagePath });
        res.json({ success: true, imagePath });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ success: false, message: 'Image upload failed' });
    }
});

// GET profile page
router.get('/', requireAuth, async (req, res) => {
    console.log('Rendering profile with:', {
        userId: req.session.userId
    });
    try {
        const user = await User.findById(req.session.userId);
        
        // Get user statistics
        const stats = await getUserStats(req.session.userId);
        
        // Get recent trades (last 10)
        const recentTrades = await Trade.find({ userId: req.session.userId })
            .sort({ date: -1 })
            .limit(10)
            .lean();

        res.render('profile', {
            user,
            stats,
            recentTrades,
            title: 'Profile - StockSage'
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', { 
            message: 'Error loading profile page',
            title: 'Error - StockSage'
        });
    }
});

// POST update profile
router.post('/update', requireAuth, async (req, res) => {
    try {
        const { name, email, phone, experienceLevel, bio } = req.body;
        
        // Validate required fields
        if (!name || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name and email are required'
            });
        }

        // Check if email is already taken by another user
        const existingUser = await User.findOne({ 
            email: email.toLowerCase(),
            _id: { $ne: req.session.userId }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered to another account'
            });
        }

        // Update user profile
        const updatedUser = await User.findByIdAndUpdate(
            req.session.userId,
            {
                name: name.trim(),
                email: email.toLowerCase().trim(),
                phone: phone ? phone.trim() : null,
                experienceLevel: experienceLevel || 'beginner',
                bio: bio ? bio.trim() : null,
                updatedAt: new Date()
            },
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            message: 'Profile updated successfully',
            user: {
                name: updatedUser.name,
                email: updatedUser.email,
                phone: updatedUser.phone,
                experienceLevel: updatedUser.experienceLevel,
                bio: updatedUser.bio
            }
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        
        if (error.name === 'ValidationError') {
            const errorMessages = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: errorMessages.join(', ')
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating profile. Please try again.'
        });
    }
});

// POST change password
router.post('/change-password', requireAuth, async (req, res) => {
    try {
        const { currentPassword, newPassword, confirmPassword } = req.body;

        // Validate input
        if (!currentPassword || !newPassword || !confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'All password fields are required'
            });
        }

        if (newPassword !== confirmPassword) {
            return res.status(400).json({
                success: false,
                message: 'New passwords do not match'
            });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'New password must be at least 6 characters long'
            });
        }

        // Get user and verify current password
        const user = await User.findById(req.session.userId);
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password and update
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        await User.findByIdAndUpdate(req.session.userId, {
            password: hashedNewPassword,
            updatedAt: new Date()
        });

        res.json({
            success: true,
            message: 'Password changed successfully'
        });

    } catch (error) {
        console.error('Error changing password:', error);
        res.status(500).json({
            success: false,
            message: 'Error changing password. Please try again.'
        });
    }
});

// POST delete account
router.post('/delete', requireAuth, async (req, res) => {
    try {
        const userId = req.session.userId;

        // Delete all user trades
        await Trade.deleteMany({ userId });

        // Delete user account
        await User.findByIdAndDelete(userId);

        // Destroy session
        req.session.destroy((err) => {
            if (err) {
                console.error('Error destroying session:', err);
            }
        });

        res.redirect('/auth/login?message=Account deleted successfully');

    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).render('error', {
            message: 'Error deleting account. Please try again.',
            title: 'Error - StockSage'
        });
    }
});

// Helper function to get user statistics
async function getUserStats(userId) {
    try {
        const trades = await Trade.find({ userId }).lean();
        const user = await User.findById(userId).lean();

        // Calculate total trades
        const totalTrades = trades.length;

        // Calculate watchlist count
        const watchlistCount = user.watchlist ? user.watchlist.length : 0;

        // Calculate total profit/loss
        const totalProfit = trades.reduce((sum, trade) => {
            return sum + (trade.profit || 0);
        }, 0);

        // Calculate win rate
        const profitableTrades = trades.filter(trade => (trade.profit || 0) > 0).length;
        const winRate = totalTrades > 0 ? Math.round((profitableTrades / totalTrades) * 100) : 0;

        // Calculate monthly profit
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const monthlyTrades = trades.filter(trade => new Date(trade.date) >= oneMonthAgo);
        const monthlyProfit = monthlyTrades.reduce((sum, trade) => {
            return sum + (trade.profit || 0);
        }, 0);

        // Calculate weekly profit
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weeklyTrades = trades.filter(trade => new Date(trade.date) >= oneWeekAgo);
        const weeklyProfit = weeklyTrades.reduce((sum, trade) => {
            return sum + (trade.profit || 0);
        }, 0);

        // Calculate today's profit
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTrades = trades.filter(trade => {
            const tradeDate = new Date(trade.date);
            tradeDate.setHours(0, 0, 0, 0);
            return tradeDate.getTime() === today.getTime();
        });
        
        const todayProfit = todayTrades.reduce((sum, trade) => {
            return sum + (trade.profit || 0);
        }, 0);

        return {
            totalTrades,
            watchlistCount,
            totalProfit: Math.round(totalProfit * 100) / 100,
            monthlyProfit: Math.round(monthlyProfit * 100) / 100,
            weeklyProfit: Math.round(weeklyProfit * 100) / 100,
            todayProfit: Math.round(todayProfit * 100) / 100,
            winRate
        };

    } catch (error) {
        console.error('Error calculating user stats:', error);
        return {
            totalTrades: 0,
            watchlistCount: 0,
            totalProfit: 0,
            monthlyProfit: 0,
            weeklyProfit: 0,
            todayProfit: 0,
            winRate: 0
        };
    }
}

module.exports = router;