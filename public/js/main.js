// ===== STOCKSAGE MAIN.JS - Global Functions =====

// ===== API CONFIGURATION =====
const API_CONFIG = {
    FINNHUB_BASE_URL: 'https://finnhub.io/api/v1',
    ENDPOINTS: {
        QUOTE: '/quote',
        CANDLES: '/stock/candle',
        SEARCH: '/search',
        RECOMMENDATION: '/stock/recommendation'
    }
};

// ===== API FUNCTIONS =====

/**
 * Make API call to Finnhub
 * @param {string} endpoint - API endpoint
 * @param {object} params - Query parameters
 * @returns {Promise} API response
 */
async function makeAPICall(endpoint, params = {}) {
    try {
        const url = new URL(API_CONFIG.FINNHUB_BASE_URL + endpoint);
        
        // Add API key and other parameters
        url.searchParams.append('token', window.FINNHUB_API_KEY || '');
        Object.keys(params).forEach(key => {
            url.searchParams.append(key, params[key]);
        });

        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`API Error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('API Call failed:', error);
        throw error;
    }
}

/**
 * Get real-time stock quote
 * @param {string} symbol - Stock symbol (e.g., 'AAPL')
 * @returns {Promise} Stock quote data
 */
async function getStockQuote(symbol) {
    return await makeAPICall(API_CONFIG.ENDPOINTS.QUOTE, { symbol });
}

/**
 * Get stock candle data for charts
 * @param {string} symbol - Stock symbol
 * @param {string} resolution - Time resolution (1, 5, 15, 30, 60, D, W, M)
 * @param {number} from - From timestamp
 * @param {number} to - To timestamp
 * @returns {Promise} Candle data
 */
async function getStockCandles(symbol, resolution = 'D', from, to) {
    return await makeAPICall(API_CONFIG.ENDPOINTS.CANDLES, {
        symbol,
        resolution,
        from,
        to
    });
}

/**
 * Search for stocks
 * @param {string} query - Search query
 * @returns {Promise} Search results
 */
async function searchStocks(query) {
    return await makeAPICall(API_CONFIG.ENDPOINTS.SEARCH, { q: query });
}

/**
 * Get stock recommendations
 * @param {string} symbol - Stock symbol
 * @returns {Promise} Recommendation data
 */
async function getStockRecommendation(symbol) {
    return await makeAPICall(API_CONFIG.ENDPOINTS.RECOMMENDATION, { symbol });
}

// ===== UTILITY FUNCTIONS =====

/**
 * Format price with currency symbol
 * @param {number} price - Price value
 * @param {string} currency - Currency code (default: USD)
 * @returns {string} Formatted price
 */
function formatPrice(price, currency = 'USD') {
    if (price === null || price === undefined || isNaN(price)) {
        return '--';
    }
    
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(price);
}

/**
 * Format percentage change
 * @param {number} change - Change value
 * @param {number} precision - Decimal places (default: 2)
 * @returns {string} Formatted percentage
 */
function formatPercentage(change, precision = 2) {
    if (change === null || change === undefined || isNaN(change)) {
        return '--';
    }
    
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(precision)}%`;
}

/**
 * Format date for display
 * @param {Date|string|number} date - Date to format
 * @param {string} format - Format type ('short', 'long', 'time')
 * @returns {string} Formatted date
 */
function formatDate(date, format = 'short') {
    if (!date) return '--';
    
    const dateObj = new Date(date);
    
    if (isNaN(dateObj.getTime())) {
        return '--';
    }
    
    const options = {
        short: { month: 'short', day: 'numeric', year: 'numeric' },
        long: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' },
        time: { hour: '2-digit', minute: '2-digit' },
        full: { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric', 
            hour: '2-digit', 
            minute: '2-digit' 
        }
    };
    
    return dateObj.toLocaleDateString('en-US', options[format] || options.short);
}

/**
 * Calculate profit/loss
 * @param {number} buyPrice - Buy price
 * @param {number} sellPrice - Sell price
 * @param {number} quantity - Number of shares
 * @returns {object} Profit/loss data
 */
function calculateProfitLoss(buyPrice, sellPrice, quantity) {
    const totalBuy = buyPrice * quantity;
    const totalSell = sellPrice * quantity;
    const profit = totalSell - totalBuy;
    const profitPercentage = (profit / totalBuy) * 100;
    
    return {
        profit: profit,
        profitPercentage: profitPercentage,
        totalBuy: totalBuy,
        totalSell: totalSell,
        isProfit: profit >= 0
    };
}

/**
 * Get color class based on price change
 * @param {number} change - Price change value
 * @returns {string} CSS class name
 */
function getPriceChangeClass(change) {
    if (change > 0) return 'text-success';
    if (change < 0) return 'text-danger';
    return 'text-muted';
}

/**
 * Get time period timestamps
 * @param {string} period - Time period ('1d', '1w', '1m', '3m', '1y')
 * @returns {object} From and to timestamps
 */
function getTimePeriod(period) {
    const now = Date.now();
    const to = Math.floor(now / 1000);
    let from;
    
    switch (period) {
        case '1d':
            from = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1w':
            from = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1m':
            from = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '3m':
            from = Math.floor((now - 90 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1y':
            from = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000);
            break;
        default:
            from = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
    }
    
    return { from, to };
}

// ===== UI INTERACTION FUNCTIONS =====

/**
 * Show loading spinner
 * @param {string} elementId - Element ID to show loading in
 */
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="text-center">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
}

/**
 * Hide loading spinner
 * @param {string} elementId - Element ID to hide loading from
 */
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = '';
    }
}

