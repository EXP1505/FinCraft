// ===== WATCHLIST FUNCTIONALITY =====

document.addEventListener('DOMContentLoaded', function() {
    console.log('🌟 Watchlist functionality initialized');
    
    // Initialize watchlist functionality
    initializeWatchlist();
    
    // Load user's watchlist to set button states
    loadWatchlistStates();
});

/**
 * Initialize watchlist button event handlers
 */
function initializeWatchlist() {
    // Find all watchlist buttons
    const watchlistButtons = document.querySelectorAll('.watchlist-btn');
    console.log('📋 Found watchlist buttons:', watchlistButtons.length);
    
    watchlistButtons.forEach(button => {
        button.addEventListener('click', handleWatchlistClick);
    });
}

/**
 * Handle watchlist button clicks
 * @param {Event} event - Click event
 */
async function handleWatchlistClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const button = event.currentTarget;
    const symbol = button.dataset.symbol;
    const stockName = button.dataset.name || symbol;
    
    console.log('⭐ Watchlist button clicked:', { symbol, stockName });
    
    if (!symbol) {
        console.error('❌ No symbol found on button');
        showToast('Error: Stock symbol not found', 'error');
        return;
    }
    
    // Disable button during request
    button.disabled = true;
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    try {
        const isInWatchlist = button.classList.contains('in-watchlist');
        
        if (isInWatchlist) {
            await removeFromWatchlist(symbol, button);
        } else {
            await addToWatchlist(symbol, stockName, button);
        }
        
    } catch (error) {
        console.error('❌ Watchlist operation failed:', error);
        showToast('Failed to update watchlist. Please try again.', 'error');
        
        // Restore button
        button.innerHTML = originalHTML;
        button.disabled = false;
    }
}

/**
 * Add stock to watchlist
 * @param {string} symbol - Stock symbol
 * @param {string} name - Stock name
 * @param {HTMLElement} button - Button element
 */
async function addToWatchlist(symbol, name, button) {
    console.log('➕ Adding to watchlist:', { symbol, name });
    
    try {
        const response = await fetch('/api/watchlist/add', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symbol, name })
        });
        
        const data = await response.json();
        console.log('📡 Add response:', data);
        
        if (response.ok && data.success) {
            // Update button state
            button.classList.add('in-watchlist');
            button.innerHTML = '<i class="fas fa-star"></i>';
            button.title = 'Remove from watchlist';
            
            showToast(`${symbol} added to watchlist`, 'success');
        } else {
            throw new Error(data.message || 'Failed to add to watchlist');
        }
        
    } catch (error) {
        console.error('❌ Add to watchlist error:', error);
        throw error;
    } finally {
        button.disabled = false;
    }
}

/**
 * Remove stock from watchlist
 * @param {string} symbol - Stock symbol
 * @param {HTMLElement} button - Button element
 */
async function removeFromWatchlist(symbol, button) {
    console.log('➖ Removing from watchlist:', symbol);
    
    try {
        const response = await fetch(`/api/watchlist/remove`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symbol })
        });
        
        const data = await response.json();
        console.log('📡 Remove response:', data);
        
        if (response.ok && data.success) {
            // Update button state
            button.classList.remove('in-watchlist');
            button.innerHTML = '<i class="far fa-star"></i>';
            button.title = 'Add to watchlist';
            
            showToast(`${symbol} removed from watchlist`, 'success');
        } else {
            throw new Error(data.message || 'Failed to remove from watchlist');
        }
        
    } catch (error) {
        console.error('❌ Remove from watchlist error:', error);
        throw error;
    } finally {
        button.disabled = false;
    }
}

/**
 * Load watchlist states for all buttons
 */
async function loadWatchlistStates() {
    console.log('🔄 Loading watchlist states...');
    
    try {
        const response = await fetch('/api/watchlist');
        
        if (!response.ok) {
            if (response.status === 401) {
                console.log('👤 User not authenticated - skipping watchlist states');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📋 User watchlist:', watchlist);
        
        const watchlist= result.data || [];

        if (!Array.isArray(watchlist)) {
            console.log('⚠️ Watchlist is not an array:', watchlist);
            return;
        }
        
        // Get all symbols in watchlist
        const watchlistSymbols = watchlist.map(item => item.symbol);
        
        // Update button states
        const buttons = document.querySelectorAll('.watchlist-btn[data-symbol]');
        buttons.forEach(button => {
            const symbol = button.dataset.symbol;
            if (watchlistSymbols.includes(symbol)) {
                button.classList.add('in-watchlist');
                button.innerHTML = '<i class="fas fa-star"></i>';
                button.title = 'Remove from watchlist';
            } else {
                button.classList.remove('in-watchlist');
                button.innerHTML = '<i class="far fa-star"></i>';
                button.title = 'Add to watchlist';
            }

        });
        
        console.log('✅ Watchlist states updated');
        
    } catch (error) {
        console.error('❌ Failed to load watchlist states:', error);
    }
}

/**
 * Show toast notification
 * @param {string} message - Message to show
 * @param {string} type - Type: success, error, info
 */
function showToast(message, type = 'info') {
    // Check if you have a toast system (Bootstrap, custom, etc.)
    if (typeof StockSage !== 'undefined' && StockSage.showSuccess) {
        if (type === 'success') {
            StockSage.showSuccess(message);
        } else if (type === 'error') {
            StockSage.showError(message);
        } else {
            console.log(message);
        }
    } else {
        // Fallback to console or simple alert
        console.log(`${type.toUpperCase()}: ${message}`);
        // Uncomment if you want alerts: alert(message);
    }
}