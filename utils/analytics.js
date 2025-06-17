const moment = require('moment');
const Trade = require('../models/Trade');

const analytics = {
  // Calculate profit/loss for different time periods
 calculateProfitLoss: async (userId, period = 'all') => {
  let startDate;
  const endDate = new Date();

  // Set start date based on period
  switch (period) {
    case 'today':
      startDate = moment().startOf('day').toDate();
      break;
    case 'week':
      startDate = moment().subtract(7, 'days').startOf('day').toDate();
      break;
    case 'month':
      startDate = moment().subtract(1, 'month').startOf('day').toDate();
      break;
    case 'year':
      startDate = moment().subtract(1, 'year').startOf('day').toDate();
      break;
    default:
      startDate = new Date(0); // Beginning of time
  }

  const query = {
    userId,
    tradeDate: { $gte: startDate, $lte: endDate }
  };

  const trades = await Trade.find(query);

  let totalProfit = 0;
  let totalLoss = 0;
  let totalInvestment = 0;
  let totalTrades = trades.length;
  let winningTrades = 0;
  let losingTrades = 0;

  trades.forEach(trade => {
    if (trade.type === 'BUY') {
      totalInvestment += trade.totalAmount;
    } else if (trade.type === 'SELL') {
      if (trade.profitLoss > 0) {
        totalProfit += trade.profitLoss;
        winningTrades++;
      } else {
        totalLoss += Math.abs(trade.profitLoss);
        losingTrades++;
      }
    }
  });

  const netProfit = totalProfit - totalLoss;
  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;
  const profitMargin = totalInvestment > 0 ? (netProfit / totalInvestment) * 100 : 0;

  return {
    allTime: netProfit,
    totalProfit,
    totalLoss,
    netProfit,
    totalInvestment,
    totalTrades,
    winningTrades,
    losingTrades,
    winRate,
    profitMargin,
    period
  };
},

  // Get portfolio summary
  getPortfolioSummary: async (userId) => {
    const portfolio = await Trade.getUserPortfolio(userId);
    
    let totalValue = 0;
    let totalInvestment = 0;
    let totalUnrealizedPL = 0;

    portfolio.forEach(position => {
      totalInvestment += position.totalInvestment;
      // Note: We'll need current prices to calculate current value
      // This will be updated when we integrate with the stock API
    });

    return {
      totalPositions: portfolio.length,
      totalInvestment,
      totalValue,
      totalUnrealizedPL,
      portfolio
    };
  },

  // Calculate performance metrics
  calculatePerformanceMetrics: async (userId, period = 'all') => {
    const profitLoss = await analytics.calculateProfitLoss(userId, period);
    const portfolio = await analytics.getPortfolioSummary(userId);

    // Calculate additional metrics
    const totalReturn = profitLoss.totalInvestment > 0 
      ? ((profitLoss.netProfit / profitLoss.totalInvestment) * 100) 
      : 0;

    const avgTradeValue = profitLoss.totalTrades > 0 
      ? (profitLoss.totalInvestment / profitLoss.totalTrades) 
      : 0;

    const avgProfit = profitLoss.winningTrades > 0 
      ? (profitLoss.totalProfit / profitLoss.winningTrades) 
      : 0;

    const avgLoss = profitLoss.losingTrades > 0 
      ? (profitLoss.totalLoss / profitLoss.losingTrades) 
      : 0;

    const profitFactor = profitLoss.totalLoss > 0 
      ? (profitLoss.totalProfit / profitLoss.totalLoss) 
      : (profitLoss.totalProfit > 0 ? Infinity : 0);

    return {
      ...profitLoss,
      portfolio,
      totalReturn,
      avgTradeValue,
      avgProfit,
      avgLoss,
      profitFactor
    };
  },

  // Filter trades by date range
  filterTradesByDate: async (userId, startDate, endDate) => {
    const trades = await Trade.find({
      userId,
      tradeDate: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ tradeDate: -1 });

    return trades;
  },

  // Filter trades by symbol
  filterTradesBySymbol: async (userId, symbol) => {
    const trades = await Trade.find({
      userId,
      symbol: symbol.toUpperCase()
    }).sort({ tradeDate: -1 });

    return trades;
  },

  // Get top performing stocks
  getTopPerformers: async (userId, limit = 5) => {
    const trades = await Trade.find({ 
      userId, 
      type: 'SELL',
      profitLoss: { $gt: 0 }
    }).sort({ profitLoss: -1 }).limit(limit);

    return trades;
  },

  // Get worst performing stocks
  getWorstPerformers: async (userId, limit = 5) => {
    const trades = await Trade.find({ 
      userId, 
      type: 'SELL',
      profitLoss: { $lt: 0 }
    }).sort({ profitLoss: 1 }).limit(limit);

    return trades;
  },

  // Calculate monthly performance for charts
  getMonthlyPerformance: async (userId, months = 12) => {
    const monthlyData = [];
    
    for (let i = months - 1; i >= 0; i--) {
      const startDate = moment().subtract(i, 'months').startOf('month').toDate();
      const endDate = moment().subtract(i, 'months').endOf('month').toDate();
      
      const monthTrades = await Trade.find({
        userId,
        tradeDate: { $gte: startDate, $lte: endDate }
      });

      let monthProfit = 0;
      monthTrades.forEach(trade => {
        if (trade.type === 'SELL') {
          monthProfit += trade.profitLoss;
        }
      });

      monthlyData.push({
        month: moment().subtract(i, 'months').format('MMM YYYY'),
        profit: monthProfit,
        trades: monthTrades.length
      });
    }

    return monthlyData;
  },

  // Format currency
  formatCurrency: (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  },

  // Format percentage
  formatPercentage: (percentage) => {
    return `${percentage >= 0 ? '+' : ''}${percentage.toFixed(2)}%`;
  }
};

module.exports = analytics;