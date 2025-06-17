// ===== STOCKSAGE DASHBOARD.JS - Dashboard Functionality =====

// ===== GLOBAL VARIABLES =====
let profitChart = null;
let watchlistUpdateInterval = null;
let currentTimeframe = 'all';

// ===== DASHBOARD INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    initializeDashboard();
});

/**
 * Initialize dashboard components
 */
async function initializeDashboard() {
    try {
        // Initialize profit/loss chart
        await initializeProfitChart();
        
        // Load watchlist with real-time prices
        await loadWatchlistPrices();
        
        // Setup timeframe filters
        setupTimeframeFilters();
        
        // Setup search functionality
        setupSearchFunctionality();
        
        // Start real-time updates
        startRealTimeUpdates();
        
        // Setup interactive elements
        setupInteractiveElements();
        
    } catch (error) {
        console.error('Dashboard initialization error:', error);
        StockSage.showError('Failed to load dashboard data. Please refresh the page.');
    }
}

// ===== PROFIT/LOSS CHART =====

/**
 * Initialize the profit/loss analytics chart
 */
async function initializeProfitChart() {
    const ctx = document.getElementById('profitChart');
    if (!ctx) return;
    
    try {
        StockSage.showLoading('profitChartContainer');
        
        // Fetch analytics data from backend
        const response = await fetch('/api/analytics/profit-loss');
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Failed to fetch analytics data');
        }
        
        // Create chart
        profitChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.labels || [],
                datasets: [{
                    label: 'Profit/Loss',
                    data: data.profits || [],
                    borderColor: function(context) {
                        const value = context.parsed.y;
                        return value >= 0 ? '#28a745' : '#dc3545';
                    },
                    backgroundColor: function(context) {
                        const value = context.parsed.y;
                        return value >= 0 ? 'rgba(40, 167, 69, 0.1)' : 'rgba(220, 53, 69, 0.1)';
                    },
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
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
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const formatted = StockSage.formatPrice(value);
                                return `P&L: ${formatted}`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return StockSage.formatPrice(value);
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'
                }
            }
        });
        
        StockSage.hideLoading('profitChartContainer');
        
    } catch (error) {
        console.error('Chart initialization error:', error);
        document.getElementById('profitChartContainer').innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-chart-line fa-3x mb-3"></i>
                <p>Unable to load profit/loss chart</p>
            </div>
        `;
    }
}

/**
 * Update chart based on timeframe
 * @param {string} timeframe - Selected timeframe
 */
async function updateProfitChart(timeframe) {
    if (!profitChart) return;
    
    try {
        const response = await fetch(`/api/analytics/profit-loss?timeframe=${timeframe}`);
        const data = await response.json();
        
        if (response.ok) {
            profitChart.data.labels = data.labels || [];
            profitChart.data.datasets[0].data = data.profits || [];
            profitChart.update('active');
        }
    } catch (error) {
        console.error('Chart update error:', error);
    }
}

// ===== WATCHLIST FUNCTIONALITY =====

/**
 * Load watchlist with real-time prices
 */
async function loadWatchlistPrices() {
    const watchlistContainer = document.getElementById('watchlistContainer');
    if (!watchlistContainer) return;
    
    try {
        // Get user's watchlist from backend
        const response = await fetch('/api/watchlist');
        const watchlist = await response.json();
        
        if (!response.ok) {
            throw new Error('Failed to load watchlist');
        }
        
        if (watchlist.length === 0) {
            watchlistContainer.innerHTML = `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-star fa-2x mb-3"></i>
                    <p>No stocks in your watchlist yet</p>
                    <a href="/stocks" class="btn btn-primary btn-sm">Add Stocks</a>
                </div>
            `;
            return;
        }
        
        // Load real-time prices for each stock
        const watchlistWithPrices = await Promise.all(
            watchlist.map(async (stock) => {
                try {
                    const quote = await StockSage.getStockQuote(stock.symbol);
                    return {
                        ...stock,
                        currentPrice: quote.c || 0,
                        change: quote.d || 0,
                        changePercent: quote.dp || 0,
                        previousClose: quote.pc || 0
                    };
                } catch (error) {
                    console.error(`Error fetching price for ${stock.symbol}:`, error);
                    return {
                        ...stock,
                        currentPrice: 0,
                        change: 0,
                        changePercent: 0,
                        error: true
                    };
                }
            })
        );
        
        // Render watchlist
        renderWatchlist(watchlistWithPrices);
        
    } catch (error) {
        console.error('Watchlist loading error:', error);
        watchlistContainer.innerHTML = `
            <div class="text-center text-muted">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading watchlist</p>
            </div>
        `;
    }
}

/**
 * Render watchlist HTML
 * @param {Array} watchlist - Watchlist with price data
 */
function renderWatchlist(watchlist) {
    const container = document.getElementById('watchlistContainer');
    if (!container) return;
    
    const html = watchlist.map(stock => `
        <div class="watchlist-item p-3 border rounded mb-2 bg-light">
            <div class="row align-items-center">
                <div class="col-md-6">
                    <h6 class="mb-1">
                        <a href="/stock/${stock.symbol}" class="text-decoration-none">
                            ${stock.symbol}
                        </a>
                    </h6>
                    <small class="text-muted">${stock.name || stock.symbol}</small>
                </div>
                <div class="col-md-3 text-end">
                    <div class="fw-bold">
                        ${stock.error ? '--' : StockSage.formatPrice(stock.currentPrice)}
                    </div>
                </div>
                <div class="col-md-3 text-end">
                    <div class="${StockSage.getPriceChangeClass(stock.change)}">
                        <small>
                            ${stock.error ? '--' : StockSage.formatPrice(stock.change)} 
                            (${stock.error ? '--' : StockSage.formatPercentage(stock.changePercent)})
                        </small>
                    </div>
                </div>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = html;
}

