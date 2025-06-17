/**
 * StockSage Charts - Interactive Stock Price Visualization
 * Handles real-time price charts, historical data, and technical indicators
 */

class StockChart {
    constructor(containerId, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.chart = null;
        this.symbol = options.symbol || '';
        this.timeframe = options.timeframe || '1D';
        this.isLoading = false;
        
        // Chart configuration
        this.config = {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Price',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#10b981',
                    pointHoverBorderColor: '#ffffff',
                    pointHoverBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    intersect: false,
                    mode: 'index'
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(17, 24, 39, 0.9)',
                        titleColor: '#f9fafb',
                        bodyColor: '#f9fafb',
                        borderColor: '#374151',
                        borderWidth: 1,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            title: function(context) {
                                return new Date(context[0].label).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                });
                            },
                            label: function(context) {
                                return `Price: $${context.parsed.y.toFixed(2)}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        display: true,
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 12
                            },
                            maxTicksLimit: 6
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        grid: {
                            color: 'rgba(156, 163, 175, 0.1)',
                            borderDash: [2, 2]
                        },
                        ticks: {
                            color: '#9ca3af',
                            font: {
                                size: 12
                            },
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                onHover: (event, elements) => {
                    if (event.native && event.native.target) {
                        event.native.target.style.cursor = elements.length > 0 ? 'crosshair' : 'default';
                    }
                }
            }
        };

        this.initChart();
    }

    /**
     * Initialize the Chart.js instance
     */
    initChart() {
        if (this.chart) {
            this.chart.destroy();
        }

        if (!this.container) return;

        const ctx = this.container.getContext('2d');
        this.chart = new Chart(ctx, this.config);
    }

    /**
     * Load stock data and update chart
     * @param {string} symbol - Stock symbol
     * @param {string} timeframe - Time period (1D, 5D, 1M, 3M, 6M, 1Y, 2Y, 5Y)
     */
    async loadData(symbol, timeframe = '1D') {
        if (this.isLoading) return;
        
        try {
            this.isLoading = true;
            this.showLoading();

            // Calculate time range based on timeframe
            const now = Math.floor(Date.now() / 1000);
            let from, resolution;
            
            switch (timeframe) {
                case '1D':
                    from = now - (24 * 60 * 60);
                    resolution = '5';
                    break;
                case '1W':
                    from = now - (7 * 24 * 60 * 60);
                    resolution = '15';
                    break;
                case '1M':
                    from = now - (30 * 24 * 60 * 60);
                    resolution = '60';
                    break;
                case '3M':
                    from = now - (90 * 24 * 60 * 60);
                    resolution = 'D';
                    break;
                case '1Y':
                    from = now - (365 * 24 * 60 * 60);
                    resolution = 'D';
                    break;
                default:
                    from = now - (30 * 24 * 60 * 60);
                    resolution = 'D';
            }

            const url = `/api/candle/${symbol}?resolution=${resolution}&from=${from}&to=${now}`;
            console.log('Loading chart data from:', url);

            const response = await fetch(url);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Failed to fetch chart data');
            }

            if (!result.success || !result.data) {
                throw new Error('Invalid chart data received');
            }

            // Validate data structure
            const { timestamps, close } = result.data;
            if (!timestamps || !close || timestamps.length === 0 || close.length === 0) {
                throw new Error('No chart data available');
            }

            if (timestamps.length !== close.length) {
                throw new Error('Mismatched chart data arrays');
            }

            this.updateChart({
                timestamps: timestamps,
                prices: close
            });

        } catch (error) {
            console.error('Error loading chart data:', error);
            this.showError('Failed to load chart data');
        } finally {
            this.isLoading = false;
            this.hideLoading();
        }
    }

    /**
     * Update chart with new data
     * @param {Object} data - Chart data
     */
    updateChart(data) {
        if (!this.chart || !data.timestamps || !data.prices) return;

        try {
            // Clear existing data
            this.chart.data.labels = [];
            this.chart.data.datasets[0].data = [];

            // Process timestamps and prices
            const labels = data.timestamps.map(ts => {
                return new Date(ts * 1000).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric'
                });
            });

            // Update chart data
            this.chart.data.labels = labels;
            this.chart.data.datasets[0].data = data.prices;

            // Update colors based on price trend
            if (data.prices.length > 1) {
                const firstPrice = data.prices[0];
                const lastPrice = data.prices[data.prices.length - 1];
                const isPositive = lastPrice >= firstPrice;

                this.chart.data.datasets[0].borderColor = isPositive ? '#10b981' : '#ef4444';
                this.chart.data.datasets[0].backgroundColor = isPositive ? 
                    'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            }

            // Update chart with animation
            this.chart.update('resize');

        } catch (error) {
            console.error('Error updating chart:', error);
            this.showError('Error displaying chart data');
        }
    }

    /**
     * Change chart timeframe
     * @param {string} timeframe - New timeframe
     */
    async changeTimeframe(timeframe) {
        this.timeframe = timeframe;
        await this.loadData(this.symbol, timeframe);
    }

    /**
     * Show loading indicator
     */
    showLoading() {
        this.hideLoading(); // Remove any existing loading indicator
        
        if (!this.container || !this.container.parentElement) return;

        const loadingEl = document.createElement('div');
        loadingEl.id = `chart-loading-${this.containerId}`;
        loadingEl.className = 'chart-loading';
        loadingEl.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255, 255, 255, 0.8);
            z-index: 10;
        `;
        loadingEl.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <div style="
                    width: 20px; 
                    height: 20px; 
                    border: 2px solid #e5e7eb; 
                    border-top: 2px solid #3b82f6; 
                    border-radius: 50%; 
                    animation: spin 1s linear infinite;
                "></div>
                <span style="color: #6b7280; font-size: 14px;">Loading chart...</span>
            </div>
        `;
        
        // Add CSS animation if not already present
        if (!document.getElementById('chart-loading-styles')) {
            const styles = document.createElement('style');
            styles.id = 'chart-loading-styles';
            styles.textContent = `
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `;
            document.head.appendChild(styles);
        }
        
        this.container.parentElement.style.position = 'relative';
        this.container.parentElement.appendChild(loadingEl);
    }

    /**
     * Hide loading indicator
     */
    hideLoading() {
        const loadingEl = document.getElementById(`chart-loading-${this.containerId}`);
        if (loadingEl) {
            loadingEl.remove();
        }
    }

    /**
     * Show error message
     * @param {string} message - Error message
     */
    showError(message) {
        this.hideLoading();
        
        if (!this.container || !this.container.parentElement) return;

        const errorEl = document.createElement('div');
        errorEl.id = `chart-error-${this.containerId}`;
        errorEl.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(254, 242, 242, 0.9);
            z-index: 10;
        `;
        errorEl.innerHTML = `
            <div style="text-align: center;">
                <div style="color: #dc2626; font-size: 16px; margin-bottom: 8px;">${message}</div>
                <button onclick="this.parentElement.parentElement.remove()" 
                        style="
                            padding: 6px 12px; 
                            background: #dc2626; 
                            color: white; 
                            border: none; 
                            border-radius: 4px; 
                            cursor: pointer;
                            font-size: 12px;
                        ">
                    Dismiss
                </button>
            </div>
        `;
        
        this.container.parentElement.appendChild(errorEl);
    }

