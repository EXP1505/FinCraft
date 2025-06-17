const mongoose = require('mongoose');

const tradeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  companyName: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  tradeDate: {
    type: Date,
    default: Date.now
  },
  // For calculating profit/loss when selling
  buyPrice: {
    type: Number
  },
  sellPrice: {
    type: Number
  },
  profitLoss: {
    type: Number,
    default: 0
  },
  profitLossPercentage: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['OPEN', 'CLOSED'],
    default: 'OPEN'
  },
  notes: {
    type: String,
    trim: true
  }
}, {
  timestamps: true
});

// Calculate profit/loss
tradeSchema.methods.calculateProfitLoss = function(currentPrice) {
  if (this.type === 'BUY') {
    // For buy orders, calculate unrealized profit/loss
    const currentValue = currentPrice * this.quantity;
    const profitLoss = currentValue - this.totalAmount;
    const profitLossPercentage = ((currentPrice - this.price) / this.price) * 100;
    
    return {
      profitLoss: profitLoss,
      profitLossPercentage: profitLossPercentage,
      currentValue: currentValue
    };
  } else {
    // For sell orders, profit/loss is already calculated
    return {
      profitLoss: this.profitLoss,
      profitLossPercentage: this.profitLossPercentage,
      currentValue: this.totalAmount
    };
  }
};

// Static method to get user's portfolio
tradeSchema.statics.getUserPortfolio = async function(userId) {
  const trades = await this.find({ userId }).sort({ tradeDate: -1 });
  
  // Group trades by symbol
  const portfolio = {};
  
  trades.forEach(trade => {
    if (!portfolio[trade.symbol]) {
      portfolio[trade.symbol] = {
        symbol: trade.symbol,
        companyName: trade.companyName,
        totalQuantity: 0,
        totalInvestment: 0,
        avgPrice: 0,
        trades: []
      };
    }
    
    const position = portfolio[trade.symbol];
    
    if (trade.type === 'BUY') {
      position.totalQuantity += trade.quantity;
      position.totalInvestment += trade.totalAmount;
    } else {
      position.totalQuantity -= trade.quantity;
      position.totalInvestment -= (trade.quantity * position.avgPrice);
    }
    
    // Calculate average price
    if (position.totalQuantity > 0) {
      position.avgPrice = position.totalInvestment / position.totalQuantity;
    }
    
    position.trades.push(trade);
  });
  
  // Filter out positions with zero quantity
  const activePositions = Object.values(portfolio).filter(pos => pos.totalQuantity > 0);
  
  return activePositions;
};

module.exports = mongoose.model('Trade', tradeSchema);