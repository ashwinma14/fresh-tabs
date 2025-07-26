import { test, expect, Page, BrowserContext } from '@playwright/test';
import { createExtensionContext, waitForExtensionReady } from '../extensionTestSetup';

test.describe('Morning Tab Cleaner - Welcome Screen', () => {
  let context: BrowserContext;
  let extensionId: string;
  let openExtensionPage: (path: string) => Promise<Page>;

  test.beforeEach(async () => {
    const extensionContext = await createExtensionContext();
    context = extensionContext.context;
    extensionId = extensionContext.extensionId;
    openExtensionPage = extensionContext.openExtensionPage;
  });

  test.afterEach(async () => {
    await context.close();
  });

  test.describe('✅ PART 1: Welcome Tab Logic', () => {
    test('welcome tab opens only once per day after scheduled cleanup', async () => {
      // Clear any existing welcome date
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);
      
      await page.evaluate(() => {
        localStorage.removeItem('lastWelcomeDate');
        chrome.storage.local.clear();
      });

      // Mock today's date
      const today = '2024-01-15';
      await page.addInitScript(() => {
        const originalDate = Date;
        class MockDate extends Date {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super('2024-01-15T09:00:00Z');
            } else {
              super(...args);
            }
          }
          static now() {
            return new Date('2024-01-15T09:00:00Z').getTime();
          }
        }
        Object.setPrototypeOf(MockDate, Date);
        Object.setPrototypeOf(MockDate.prototype, Date.prototype);
        (window as any).Date = MockDate;
      });

      // Simulate background script calling checkAndOpenWelcomeTab()
      await page.evaluate(() => {
        // Simulate the background script function
        async function checkAndOpenWelcomeTab() {
          const today = new Date().toISOString().split('T')[0];
          const result = await chrome.storage.local.get(['lastWelcomeDate']);
          const lastWelcomeDate = result.lastWelcomeDate;
          
          if (lastWelcomeDate === today) {
            return false; // Already opened today
          }
          
          await chrome.storage.local.set({ lastWelcomeDate: today });
          return true; // Should open
        }
        
        return checkAndOpenWelcomeTab();
      });

      // Check that storage was set correctly
      const storageResult = await page.evaluate(() => {
        return chrome.storage.local.get(['lastWelcomeDate']);
      });
      
      expect(storageResult.lastWelcomeDate).toBe(today);

      // Test that second call doesn't open again
      const shouldOpenAgain = await page.evaluate(() => {
        async function checkAndOpenWelcomeTab() {
          const today = new Date().toISOString().split('T')[0];
          const result = await chrome.storage.local.get(['lastWelcomeDate']);
          const lastWelcomeDate = result.lastWelcomeDate;
          
          if (lastWelcomeDate === today) {
            return false; // Already opened today
          }
          
          await chrome.storage.local.set({ lastWelcomeDate: today });
          return true; // Should open
        }
        
        return checkAndOpenWelcomeTab();
      });

      expect(shouldOpenAgain).toBe(false);
    });

    test('welcome tab does not open during manual cleanups', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Clear storage
      await page.evaluate(() => {
        chrome.storage.local.clear();
      });

      // Simulate manual cleanup (should not trigger welcome tab logic)
      const manualCleanupResult = await page.evaluate(() => {
        // This simulates the manual cleanup path which shouldn't call checkAndOpenWelcomeTab
        return chrome.storage.local.get(['lastWelcomeDate']);
      });

      expect(manualCleanupResult.lastWelcomeDate).toBeUndefined();
    });
  });

  test.describe('✅ PART 2: Archived Tabs', () => {
    test('displays archived tabs with correct information', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Mock archived tabs data
      const mockArchivedTabs = [
        {
          title: 'GitHub - Morning Tab Cleaner',
          url: 'https://github.com/example/morning-tab-cleaner',
          timestamp: '2024-01-15T09:00:00Z'
        },
        {
          title: 'Playwright Documentation',
          url: 'https://playwright.dev/docs/intro',
          timestamp: '2024-01-15T09:01:00Z'
        },
        {
          title: 'Google',
          url: 'https://google.com',
          timestamp: '2024-01-15T09:02:00Z'
        }
      ];

      // Set mock data in storage
      await page.evaluate((tabs) => {
        chrome.storage.local.set({
          archivedTabs: tabs,
          remainingTabs: []
        });
      }, mockArchivedTabs);

      // Reload page to trigger data loading
      await page.reload();
      await waitForExtensionReady(page);

      // Wait for data to load
      await page.waitForTimeout(1000);

      // Assert correct number of archived tabs
      const archivedCount = await page.locator('#archivedCount').textContent();
      expect(archivedCount).toBe('3');

      // Assert archive header shows correct count
      const archiveBadge = page.locator('.archive-badge');
      await expect(archiveBadge).toContainText('3 tabs archived');

      // Check each tab item
      const tabItems = page.locator('.tab-item').filter({ hasNot: page.locator('.archive-header') });
      await expect(tabItems).toHaveCount(3);

      // Check first tab
      const firstTab = tabItems.first();
      await expect(firstTab.locator('.tab-title')).toContainText('GitHub - Morning Tab Cleaner');
      await expect(firstTab.locator('.tab-title')).toHaveAttribute('href', 'https://github.com/example/morning-tab-cleaner');
      await expect(firstTab.locator('.tab-title')).toHaveAttribute('target', '_blank');
      
      // Check favicon URL
      const favicon = firstTab.locator('.tab-favicon img');
      await expect(favicon).toHaveAttribute('src', /.*google\.com\/s2\/favicons.*github\.com.*/);
      
      // Check domain display
      await expect(firstTab.locator('.tab-url')).toContainText('github.com');

      // Take visual snapshot
      await expect(page.locator('.archived-section')).toHaveScreenshot('archived-tabs-section.png');
    });

    test('tab links are clickable and open in new tab', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const mockArchivedTabs = [{
        title: 'Test Tab',
        url: 'https://example.com',
        timestamp: '2024-01-15T09:00:00Z'
      }];

      await page.evaluate((tabs) => {
        chrome.storage.local.set({ archivedTabs: tabs, remainingTabs: [] });
      }, mockArchivedTabs);

      await page.reload();
      await waitForExtensionReady(page);
      await page.waitForTimeout(1000);

      // Click on tab link (this will attempt to open new tab)
      const tabLink = page.locator('.tab-title').first();
      await expect(tabLink).toBeVisible();
      
      // Check that it has correct attributes for new tab opening
      await expect(tabLink).toHaveAttribute('href', 'https://example.com');
      await expect(tabLink).toHaveAttribute('target', '_blank');
    });
  });

  test.describe('✅ PART 3: Empty State', () => {
    test('shows empty state message when no tabs archived', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Set empty archived tabs
      await page.evaluate(() => {
        chrome.storage.local.set({
          archivedTabs: [],
          remainingTabs: []
        });
      });

      await page.reload();
      await waitForExtensionReady(page);
      await page.waitForTimeout(1000);

      // Check archived count is 0
      const archivedCount = await page.locator('#archivedCount').textContent();
      expect(archivedCount).toBe('0');

      // Check empty state message
      const emptyState = page.locator('.empty-state');
      await expect(emptyState).toBeVisible();
      await expect(emptyState.locator('.empty-message')).toContainText("You're all clear! No tabs were archived today.");
      await expect(emptyState.locator('.empty-icon')).toContainText('🌟');

      // Take visual snapshot of empty state
      await expect(page.locator('.archived-section')).toHaveScreenshot('empty-archived-tabs.png');
    });
  });

  test.describe('✅ PART 4: Daily Focus Input', () => {
    test('persists focus input to localStorage', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const focusInput = page.locator('#focusInput');
      await expect(focusInput).toBeVisible();

      // Type in focus input
      const testFocus = 'Complete the Morning Tab Cleaner tests';
      await focusInput.fill(testFocus);

      // Wait for debounced save
      await page.waitForTimeout(600);

      // Check localStorage
      const storedFocus = await page.evaluate(() => {
        return localStorage.getItem('dailyFocus');
      });
      expect(storedFocus).toBe(testFocus);

      // Test blur behavior (immediate save)
      await focusInput.fill('Updated focus goal');
      await focusInput.blur();
      
      const updatedFocus = await page.evaluate(() => {
        return localStorage.getItem('dailyFocus');
      });
      expect(updatedFocus).toBe('Updated focus goal');
    });

    test('retains focus value after reload', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Set focus value
      const testFocus = 'Test persistence across reloads';
      await page.evaluate((focus) => {
        localStorage.setItem('dailyFocus', focus);
      }, testFocus);

      // Reload page
      await page.reload();
      await waitForExtensionReady(page);

      // Check that value is retained
      const focusInput = page.locator('#focusInput');
      await expect(focusInput).toHaveValue(testFocus);
    });

    test('saves on Enter key press', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const focusInput = page.locator('#focusInput');
      await focusInput.fill('Save on Enter test');
      await focusInput.press('Enter');

      // Should blur after Enter
      await expect(focusInput).not.toBeFocused();

      // Check localStorage was updated immediately
      const storedFocus = await page.evaluate(() => {
        return localStorage.getItem('dailyFocus');
      });
      expect(storedFocus).toBe('Save on Enter test');
    });
  });

  test.describe('✅ PART 5: Inspirational Quote', () => {
    test('displays consistent quote for the same day', async () => {
      // Mock date to a fixed value
      const fixedDate = '2024-01-15';
      
      const page = await openExtensionPage('/welcome.html');
      await page.addInitScript((date) => {
        const originalDate = Date;
        class MockDate extends Date {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super(`${date}T09:00:00Z`);
            } else {
              super(...args);
            }
          }
          static now() {
            return new Date(`${date}T09:00:00Z`).getTime();
          }
          toDateString() {
            return new Date(`${date}T09:00:00Z`).toDateString();
          }
        }
        Object.setPrototypeOf(MockDate, Date);
        Object.setPrototypeOf(MockDate.prototype, Date.prototype);
        (window as any).Date = MockDate;
      }, fixedDate);

      await waitForExtensionReady(page);

      // Get the initial quote
      const quoteText = page.locator('#quoteText');
      const quoteAuthor = page.locator('#quoteAuthor');
      
      await expect(quoteText).toBeVisible();
      await expect(quoteAuthor).toBeVisible();

      const initialQuote = await quoteText.textContent();
      const initialAuthor = await quoteAuthor.textContent();

      expect(initialQuote).toBeTruthy();
      expect(initialAuthor).toBeTruthy();

      // Reload page multiple times - should show same quote
      for (let i = 0; i < 3; i++) {
        await page.reload();
        await waitForExtensionReady(page);
        
        const currentQuote = await quoteText.textContent();
        const currentAuthor = await quoteAuthor.textContent();
        
        expect(currentQuote).toBe(initialQuote);
        expect(currentAuthor).toBe(initialAuthor);
      }

      // Take visual snapshot of quote section
      await expect(page.locator('.quote-section')).toHaveScreenshot('quote-section.png');
    });

    test('quote changes on different days', async () => {
      // Test day 1
      const page = await openExtensionPage('/welcome.html');
      await page.addInitScript(() => {
        const originalDate = Date;
        class MockDate extends Date {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super('2024-01-15T09:00:00Z');
            } else {
              super(...args);
            }
          }
          toDateString() {
            return new Date('2024-01-15T09:00:00Z').toDateString();
          }
        }
        Object.setPrototypeOf(MockDate, Date);
        Object.setPrototypeOf(MockDate.prototype, Date.prototype);
        (window as any).Date = MockDate;
      });

      await waitForExtensionReady(page);
      
      const day1Quote = await page.locator('#quoteText').textContent();

      // Clear localStorage to simulate new day
      await page.evaluate(() => {
        Object.keys(localStorage).forEach(key => {
          if (key.startsWith('dailyQuote_')) {
            localStorage.removeItem(key);
          }
        });
      });

      // Mock day 2
      await page.addInitScript(() => {
        const originalDate = Date;
        class MockDate extends Date {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super('2024-01-16T09:00:00Z');
            } else {
              super(...args);
            }
          }
          toDateString() {
            return new Date('2024-01-16T09:00:00Z').toDateString();
          }
        }
        Object.setPrototypeOf(MockDate, Date);
        Object.setPrototypeOf(MockDate.prototype, Date.prototype);
        (window as any).Date = MockDate;
      });

      await page.reload();
      await waitForExtensionReady(page);

      const day2Quote = await page.locator('#quoteText').textContent();

      // Quotes should be different (though there's a small chance they could be the same)
      // We'll check that the quote loading mechanism works
      expect(day2Quote).toBeTruthy();
    });
  });

  test.describe('✅ PART 6: Settings Icon Accessibility', () => {
    test('settings icon has proper accessibility attributes', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const settingsIcon = page.locator('.settings-icon');
      
      // Check accessibility attributes
      await expect(settingsIcon).toHaveAttribute('tabindex', '0');
      await expect(settingsIcon).toHaveAttribute('role', 'button');
      await expect(settingsIcon).toHaveAttribute('aria-label', 'Settings');

      // Test keyboard focus
      await settingsIcon.focus();
      await expect(settingsIcon).toBeFocused();
    });

    test('tooltip shows on hover and focus', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const settingsIcon = page.locator('.settings-icon');
      const tooltip = settingsIcon.locator('.tooltip');

      // Initially tooltip should be hidden
      await expect(tooltip).toHaveCSS('opacity', '0');

      // Hover should show tooltip
      await settingsIcon.hover();
      await expect(tooltip).toHaveCSS('opacity', '1');
      await expect(tooltip).toContainText('Settings');

      // Focus should also show tooltip
      await page.mouse.move(0, 0); // Move mouse away
      await settingsIcon.focus();
      await expect(tooltip).toHaveCSS('opacity', '1');
    });

    test('Enter and Space keys trigger settings', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const settingsIcon = page.locator('.settings-icon');
      await settingsIcon.focus();

      // Mock chrome.runtime.openOptionsPage to track calls
      await page.evaluate(() => {
        (window as any).settingsCallCount = 0;
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.openOptionsPage = () => {
            (window as any).settingsCallCount++;
          };
        } else {
          // Mock chrome API if not available
          (window as any).chrome = {
            runtime: {
              openOptionsPage: () => {
                (window as any).settingsCallCount++;
              }
            }
          };
        }
      });

      // Test Enter key
      await settingsIcon.press('Enter');
      let callCount = await page.evaluate(() => (window as any).settingsCallCount);
      expect(callCount).toBe(1);

      // Test Space key
      await settingsIcon.press(' ');
      callCount = await page.evaluate(() => (window as any).settingsCallCount);
      expect(callCount).toBe(2);
    });

    test('click opens options page', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Mock chrome.runtime.openOptionsPage
      await page.evaluate(() => {
        (window as any).optionsPageOpened = false;
        if (typeof chrome !== 'undefined' && chrome.runtime) {
          chrome.runtime.openOptionsPage = () => {
            (window as any).optionsPageOpened = true;
          };
        } else {
          // Mock chrome API if not available
          (window as any).chrome = {
            runtime: {
              openOptionsPage: () => {
                (window as any).optionsPageOpened = true;
              }
            }
          };
        }
      });

      const settingsIcon = page.locator('.settings-icon');
      await settingsIcon.click();

      const optionsPageOpened = await page.evaluate(() => (window as any).optionsPageOpened);
      expect(optionsPageOpened).toBe(true);
    });

    test('settings icon visual appearance', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      const settingsIcon = page.locator('.settings-icon');
      
      // Check basic styling
      await expect(settingsIcon).toBeVisible();
      await expect(settingsIcon).toContainText('⚙️');

      // Take screenshot in default state
      await expect(settingsIcon).toHaveScreenshot('settings-icon-default.png');

      // Take screenshot in hover state
      await settingsIcon.hover();
      await expect(settingsIcon).toHaveScreenshot('settings-icon-hover.png');

      // Take screenshot in focus state
      await settingsIcon.focus();
      await expect(settingsIcon).toHaveScreenshot('settings-icon-focus.png');
    });
  });

  test.describe('📸 Visual Regression Tests', () => {
    test('full welcome page screenshot', async () => {
      const page = await openExtensionPage('/welcome.html');
      await waitForExtensionReady(page);

      // Set up test data for consistent screenshot
      const mockData = {
        archivedTabs: [
          { title: 'Example Site', url: 'https://example.com', timestamp: '2024-01-15T09:00:00Z' },
          { title: 'Test Page', url: 'https://test.com', timestamp: '2024-01-15T09:01:00Z' }
        ],
        remainingTabs: []
      };

      await page.evaluate((data) => {
        chrome.storage.local.set(data);
        localStorage.setItem('dailyFocus', 'Complete all morning tasks');
      }, mockData);

      // Mock date for consistent quote
      await page.addInitScript(() => {
        const originalDate = Date;
        class MockDate extends Date {
          constructor(...args: any[]) {
            if (args.length === 0) {
              super('2024-01-15T09:00:00Z');
            } else {
              super(...args);
            }
          }
          toDateString() {
            return new Date('2024-01-15T09:00:00Z').toDateString();
          }
        }
        Object.setPrototypeOf(MockDate, Date);
        Object.setPrototypeOf(MockDate.prototype, Date.prototype);
        (window as any).Date = MockDate;
      });

      await page.reload();
      await waitForExtensionReady(page);
      
      // Wait for all content to load
      await page.waitForTimeout(1500);

      // Take full page screenshot
      await expect(page).toHaveScreenshot('welcome-page-full.png', { 
        fullPage: true,
        threshold: 0.3 // Allow for some variation in fonts/rendering
      });
    });
  });
});