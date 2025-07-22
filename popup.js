// Fresh Tabs Popup Script

// Global variables
let allArchivedData = {};
let currentSearchTerm = '';
let searchTimeout = null;

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  console.log('Fresh Tabs popup opened');
  
  try {
    // Clear badge when popup opens
    await clearBadge();
    
    await loadArchivedTabs();
    setupSearchFunctionality();
    setupManualCleanup();
    setupSettingsButton();
  } catch (error) {
    console.error('Error initializing popup:', error);
    showErrorState();
  }
});

/**
 * Clear the extension badge when popup is opened
 */
async function clearBadge() {
  try {
    if (chrome.action && chrome.action.setBadgeText) {
      await chrome.action.setBadgeText({ text: '' });
      console.log('Badge cleared');
    }
  } catch (error) {
    console.error('Error clearing badge:', error);
  }
}

/**
 * Load all archived tabs from storage and display them
 * IMPORTANT: This function only READS data, it never closes tabs
 */
async function loadArchivedTabs() {
  try {
    console.log('Loading archived tabs...');
    
    // Get all data from chrome storage
    const storage = await chrome.storage.local.get(null);
    
    // Filter out non-date keys (like 'settings') and only keep YYYY-MM-DD format
    allArchivedData = {};
    Object.keys(storage).forEach(key => {
      // Check if key matches YYYY-MM-DD format
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Array.isArray(storage[key])) {
        allArchivedData[key] = storage[key];
      }
    });
    
    console.log(`Found ${Object.keys(allArchivedData).length} days of archived data`);
    
    // Display the tabs
    displayArchivedTabs(allArchivedData);
    
  } catch (error) {
    console.error('Error loading archived tabs:', error);
    showErrorState();
  }
}

/**
 * Display archived tabs in the popup
 * @param {Object} data - The archived data to display
 */
function displayArchivedTabs(data) {
  const contentDiv = document.getElementById('content');
  
  if (!contentDiv) {
    console.error('Content div not found');
    return;
  }
  
  // Check if there's any archived data
  if (Object.keys(data).length === 0) {
    showEmptyState();
    return;
  }
  
  // Filter data based on current search term
  const filteredData = filterDataBySearch(data, currentSearchTerm);
  
  // Check if search returned no results
  if (Object.keys(filteredData).length === 0 && currentSearchTerm) {
    showNoResultsState();
    return;
  }
  
  // Sort dates in descending order (newest first)
  const dates = Object.keys(filteredData).sort((a, b) => new Date(b) - new Date(a));
  
  // Clear content
  contentDiv.innerHTML = '';
  
  // Display tabs for each date
  dates.forEach(date => {
    const tabs = filteredData[date];
    
    if (Array.isArray(tabs) && tabs.length > 0) {
      const dateSection = createDateSection(date, tabs);
      contentDiv.appendChild(dateSection);
    }
  });
}

/**
 * Create a date section with its tabs
 * @param {string} date - The date string (YYYY-MM-DD)
 * @param {Array} tabs - Array of tab objects
 * @returns {HTMLElement} The date section element
 */
