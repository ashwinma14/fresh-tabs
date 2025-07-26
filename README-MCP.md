# MCP & Playwright Setup for Morning Tab Cleaner

This directory contains MCP (Model Context Protocol) and Playwright configurations for testing the Morning Tab Cleaner Chrome extension.

## 🏗️ Setup Overview

The configuration automatically:
- Loads your Chrome extension as an unpacked extension
- Extracts the dynamic extension ID
- Creates proper `chrome-extension://` URLs for testing
- Provides helpers for extension page navigation

## 📁 File Structure

```
morning-tab-cleaner/
├── mcp.config.ts           # MCP configuration for exploration
├── playwright.config.ts    # Playwright browser/test configuration  
├── extensionTestSetup.ts   # Extension loading helpers
├── tests/
│   └── example.spec.ts     # Example extension tests
└── README-MCP.md          # This file
```

## 🚀 Running MCP Exploration

From the extension directory, run:

```bash
npx playwright mcp
```

This will:
1. Launch Chromium with your extension loaded
2. Extract the extension ID dynamically
3. Navigate to and explore:
   - `chrome-extension://<id>/welcome.html`
   - `chrome-extension://<id>/popup.html` 
   - `chrome-extension://<id>/options.html`
4. Generate exploration reports in `./mcp-results/`

## 🧪 Running Tests

```bash
npx playwright test
```

View test results:
```bash
npx playwright show-report
```

## ⚙️ Configuration Details

### Extension Loading
- Automatically detects extension path (`./dist/`, `./src/`, `./build/`, or `./`)
- Looks for `manifest.json` to confirm extension directory
- Uses `launchPersistentContext` with `--load-extension` flag
- Extracts extension ID from `chrome://extensions` page

### MCP Configuration
- **Project Name**: "Morning Tab Cleaner"
- **Base URL**: Dynamically replaced with actual extension ID
- **Exploration Paths**: All three HTML pages
- **Screenshots**: Enabled for visual documentation
- **URL Patterns**: Configured to follow extension-specific links

### Playwright Configuration  
- **Headless**: Disabled (required for extensions)
- **Workers**: 1 (extensions work better single-threaded)
- **Global Setup**: Handles extension loading
- **Viewport**: Optimized for extension pages

## 🛠️ Helper Functions

### `createExtensionContext()`
Creates a new browser context with the extension loaded:

```typescript
const { context, extensionId, openExtensionPage } = await createExtensionContext();

// Open any extension page
const page = await openExtensionPage('/welcome.html');
```

### `getExtensionUrls()`
Generate extension URLs:

```typescript
const urls = getExtensionUrls(extensionId);
// Returns: { welcome: 'chrome-extension://...', popup: '...', options: '...' }
```

### `waitForExtensionReady()`
Wait for Chrome extension APIs to be available:

```typescript
await waitForExtensionReady(page);
// Now chrome.runtime, chrome.storage, etc. are available
```

## 🔍 What to Expect

When running `npx playwright mcp`:

1. **Browser Launch**: Chromium opens with your extension loaded
2. **Extension Detection**: Automatically finds and extracts extension ID
3. **Page Navigation**: Visits each HTML page in your extension
4. **Element Discovery**: Maps interactive elements, forms, buttons
5. **Screenshot Capture**: Takes screenshots of each page state
6. **Report Generation**: Creates detailed exploration reports

## 📋 Prerequisites

Make sure your extension has:
- A valid `manifest.json` file
- The HTML files (`welcome.html`, `popup.html`, `options.html`) 
- Playwright and MCP installed as devDependencies

## 🐛 Troubleshooting

**Extension not loading?**
- Check that `manifest.json` exists in the detected path
- Verify extension files are in the correct directory
- Look at console output for path detection logs

**Extension ID extraction failing?**
- Make sure your extension has a proper name in `manifest.json`
- The setup looks for "Morning Tab Cleaner" or similar names

**Pages not loading?**
- Ensure your HTML files exist and are valid
- Check browser console for any extension errors
- Verify the extension loads properly in regular Chrome

## 🎯 Customization

To modify exploration behavior:
- Edit `explorePaths` in `mcp.config.ts`
- Adjust `urlPatterns` to include/exclude specific pages
- Modify viewport sizes for different page types
- Add custom selectors to ignore during exploration

To add more test cases:
- Create new `.spec.ts` files in `./tests/`
- Use the helper functions from `extensionTestSetup.ts`
- Follow the pattern in `example.spec.ts`