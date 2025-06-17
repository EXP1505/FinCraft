const express = require('express');
const router = express.Router();
const Broker = require('../models/Broker');
const { requireAuth } = require('../middleware/authMiddleware');

// GET /brokers - Display all brokers/financial advisors
router.get('/', requireAuth, async (req, res) => {
    try {
        const { specialty, experience, rating, sort = 'rating' } = req.query;
        
        // Build query filter
        let query = { isActive: true };
        
        // Filter by specialty
        if (specialty && specialty !== 'all') {
            query.specialties = { $in: [specialty] };
        }
        
        // Filter by minimum experience
        if (experience) {
            query.yearsExperience = { $gte: parseInt(experience) };
        }
        
        // Filter by minimum rating
        if (rating) {
            query.rating = { $gte: parseFloat(rating) };
        }
        
        // Sort options
        let sortOption = {};
        switch (sort) {
            case 'rating':
                sortOption = { rating: -1, reviewCount: -1 };
                break;
            case 'experience':
                sortOption = { yearsExperience: -1 };
                break;
            case 'name':
                sortOption = { name: 1 };
                break;
            case 'fee':
                sortOption = { hourlyRate: 1 };
                break;
            default:
                sortOption = { rating: -1 };
        }
        
        const brokers = await Broker.find(query).sort(sortOption);
        
        // Get unique specialties for filter dropdown
        const allBrokers = await Broker.find({ isActive: true });
        const specialties = [...new Set(allBrokers.flatMap(broker => broker.specialties))].sort();
        
        res.render('brokers', {
            title: 'Financial Advisors & Brokers',
            user: req.user,
            brokers,
            specialties,
            filters: { specialty, experience, rating, sort },
            totalBrokers: brokers.length
        });
        
    } catch (error) {
        console.error('Error fetching brokers:', error);
        res.status(500).render('error', { 
            message: 'Error loading brokers', 
            user: req.user 
        });
    }
});

// GET /brokers/:id - Individual broker profile
router.get('/:id', requireAuth, async (req, res) => {
    try {
        const broker = await Broker.findById(req.params.id);
        
        if (!broker) {
            return res.status(404).render('error', { 
                message: 'Broker not found', 
                user: req.user 
            });
        }
        
        // Get similar brokers (same specialties)
        const similarBrokers = await Broker.find({
            _id: { $ne: broker._id },
            specialties: { $in: broker.specialties },
            isActive: true
        })
        .sort({ rating: -1 })
        .limit(3);
        
        res.render('broker-profile', {
            user: req.user,
            broker,
            similarBrokers
        });
        
    } catch (error) {
        console.error('Error fetching broker profile:', error);
        res.status(500).render('error', { 
            message: 'Error loading broker profile', 
            user: req.user 
        });
    }
});

// POST /brokers/contact - Contact a broker (simulation)
router.post('/contact', requireAuth, async (req, res) => {
    try {
        const { brokerId, message, contactMethod, preferredTime } = req.body;
        
        // Validate input
        if (!brokerId || !message || !contactMethod) {
            return res.status(400).json({
                success: false,
                message: 'Missing required fields'
            });
        }
        
        const broker = await Broker.findById(brokerId);
        if (!broker) {
            return res.status(404).json({
                success: false,
                message: 'Broker not found'
            });
        }
        
        // Simulate contact request (in a real app, this would send email/notification)
        const contactRequest = {
            userId: req.user._id,
            userName: req.user.name,
            userEmail: req.user.email,
            brokerId: broker._id,
            brokerName: broker.name,
            message: message.trim(),
            contactMethod,
            preferredTime,
            timestamp: new Date(),
            status: 'pending'
        };
        
        // In a real application, you might save this to a ContactRequest model
        // For now, we'll just simulate success
        
        res.json({
            success: true,
            message: `Your message has been sent to ${broker.name}. They will contact you within 24 hours.`,
            contactRequest: {
                brokerName: broker.name,
                contactMethod,
                timestamp: contactRequest.timestamp
            }
        });
        
    } catch (error) {
        console.error('Error processing contact request:', error);
        res.status(500).json({
            success: false,
            message: 'Error sending contact request'
        });
    }
});

// GET /brokers/search/suggestions - Get broker search suggestions
router.get('/search/suggestions', requireAuth, async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.length < 2) {
            return res.json({ suggestions: [] });
        }
        
        const searchRegex = new RegExp(q, 'i');
        
        const brokers = await Broker.find({
            $or: [
                { name: searchRegex },
                { specialties: { $in: [searchRegex] } },
                { location: searchRegex }
            ],
            isActive: true
        })
        .select('name specialties location rating')
        .limit(5);
        
        const suggestions = brokers.map(broker => ({
            id: broker._id,
            name: broker.name,
            specialties: broker.specialties.join(', '),
            location: broker.location,
            rating: broker.rating
        }));
        
        res.json({ suggestions });
        
    } catch (error) {
        console.error('Error fetching broker suggestions:', error);
        res.status(500).json({ suggestions: [] });
    }
});

