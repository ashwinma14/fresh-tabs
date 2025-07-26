import { test, expect } from '@playwright/test';
import path from 'path';

test.describe('Simple Welcome Page Test', () => {
  test('welcome page loads as file:// URL', async ({ page }) => {
    // Load the welcome.html file directly
    const welcomePath = path.resolve(__dirname, '../welcome.html');
    await page.goto(`file://${welcomePath}`);
    
    // Check if basic elements are present
    const greeting = page.locator('.greeting');
    await expect(greeting).toBeVisible();
    await expect(greeting).toContainText('Good'); // Accept Morning, Afternoon, or Evening
    
    // Check if main sections are present
    await expect(page.locator('.archived-section')).toBeVisible();
    await expect(page.locator('.focus-section')).toBeVisible();
    await expect(page.locator('.quick-links-section')).toBeVisible();
    
    // Test focus input
    const focusInput = page.locator('#focusInput');
    await expect(focusInput).toBeVisible();
    await focusInput.fill('Test focus');
    await expect(focusInput).toHaveValue('Test focus');
    
    console.log('✅ Basic welcome page functionality working');
  });
  
  test('settings icon is present and accessible', async ({ page }) => {
    const welcomePath = path.resolve(__dirname, '../welcome.html');
    await page.goto(`file://${welcomePath}`);
    
    const settingsIcon = page.locator('.settings-icon');
    await expect(settingsIcon).toBeVisible();
    await expect(settingsIcon).toHaveAttribute('tabindex', '0');
    await expect(settingsIcon).toHaveAttribute('role', 'button');
    
    // Test focus
    await settingsIcon.focus();
    await expect(settingsIcon).toBeFocused();
    
    console.log('✅ Settings icon accessibility working');
  });
});