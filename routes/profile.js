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
        // Use req.session.user.id instead of req.session.userId
        cb(null, req.session.user.id + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

router.post('/upload-image', requireAuth, upload.single('profileImage'), async (req, res) => {
    try {
        const imagePath = '/uploads/' + req.file.filename;
        // Fixed: Use req.session.user.id instead of req.session.userId
        await User.findByIdAndUpdate(req.session.user.id, { profileImage: imagePath });
        res.json({ success: true, imagePath });
    } catch (error) {
        console.error('Error uploading image:', error);
        res.status(500).json({ success: false, message: 'Image upload failed' });
    }
});

// GET profile page
router.get('/', requireAuth, async (req, res) => {
    try {
        // Since requireAuth middleware already fetches the user, we can use req.user
        const user = req.user || await User.findById(req.session.user.id||req.session.user._id);
        
        // Get user statistics - Fixed: Use req.session.user.id
        const stats = await getUserStats(req.session.user.id||req.session.user._id);
        
        // Get recent trades (last 10) - Fixed: Use req.session.user.id
        const userId = req.session.user._id || req.session.user.id;

        if (!userId) {
            return res.redirect('/login');
        }

        // FIXED: Actually fetch the recent trades
        const recentTrades = await Trade.find({ userId })
            .sort({ tradeDate: -1 })
            .limit(10)
            .lean();
        // Debug: Log the structure of the first trade to understand the data format
        if (recentTrades.length > 0) {
            console.log('Sample trade structure:', JSON.stringify(recentTrades[0], null, 2));
        }

        res.render('profile', {
            user,
            stats,
            recentTrades, // This was missing before
            title: 'Profile - Fincraft'
        });
    } catch (error) {
        console.error('Error loading profile:', error);
        res.status(500).render('error', { 
            message: 'Error loading profile page',
            title: 'Error - Fincraft',
            error: process.env.NODE_ENV === 'development' ? error : {} // FIXED: Added error object
        });
    }
});

// POST update profile - FIXED VERSION
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

        // Trim and validate input
        const trimmedName = name.trim();
        const trimmedEmail = email.toLowerCase().trim();

        if (trimmedName.length === 0 || trimmedEmail.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Name and email cannot be empty'
            });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(trimmedEmail)) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a valid email address'
            });
        }

        // Check if email is already taken by another user - Fixed: Use req.session.user.id
        const existingUser = await User.findOne({ 
            email: trimmedEmail,
            _id: { $ne: req.session.user.id }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email is already registered to another account'
            });
        }

        // Prepare update data
        const updateData = {
            name: trimmedName,
            email: trimmedEmail,
            phone: phone ? phone.trim() : null,
            experienceLevel: experienceLevel || 'beginner',
            bio: bio ? bio.trim() : null,
            updatedAt: new Date()
        };

        // Update user profile - Fixed: Use req.session.user.id
        const updatedUser = await User.findByIdAndUpdate(
            req.session.user.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!updatedUser) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Update session data with new information
        req.session.user.email = updatedUser.email;
        // If you have firstName/lastName fields, update them too
        if (updatedUser.firstName) req.session.user.firstName = updatedUser.firstName;
        if (updatedUser.lastName) req.session.user.lastName = updatedUser.lastName;

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

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid user ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Error updating profile. Please try again.'
        });
    }
});

// POST change password - Fixed: Use req.session.user.id
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

        // Get user and verify current password - Fixed: Use req.session.user.id
        const user = await User.findById(req.session.user.id);
        const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);

        if (!isCurrentPasswordValid) {
            return res.status(400).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password and update - Fixed: Use req.session.user.id
        const saltRounds = 10;
        const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

        await User.findByIdAndUpdate(req.session.user.id, {
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

// POST delete account - Fixed: Use req.session.user.id
router.post('/delete', requireAuth, async (req, res) => {
    try {
        const userId = req.session.user.id;

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
            title: 'Error - Fincraft',
            error: process.env.NODE_ENV === 'development' ? error : {} // FIXED: Added error object
        });
    }
});

// Helper function to get user statistics - FIXED VERSION
async function getUserStats(userId) {
    try {
        const trades = await Trade.find({ userId }).lean();
        const user = await User.findById(userId).lean();

        // Calculate total trades
        const totalTrades = trades.length;

        // Calculate watchlist count
        const watchlistCount = user.watchlist ? user.watchlist.length : 0;

        // Calculate total profit/loss - FIXED: Use 'profitLoss' instead of 'profit'
        const totalProfit = trades.reduce((sum, trade) => {
            return sum + (trade.profitLoss || 0);
        }, 0);

        // Calculate win rate - FIXED: Use 'profitLoss' instead of 'profit'
        const profitableTrades = trades.filter(trade => (trade.profitLoss || 0) > 0).length;
        const winRate = totalTrades > 0 ? Math.round((profitableTrades / totalTrades) * 100) : 0;

        // Calculate monthly profit - FIXED: Use 'profitLoss' and 'tradeDate'
        const oneMonthAgo = new Date();
        oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
        
        const monthlyTrades = trades.filter(trade => new Date(trade.tradeDate) >= oneMonthAgo);
        const monthlyProfit = monthlyTrades.reduce((sum, trade) => {
            return sum + (trade.profitLoss || 0);
        }, 0);

        // Calculate weekly profit - FIXED: Use 'profitLoss' and 'tradeDate'
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const weeklyTrades = trades.filter(trade => new Date(trade.tradeDate) >= oneWeekAgo);
        const weeklyProfit = weeklyTrades.reduce((sum, trade) => {
            return sum + (trade.profitLoss || 0);
        }, 0);

        // Calculate today's profit - FIXED: Use 'profitLoss' and 'tradeDate'
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const todayTrades = trades.filter(trade => {
            const tradeDate = new Date(trade.tradeDate);
            tradeDate.setHours(0, 0, 0, 0);
            return tradeDate.getTime() === today.getTime();
        });
        
        const todayProfit = todayTrades.reduce((sum, trade) => {
            return sum + (trade.profitLoss || 0);
        }, 0);

        return {
            totalTrades,
            watchlistCount,
            totalProfit: Math.round(totalProfit * 100) / 100,
            totalProfitLoss: Math.round(totalProfit * 100) / 100, // Added this for profile.ejs
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
            totalProfitLoss: 0,
            monthlyProfit: 0,
            weeklyProfit: 0,
            todayProfit: 0,
            winRate: 0
        };
    }
}

module.exports = router;