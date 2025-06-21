// ===== STOCKSAGE STOCK.JS - Individual Stock Page Functionality =====

// ===== GLOBAL VARIABLES =====
let stockChart = null;
let priceUpdateInterval = null;
let currentSymbol = null;
let currentQuote = null;
let isInWatchlist = false;

// ===== STOCK PAGE INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeStockPage();
});

/**
 * Initialize stock page components
 */
async function initializeStockPage() {
    // Get stock symbol from URL
    currentSymbol = getSymbolFromURL();
    if (!currentSymbol) {
        StockSage.showError('Invalid stock symbol');
        return;
    }
    
    try {
        // Load initial data
        await Promise.all([
            loadStockQuote(),
            loadStockChart(),
            loadStockRecommendations(),
            checkWatchlistStatus()
        ]);
        
        // Setup interactive elements
        setupTradingForm();
        setupWatchlistToggle();
        setupChartControls();
        
        // Start real-time price updates
        startPriceUpdates();
        
    } catch (error) {
        console.error('Stock page initialization error:', error);
        StockSage.showError('Failed to load stock data. Please try again.');
    }
}

/**
 * Get stock symbol from URL path
 * @returns {string|null} Stock symbol
 */
function getSymbolFromURL() {
    const pathParts = window.location.pathname.split('/');
    return pathParts[pathParts.length - 1]?.toUpperCase() || null;
}

// ===== STOCK QUOTE & REAL-TIME UPDATES =====

/**
 * Load and display current stock quote
 */
