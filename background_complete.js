// Fresh Tabs Background Script - Complete Version with Working Toast

// Default settings for fallback
const DEFAULT_SETTINGS = {
  archiveTime: '07:00',
  dailyCleanupEnabled: true, // Enable daily cleanup by default
  notificationsEnabled: true,
  retentionDays: 30
};

console.log('🔧 Fresh Tabs loading...');

// Message handler for popup and testing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('📨 Received message:', message);
  
  if (message.action === 'manualCleanup') {
    console.log('🧹 Manual cleanup requested');
    cleanupTabs(true).then(() => {
      console.log('✅ Manual cleanup completed');
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('❌ Manual cleanup failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  if (message.action === 'testNotification') {
    console.log('🧪 Test notification requested');
    showToast('Good morning! We\'ve cleaned up 5 tabs to help you start your day fresh.').then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Async response
  }
  
  return false;
});

// Initialize extension
chrome.runtime.onInstalled.addListener(async () => {
  console.log('Fresh Tabs installed');
  
  try {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || DEFAULT_SETTINGS;
    
    // Only schedule cleanup if daily cleanup is enabled
    if (settings.dailyCleanupEnabled !== false) { // Default to true if not set
      await scheduleNextCleanup(settings.archiveTime);
      console.log(`Fresh Tabs initialized with cleanup time: ${settings.archiveTime}`);
    } else {
      console.log('Fresh Tabs initialized with daily cleanup disabled');
    }
  } catch (error) {
    console.error('Error initializing Fresh Tabs:', error);
    // Only schedule default if daily cleanup is enabled by default
    if (DEFAULT_SETTINGS.dailyCleanupEnabled) {
      await scheduleNextCleanup(DEFAULT_SETTINGS.archiveTime);
    }
  }
});

// Handle alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'morningCleanup') {
    console.log('Morning cleanup alarm triggered');
    cleanupTabs();
  }
});

// Storage change listener for settings updates
chrome.storage.onChanged.addListener(async (changes, areaName) => {
  if (areaName !== 'local') return;
  
  if (changes.settings && changes.settings.newValue) {
    const newSettings = changes.settings.newValue;
    const oldSettings = changes.settings.oldValue || {};
    
    // Handle daily cleanup enable/disable changes
    const dailyCleanupChanged = newSettings.dailyCleanupEnabled !== oldSettings.dailyCleanupEnabled;
    const archiveTimeChanged = newSettings.archiveTime !== oldSettings.archiveTime;
    
    if (dailyCleanupChanged || archiveTimeChanged) {
      // Always clear existing alarms first
      await chrome.alarms.clear('morningCleanup');
      
      if (newSettings.dailyCleanupEnabled !== false) {
        // Schedule new alarm if daily cleanup is enabled
        await scheduleNextCleanup(newSettings.archiveTime);
        console.log(`Daily cleanup ${dailyCleanupChanged ? 'enabled' : 'rescheduled'} for ${newSettings.archiveTime}`);
      } else {
        // Daily cleanup is disabled
        console.log('Daily cleanup disabled - alarm cleared');
      }
    }
  }
});

/**
 * Schedule the next cleanup alarm
 */
async function scheduleNextCleanup(archiveTime) {
  try {
    const [hours, minutes] = archiveTime.split(':').map(num => parseInt(num, 10));
    
    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error(`Invalid time format: ${archiveTime}`);
    }
    
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(hours, minutes, 0, 0);
    
    if (targetTime <= now) {
      targetTime.setDate(targetTime.getDate() + 1);
    }
    
    await chrome.alarms.clear('morningCleanup');
    await chrome.alarms.create('morningCleanup', {
      when: targetTime.getTime(),
      periodInMinutes: 24 * 60
    });
    
    console.log(`Next cleanup scheduled for: ${targetTime.toLocaleString()}`);
    
  } catch (error) {
    console.error('Error scheduling cleanup:', error);
  }
}

/**
 * Main cleanup function - archives and closes unpinned tabs
 */
