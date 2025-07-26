import { test, expect } from '@playwright/test';
import { createExtensionContext, waitForExtensionReady } from '../extensionTestSetup';

test.describe('Morning Tab Cleaner Extension', () => {
  
  test('welcome page loads correctly', async () => {
    const { context, extensionId, openExtensionPage } = await createExtensionContext();
    
    try {
      // Open welcome page
      const page = await openExtensionPage('/welcome.html');
      
      // Wait for extension context to be ready
      await waitForExtensionReady(page);
      
      // Check if the greeting is present
      await expect(page.locator('.greeting')).toBeVisible();
      await expect(page.locator('.greeting')).toContainText('Good Morning');
      
      // Check if main sections are present
      await expect(page.locator('.archived-section')).toBeVisible();
      await expect(page.locator('.focus-section')).toBeVisible();
      await expect(page.locator('.quick-links-section')).toBeVisible();
      
      // Check if settings icon is present and functional
      const settingsIcon = page.locator('.settings-icon');
      await expect(settingsIcon).toBeVisible();
      
      // Test keyboard accessibility
      await settingsIcon.focus();
      await expect(settingsIcon).toBeFocused();
      
    } finally {
      await context.close();
    }
  });
  
  test('popup page loads correctly', async () => {
    const { context, openExtensionPage } = await createExtensionContext();
    
    try {
      // Open popup page
      const page = await openExtensionPage('/popup.html');
      
      // Wait for extension context to be ready
      await waitForExtensionReady(page);
      
      // Add your popup-specific tests here
      // Example: Check if popup content is loaded
      await expect(page).toHaveTitle(/Morning Tab Cleaner/i);
      
    } finally {
      await context.close();
    }
  });
  
  test('options page loads correctly', async () => {
    const { context, openExtensionPage } = await createExtensionContext();
    
    try {
      // Open options page
      const page = await openExtensionPage('/options.html');
      
      // Wait for extension context to be ready
      await waitForExtensionReady(page);
      
      // Add your options-specific tests here
      // Example: Check if options form is present
      await expect(page).toHaveTitle(/Options|Settings/i);
      
    } finally {
      await context.close();
    }
  });
  
  test('settings icon opens options page', async () => {
    const { context, openExtensionPage } = await createExtensionContext();
    
    try {
      // Open welcome page
      const welcomePage = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(welcomePage);
      
      // Click settings icon
      const settingsIcon = welcomePage.locator('.settings-icon');
      await settingsIcon.click();
      
      // Wait for options page to open
      const pages = context.pages();
      await context.waitForEvent('page');
      
      // Check if options page opened
      const newPages = context.pages().filter(p => !pages.includes(p));
      expect(newPages.length).toBeGreaterThan(0);
      
      const optionsPage = newPages[0];
      await optionsPage.waitForLoadState();
      
      // Verify it's the options page
      const url = optionsPage.url();
      expect(url).toContain('options.html');
      
    } finally {
      await context.close();
    }
  });
});