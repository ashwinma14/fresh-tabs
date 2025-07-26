import { chromium, BrowserContext, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

export interface ExtensionTestContext {
  context: BrowserContext;
  extensionId: string;
  getExtensionUrl: (path: string) => string;
  openExtensionPage: (pagePath: string) => Promise<Page>;
}

/**
 * Global setup function for Playwright
 */
async function globalSetup() {
  console.log('🚀 Setting up Chrome extension test environment...');
  
  // Determine extension path (try both dist and src)
  const extensionPath = getExtensionPath();
  console.log(`📁 Loading extension from: ${extensionPath}`);
  
  // Launch browser with extension loaded
  const { context, extensionId } = await launchBrowserWithExtension(extensionPath);
  
  console.log(`✅ Extension loaded with ID: ${extensionId}`);
  
  // Store extension ID for tests
  process.env.EXTENSION_ID = extensionId;
  process.env.EXTENSION_PATH = extensionPath;
  
  // Close the context (tests will create their own)
  await context.close();
  
  return async () => {
    console.log('🧹 Cleaning up extension test environment...');
  };
}

/**
 * Create a new browser context with the extension loaded
 */
export async function createExtensionContext(): Promise<ExtensionTestContext> {
  const extensionPath = process.env.EXTENSION_PATH || getExtensionPath();
  const { context, extensionId } = await launchBrowserWithExtension(extensionPath);
  
  return {
    context,
    extensionId,
    getExtensionUrl: (path: string) => `chrome-extension://${extensionId}${path.startsWith('/') ? path : '/' + path}`,
    openExtensionPage: async (pagePath: string) => {
      const url = `chrome-extension://${extensionId}${pagePath.startsWith('/') ? pagePath : '/' + pagePath}`;
      const page = await context.newPage();
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      return page;
    }
  };
}

/**
 * Launch Chromium with extension loaded and extract extension ID
 */
async function launchBrowserWithExtension(extensionPath: string): Promise<{ context: BrowserContext, extensionId: string }> {
  // Launch browser with extension
  const context = await chromium.launchPersistentContext('', {
    headless: false,
    args: [
      `--load-extension=${extensionPath}`,
      '--disable-extensions-except=' + extensionPath,
      '--disable-web-security',
      '--disable-features=TranslateUI',
      '--disable-ipc-flooding-protection',
      '--disable-background-timer-throttling',
      '--disable-renderer-backgrounding',
      '--disable-backgrounding-occluded-windows',
      '--disable-component-extensions-with-background-pages',
      '--allow-running-insecure-content',
      '--disable-blink-features=AutomationControlled',
      '--disable-dev-shm-usage',
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-extensions-file-access-check',
      '--allow-file-access-from-files',
      '--enable-experimental-extension-apis',
    ],
    viewport: { width: 1200, height: 800 }
  });

  // Try multiple methods to get extension ID
  let extensionId: string | null = null;

  try {
    // Method 1: Use chrome://extensions-internals (more reliable)
    const page = await context.newPage();
    await page.goto('chrome://extensions-internals');
    await page.waitForTimeout(2000);
    
    extensionId = await page.evaluate(() => {
      const pre = document.querySelector('pre');
      if (pre) {
        const text = pre.textContent || '';
        const match = text.match(/"id":\s*"([a-z]+)"/);
        return match ? match[1] : null;
      }
      return null;
    });
    
    await page.close();
  } catch (e) {
    console.log('Method 1 failed:', e);
  }

  if (!extensionId) {
    try {
      // Method 2: Try chrome://extensions with better error handling
      const page = await context.newPage();
      await page.goto('chrome://extensions');
      
      // Enable developer mode
      try {
        const devModeToggle = page.locator('#developer-mode');
        const isVisible = await devModeToggle.isVisible({ timeout: 5000 });
        if (isVisible) {
          const isChecked = await devModeToggle.isChecked();
          if (!isChecked) {
            await devModeToggle.click();
            await page.waitForTimeout(2000);
          }
        }
      } catch (e) {
        console.log('Developer mode toggle failed:', e);
      }
      
      // Wait longer for extensions to load
      await page.waitForTimeout(3000);
      
      extensionId = await page.evaluate(() => {
        const extensions = document.querySelectorAll('extensions-item');
        console.log(`Found ${extensions.length} extensions`);
        
        for (const extension of extensions) {
          try {
            const nameElement = extension.shadowRoot?.querySelector('#name');
            const name = nameElement?.textContent?.trim();
            console.log(`Extension name: ${name}`);
            
            if (name === 'Fresh Tabs' || name === 'Morning Tab Cleaner' || 
                name?.includes('Fresh') || name?.includes('Tab')) {
              const idElement = extension.shadowRoot?.querySelector('#extension-id');
              const id = idElement?.textContent?.replace('ID: ', '')?.trim();
              console.log(`Found matching extension ID: ${id}`);
              return id;
            }
          } catch (e) {
            console.log('Error accessing extension shadow DOM:', e);
          }
        }
        
        // Fallback: get any extension ID
        const firstExtension = extensions[0];
        if (firstExtension?.shadowRoot) {
          const idElement = firstExtension.shadowRoot.querySelector('#extension-id');
          const id = idElement?.textContent?.replace('ID: ', '')?.trim();
          console.log(`Fallback extension ID: ${id}`);
          return id;
        }
        
        return null;
      });
      
      await page.close();
    } catch (e) {
      console.log('Method 2 failed:', e);
    }
  }

  if (!extensionId) {
    // Method 3: Generate a predictable ID and try to access the extension directly
    console.log('Trying method 3: Direct extension access');
    const page = await context.newPage();
    
    // Try some common extension URLs to see if we can find the right one
    const testIds = [
      'abcdefghijklmnopqrstuvwxyzabcdef', // Example ID
      'bcdefghijklmnopqrstuvwxyzabcdefa',
      'cdefghijklmnopqrstuvwxyzabcdefab'
    ];
    
    for (const testId of testIds) {
      try {
        await page.goto(`chrome-extension://${testId}/manifest.json`);
        const content = await page.content();
        if (content.includes('Fresh Tabs') || content.includes('Morning Tab Cleaner')) {
          extensionId = testId;
          break;
        }
      } catch (e) {
        // Expected to fail for most IDs
      }
    }
    
    await page.close();
  }

  // If all methods fail, use a mock ID for testing purposes
  if (!extensionId) {
    console.warn('Could not determine actual extension ID, using mock ID for testing');
    extensionId = 'mock-extension-id-for-testing';
  }

  // Test if we can actually access the extension pages
  try {
    const testPage = await context.newPage();
    await testPage.goto(`chrome-extension://${extensionId}/welcome.html`, { timeout: 10000 });
    console.log(`✅ Successfully accessed extension page at chrome-extension://${extensionId}/welcome.html`);
    await testPage.close();
  } catch (e) {
    console.warn(`⚠️ Could not access extension page: ${e}`);
    // Try to find the actual working extension ID by brute force
    const pages = await context.pages();
    const testPage = pages[0] || await context.newPage();
    
    try {
      // Navigate to chrome://extensions and get any working extension ID
      await testPage.goto('chrome://extensions');
      await testPage.waitForTimeout(2000);
      
      const workingId = await testPage.evaluate(async () => {
        const extensions = document.querySelectorAll('extensions-item');
        for (const ext of extensions) {
          try {
            const idElement = ext.shadowRoot?.querySelector('#extension-id');
            const id = idElement?.textContent?.replace('ID: ', '')?.trim();
            if (id) {
              // Test this ID by trying to fetch its manifest
              try {
                const response = await fetch(`chrome-extension://${id}/manifest.json`);
                if (response.ok) {
                  const manifest = await response.json();
                  if (manifest.name === 'Fresh Tabs' || manifest.name?.includes('Fresh') || manifest.name?.includes('Tab')) {
                    return id;
                  }
                }
              } catch (e) {
                // This ID doesn't work
              }
            }
          } catch (e) {
            // Skip this extension
          }
        }
        return null;
      });
      
      if (workingId) {
        console.log(`✅ Found working extension ID: ${workingId}`);
        extensionId = workingId;
      }
    } catch (e) {
      console.warn('Could not verify extension access');
    }
  }

  return { context, extensionId };
}

/**
 * Determine the correct extension path
 */
function getExtensionPath(): string {
  const possiblePaths = [
    path.resolve('./dist'),
    path.resolve('./src'),
    path.resolve('./build'),
    path.resolve('./')
  ];
  
  for (const extensionPath of possiblePaths) {
    // Check if manifest.json exists
    const manifestPath = path.join(extensionPath, 'manifest.json');
    if (fs.existsSync(manifestPath)) {
      console.log(`📋 Found manifest.json at: ${manifestPath}`);
      return extensionPath;
    }
  }
  
  // Default to current directory
  console.warn('⚠️ Could not find manifest.json, using current directory');
  return path.resolve('./');
}

/**
 * Helper function for MCP to get extension URLs
 */
export function getExtensionUrls(extensionId?: string): Record<string, string> {
  const id = extensionId || process.env.EXTENSION_ID || 'EXTENSION_ID_PLACEHOLDER';
  
  return {
    welcome: `chrome-extension://${id}/welcome.html`,
    popup: `chrome-extension://${id}/popup.html`,
    options: `chrome-extension://${id}/options.html`,
  };
}

/**
 * Helper function to wait for extension to be ready
 */
export async function waitForExtensionReady(page: Page, timeout = 10000): Promise<void> {
  await page.waitForFunction(
    () => typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id,
    { timeout }
  );
}

// Export for global setup
export default globalSetup;