// ===== TIMEFRAME FILTERS =====

/**
 * Setup timeframe filter buttons
 */
function setupTimeframeFilters() {
    const timeframeButtons = document.querySelectorAll('.timeframe-btn');
    
    timeframeButtons.forEach(button => {
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            
            // Update active state
            timeframeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            
            // Get selected timeframe
            const timeframe = this.dataset.timeframe;
            currentTimeframe = timeframe;
            
            // Update chart
            await updateProfitChart(timeframe);
            
            // Update summary cards
            await updateSummaryCards(timeframe);
        });
    });
}

/**
 * Update summary cards based on timeframe
 * @param {string} timeframe - Selected timeframe
 */
async function updateSummaryCards(timeframe) {
    try {
        const response = await fetch(`/api/analytics/summary?timeframe=${timeframe}`);
        const data = await response.json();
        
        if (response.ok) {
            // Update profit/loss card
            const profitElement = document.getElementById('totalProfit');
            if (profitElement) {
                profitElement.textContent = StockSage.formatPrice(data.totalProfit || 0);
                profitElement.className = `h3 mb-0 ${StockSage.getPriceChangeClass(data.totalProfit || 0)}`;
            }
            
            // Update trades count
            const tradesElement = document.getElementById('totalTrades');
            if (tradesElement) {
                tradesElement.textContent = data.totalTrades || 0;
            }
            
            // Update win rate
            const winRateElement = document.getElementById('winRate');
            if (winRateElement) {
                winRateElement.textContent = `${(data.winRate || 0).toFixed(1)}%`;
            }
        }
    } catch (error) {
        console.error('Summary update error:', error);
    }
}

// ===== SEARCH FUNCTIONALITY =====

/**
 * Setup search functionality
 */
function setupSearchFunctionality() {
    const searchForm = document.getElementById('stockSearchForm');
    const searchInput = document.getElementById('stockSearchInput');
    
    if (searchForm && searchInput) {
        // Debounced search suggestions
        const debouncedSearch = StockSage.debounce(showSearchSuggestions, 300);
        
        searchInput.addEventListener('input', function() {
            const query = this.value.trim();
            if (query.length >= 2) {
                debouncedSearch(query);
            } else {
                hideSearchSuggestions();
            }
        });
        
        // Handle form submission
        searchForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
                window.location.href = `/search?q=${encodeURIComponent(query)}`;
            }
        });
        
        // Hide suggestions when clicking outside
        document.addEventListener('click', function(e) {
            if (!searchForm.contains(e.target)) {
                hideSearchSuggestions();
            }
        });
    }
}

