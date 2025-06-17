const mongoose = require('mongoose');

const brokerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  title: {
    type: String,
    required: true,
    trim: true
  },
  company: {
    type: String,
    required: true,
    trim: true
  },
  experience: {
    type: Number,
    required: true,
    min: 0
  },
  specialization: [{
    type: String,
    trim: true
  }],
  rating: {
    type: Number,
    min: 0,
    max: 5,
    default: 0
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    trim: true
  },
  profileImage: {
    type: String,
    default: '/images/default-broker.png'
  },
  bio: {
    type: String,
    trim: true
  },
  location: {
    city: {
      type: String,
      trim: true
    },
    state: {
      type: String,
      trim: true
    },
    country: {
      type: String,
      trim: true,
      default: 'USA'
    }
  },
  services: [{
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    price: {
      type: Number,
      min: 0
    }
  }],
  certifications: [{
    name: {
      type: String,
      required: true
    },
    issuedBy: {
      type: String
    },
    year: {
      type: Number
    }
  }],
  availability: {
    type: String,
    enum: ['Available', 'Busy', 'Unavailable'],
    default: 'Available'
  },
  commissionRate: {
    type: Number,
    min: 0,
    max: 100,
    default: 2.5
  },
  minimumInvestment: {
    type: Number,
    min: 0,
    default: 1000
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Virtual for full location
brokerSchema.virtual('fullLocation').get(function() {
  const parts = [];
  if (this.location.city) parts.push(this.location.city);
  if (this.location.state) parts.push(this.location.state);
  if (this.location.country) parts.push(this.location.country);
  return parts.join(', ');
});

// Static method to get top-rated brokers
brokerSchema.statics.getTopRated = function(limit = 5) {
  return this.find({ isActive: true })
    .sort({ rating: -1, reviewCount: -1 })
    .limit(limit);
};

// Static method to search brokers
brokerSchema.statics.searchBrokers = function(query) {
  return this.find({
    isActive: true,
    $or: [
      { name: { $regex: query, $options: 'i' } },
      { company: { $regex: query, $options: 'i' } },
      { specialization: { $in: [new RegExp(query, 'i')] } },
      { 'location.city': { $regex: query, $options: 'i' } },
      { 'location.state': { $regex: query, $options: 'i' } }
    ]
  }).sort({ rating: -1 });
};

// Ensure virtual fields are serialized
brokerSchema.set('toJSON', {
  virtuals: true
});

module.exports = mongoose.model('Broker', brokerSchema);