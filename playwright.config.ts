import { defineConfig, devices } from '@playwright/test';
import path from 'path';

export default defineConfig({
  testDir: './tests',
  
  // Extension tests require non-headless mode
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Extensions work better with single worker
  
  reporter: 'html',
  
  use: {
    // Extensions require non-headless mode
    headless: false,
    
    // Trace settings
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    
    // Viewport for extension pages
    viewport: { width: 1200, height: 800 },
  },

  projects: [
    {
      name: 'chrome-extension',
      use: { 
        ...devices['Desktop Chrome'],
        // Custom browser launch for extension loading
        launchOptions: {
          // Use persistent context to load extension
          // This will be handled by extensionTestSetup.ts
        }
      },
    },
  ],

  // Global setup for extension loading
  globalSetup: './extensionTestSetup.ts',
  
  // Development server not needed for extension testing
  webServer: undefined,
});