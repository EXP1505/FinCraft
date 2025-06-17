const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/authMiddleware');

// Subscription plans configuration
const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free',
        price: 0,
        duration: 'forever',
        features: [
            'Basic stock tracking',
            'Simple trade simulation',
            'Limited watchlist (5 stocks)',
            'Basic analytics',
            'Community support'
        ],
        limits: {
            watchlistSize: 5,
            tradesPerMonth: 50,
            realtimeData: false,
            advancedCharts: false
        }
    },
    basic: {
        name: 'Basic',
        price: 9.99,
        duration: 'month',
        features: [
            'Everything in Free',
            'Unlimited watchlist',
            'Real-time stock data',
            'Advanced charts',
            'Email alerts',
            'Basic broker access'
        ],
        limits: {
            watchlistSize: -1, // unlimited
            tradesPerMonth: 200,
            realtimeData: true,
            advancedCharts: true
        },
        popular: false
    },
    pro: {
        name: 'Pro',
        price: 19.99,
        duration: 'month',
        features: [
            'Everything in Basic',
            'Unlimited trades',
            'Advanced analytics',
            'Portfolio optimization',
            'Priority broker access',
            'API access',
            'Custom alerts'
        ],
        limits: {
            watchlistSize: -1,
            tradesPerMonth: -1, // unlimited
            realtimeData: true,
            advancedCharts: true
        },
        popular: true
    },
    enterprise: {
        name: 'Enterprise',
        price: 49.99,
        duration: 'month',
        features: [
            'Everything in Pro',
            'White-label solution',
            'Dedicated account manager',
            'Custom integrations',
            'Priority support',
            'Advanced reporting',
            'Multi-user management'
        ],
        limits: {
            watchlistSize: -1,
            tradesPerMonth: -1,
            realtimeData: true,
            advancedCharts: true
        },
        popular: false
    }
};

// GET /payment - Display subscription plans
router.get('/', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        res.render('payment', {
            title: 'Payment - StockSage',
            user,
            plans: SUBSCRIPTION_PLANS,
            currentPlan: user.subscription || 'free'
        });
        
    } catch (error) {
        console.error('Error loading payment page:', error);
        res.status(500).render('error', { 
            title: 'Error - StockSage',
            message: 'Error loading payment page', 
            user: req.user || null,
            error: {}
        });
    }
});

// GET /payment/checkout/:plan - Checkout page for specific plan
router.get('/checkout/:plan', requireAuth, async (req, res) => {
    try {
        const planName = req.params.plan;
        const plan = SUBSCRIPTION_PLANS[planName];
        
        if (!plan) {
            return res.status(404).render('error', { 
                message: 'Plan not found', 
                user: req.user || null,
                error: {}
            });
        }
        
        if (planName === 'free') {
            return res.redirect('/payment');
        }
        
        const user = await User.findById(req.user._id);
        
        res.render('checkout', {
            user,
            plan: { ...plan, id: planName },
            total: plan.price,
            tax: (plan.price * 0.08).toFixed(2), // 8% tax
            finalTotal: (plan.price * 1.08).toFixed(2)
        });
        
    } catch (error) {
        console.error('Error loading checkout page:', error);
        res.status(500).render('error', { 
            title: 'Error - StockSage',
            message: 'Error loading checkout page', 
            user: req.user || null,
            error: {}
        });
    }
});

// POST /payment/process - Process payment (simulation)
router.post('/process', requireAuth, async (req, res) => {
    try {
        const { 
            planId, 
            cardNumber, 
            cardExpiry, 
            cardCvc, 
            cardName,
            billingAddress,
            billingCity,
            billingState,
            billingZip,
            paymentMethod = 'card'
        } = req.body;
        
        // Validate plan
        const plan = SUBSCRIPTION_PLANS[planId];
        if (!plan) {
            return res.status(400).json({
                success: false,
                message: 'Invalid subscription plan',
                error: {}
            });
        }
        
        // Validate payment method
        if (paymentMethod === 'card') {
            // Basic card validation (in real app, use proper validation)
            if (!cardNumber || !cardExpiry || !cardCvc || !cardName) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required card information',
                    error: {}
                });
            }
            
            // Simulate card validation
            const cleanCardNumber = cardNumber.replace(/\s/g, '');
            if (cleanCardNumber.length < 13 || cleanCardNumber.length > 19) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid card number',
                    error: {}
                });
            }
            
            // Simulate declined card (for demo purposes)
            if (cleanCardNumber.endsWith('0000')) {
                return res.status(400).json({
                    success: false,
                    message: 'Payment declined. Please try a different card.',
                    error: {}
                });
            }
        }
        
        // Calculate subscription dates
        const now = new Date();
        let expiryDate;
        
        if (plan.duration === 'month') {
            expiryDate = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        } else if (plan.duration === 'year') {
            expiryDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());
        } else {
            expiryDate = null; // Forever (free plan)
        }
        
        // Update user subscription
        const updateData = {
            subscription: planId,
            subscriptionExpiry: expiryDate,
            subscriptionStatus: 'active'
        };
        
        await User.findByIdAndUpdate(req.user._id, updateData);
        
        // Simulate payment processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Generate mock transaction ID
        const transactionId = 'TXN_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        // Create mock payment record (in real app, save to database)
        const paymentRecord = {
            userId: req.user._id,
            transactionId,
            planId,
            planName: plan.name,
            amount: plan.price,
            tax: (plan.price * 0.08).toFixed(2),
            total: (plan.price * 1.08).toFixed(2),
            paymentMethod,
            status: 'completed',
            timestamp: now,
            billingInfo: {
                name: cardName,
                address: billingAddress,
                city: billingCity,
                state: billingState,
                zip: billingZip
            }
        };
        
        res.json({
            success: true,
            message: 'Payment processed successfully',
            transactionId,
            planName: plan.name,
            amount: plan.price,
            redirectUrl: `/payment/success?txn=${transactionId}`
        });
        
    } catch (error) {
        console.error('Error processing payment:', error);
        res.status(500).json({
            success: false,
            message: 'Payment processing error. Please try again.',
            error: {}
        });
    }
});

