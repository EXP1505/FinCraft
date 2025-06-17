const axios = require('axios');

class StockAPI {
    constructor() {
        this.finnhubKey = process.env.FINNHUB_API_KEY;
        this.twelveDataKey = process.env.TWELVE_DATA_API_KEY;
        this.baseURL = 'https://finnhub.io/api/v1';
        this.twelveDataURL = 'https://api.twelvedata.com';
    }

    /**
     * Get real-time stock quote
     * @param {string} symbol - Stock symbol (e.g., 'AAPL')
     * @returns {Object} Current stock data
     */
    async getQuote(symbol) {
        try {
            const response = await axios.get(`${this.baseURL}/quote`, {
                params: {
                    symbol: symbol.toUpperCase(),
                    token: this.finnhubKey
                }
            });

            const data = response.data;
            
            if (data.c === 0) {
                throw new Error('Invalid symbol or market closed');
            }

            return {
                symbol,
                currentPrice: data.c,
                change: data.d,
                changePercent: data.dp,
                high: data.h,
                low: data.l,
                open: data.o,
                previousClose: data.pc,
                timestamp: Date.now()
            };
        } catch (error) {
            console.error(`Error fetching quote for ${symbol}:`, error.message);
            throw new Error(`Failed to fetch stock data for ${symbol}`);
        }
    }

    /**
     * Get historical candlestick data
     * @param {string} symbol - Stock symbol
     * @param {string} resolution - Time resolution (1, 5, 15, 30, 60, D, W, M)
     * @param {number} from - Unix timestamp
     * @param {number} to - Unix timestamp
     * @returns {Object} Historical data
     */
    async getCandles(symbol, resolution = 'D', from, to) {
        try {
            // Default to last 30 days if no dates provided
            if (!from || !to) {
                to = Math.floor(Date.now() / 1000);
                from = to - (30 * 24 * 60 * 60); // 30 days ago
            }

            const response = await axios.get(`${this.baseURL}/stock/candle`, {
                params: {
                    symbol: symbol.toUpperCase(),
                    resolution,
                    from,
                    to,
                    token: this.finnhubKey
                }
            });

            const data = response.data;

            if (data.s === 'no_data') {
                throw new Error('No data available for the specified period');
            }

            return {
                symbol,
                resolution,
                timestamps: data.t,
                open: data.o,
                high: data.h,
                low: data.l,
                close: data.c,
                volume: data.v,
                status: data.s
            };
        } catch (error) {
            console.error(`Error fetching candles for ${symbol}:`, error.message);
            throw new Error(`Failed to fetch historical data for ${symbol}`);
        }
    }

    /**
     * Get stock recommendations
     * @param {string} symbol - Stock symbol
     * @returns {Object} Analyst recommendations
     */
    async getRecommendations(symbol) {
        try {
            const response = await axios.get(`${this.baseURL}/stock/recommendation`, {
                params: {
                    symbol: symbol.toUpperCase(),
                    token: this.finnhubKey
                }
            });

            const data = response.data[0]; // Get latest recommendations

            if (!data) {
                return {
                    symbol,
                    recommendation: 'HOLD',
                    strongBuy: 0,
                    buy: 0,
                    hold: 1,
                    sell: 0,
                    strongSell: 0
                };
            }

            // Determine overall recommendation
            const total = data.strongBuy + data.buy + data.hold + data.sell + data.strongSell;
            const buyScore = (data.strongBuy * 2 + data.buy) / total;
            const sellScore = (data.strongSell * 2 + data.sell) / total;

            let recommendation = 'HOLD';
            if (buyScore > 0.6) recommendation = 'BUY';
            else if (buyScore > 0.8) recommendation = 'STRONG BUY';
            else if (sellScore > 0.6) recommendation = 'SELL';
            else if (sellScore > 0.8) recommendation = 'STRONG SELL';

            return {
                symbol,
                recommendation,
                strongBuy: data.strongBuy,
                buy: data.buy,
                hold: data.hold,
                sell: data.sell,
                strongSell: data.strongSell,
                period: data.period
            };
        } catch (error) {
            console.error(`Error fetching recommendations for ${symbol}:`, error.message);
            return {
                symbol,
                recommendation: 'HOLD',
                strongBuy: 0,
                buy: 0,
                hold: 1,
                sell: 0,
                strongSell: 0
            };
        }
    }

    /**
     * Search for stocks by query
     * @param {string} query - Search term
     * @returns {Array} Array of matching stocks
     */
    async searchStocks(query) {
        try {
            const response = await axios.get(`${this.baseURL}/search`, {
                params: {
                    q: query,
                    token: this.finnhubKey
                }
            });

            return response.data.result.map(stock => ({
                symbol: stock.symbol,
                description: stock.description,
                displaySymbol: stock.displaySymbol,
                type: stock.type
            })).slice(0, 10); // Limit to 10 results
        } catch (error) {
            console.error(`Error searching stocks:`, error.message);
            return [];
        }
    }

    /**
     * Get company profile
     * @param {string} symbol - Stock symbol
     * @returns {Object} Company information
     */
    async getCompanyProfile(symbol) {
        try {
            const response = await axios.get(`${this.baseURL}/stock/profile2`, {
                params: {
                    symbol: symbol.toUpperCase(),
                    token: this.finnhubKey
                }
            });

            const data = response.data;

            return {
                symbol,
                name: data.name,
                country: data.country,
                currency: data.currency,
                exchange: data.exchange,
                industry: data.finnhubIndustry,
                ipo: data.ipo,
                logo: data.logo,
                marketCapitalization: data.marketCapitalization,
                shareOutstanding: data.shareOutstanding,
                ticker: data.ticker,
                weburl: data.weburl
            };
        } catch (error) {
            console.error(`Error fetching company profile for ${symbol}:`, error.message);
            return {
                symbol,
                name: symbol,
                country: 'Unknown',
                currency: 'USD',
                exchange: 'Unknown'
            };
        }
    }

    /**
     * Get multiple quotes at once
     * @param {Array} symbols - Array of stock symbols
     * @returns {Array} Array of quote objects
     */
    async getBatchQuotes(symbols) {
        try {
            const promises = symbols.map(symbol => this.getQuote(symbol));
            const results = await Promise.allSettled(promises);
            
            return results.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                } else {
                    return {
                        symbol: symbols[index],
                        error: 'Failed to fetch data',
                        currentPrice: 0,
                        change: 0,
                        changePercent: 0
                    };
                }
            });
        } catch (error) {
            console.error('Error fetching batch quotes:', error.message);
            return [];
        }
    }

    /**
     * Check if market is open (US market hours)
     * @returns {boolean} True if market is open
     */
    isMarketOpen() {
        const now = new Date();
        const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const est = new Date(utc + (-5 * 3600000)); // EST timezone
        
        const day = est.getDay();
        const hours = est.getHours();
        const minutes = est.getMinutes();
        const totalMinutes = hours * 60 + minutes;
        
        // Market closed on weekends
        if (day === 0 || day === 6) return false;
        
        // Market hours: 9:30 AM - 4:00 PM EST
        const marketOpen = 9 * 60 + 30; // 9:30 AM
        const marketClose = 16 * 60; // 4:00 PM
        
        return totalMinutes >= marketOpen && totalMinutes < marketClose;
    }

    /**
     * Format currency values
     * @param {number} value - Numeric value
     * @returns {string} Formatted currency string
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }

    /**
     * Format percentage values
     * @param {number} value - Numeric value
     * @returns {string} Formatted percentage string
     */
    formatPercentage(value) {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    }
}

module.exports = new StockAPI();