async function cleanupTabs(isManual = false) {
  try {
    console.log(`Starting ${isManual ? 'manual' : 'scheduled'} tab cleanup...`);
    
    const tabs = await chrome.tabs.query({});
    if (tabs.length === 0) {
      console.log('No tabs to archive');
      return;
    }
    
    // Separate pinned and unpinned tabs
    const pinnedTabs = tabs.filter(tab => tab.pinned);
    const unpinnedTabs = tabs.filter(tab => !tab.pinned);
    
    if (unpinnedTabs.length === 0) {
      console.log('No unpinned tabs to archive - all tabs are pinned');
      return;
    }
    
    // Prepare tab data for storage
    const tabData = unpinnedTabs.map(tab => ({
      url: tab.url,
      title: tab.title,
      timestamp: new Date().toISOString()
    }));
    
    // Get today's date
    const today = new Date().toISOString().split('T')[0];
    
    // Save to storage
    await chrome.storage.local.set({
      [today]: tabData
    });
    
    console.log(`Archived ${unpinnedTabs.length} unpinned tabs`);
    console.log(`Preserved ${pinnedTabs.length} pinned tabs`);
    
    // Close unpinned tabs
    const unpinnedTabIds = unpinnedTabs.map(tab => tab.id);
    await chrome.tabs.remove(unpinnedTabIds);
    
    // Show toast notification
    await showToast(getWarmMessage(unpinnedTabs.length));
    
    // Set badge
    await setBadge(unpinnedTabs.length);
    
    // Clean up old archives
    await cleanupOldArchives();
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  }
}

/**
 * Get warm message based on time of day
 */
function getWarmMessage(tabCount) {
  const hour = new Date().getHours();
  
  if (hour >= 5 && hour < 12) {
    return `Good morning! We've cleaned up ${tabCount} tabs to help you start your day fresh.`;
  } else if (hour >= 12 && hour < 18) {
    return `Good afternoon! We've just archived ${tabCount} tabs for you — enjoy your day.`;
  } else {
    return `Good evening! ${tabCount} tabs have been archived — ready for a clean start tomorrow.`;
  }
}

/**
 * Show toast notification (using our working method)
 */
async function showToast(message) {
  try {
    // Get user settings
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || DEFAULT_SETTINGS;
    
    if (!settings.notificationsEnabled) {
      console.log('Notifications disabled - skipping toast');
      return;
    }
    
    console.log('🍞 Showing toast:', message);
    
    // Find any regular web tab
    const tabs = await chrome.tabs.query({});
    const regularTab = tabs.find(tab => 
      tab.url && 
      !tab.url.startsWith('chrome://') && 
      !tab.url.startsWith('chrome-extension://')
    );
    
    if (!regularTab) {
      console.log('⚠️ No regular web tabs for toast');
      return;
    }
    
    // Inject toast
    await chrome.scripting.executeScript({
      target: { tabId: regularTab.id },
      func: function(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          background: #c79300 !important;
          color: white !important;
          padding: 15px 20px !important;
          border-radius: 8px !important;
          z-index: 2147483647 !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif !important;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15) !important;
          transform: translateX(100%) !important;
          transition: transform 0.3s ease !important;
          max-width: 320px !important;
          word-wrap: break-word !important;
        `;
        toast.innerHTML = `🌅 ${message}`;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.transform = 'translateX(0)', 100);
        setTimeout(() => {
          toast.style.transform = 'translateX(100%)';
          setTimeout(() => toast.remove(), 300);
        }, 4000);
      },
      args: [message]
    });
    
    console.log('✅ Toast shown successfully');
    
  } catch (error) {
    console.error('❌ Error showing toast:', error);
  }
}

/**
 * Set badge on extension icon
 */
async function setBadge(tabCount) {
  try {
    await chrome.action.setBadgeText({ text: tabCount.toString() });
    await chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
    console.log(`Badge set with count: ${tabCount}`);
  } catch (error) {
    console.error('Error setting badge:', error);
  }
}

/**
 * Clean up old archives
 */
async function cleanupOldArchives() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    const settings = result.settings || DEFAULT_SETTINGS;
    const retentionDays = settings.retentionDays || 30;
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    const allData = await chrome.storage.local.get(null);
    const keysToRemove = [];
    
    Object.keys(allData).forEach(key => {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key)) {
        const archiveDate = new Date(key + 'T00:00:00');
        if (archiveDate < cutoffDate) {
          keysToRemove.push(key);
        }
      }
    });
    
    if (keysToRemove.length > 0) {
      await chrome.storage.local.remove(keysToRemove);
      console.log(`Cleaned up ${keysToRemove.length} old archives`);
    }
    
  } catch (error) {
    console.error('Error cleaning up old archives:', error);
  }
}

// Test function
globalThis.testToast = () => showToast('Test message from Fresh Tabs!');

console.log('✅ Fresh Tabs loaded successfully');