// GET /payment/success - Payment success page
router.get('/success', requireAuth, async (req, res) => {
    try {
        const { txn } = req.query;
        
        if (!txn) {
            return res.redirect('/payment');
        }
        
        const user = await User.findById(req.user._id);
        const currentPlan = SUBSCRIPTION_PLANS[user.subscription || 'free'];
        
        res.render('payment-success', {
            user,
            transactionId: txn,
            plan: currentPlan,
            subscriptionExpiry: user.subscriptionExpiry
        });
        
    } catch (error) {
        console.error('Error loading success page:', error);
        res.status(500).render('error', { 
            title: 'Error - StockSage',
            message: 'Error loading success page', 
            user: req.user || null,
            error: {}
        });
    }
});

// POST /payment/cancel - Cancel subscription
router.post('/cancel', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        if (user.subscription === 'free') {
            return res.status(400).json({
                success: false,
                message: 'No active subscription to cancel',
                error: {}
            });
        }
        
        // Set subscription to expire at the end of current period
        await User.findByIdAndUpdate(req.user._id, {
            subscriptionStatus: 'cancelled',
            // Keep subscription active until expiry date
        });
        
        res.json({
            success: true,
            message: 'Subscription cancelled. You will retain access until the end of your current billing period.',
            expiryDate: user.subscriptionExpiry
        });
        
    } catch (error) {
        console.error('Error cancelling subscription:', error);
        res.status(500).json({
            success: false,
            message: 'Error cancelling subscription',
            error: {}
        });
    }
});

// GET /payment/invoice/:transactionId - Generate invoice (simulation)
router.get('/invoice/:transactionId', requireAuth, async (req, res) => {
    try {
        const { transactionId } = req.params;
        
        // In a real app, you'd fetch this from a payments database
        const mockInvoice = {
            transactionId,
            invoiceNumber: `INV-${Date.now()}`,
            date: new Date(),
            user: req.user,
            planName: 'Pro Plan',
            amount: 19.99,
            tax: 1.60,
            total: 21.59,
            status: 'paid'
        };
        
        res.render('invoice', {
            user: req.user,
            invoice: mockInvoice
        });
        
    } catch (error) {
        console.error('Error generating invoice:', error);
        res.status(500).render('error', {
            title: 'Error - StockSage', 
            message: 'Error generating invoice', 
            user: req.user || null,
            error: {}
        });
    }
});

// GET /payment/billing - Billing history
router.get('/billing', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        
        // Mock billing history (in real app, fetch from database)
        const mockBillingHistory = [
            {
                id: 1,
                date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
                description: 'Pro Plan - Monthly',
                amount: 19.99,
                status: 'paid',
                transactionId: 'TXN_1234567890'
            },
            {
                id: 2,
                date: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
                description: 'Basic Plan - Monthly',
                amount: 9.99,
                status: 'paid',
                transactionId: 'TXN_0987654321'
            }
        ];
        
        res.render('billing', {
            user,
            billingHistory: mockBillingHistory,
            currentPlan: SUBSCRIPTION_PLANS[user.subscription || 'free']
        });
        
    } catch (error) {
        console.error('Error loading billing page:', error);
        res.status(500).render('error', {
            title: 'Error - StockSage', 
            message: 'Error loading billing page', 
            user: req.user || null,
            error: {}
        });
    }
});

// GET /payment/plans/compare - Compare plans
router.get('/plans/compare', requireAuth, async (req, res) => {
    try {
        res.render('plans-compare', {
            title: 'Error - StockSage',
            user: req.user,
            plans: SUBSCRIPTION_PLANS
        });
        
    } catch (error) {
        console.error('Error loading plans comparison:', error);
        res.status(500).render('error', {
            title: 'Error - StockSage', 
            message: 'Error loading plans comparison', 
            user: req.user || null,
            error: {}
        });
    }
});

// Middleware to check subscription limits
const checkSubscriptionLimits = async (req, res, next) => {
    try {
        const user = await User.findById(req.user._id);
        const plan = SUBSCRIPTION_PLANS[user.subscription || 'free'];
        
        req.subscriptionLimits = plan.limits;
        req.currentPlan = plan;
        
        next();
    } catch (error) {
        console.error('Error checking subscription limits:', error);
        next(error);
    }
};

module.exports = router;