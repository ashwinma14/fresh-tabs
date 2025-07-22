// Fresh Tabs Options Script

// Default settings configuration
const DEFAULT_SETTINGS = {
  archiveTime: '07:00',
  dailyCleanupEnabled: true, // Enable daily cleanup by default
  notificationsEnabled: true, // Enable notifications by default for better UX
  retentionDays: 30
};

// DOM elements
let archiveTimeInput;
let dailyCleanupEnabledInput;
let notificationsEnabledInput;
let retentionDaysInput;
let statusMessage;
let settingsForm;
let resetButton;
let nextArchivePreview;
let archiveTimeGroup;

// Initialize options page when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  initializeElements();
  await loadSettings();
  setupEventListeners();
  updateNextArchivePreview(); // Initial preview update
});

/**
 * Initialize DOM element references
 */
function initializeElements() {
  archiveTimeInput = document.getElementById('archiveTime');
  dailyCleanupEnabledInput = document.getElementById('dailyCleanupEnabled');
  notificationsEnabledInput = document.getElementById('notificationsEnabled');
  retentionDaysInput = document.getElementById('retentionDays');
  statusMessage = document.getElementById('statusMessage');
  settingsForm = document.getElementById('settingsForm');
  resetButton = document.getElementById('resetButton');
  nextArchivePreview = document.getElementById('nextArchivePreview');
  archiveTimeGroup = document.getElementById('archiveTimeGroup');
}

/**
 * Load settings from chrome.storage.local and populate the form
 */
async function loadSettings() {
  try {
    // Get settings from storage under the 'settings' key
    const result = await chrome.storage.local.get(['settings']);
    
    // Use stored settings or fall back to defaults
    const settings = result.settings || DEFAULT_SETTINGS;
    
    // Populate form inputs with loaded settings
    archiveTimeInput.value = settings.archiveTime || DEFAULT_SETTINGS.archiveTime;
    dailyCleanupEnabledInput.checked = settings.dailyCleanupEnabled !== undefined ? settings.dailyCleanupEnabled : DEFAULT_SETTINGS.dailyCleanupEnabled;
    notificationsEnabledInput.checked = settings.notificationsEnabled || DEFAULT_SETTINGS.notificationsEnabled;
    retentionDaysInput.value = settings.retentionDays || DEFAULT_SETTINGS.retentionDays;
    
    // Update UI state based on daily cleanup setting
    updateArchiveTimeVisibility();
    
    // Update archive preview after loading settings
    updateNextArchivePreview();
    
    console.log('Settings loaded:', settings);
    
  } catch (error) {
    console.error('Error loading settings:', error);
    showStatus('❌ Error loading settings. Using defaults.', 'error');
    
    // Fall back to default settings if loading fails
    archiveTimeInput.value = DEFAULT_SETTINGS.archiveTime;
    dailyCleanupEnabledInput.checked = DEFAULT_SETTINGS.dailyCleanupEnabled;
    notificationsEnabledInput.checked = DEFAULT_SETTINGS.notificationsEnabled;
    retentionDaysInput.value = DEFAULT_SETTINGS.retentionDays;
    
    // Update UI state
    updateArchiveTimeVisibility();
  }
}

/**
 * Setup event listeners for form interactions
 */
function setupEventListeners() {
  // Listen for form submission (manual save button)
  settingsForm.addEventListener('submit', handleFormSubmit);
  
  // Listen for individual input changes for immediate saving
  archiveTimeInput.addEventListener('change', handleInputChange);
  dailyCleanupEnabledInput.addEventListener('change', handleDailyCleanupChange);
  notificationsEnabledInput.addEventListener('change', handleInputChange);
  retentionDaysInput.addEventListener('change', handleInputChange);
  
  // Listen for archive time changes to update preview
  archiveTimeInput.addEventListener('input', updateNextArchivePreview);
  archiveTimeInput.addEventListener('change', updateNextArchivePreview);
  
  // Listen for reset button clicks
  resetButton.addEventListener('click', handleResetToDefaults);
  
  // Additional validation for retention days input
  retentionDaysInput.addEventListener('input', validateRetentionDays);
}