// POST /brokers/review - Add a review for a broker (simulation)
router.post('/review', requireAuth, async (req, res) => {
    try {
        const { brokerId, rating, comment } = req.body;
        
        // Validate input
        if (!brokerId || !rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: 'Invalid rating. Must be between 1 and 5.'
            });
        }
        
        const broker = await Broker.findById(brokerId);
        if (!broker) {
            return res.status(404).json({
                success: false,
                message: 'Broker not found'
            });
        }
        
        // Simulate adding review (in real app, you'd have a Review model)
        const newReview = {
            userId: req.user._id,
            userName: req.user.name,
            rating: parseInt(rating),
            comment: comment ? comment.trim() : '',
            timestamp: new Date()
        };
        
        // Update broker's rating (simplified calculation)
        const currentRating = broker.rating || 0;
        const currentReviewCount = broker.reviewCount || 0;
        const newReviewCount = currentReviewCount + 1;
        const newRating = ((currentRating * currentReviewCount) + parseInt(rating)) / newReviewCount;
        
        await Broker.findByIdAndUpdate(brokerId, {
            rating: Math.round(newRating * 10) / 10, // Round to 1 decimal place
            reviewCount: newReviewCount
        });
        
        res.json({
            success: true,
            message: 'Thank you for your review!',
            review: newReview
        });
        
    } catch (error) {
        console.error('Error adding review:', error);
        res.status(500).json({
            success: false,
            message: 'Error submitting review'
        });
    }
});

// GET /brokers/featured - Get featured brokers for homepage/dashboard
router.get('/featured', requireAuth, async (req, res) => {
    try {
        const featuredBrokers = await Broker.find({
            isActive: true,
            rating: { $gte: 4.0 }
        })
        .sort({ rating: -1, reviewCount: -1 })
        .limit(6);
        
        res.json({
            success: true,
            brokers: featuredBrokers
        });
        
    } catch (error) {
        console.error('Error fetching featured brokers:', error);
        res.status(500).json({
            success: false,
            message: 'Error loading featured brokers'
        });
    }
});

// Initialize brokers if none exist (for development)
router.post('/initialize', requireAuth, async (req, res) => {
    try {
        const count = await Broker.countDocuments();
        if (count > 0) {
            return res.json({ message: 'Brokers already exist' });
        }
        
        const sampleBrokers = [
            {
                name: 'Sarah Johnson',
                email: 'sarah.johnson@example.com',
                phone: '+1 (555) 123-4567',
                specialties: ['Stock Analysis', 'Portfolio Management', 'Risk Assessment'],
                yearsExperience: 8,
                location: 'New York, NY',
                bio: 'Experienced financial advisor specializing in growth stocks and portfolio optimization. Helped over 200 clients achieve their financial goals.',
                rating: 4.8,
                reviewCount: 47,
                hourlyRate: 150,
                availability: ['Monday', 'Tuesday', 'Wednesday', 'Friday'],
                certifications: ['CFA', 'CFP'],
                profileImage: '/images/brokers/sarah-johnson.jpg',
                isActive: true
            },
            {
                name: 'Michael Chen',
                email: 'michael.chen@example.com',
                phone: '+1 (555) 234-5678',
                specialties: ['Day Trading', 'Technical Analysis', 'Cryptocurrency'],
                yearsExperience: 12,
                location: 'San Francisco, CA',
                bio: 'Former Wall Street trader with expertise in high-frequency trading and market analysis. Specializes in helping active traders maximize returns.',
                rating: 4.6,
                reviewCount: 89,
                hourlyRate: 200,
                availability: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
                certifications: ['CFA', 'FRM'],
                profileImage: '/images/brokers/michael-chen.jpg',
                isActive: true
            },
            {
                name: 'Emily Rodriguez',
                email: 'emily.rodriguez@example.com',
                phone: '+1 (555) 345-6789',
                specialties: ['Retirement Planning', 'Index Funds', 'Long-term Investing'],
                yearsExperience: 6,
                location: 'Chicago, IL',
                bio: 'Passionate about helping young professionals build wealth through smart, long-term investment strategies.',
                rating: 4.9,
                reviewCount: 63,
                hourlyRate: 120,
                availability: ['Tuesday', 'Wednesday', 'Thursday', 'Saturday'],
                certifications: ['CFP', 'CPA'],
                profileImage: '/images/brokers/emily-rodriguez.jpg',
                isActive: true
            },
            {
                name: 'David Thompson',
                email: 'david.thompson@example.com',
                phone: '+1 (555) 456-7890',
                specialties: ['Options Trading', 'Derivatives', 'Risk Management'],
                yearsExperience: 15,
                location: 'Boston, MA',
                bio: 'Senior financial advisor with deep expertise in complex financial instruments and risk management strategies.',
                rating: 4.4,
                reviewCount: 112,
                hourlyRate: 250,
                availability: ['Monday', 'Wednesday', 'Friday'],
                certifications: ['CFA', 'FRM', 'PRM'],
                profileImage: '/images/brokers/david-thompson.jpg',
                isActive: true
            },
            {
                name: 'Lisa Wang',
                email: 'lisa.wang@example.com',
                phone: '+1 (555) 567-8901',
                specialties: ['ESG Investing', 'Sustainable Finance', 'Green Bonds'],
                yearsExperience: 7,
                location: 'Seattle, WA',
                bio: 'Specialist in environmental, social, and governance (ESG) investing. Helping clients align their investments with their values.',
                rating: 4.7,
                reviewCount: 34,
                hourlyRate: 140,
                availability: ['Tuesday', 'Thursday', 'Friday', 'Saturday'],
                certifications: ['CFA', 'ESG Certificate'],
                profileImage: '/images/brokers/lisa-wang.jpg',
                isActive: true
            }
        ];
        
        await Broker.insertMany(sampleBrokers);
        
        res.json({ 
            success: true, 
            message: `${sampleBrokers.length} sample brokers created successfully` 
        });
        
    } catch (error) {
        console.error('Error initializing brokers:', error);
        res.status(500).json({
            success: false,
            message: 'Error initializing brokers'
        });
    }
});

module.exports = router;