function createDateSection(date, tabs) {
  // Create date section container
  const dateSection = document.createElement('div');
  dateSection.className = 'date-section';
  dateSection.setAttribute('data-date', date);
  dateSection.style.marginBottom = '20px';
  
  // Create clickable date header container
  const dateHeader = document.createElement('div');
  dateHeader.className = 'date-header';
  dateHeader.style.cssText = 'display: flex; align-items: center; cursor: pointer; padding: 4px 0;';
  
  // Create toggle arrow
  const toggleArrow = document.createElement('span');
  toggleArrow.className = 'toggle-arrow';
  toggleArrow.textContent = '🔽'; // Expanded by default
  toggleArrow.style.cssText = 'margin-right: 8px; font-size: 12px; transition: transform 0.2s ease;';
  
  // Create date heading
  const dateHeading = document.createElement('h2');
  dateHeading.textContent = formatDate(date);
  dateHeading.style.cssText = 'margin: 0; font-size: 16px; color: #333; border-bottom: 1px solid #eee; padding-bottom: 4px; flex: 1;';
  
  // Highlight date if it matches search term
  if (currentSearchTerm) {
    highlightSearchTerm(dateHeading, currentSearchTerm);
  }
  
  // Assemble header
  dateHeader.appendChild(toggleArrow);
  dateHeader.appendChild(dateHeading);
  dateSection.appendChild(dateHeader);
  
  // Create tab list container
  const tabListContainer = document.createElement('div');
  tabListContainer.className = 'tab-list-container';
  tabListContainer.style.cssText = 'overflow: hidden; transition: max-height 0.3s ease;';
  
  // Create tab list
  const tabList = document.createElement('ul');
  tabList.className = 'tab-list';
  tabList.style.cssText = 'list-style: none; padding: 0; margin: 8px 0 0 0;';
  
  // Filter tabs based on search term
  const filteredTabs = filterTabsBySearch(tabs, currentSearchTerm);
  
  filteredTabs.forEach(tab => {
    const tabItem = createTabItem(tab);
    tabList.appendChild(tabItem);
  });
  
  tabListContainer.appendChild(tabList);
  dateSection.appendChild(tabListContainer);
  
  // Add click handler for collapse/expand
  dateHeader.addEventListener('click', () => {
    toggleDateSection(dateSection, toggleArrow, tabListContainer);
  });
  
  return dateSection;
}

/**
 * Create a tab list item
 * @param {Object} tab - Tab object with url, title, timestamp
 * @returns {HTMLElement} The tab list item element
 */
function createTabItem(tab) {
  const listItem = document.createElement('li');
  listItem.style.marginBottom = '4px';
  
  const link = document.createElement('a');
  link.href = tab.url;
  link.target = '_blank'; // Ensure it opens in new tab
  link.rel = 'noopener noreferrer'; // Security best practice
  link.style.cssText = 'display: block; padding: 8px; color: #1a73e8; text-decoration: none; border-radius: 4px; transition: background-color 0.2s;';
  
  // Create tab title
  const titleElement = document.createElement('div');
  titleElement.style.cssText = 'font-weight: 500; margin-bottom: 2px; line-height: 1.4;';
  titleElement.textContent = tab.title || tab.url;
  
  // Create tab URL
  const urlElement = document.createElement('div');
  urlElement.style.cssText = 'font-size: 12px; color: #666; opacity: 0.8;';
  urlElement.textContent = tab.url;
  
  // Add highlighting if there's a search term
  if (currentSearchTerm) {
    highlightSearchTerm(titleElement, currentSearchTerm);
    highlightSearchTerm(urlElement, currentSearchTerm);
  }
  
  link.appendChild(titleElement);
  link.appendChild(urlElement);
  
  // Add hover effect
  link.addEventListener('mouseenter', () => {
    link.style.backgroundColor = '#f0f0f0';
  });
  link.addEventListener('mouseleave', () => {
    link.style.backgroundColor = 'transparent';
  });
  
  // SAFE click handler - only opens new tabs, never closes existing ones
  link.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    try {
      // IMPORTANT: This only OPENS a new tab, it never closes anything
      chrome.tabs.create({ 
        url: tab.url, 
        active: true 
      }).catch(error => {
        console.error('Error opening tab:', error);
        // Fallback: open in current window
        window.open(tab.url, '_blank');
      });
    } catch (error) {
      console.error('Error creating new tab:', error);
      // Fallback: open in current window
      window.open(tab.url, '_blank');
    }
  });
  
  listItem.appendChild(link);
  return listItem;
}

/**
 * Toggle the collapse/expand state of a date section
 * @param {HTMLElement} dateSection - The date section container
 * @param {HTMLElement} toggleArrow - The toggle arrow element
 * @param {HTMLElement} tabListContainer - The tab list container to show/hide
 */
function toggleDateSection(dateSection, toggleArrow, tabListContainer) {
  const isExpanded = !dateSection.hasAttribute('data-collapsed');
  
  if (isExpanded) {
    // Collapse the section
    dateSection.setAttribute('data-collapsed', 'true');
    toggleArrow.textContent = '▶️';
    tabListContainer.style.maxHeight = '0';
    tabListContainer.style.paddingTop = '0';
  } else {
    // Expand the section
    dateSection.removeAttribute('data-collapsed');
    toggleArrow.textContent = '🔽';
    tabListContainer.style.maxHeight = 'none';
    tabListContainer.style.paddingTop = '';
  }
}

