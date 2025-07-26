// Welcome screen functionality for Morning Tab Cleaner extension

document.addEventListener('DOMContentLoaded', function() {
    initializeWelcomeScreen();
});

function initializeWelcomeScreen() {
    loadTabData();
    loadDailyFocus();
    setupFocusAutoSave();
    loadDailyQuote();
    setupSettingsKeyboardAccess();
}

// Load and display tab data from storage
function loadTabData() {
    // Get archived tabs data from Chrome storage
    chrome.storage.local.get(['archivedTabs', 'remainingTabs'], function(result) {
        const archivedTabs = result.archivedTabs || [];
        const remainingTabs = result.remainingTabs || [];
        
        // Update badge counts
        document.getElementById('archivedCount').textContent = archivedTabs.length;
        document.getElementById('remainingCount').textContent = remainingTabs.length;
        
        // Populate archived tabs list
        displayArchivedTabs(archivedTabs);
    });
}

// Display archived tabs in the scrollable list
function displayArchivedTabs(tabs) {
    const tabsList = document.getElementById('archivedTabsList');
    
    if (tabs.length === 0) {
        tabsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🌟</div>
                <div class="empty-message">You're all clear! No tabs were archived today.</div>
            </div>
        `;
        return;
    }
    
    // Add total count badge at the top
    const totalCountHtml = `
        <div class="archive-header">
            <span class="archive-badge">${tabs.length} tab${tabs.length !== 1 ? 's' : ''} archived</span>
        </div>
    `;
    
    const tabsHtml = tabs.map(tab => {
        const faviconUrl = getFaviconUrl(tab.url);
        const safeUrl = escapeHtml(tab.url || '');
        const safeTitle = escapeHtml(tab.title || 'Untitled');
        
        return `
            <div class="tab-item">
                <div class="tab-favicon">
                    <img src="${faviconUrl}" alt="" class="favicon-img">
                    <span class="favicon-fallback">🌐</span>
                </div>
                <div class="tab-content">
                    <a href="${safeUrl}" target="_blank" class="tab-title" title="${safeTitle}">
                        ${safeTitle}
                    </a>
                    <div class="tab-url">${getDomainFromUrl(safeUrl)}</div>
                </div>
            </div>
        `;
    }).join('');
    
    tabsList.innerHTML = totalCountHtml + tabsHtml;
    
    // Add error handling for favicon images
    const faviconImages = tabsList.querySelectorAll('.favicon-img');
    faviconImages.forEach(img => {
        img.addEventListener('error', function() {
            this.classList.add('hidden');
            this.nextElementSibling.classList.add('show');
        });
    });
}

// Load daily focus from localStorage
function loadDailyFocus() {
    const focusValue = localStorage.getItem('dailyFocus') || '';
    const focusInput = document.getElementById('focusInput');
    if (focusInput) {
        focusInput.value = focusValue;
    }
}

// Setup auto-save for focus input with debouncing
function setupFocusAutoSave() {
    const focusInput = document.getElementById('focusInput');
    if (!focusInput) return;
    
    let saveTimeout;
    
    // Debounced save function
    function debouncedSave() {
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            saveDailyFocus(focusInput.value);
        }, 500); // 500ms debounce
    }
    
    // Save on input change (debounced)
    focusInput.addEventListener('input', debouncedSave);
    
    // Save immediately when user leaves the input
    focusInput.addEventListener('blur', function() {
        clearTimeout(saveTimeout);
        saveDailyFocus(focusInput.value);
    });
    
    // Save on Enter key
    focusInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            clearTimeout(saveTimeout);
            saveDailyFocus(focusInput.value);
            focusInput.blur(); // Remove focus for clean UX
        }
    });
}

// Save daily focus to localStorage
function saveDailyFocus(focusText) {
    try {
        localStorage.setItem('dailyFocus', focusText);
        console.log('Daily focus saved:', focusText);
    } catch (error) {
        console.error('Error saving daily focus:', error);
    }
}

// Motivational quotes aligned with fresh starts, clarity, and focus
const DAILY_QUOTES = [
    {
        text: "Every morning brings new potential, but only if you make the most of it.",
        author: "Unknown"
    },
    {
        text: "The secret of getting ahead is getting started with a clear mind.",
        author: "Mark Twain"
    },
    {
        text: "Today is the first day of the rest of your life. Make it count.",
        author: "Abbie Hoffman"
    },
    {
        text: "Clarity comes from action, not thought. Start with what you can see clearly today.",
        author: "Marie Forleo"
    },
    {
        text: "A clear mind is like a calm lake—it reflects the truth of what's important.",
        author: "Unknown"
    },
    {
        text: "Focus is about saying no to a thousand good things so you can say yes to the few great things.",
        author: "Steve Jobs"
    },
    {
        text: "The morning is when your mind is most receptive to new possibilities.",
        author: "Robin Sharma"
    },
    {
        text: "Start where you are, use what you have, do what you can—with a clear heart.",
        author: "Arthur Ashe"
    },
    {
        text: "Fresh starts are disguised as painful endings. Embrace the clarity that comes from letting go.",
        author: "Steve Maraboli"
    },
    {
        text: "The quality of your life depends on the quality of your daily decisions.",
        author: "Robin Sharma"
    },
    {
        text: "Simplicity is the ultimate sophistication. Clear your space, clear your mind.",
        author: "Leonardo da Vinci"
    },
    {
        text: "Each morning we are born again. What we do today matters most.",
        author: "Buddha"
    },
    {
        text: "Focus on what you can control, and let go of what you cannot.",
        author: "Epictetus"
    },
    {
        text: "The mind is everything. What you think about with focus becomes your reality.",
        author: "Buddha"
    },
    {
        text: "Progress, not perfection, is the goal. Take one clear step forward today.",
        author: "Unknown"
    }
];

// Load and display daily quote
function loadDailyQuote() {
    const today = new Date().toDateString();
    const storageKey = `dailyQuote_${today}`;
    
    // Check if we already have a quote for today
    const savedQuote = localStorage.getItem(storageKey);
    
    let selectedQuote;
    if (savedQuote) {
        try {
            selectedQuote = JSON.parse(savedQuote);
        } catch (e) {
            // If parsing fails, select a new quote
            selectedQuote = selectRandomQuote();
            saveDailyQuote(storageKey, selectedQuote);
        }
    } else {
        // Select and save a new quote for today
        selectedQuote = selectRandomQuote();
        saveDailyQuote(storageKey, selectedQuote);
    }
    
    // Display the quote
    displayQuote(selectedQuote);
}

// Select a random quote from the array
function selectRandomQuote() {
    const randomIndex = Math.floor(Math.random() * DAILY_QUOTES.length);
    return DAILY_QUOTES[randomIndex];
}

// Save quote to localStorage
function saveDailyQuote(storageKey, quote) {
    try {
        localStorage.setItem(storageKey, JSON.stringify(quote));
    } catch (error) {
        console.error('Error saving daily quote:', error);
    }
}

// Display quote in the DOM
function displayQuote(quote) {
    const quoteTextElement = document.getElementById('quoteText');
    const quoteAuthorElement = document.getElementById('quoteAuthor');
    
    if (quoteTextElement && quoteAuthorElement) {
        quoteTextElement.textContent = quote.text;
        quoteAuthorElement.textContent = quote.author;
    }
}

// Setup keyboard accessibility for settings icon
function setupSettingsKeyboardAccess() {
    const settingsIcon = document.getElementById('settingsIcon');
    if (!settingsIcon) return;
    
    // Handle click events
    settingsIcon.addEventListener('click', openSettings);
    
    // Handle keyboard events
    settingsIcon.addEventListener('keydown', function(event) {
        // Handle Enter and Space keys
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault(); // Prevent default behavior (like scrolling for space)
            openSettings();
        }
    });
}

// Handle settings icon click
function openSettings() {
    try {
        // Try to open extension options page
        if (chrome.runtime.openOptionsPage) {
            chrome.runtime.openOptionsPage();
        } else {
            // Fallback: open options.html in new tab
            const optionsUrl = chrome.runtime.getURL('options.html');
            chrome.tabs.create({ url: optionsUrl });
        }
    } catch (error) {
        console.error('Error opening settings:', error);
        // Final fallback: try to open options.html directly
        try {
            chrome.tabs.create({ url: chrome.runtime.getURL('options.html') });
        } catch (e) {
            console.error('Failed to open settings page:', e);
        }
    }
}


// Utility function to escape HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Get favicon URL for a given tab URL
function getFaviconUrl(url) {
    if (!url) return '';
    
    try {
        const domain = new URL(url).hostname;
        return `https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(url)}&sz=16`;
    } catch (e) {
        return '';
    }
}

// Extract domain from URL for display
function getDomainFromUrl(url) {
    if (!url) return '';
    
    try {
        const urlObj = new URL(url);
        return urlObj.hostname.replace(/^www\./, '');
    } catch (e) {
        return url.split('/')[0] || '';
    }
}

// Update greeting based on time of day
function updateGreeting() {
    const hour = new Date().getHours();
    let greeting;
    
    if (hour < 12) {
        greeting = 'Good Morning, your tabs have been refreshed.';
    } else if (hour < 17) {
        greeting = 'Good Afternoon, your tabs have been refreshed.';
    } else {
        greeting = 'Good Evening, your tabs have been refreshed.';
    }
    
    document.querySelector('.greeting').textContent = greeting;
}

// Initialize time-based greeting
updateGreeting();

// Handle extension messaging (if needed for real-time updates)
if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.type === 'tabsUpdated') {
            loadTabData();
        }
    });
}