/**
 * Show error message
 * @param {string} message - Error message
 * @param {string} elementId - Element ID to show error in
 */
function showError(message, elementId = null) {
    const errorHtml = `
        <div class="alert alert-danger alert-dismissible fade show" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = errorHtml;
        }
    } else {
        // Show at top of page
        const container = document.querySelector('.container-fluid') || document.body;
        container.insertAdjacentHTML('afterbegin', errorHtml);
    }
}

/**
 * Show success message
 * @param {string} message - Success message
 * @param {string} elementId - Element ID to show success in
 */
function showSuccess(message, elementId = null) {
    const successHtml = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            <i class="fas fa-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    if (elementId) {
        const element = document.getElementById(elementId);
        if (element) {
            element.innerHTML = successHtml;
        }
    } else {
        // Show at top of page
        const container = document.querySelector('.container-fluid') || document.body;
        container.insertAdjacentHTML('afterbegin', successHtml);
    }
}

/**
 * Debounce function to limit API calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Copy text to clipboard
 * @param {string} text - Text to copy
 * @returns {Promise} Copy promise
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showSuccess('Copied to clipboard!');
    } catch (err) {
        console.error('Failed to copy: ', err);
        showError('Failed to copy to clipboard');
    }
}

// ===== GLOBAL EVENT LISTENERS =====

// Auto-dismiss alerts after 5 seconds
document.addEventListener('DOMContentLoaded', function() {
    // Auto-dismiss alerts
    setTimeout(() => {
        const alerts = document.querySelectorAll('.alert-dismissible');
        alerts.forEach(alert => {
            const bsAlert = new bootstrap.Alert(alert);
            bsAlert.close();
        });
    }, 5000);
    
    // Add tooltips to all elements with data-bs-toggle="tooltip"
    const tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });
});

// ===== EXPORT FUNCTIONS (for use in other files) =====
window.StockSage = {
    // API Functions
    getStockQuote,
    getStockCandles,
    searchStocks,
    getStockRecommendation,
    
    // Utility Functions
    formatPrice,
    formatPercentage,
    formatDate,
    calculateProfitLoss,
    getPriceChangeClass,
    getTimePeriod,
    
    // UI Functions
    showLoading,
    hideLoading,
    showError,
    showSuccess,
    debounce,
    copyToClipboard
};