/**
 * Setup search functionality with proper debouncing
 */
function setupSearchFunctionality() {
  const searchInput = document.getElementById('searchInput');
  
  if (!searchInput) {
    console.warn('Search input not found - continuing without search functionality');
    return;
  }
  
  // Add input event listener with 200ms debouncing
  searchInput.addEventListener('input', (e) => {
    // Clear previous timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
    // Set new timeout with 200ms delay
    searchTimeout = setTimeout(() => {
      const newSearchTerm = e.target.value.trim().toLowerCase();
      
      // Only update if search term actually changed
      if (newSearchTerm !== currentSearchTerm) {
        currentSearchTerm = newSearchTerm;
        displayArchivedTabs(allArchivedData);
      }
    }, 200);
  });
  
  // Clear search when ESC is pressed
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      searchInput.value = '';
      currentSearchTerm = '';
      displayArchivedTabs(allArchivedData);
    }
  });
  
  // Focus search input when popup opens for better UX
  setTimeout(() => {
    try {
      searchInput.focus();
    } catch (error) {
      // Ignore focus errors
    }
  }, 100);
}

/**
 * Filter archived data by search term (matches dates and tab content)
 * @param {Object} data - All archived data
 * @param {string} searchTerm - Search term to filter by (case-insensitive)
 * @returns {Object} Filtered data
 */
function filterDataBySearch(data, searchTerm) {
  if (!searchTerm) return data;
  
  const filtered = {};
  
  Object.keys(data).forEach(date => {
    const tabs = data[date];
    
    if (!Array.isArray(tabs)) return;
    
    // Check if date matches search term (both raw date and formatted date)
    const rawDateMatches = date.toLowerCase().includes(searchTerm);
    const formattedDateMatches = formatDate(date).toLowerCase().includes(searchTerm);
    const dateMatches = rawDateMatches || formattedDateMatches;
    
    if (dateMatches) {
      // If date matches, include all tabs for that date
      filtered[date] = tabs;
    } else {
      // Otherwise, filter tabs by title/URL
      const filteredTabs = filterTabsBySearch(tabs, searchTerm);
      if (filteredTabs.length > 0) {
        filtered[date] = filteredTabs;
      }
    }
  });
  
  return filtered;
}

/**
 * Filter tabs array by search term (matches title and URL)
 * @param {Array} tabs - Array of tab objects
 * @param {string} searchTerm - Search term to filter by (case-insensitive)
 * @returns {Array} Filtered tabs array
 */
function filterTabsBySearch(tabs, searchTerm) {
  if (!searchTerm || !Array.isArray(tabs)) return tabs;
  
  return tabs.filter(tab => {
    const title = (tab.title || '').toLowerCase();
    const url = (tab.url || '').toLowerCase();
    return title.includes(searchTerm) || url.includes(searchTerm);
  });
}

/**
 * Highlight search term in text content
 * @param {HTMLElement} element - Element to highlight text in
 * @param {string} searchTerm - Term to highlight
 */
function highlightSearchTerm(element, searchTerm) {
  if (!searchTerm || !element.textContent) return;
  
  const text = element.textContent;
  const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
  const highlightedText = text.replace(regex, '<mark style="background: yellow; padding: 1px 2px;">$1</mark>');
  
  if (highlightedText !== text) {
    element.innerHTML = highlightedText;
  }
}

/**
 * Escape special regex characters
 * @param {string} string - String to escape
 * @returns {string} Escaped string
 */
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Format date for display (e.g., "2024-03-15" becomes "March 15, 2024")
 * @param {string} dateString - Date string in YYYY-MM-DD format
 * @returns {string} Formatted date string
 */
