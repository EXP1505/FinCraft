document.addEventListener('DOMContentLoaded', function() {
    // Initialize watchlist functionality
    initializeWatchlist();
    
    // Load user's watchlist to set button states
    loadWatchlistStates();
});

function initializeWatchlist() {
    const watchlistBtns = document.querySelectorAll('.watchlist-btn');
    
    watchlistBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            const symbol = this.dataset.symbol;
            const isInWatchlist = this.classList.contains('in-watchlist');
            
            // Disable button during request
            this.disabled = true;
            
            if (isInWatchlist) {
                removeFromWatchlist(symbol, this);
            } else {
                addToWatchlist(symbol, this);
            }
        });
    });
}

function loadWatchlistStates() {
    fetch('/api/watchlist')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const watchlistSymbols = data.data.map(item => item.symbol);
                updateButtonStates(watchlistSymbols);
            }
        })
        .catch(error => {
            console.error('Error loading watchlist:', error);
        });
}

function updateButtonStates(watchlistSymbols) {
    const watchlistBtns = document.querySelectorAll('.watchlist-btn');
    
    watchlistBtns.forEach(btn => {
        const symbol = btn.dataset.symbol;
        const star = btn.querySelector('i');
        
        if (watchlistSymbols.includes(symbol)) {
            btn.classList.add('in-watchlist');
            star.style.color = '#ffd700';
            star.classList.remove('far');
            star.classList.add('fas');
        } else {
            btn.classList.remove('in-watchlist');
            star.style.color = '';
            star.classList.remove('fas');
            star.classList.add('far');
        }
    });
}

function addToWatchlist(symbol, button) {
    fetch('/api/watchlist/add', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
            symbol: symbol,
            name: symbol // You can get the actual company name if available
        })
    })
    .then(response => response.json())
    .then(data => {
        button.disabled = false;
        
        if (data.success) {
            button.classList.add('in-watchlist');
            const star = button.querySelector('i');
            star.style.color = '#ffd700';
            star.classList.remove('far');
            star.classList.add('fas');
            showToast('Added to watchlist!', 'success');
        } else {
            showToast(data.message || 'Failed to add to watchlist', 'error');
        }
    })
    .catch(error => {
        button.disabled = false;
        console.error('Error:', error);
        showToast('Error adding to watchlist', 'error');
    });
}

function removeFromWatchlist(symbol, button) {
    fetch('/api/watchlist/remove', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symbol: symbol })
    })
    .then(response => response.json())
    .then(data => {
        button.disabled = false;
        
        if (data.success) {
            button.classList.remove('in-watchlist');
            const star = button.querySelector('i');
            star.style.color = '';
            star.classList.remove('fas');
            star.classList.add('far');
            showToast('Removed from watchlist', 'success');
        } else {
            showToast(data.message || 'Failed to remove from watchlist', 'error');
        }
    })
    .catch(error => {
        button.disabled = false;
        console.error('Error:', error);
        showToast('Error removing from watchlist', 'error');
    });
}

function showToast(message, type) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create new toast
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#4CAF50' : '#f44336'};
        color: white;
        border-radius: 8px;
        z-index: 1000;
        opacity: 0;
        transition: opacity 0.3s ease;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    `;
    
    document.body.appendChild(toast);
    
    // Animate in
    setTimeout(() => toast.style.opacity = '1', 100);
    
    // Animate out and remove
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (document.body.contains(toast)) {
                document.body.removeChild(toast);
            }
        }, 300);
    }, 3000);
}