/**
 * Handle form submission
 * @param {Event} e - Form submit event
 */
async function handleFormSubmit(e) {
  e.preventDefault();
  await saveSettings();
}

/**
 * Handle individual input changes for immediate saving
 * @param {Event} e - Input change event
 */
async function handleInputChange(e) {
  // Add small delay to avoid excessive saves during rapid changes
  clearTimeout(handleInputChange.timeout);
  handleInputChange.timeout = setTimeout(async () => {
    await saveSettings();
  }, 300);
}

/**
 * Handle daily cleanup toggle change with UI updates
 * @param {Event} e - Input change event
 */
async function handleDailyCleanupChange(e) {
  // Update UI visibility immediately
  updateArchiveTimeVisibility();
  
  // Save settings with delay to avoid excessive saves
  clearTimeout(handleDailyCleanupChange.timeout);
  handleDailyCleanupChange.timeout = setTimeout(async () => {
    await saveSettings();
  }, 300);
}

/**
 * Validate retention days input in real-time
 * @param {Event} e - Input event
 */
function validateRetentionDays(e) {
  const value = parseInt(e.target.value);
  const min = parseInt(e.target.min) || 1;
  
  // Ensure value is at least the minimum
  if (value < min && e.target.value !== '') {
    e.target.value = min;
  }
}

/**
 * Save current form settings to chrome.storage.local
 */
async function saveSettings() {
  try {
    // Get current form values
    const settings = {
      archiveTime: archiveTimeInput.value,
      dailyCleanupEnabled: dailyCleanupEnabledInput.checked,
      notificationsEnabled: notificationsEnabledInput.checked,
      retentionDays: parseInt(retentionDaysInput.value)
    };
    
    // Validate settings before saving
    if (!validateSettings(settings)) {
      return; // Don't save if validation fails
    }
    
    // Save settings to storage under the 'settings' key
    await chrome.storage.local.set({ settings });
    
    console.log('Settings saved:', settings);
    showStatus('Settings saved', 'success');
    
    // Update archive preview after saving
    updateNextArchivePreview();
    
  } catch (error) {
    console.error('Error saving settings:', error);
    showStatus('❌ Error saving settings. Please try again.', 'error');
  }
}

/**
 * Validate settings object
 * @param {Object} settings - Settings to validate
 * @returns {boolean} True if valid, false otherwise
 */
function validateSettings(settings) {
  // Validate archive time format (HH:MM)
  const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
  if (!settings.archiveTime || !timeRegex.test(settings.archiveTime)) {
    showStatus('❌ Invalid time format. Please use HH:MM format.', 'error');
    archiveTimeInput.focus();
    return false;
  }
  
  // Validate retention days (must be positive integer >= 1)
  if (!Number.isInteger(settings.retentionDays) || settings.retentionDays < 1) {
    showStatus('❌ Retention days must be a positive number (at least 1).', 'error');
    retentionDaysInput.focus();
    return false;
  }
  
  return true;
}

/**
 * Show status message to user with smooth fade in/out animations
 * @param {string} message - Message to display
 * @param {string} type - Message type: 'success' or 'error'
 */
function showStatus(message, type = 'success') {
  if (!statusMessage) {
    console.warn('Status message element not found');
    return;
  }

  // Clear any existing timeout
  if (showStatus.hideTimeout) {
    clearTimeout(showStatus.hideTimeout);
    showStatus.hideTimeout = null;
  }

  // Set message content and type
  statusMessage.textContent = message;
  statusMessage.className = `status-message ${type}`;
  
  // Show message with fade-in animation
  statusMessage.classList.add('show');
  
  // Auto-hide success messages after 2 seconds with fade-out
  if (type === 'success') {
    showStatus.hideTimeout = setTimeout(() => {
      hideStatus();
    }, 2000); // 2 seconds as requested
  }
  
  console.log(`Status shown: ${message} (${type})`);
}

/**
 * Hide status message with smooth fade-out animation
 */