/**
 * Show search suggestions
 * @param {string} query - Search query
 */
async function showSearchSuggestions(query) {
    try {
        const results = await StockSage.searchStocks(query);
        const suggestions = results.result?.slice(0, 5) || [];
        
        let suggestionsContainer = document.getElementById('searchSuggestions');
        if (!suggestionsContainer) {
            suggestionsContainer = document.createElement('div');
            suggestionsContainer.id = 'searchSuggestions';
            suggestionsContainer.className = 'position-absolute w-100 bg-white border rounded shadow-sm mt-1';
            suggestionsContainer.style.zIndex = '1000';
            document.getElementById('stockSearchForm').appendChild(suggestionsContainer);
        }
        
        if (suggestions.length > 0) {
            const html = suggestions.map(stock => `
                <div class="suggestion-item p-2 border-bottom hover-bg-light cursor-pointer" 
                     data-symbol="${stock.symbol}">
                    <div class="fw-bold">${stock.symbol}</div>
                    <small class="text-muted">${stock.description}</small>
                </div>
            `).join('');
            
            suggestionsContainer.innerHTML = html;
            
            // Add click handlers
            suggestionsContainer.querySelectorAll('.suggestion-item').forEach(item => {
                item.addEventListener('click', function() {
                    const symbol = this.dataset.symbol;
                    window.location.href = `/stock/${symbol}`;
                });
            });
        } else {
            suggestionsContainer.innerHTML = `
                <div class="p-2 text-muted text-center">
                    No stocks found
                </div>
            `;
        }
    } catch (error) {
        console.error('Search suggestions error:', error);
    }
}

/**
 * Hide search suggestions
 */
function hideSearchSuggestions() {
    const suggestions = document.getElementById('searchSuggestions');
    if (suggestions) {
        suggestions.remove();
    }
}

// ===== REAL-TIME UPDATES =====

/**
 * Start real-time updates for watchlist
 */
function startRealTimeUpdates() {
    // Update watchlist prices every 30 seconds
    watchlistUpdateInterval = setInterval(async () => {
        await loadWatchlistPrices();
    }, 30000);
}

/**
 * Stop real-time updates
 */
function stopRealTimeUpdates() {
    if (watchlistUpdateInterval) {
        clearInterval(watchlistUpdateInterval);
        watchlistUpdateInterval = null;
    }
}

// ===== INTERACTIVE ELEMENTS =====

/**
 * Setup interactive dashboard elements
 */
function setupInteractiveElements() {
    // Refresh button
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', async function() {
            this.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            await loadWatchlistPrices();
            await updateSummaryCards(currentTimeframe);
            this.innerHTML = '<i class="fas fa-sync-alt"></i>';
        });
    }
    
    // Watchlist quick actions
    document.addEventListener('click', async function(e) {
        if (e.target.classList.contains('remove-from-watchlist')) {
            e.preventDefault();
            const symbol = e.target.dataset.symbol;
            await removeFromWatchlist(symbol);
        }
    });
}

/**
 * Remove stock from watchlist
 * @param {string} symbol - Stock symbol
 */
async function removeFromWatchlist(symbol) {
    try {
        const response = await fetch(`/api/watchlist/${symbol}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            StockSage.showSuccess(`${symbol} removed from watchlist`);
            await loadWatchlistPrices();
        } else {
            throw new Error('Failed to remove from watchlist');
        }
    } catch (error) {
        console.error('Remove from watchlist error:', error);
        StockSage.showError('Failed to remove stock from watchlist');
    }
}

// ===== CLEANUP =====

// Stop updates when leaving page
window.addEventListener('beforeunload', function() {
    stopRealTimeUpdates();
    if (profitChart) {
        profitChart.destroy();
    }
});