    /**
     * Destroy chart instance
     */
    destroy() {
        this.hideLoading();
        
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

/**
 * Mini Chart for dashboard and stock cards
 */
class MiniChart {
    constructor(containerId, data, options = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.data = data || [];
        this.isPositive = options.isPositive || false;
        
        if (this.container && this.data.length > 0) {
            this.initMiniChart();
        }
    }

    initMiniChart() {
        const ctx = this.container.getContext('2d');
        
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: this.data.map((_, i) => i),
                datasets: [{
                    data: this.data,
                    borderColor: this.isPositive ? '#10b981' : '#ef4444',
                    backgroundColor: this.isPositive ? 
                        'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 1,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false }
                },
                scales: {
                    x: { display: false },
                    y: { display: false }
                },
                elements: {
                    point: { radius: 0 }
                }
            }
        });
    }
}

/**
 * Utility functions for chart management
 */
const ChartUtils = {
    /**
     * Format price for display
     * @param {number} price - Price value
     * @returns {string} Formatted price
     */
    formatPrice(price) {
        if (typeof price !== 'number' || isNaN(price)) return '$0.00';
        
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(price);
    },

    /**
     * Format percentage change
     * @param {number} change - Percentage change
     * @returns {string} Formatted percentage
     */
    formatPercentage(change) {
        if (typeof change !== 'number' || isNaN(change)) return '0.00%';
        
        const sign = change >= 0 ? '+' : '';
        return `${sign}${change.toFixed(2)}%`;
    },

    /**
     * Get color based on value (positive/negative)
     * @param {number} value - Numeric value
     * @returns {string} Color class or hex
     */
    getChangeColor(value) {
        return value >= 0 ? '#10b981' : '#ef4444';
    },

    /**
     * Generate mock data for testing
     * @param {number} days - Number of days
     * @param {number} basePrice - Starting price
     * @returns {Object} Mock chart data
     */
    generateMockData(days = 30, basePrice = 100) {
        const timestamps = [];
        const prices = [];
        
        let currentPrice = basePrice;
        
        for (let i = 0; i < days; i++) {
            const date = new Date();
            date.setDate(date.getDate() - (days - i - 1));
            timestamps.push(Math.floor(date.getTime() / 1000));
            
            // Add some realistic price movement
            const volatility = 0.02;
            const change = (Math.random() - 0.5) * volatility;
            currentPrice = Math.max(currentPrice * (1 + change), 1); // Ensure price doesn't go below $1
            prices.push(parseFloat(currentPrice.toFixed(2)));
        }
        
        return { timestamps, prices };
    }
};

// Global chart instances for cleanup
window.stockChartInstances = window.stockChartInstances || [];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { StockChart, MiniChart, ChartUtils };
}