function formatDate(dateString) {
  try {
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch (error) {
    return dateString; // Fallback to original string if parsing fails
  }
}

/**
 * Show empty state when no tabs are archived
 */
function showEmptyState() {
  const contentDiv = document.getElementById('content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon">📁</div>
      <div class="empty-state-title">No archives yet</div>
      <div class="empty-state-message">
        Come back tomorrow after your first cleanup.<br>
        Tabs will be automatically archived daily.
      </div>
    </div>
  `;
}

/**
 * Show no results state when search returns no matches
 */
function showNoResultsState() {
  const contentDiv = document.getElementById('content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div style="text-align: center; padding: 32px 20px; color: #666;">
      <div style="font-size: 32px; margin-bottom: 12px;">🔍</div>
      <div style="font-size: 15px; font-weight: 500; margin-bottom: 4px;">No matching tabs found</div>
      <div style="font-size: 13px;">
        Try adjusting your search terms or clear the search to browse by date.
      </div>
    </div>
  `;
}

/**
 * Show error state when loading fails
 */
function showErrorState() {
  const contentDiv = document.getElementById('content');
  if (!contentDiv) return;
  
  contentDiv.innerHTML = `
    <div style="text-align: center; padding: 40px 20px; color: #666;">
      <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
      <div style="font-size: 16px; font-weight: 500; margin-bottom: 8px;">Error loading archived tabs</div>
      <div style="font-size: 14px; line-height: 1.5;">
        Please try reopening the popup or check the extension permissions.
      </div>
    </div>
  `;
}

/**
 * Setup manual cleanup functionality
 */
function setupManualCleanup() {
  const manualCleanupBtn = document.getElementById('manualCleanupBtn');
  
  if (!manualCleanupBtn) {
    console.warn('Manual cleanup button not found - continuing without manual cleanup functionality');
    return;
  }
  
  // Add click event listener for manual cleanup
  manualCleanupBtn.addEventListener('click', async () => {
    try {
      console.log('Manual cleanup requested by user');
      
      // Disable button temporarily to prevent multiple clicks
      manualCleanupBtn.disabled = true;
      manualCleanupBtn.textContent = 'Archiving...';
      
      // Send message to background script to trigger manual cleanup
      await chrome.runtime.sendMessage({
        action: 'manualCleanup'
      });
      
      // Show success feedback
      manualCleanupBtn.textContent = '✅ Archived!';
      
      // Wait a moment, then reload archived tabs and reset button
      setTimeout(async () => {
        try {
          // Reload archived tabs to show the new data
          await loadArchivedTabs();
          
          // Reset button state
          manualCleanupBtn.disabled = false;
          manualCleanupBtn.textContent = 'Archive & Refresh Now';
        } catch (error) {
          console.error('Error reloading after manual cleanup:', error);
          manualCleanupBtn.disabled = false;
          manualCleanupBtn.textContent = 'Archive & Refresh Now';
        }
      }, 1500);
      
    } catch (error) {
      console.error('Error during manual cleanup:', error);
      
      // Reset button state on error
      manualCleanupBtn.disabled = false;
      manualCleanupBtn.textContent = 'Archive & Refresh Now';
      
      // Show error feedback
      setTimeout(() => {
        manualCleanupBtn.textContent = '❌ Error';
        setTimeout(() => {
          manualCleanupBtn.textContent = 'Archive & Refresh Now';
        }, 2000);
      }, 100);
    }
  });
}

/**
 * Setup settings button functionality
 */
function setupSettingsButton() {
  const settingsBtn = document.getElementById('settingsBtn');
  
  if (!settingsBtn) {
    console.warn('Settings button not found - continuing without settings functionality');
    return;
  }
  
  // Add click event listener to open options page
  settingsBtn.addEventListener('click', () => {
    try {
      console.log('Opening settings page');
      
      // Open options page using Chrome extension API
      chrome.runtime.openOptionsPage();
      
    } catch (error) {
      console.error('Error opening settings page:', error);
      
      // Fallback: try to open options page directly
      try {
        chrome.tabs.create({ 
          url: chrome.runtime.getURL('options.html'),
          active: true 
        });
      } catch (fallbackError) {
        console.error('Fallback settings page open failed:', fallbackError);
      }
    }
  });
}