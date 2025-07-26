import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Project configuration
  projectName: 'Morning Tab Cleaner',
  
  // Base URL will be dynamically replaced with actual extension ID
  baseURL: 'chrome-extension://EXTENSION_ID_PLACEHOLDER',
  
  // Pages to explore
  explorePaths: [
    '/welcome.html',
    '/popup.html', 
    '/options.html'
  ],
  
  // MCP-specific settings
  mcp: {
    // Wait for extension context to be ready
    waitForLoadState: 'networkidle',
    
    // Extension-specific selectors to ignore during exploration
    ignoreSelectors: [
      // Chrome extension internal elements
      '[data-chrome-extension]',
      // Skip any debugging/dev elements
      '[data-testid*="debug"]'
    ],
    
    // Custom exploration options
    exploration: {
      maxDepth: 3,
      followLinks: true,
      captureScreenshots: true,
      
      // Extension-specific navigation rules
      urlPatterns: {
        include: [
          'chrome-extension://*/*.html',
          'chrome-extension://*/welcome.html',
          'chrome-extension://*/popup.html',
          'chrome-extension://*/options.html'
        ],
        exclude: [
          'chrome-extension://*/background.html',
          'chrome-extension://*/service-worker.js'
        ]
      }
    },
    
    // Viewport settings for extension pages
    viewport: {
      // Popup dimensions
      popup: { width: 400, height: 600 },
      // Welcome/options page dimensions  
      fullPage: { width: 1200, height: 800 }
    }
  },
  
  // Use custom test setup for extension loading
  testSetup: './extensionTestSetup.ts',
  
  // Output configuration
  outputDir: './mcp-results',
  
  // Timeout settings for extension loading
  timeout: 30000,
  
  // Browser configuration
  use: {
    // Will be overridden by playwright.config.ts
    browserName: 'chromium',
    headless: false // Extensions require non-headless mode
  }
});