/**
 * StockSage Charts - Interactive Stock Price Visualization
 * Handles real-time price charts, historical data, and technical indicators
 */

// Stock Chart Implementation
class StockChart {
    constructor(canvasId, options = {}) {
        this.canvasId = canvasId;
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas?.getContext('2d');
        this.chart = null;
        this.symbol = options.symbol || 'STOCK';
        this.timeframe = options.timeframe || '1D';
        
        if (!this.canvas) {
            console.error(`Canvas element with id '${canvasId}' not found`);
            return;
        }
    }

    async loadData(symbol, timeframe) {
        try {
            this.symbol = symbol;
            this.timeframe = timeframe;
            
            // Try to fetch real data first
            const response = await fetch(`/api/stocks/${symbol}/chart/${timeframe}`);
            
            if (response.ok) {
                const data = await response.json();
                this.renderChart(data);
            } else {
                // Fallback to mock data
                console.log('Using mock data for chart...');
                const mockData = this.generateMockData(symbol, timeframe);
                this.renderChart(mockData);
            }
        } catch (error) {
            console.error('Error loading chart data:', error);
            // Fallback to mock data
            const mockData = this.generateMockData(symbol, timeframe);
            this.renderChart(mockData);
        }
    }

    generateMockData(symbol, timeframe) {
        const basePrice = typeof currentPrice !== 'undefined' ? currentPrice : 150;
        const periods = this.getPeriodsForTimeframe(timeframe);
        const data = [];
        const labels = [];
        
        let currentValue = basePrice;
        const now = new Date();
        
        for (let i = periods - 1; i >= 0; i--) {
            // Generate realistic price movements
            const change = (Math.random() - 0.5) * (basePrice * 0.02); // 2% max change
            currentValue = Math.max(currentValue + change, basePrice * 0.8); // Don't go below 80% of base
            
            data.push(parseFloat(currentValue.toFixed(2)));
            
            // Generate appropriate labels based on timeframe
            const date = new Date(now);
            switch (timeframe) {
                case '1D':
                    date.setHours(date.getHours() - i);
                    labels.push(date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
                    break;
                case '1W':
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                    break;
                case '1M':
                    date.setDate(date.getDate() - i);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                    break;
                case '3M':
                    date.setDate(date.getDate() - i * 3);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
                    break;
                case '1Y':
                    date.setMonth(date.getMonth() - i);
                    labels.push(date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }));
                    break;
                default:
                    labels.push(`${i + 1}`);
            }
        }

        return {
            labels: labels,
            prices: data,
            symbol: symbol
        };
    }

    getPeriodsForTimeframe(timeframe) {
        switch (timeframe) {
            case '1D': return 24; // 24 hours
            case '1W': return 7;  // 7 days
            case '1M': return 30; // 30 days
            case '3M': return 90; // 90 days
            case '1Y': return 12; // 12 months
            default: return 30;
        }
    }

    renderChart(data) {
        if (this.chart) {
            this.chart.destroy();
        }

        if (!this.ctx) {
            console.error('Canvas context not available');
            return;
        }

        // Determine color based on price trend
        const firstPrice = data.prices[0];
        const lastPrice = data.prices[data.prices.length - 1];
        const isPositive = lastPrice >= firstPrice;
        const lineColor = isPositive ? '#10b981' : '#ef4444';
        const fillColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';

        this.chart = new Chart(this.ctx, {
            type: 'line',
            data: {
                labels: data.labels,
                datasets: [{
                    label: this.symbol,
                    data: data.prices,
                    borderColor: lineColor,
                    backgroundColor: fillColor,
                    borderWidth: 2,
                    fill: true,
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointBackgroundColor: lineColor,
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2
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
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: '#ffffff',
                        bodyColor: '#ffffff',
                        borderColor: lineColor,
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `${data.symbol || 'Price'}: $${context.parsed.y.toFixed(2)}`;
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
                            color: '#6b7280',
                            maxTicksLimit: 8
                        }
                    },
                    y: {
                        display: true,
                        position: 'right',
                        beginAtZero: false,
                        grid: {
                            color: 'rgba(107, 114, 128, 0.1)'
                        },
                        ticks: {
                            color: '#6b7280',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    }
                },
                elements: {
                    point: {
                        hoverBackgroundColor: lineColor
                    }
                }
            }
        });

        console.log(`Chart rendered for ${this.symbol} - ${this.timeframe}`);
    }

    changeTimeframe(newTimeframe) {
        this.timeframe = newTimeframe;
        this.loadData(this.symbol, newTimeframe);
    }

    destroy() {
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
    }
}

// Utility class for chart operations
class ChartUtils {
    static generateMockData(periods, basePrice = 100) {
        const data = [];
        const timestamps = [];
        let currentPrice = basePrice;
        
        for (let i = 0; i < periods; i++) {
            // Generate realistic price movement
            const change = (Math.random() - 0.5) * (basePrice * 0.03);
            currentPrice = Math.max(currentPrice + change, basePrice * 0.7);
            
            data.push(parseFloat(currentPrice.toFixed(2)));
            timestamps.push(new Date(Date.now() - (periods - i) * 60000)); // 1 minute intervals
        }
        
        return {
            prices: data,
            timestamps: timestamps
        };
    }
    
    static formatPrice(price) {
        return `$${parseFloat(price).toFixed(2)}`;
    }
    
    static calculateChange(current, previous) {
        const change = current - previous;
        const changePercent = (change / previous) * 100;
        return {
            absolute: change,
            percent: changePercent,
            isPositive: change >= 0
        };
    }
}

// Export for use in other files
if (typeof window !== 'undefined') {
    window.StockChart = StockChart;
    window.ChartUtils = ChartUtils;
}