async function loadStockQuote() {
    try {
        StockSage.showLoading('stockQuoteContainer');
        
        currentQuote = await StockSage.getStockQuote(currentSymbol);
        renderStockQuote(currentQuote);
        
        StockSage.hideLoading('stockQuoteContainer');
        
    } catch (error) {
        console.error('Quote loading error:', error);
        document.getElementById('stockQuoteContainer').innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Unable to load stock quote</p>
            </div>
        `;
    }
}

/**
 * Render stock quote information
 * @param {object} quote - Stock quote data
 */
function renderStockQuote(quote) {
    // Update stock price
    const priceElement = document.getElementById('stockPrice');
    if (priceElement) {
        priceElement.textContent = StockSage.formatPrice(quote.c || 0);
    }
    
    // Update price change
    const changeElement = document.getElementById('priceChange');
    if (changeElement) {
        const change = quote.d || 0;
        const changePercent = quote.dp || 0;
        changeElement.innerHTML = `
            ${StockSage.formatPrice(change)} 
            (${StockSage.formatPercentage(changePercent)})
        `;
        changeElement.className = `h6 ${StockSage.getPriceChangeClass(change)}`;
    }
    
    // Update other quote data
    updateQuoteDetails(quote);
}

/**
 * Update detailed quote information
 * @param {object} quote - Stock quote data
 */
function updateQuoteDetails(quote) {
    const details = {
        'openPrice': quote.o,
        'highPrice': quote.h,
        'lowPrice': quote.l,
        'previousClose': quote.pc,
        'volume': quote.v
    };
    
    Object.keys(details).forEach(key => {
        const element = document.getElementById(key);
        if (element) {
            if (key === 'volume') {
                element.textContent = formatVolume(details[key]);
            } else {
                element.textContent = StockSage.formatPrice(details[key] || 0);
            }
        }
    });
}

/**
 * Format volume for display
 * @param {number} volume - Volume value
 * @returns {string} Formatted volume
 */
function formatVolume(volume) {
    if (!volume) return '--';
    
    if (volume >= 1000000) {
        return (volume / 1000000).toFixed(1) + 'M';
    } else if (volume >= 1000) {
        return (volume / 1000).toFixed(1) + 'K';
    }
    return volume.toLocaleString();
}

/**
 * Start real-time price updates
 */
function startPriceUpdates() {
    // Update every 15 seconds
    priceUpdateInterval = setInterval(async () => {
        try {
            const newQuote = await StockSage.getStockQuote(currentSymbol);
            currentQuote = newQuote;
            renderStockQuote(newQuote);
        } catch (error) {
            console.error('Price update error:', error);
        }
    }, 15000);
}

/**
 * Stop price updates
 */
function stopPriceUpdates() {
    if (priceUpdateInterval) {
        clearInterval(priceUpdateInterval);
        priceUpdateInterval = null;
    }
}

// ===== STOCK CHART =====

/**
 * Load and display stock chart
 * @param {string} period - Time period (1D, 1W, 1M, 3M, 1Y)
 */
async function loadStockChart(period = '1M') {
    const ctx = document.getElementById('stockChart');
    if (!ctx) return;
    
    try {
        StockSage.showLoading('chartContainer');
        
        // Get time period
        const { from, to } = getChartTimePeriod(period);
        const resolution = getChartResolution(period);
        
        // Fetch candle data
        const candleData = await StockSage.getStockCandles(currentSymbol, resolution, from, to);
        
        if (!candleData.s || candleData.s === 'no_data') {
            throw new Error('No chart data available');
        }
        
        // Prepare chart data
        const chartData = prepareChartData(candleData);
        
        // Destroy existing chart
        if (stockChart) {
            stockChart.destroy();
        }
        
        // Create new chart
        stockChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Price',
                    data: chartData.prices,
                    borderColor: '#007bff',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 0,
                    pointHoverRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: function(context) {
                                return `Price: ${StockSage.formatPrice(context.parsed.y)}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: false,
                        ticks: {
                            callback: function(value) {
                                return StockSage.formatPrice(value);
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            display: false
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        StockSage.hideLoading('chartContainer');
        
    } catch (error) {
        console.error('Chart loading error:', error);
        document.getElementById('chartContainer').innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-chart-line fa-3x mb-3"></i>
                <p>Unable to load chart data</p>
            </div>
        `;
    }
}

/**
 * Get chart time period timestamps
 * @param {string} period - Period string
 * @returns {object} From and to timestamps
 */
function getChartTimePeriod(period) {
    const now = Date.now();
    const to = Math.floor(now / 1000);
    let from;
    
    switch (period) {
        case '1D':
            from = Math.floor((now - 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1W':
            from = Math.floor((now - 7 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1M':
            from = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '3M':
            from = Math.floor((now - 90 * 24 * 60 * 60 * 1000) / 1000);
            break;
        case '1Y':
            from = Math.floor((now - 365 * 24 * 60 * 60 * 1000) / 1000);
            break;
        default:
            from = Math.floor((now - 30 * 24 * 60 * 60 * 1000) / 1000);
    }
    
    return { from, to };
}

/**
 * Get chart resolution based on period
 * @param {string} period - Time period
 * @returns {string} Chart resolution
 */
function getChartResolution(period) {
    switch (period) {
        case '1D': return '5';
        case '1W': return '15';
        case '1M': return '60';
        case '3M': return 'D';
        case '1Y': return 'D';
        default: return 'D';
    }
}

/**
 * Prepare chart data from candle data
 * @param {object} candleData - Raw candle data
 * @returns {object} Formatted chart data
 */
function prepareChartData(candleData) {
    const labels = [];
    const prices = [];
    
    candleData.t.forEach((timestamp, index) => {
        const date = new Date(timestamp * 1000);
        labels.push(StockSage.formatDate(date, 'short'));
        prices.push(candleData.c[index]); // Close price
    });
    
    return { labels, prices };
}

// ===== CHART CONTROLS =====

/**
 * Setup chart period controls
 */
function setupChartControls() {
    const periodButtons = document.querySelectorAll('.chart-period-btn');
    
    periodButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Update active state
            periodButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Load chart for selected period
            const period = this.dataset.period;
            await loadStockChart(period);
        });
    });
}

// ===== TRADING SIMULATION =====

/**
 * Setup trading form
 */
function setupTradingForm() {
    const buyForm = document.getElementById('buyForm');
    const sellForm = document.getElementById('sellForm');
    
    if (buyForm) {
        buyForm.addEventListener('submit', handleBuyTrade);
    }
    
    if (sellForm) {
        sellForm.addEventListener('submit', handleSellTrade);
    }
    
    // Update total cost when quantity changes
    const quantityInputs = document.querySelectorAll('input[name="quantity"]');
    quantityInputs.forEach(input => {
        input.addEventListener('input', updateTotalCost);
    });
}

/**
 * Handle buy trade simulation
 * @param {Event} e - Form submit event
 */
async function handleBuyTrade(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const quantity = parseInt(formData.get('quantity'));
    
    if (!quantity || quantity <= 0) {
        StockSage.showError('Please enter a valid quantity');
        return;
    }
    
    if (!currentQuote) {
        StockSage.showError('Unable to get current price');
        return;
    }
    
    try {
        const tradeData = {
            symbol: currentSymbol,
            type: 'buy',
            quantity: quantity,
            price: currentQuote.c,
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch('/api/trades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            StockSage.showSuccess(`Successfully bought ${quantity} shares of ${currentSymbol}!`);
            e.target.reset();
            updateTotalCost();
        } else {
            throw new Error(result.message || 'Trade failed');
        }
        
    } catch (error) {
        console.error('Buy trade error:', error);
        StockSage.showError('Failed to execute buy order');
    }
}

/**
 * Handle sell trade simulation
 * @param {Event} e - Form submit event
 */
async function handleSellTrade(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const quantity = parseInt(formData.get('quantity'));
    
    if (!quantity || quantity <= 0) {
        StockSage.showError('Please enter a valid quantity');
        return;
    }
    
    if (!currentQuote) {
        StockSage.showError('Unable to get current price');
        return;
    }
    
    try {
        const tradeData = {
            symbol: currentSymbol,
            type: 'sell',
            quantity: quantity,
            price: currentQuote.c,
            timestamp: new Date().toISOString()
        };
        
        const response = await fetch('/api/trades', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(tradeData)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            StockSage.showSuccess(`Successfully sold ${quantity} shares of ${currentSymbol}!`);
            e.target.reset();
            updateTotalCost();
        } else {
            throw new Error(result.message || 'Trade failed');
        }
        
    } catch (error) {
        console.error('Sell trade error:', error);
        StockSage.showError('Failed to execute sell order');
    }
}

/**
 * Update total cost display
 */
function updateTotalCost() {
    const quantityInputs = document.querySelectorAll('input[name="quantity"]');
    
    quantityInputs.forEach(input => {
        const quantity = parseInt(input.value) || 0;
        const totalElement = input.closest('form').querySelector('.total-cost');
        
        if (totalElement && currentQuote) {
            const total = quantity * currentQuote.c;
            totalElement.textContent = `Total: ${StockSage.formatPrice(total)}`;
        }
    });
}

// ===== WATCHLIST FUNCTIONALITY =====

/**
 * Check if stock is in user's watchlist
 */
async function checkWatchlistStatus() {
    try {
        const response = await fetch(`/api/watchlist/check/${currentSymbol}`);
        const result = await response.json();
        
        isInWatchlist = result.inWatchlist;
        updateWatchlistButton();
        
    } catch (error) {
        console.error('Watchlist status check error:', error);
    }
}

/**
 * Setup watchlist toggle functionality
 */
function setupWatchlistToggle() {
    const watchlistBtn = document.getElementById('watchlistBtn');
    
    if (watchlistBtn) {
        watchlistBtn.addEventListener('click', toggleWatchlist);
    }
}

/**
 * Toggle stock in/out of watchlist
 */
async function toggleWatchlist() {
    try {
        const method = isInWatchlist ? 'DELETE' : 'POST';
        const response = await fetch(`/api/watchlist/${currentSymbol}`, {
            method: method
        });
        
        if (response.ok) {
            isInWatchlist = !isInWatchlist;
            updateWatchlistButton();
            
            const message = isInWatchlist 
                ? `${currentSymbol} added to watchlist` 
                : `${currentSymbol} removed from watchlist`;
            StockSage.showSuccess(message);
        } else {
            throw new Error('Watchlist update failed');
        }
        
    } catch (error) {
        console.error('Watchlist toggle error:', error);
        StockSage.showError('Failed to update watchlist');
    }
}

/**
 * Update watchlist button appearance
 */
function updateWatchlistButton() {
    const watchlistBtn = document.getElementById('watchlistBtn');
    if (!watchlistBtn) return;
    
    if (isInWatchlist) {
        watchlistBtn.innerHTML = '<i class="fas fa-star"></i> In Watchlist';
        watchlistBtn.className = 'btn btn-warning';
    } else {
        watchlistBtn.innerHTML = '<i class="far fa-star"></i> Add to Watchlist';
        watchlistBtn.className = 'btn btn-outline-warning';
    }
}

// ===== STOCK RECOMMENDATIONS =====

/**
 * Load and display stock recommendations
 */
async function loadStockRecommendations() {
    try {
        const recommendations = await StockSage.getStockRecommendation(currentSymbol);
        renderRecommendations(recommendations);
        
    } catch (error) {
        console.error('Recommendations loading error:', error);
        const container = document.getElementById('recommendationsContainer');
        if (container) {
            container.innerHTML = `
                <div class="text-center text-muted">
                    <small>Recommendations not available</small>
                </div>
            `;
        }
    }
}

/**
 * Render recommendations
 * @param {object} recommendations - Recommendation data
 */
function renderRecommendations(recommendations) {
    const container = document.getElementById('recommendationsContainer');
    if (!container || !recommendations) return;
    
    const { buy = 0, hold = 0, sell = 0, strongBuy = 0, strongSell = 0 } = recommendations;
    const total = buy + hold + sell + strongBuy + strongSell;
    
    if (total === 0) {
        container.innerHTML = '<small class="text-muted">No recommendations available</small>';
        return;
    }
    
    // Determine overall recommendation
    const strongBuyPct = (strongBuy / total) * 100;
    const buyPct = (buy / total) * 100;
    const sellPct = (sell / total) * 100;
    const strongSellPct = (strongSell / total) * 100;
    
    let overallRec = 'HOLD';
    let recClass = 'warning';
    
    if (strongBuyPct + buyPct > 60) {
        overallRec = 'BUY';
        recClass = 'success';
    } else if (strongSellPct + sellPct > 60) {
        overallRec = 'SELL';
        recClass = 'danger';
    }
    
    container.innerHTML = `
        <div class="text-center">
            <span class="badge bg-${recClass} fs-6">${overallRec}</span>
            <div class="mt-2">
                <small class="text-muted">
                    ${strongBuy + buy} Buy • ${hold} Hold • ${sell + strongSell} Sell
                </small>
            </div>
        </div>
    `;
}

// ===== CLEANUP =====

// Cleanup when leaving page
window.addEventListener('beforeunload', function() {
    stopPriceUpdates();
    if (stockChart) {
        stockChart.destroy();
    }
});