function hideStatus() {
  if (!statusMessage) return;
  
  // Remove show class to trigger fade-out
  statusMessage.classList.remove('show');
  
  // Clean up timeout reference
  if (showStatus.hideTimeout) {
    clearTimeout(showStatus.hideTimeout);
    showStatus.hideTimeout = null;
  }
}

/**
 * Handle reset to defaults button click
 */
async function handleResetToDefaults() {
  try {
    // Ask for confirmation
    const confirmed = confirm('Are you sure you want to reset all settings to their default values?');
    if (!confirmed) {
      return;
    }
    
    // Set form inputs to default values
    archiveTimeInput.value = DEFAULT_SETTINGS.archiveTime;
    dailyCleanupEnabledInput.checked = DEFAULT_SETTINGS.dailyCleanupEnabled;
    notificationsEnabledInput.checked = DEFAULT_SETTINGS.notificationsEnabled;
    retentionDaysInput.value = DEFAULT_SETTINGS.retentionDays;
    
    // Update UI visibility
    updateArchiveTimeVisibility();
    
    // Save default settings immediately
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
    
    console.log('Settings reset to defaults:', DEFAULT_SETTINGS);
    showStatus('Settings saved', 'success');
    
    // Update archive preview after reset
    updateNextArchivePreview();
    
  } catch (error) {
    console.error('Error resetting settings:', error);
    showStatus('❌ Error resetting settings. Please try again.', 'error');
  }
}

/**
 * Update archive time section visibility based on daily cleanup setting
 */
function updateArchiveTimeVisibility() {
  if (!dailyCleanupEnabledInput || !archiveTimeGroup) {
    return;
  }
  
  const isEnabled = dailyCleanupEnabledInput.checked;
  
  if (isEnabled) {
    archiveTimeGroup.style.opacity = '1';
    archiveTimeGroup.style.pointerEvents = 'auto';
    archiveTimeInput.disabled = false;
  } else {
    archiveTimeGroup.style.opacity = '0.5';
    archiveTimeGroup.style.pointerEvents = 'none';
    archiveTimeInput.disabled = true;
    // Clear preview when disabled
    if (nextArchivePreview) {
      nextArchivePreview.textContent = '';
    }
  }
}

/**
 * Update the next archive preview text
 */
function updateNextArchivePreview() {
  if (!nextArchivePreview || !archiveTimeInput || !dailyCleanupEnabledInput) {
    return;
  }
  
  // Don't show preview if daily cleanup is disabled
  if (!dailyCleanupEnabledInput.checked) {
    nextArchivePreview.textContent = '';
    return;
  }
  
  const timeValue = archiveTimeInput.value;
  
  if (!timeValue) {
    nextArchivePreview.textContent = '';
    return;
  }
  
  try {
    // Parse the time input (HH:MM format)
    const [hours, minutes] = timeValue.split(':').map(num => parseInt(num, 10));
    
    // Create a Date object for tomorrow at the specified time
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(hours, minutes, 0, 0);
    
    // Check if the archive time is later today instead of tomorrow
    const today = new Date(now);
    today.setHours(hours, minutes, 0, 0);
    
    let targetDate;
    let dayLabel;
    
    if (today > now) {
      // Archive time hasn't passed today
      targetDate = today;
      dayLabel = 'today';
    } else {
      // Archive time has passed today, so it's tomorrow
      targetDate = tomorrow;
      dayLabel = 'tomorrow';
    }
    
    // Format the time for display (e.g., "7:00 AM")
    const timeString = targetDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    nextArchivePreview.textContent = `Next archive will run at ${timeString} ${dayLabel}.`;
    
  } catch (error) {
    console.error('Error updating archive preview:', error);
    nextArchivePreview.textContent = '';
  }
}

/**
 * Get current settings (utility function)
 * @returns {Promise<Object>} Current settings object
 */
async function getCurrentSettings() {
  try {
    const result = await chrome.storage.local.get(['settings']);
    return result.settings || DEFAULT_SETTINGS;
  } catch (error) {
    console.error('Error getting current settings:', error);
    return DEFAULT_SETTINGS;
  }
}