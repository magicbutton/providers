import { z } from 'zod';
import { createContract } from '@magicbutton.cloud/messaging';
import { ChromeExtensionServerFactory } from '../chrome-extension-server-factory';
import { createBackgroundConfig } from '../component-configs';

// Define a contract for the extension
const extensionContract = createContract({
  name: 'extension',
  events: {
    // Event sent when user settings are updated
    'settings:updated': z.object({
      darkMode: z.boolean(),
      notifications: z.boolean(),
      syncEnabled: z.boolean()
    }),
    // Event sent when user performs an important action
    'user:action': z.object({
      action: z.string(),
      timestamp: z.number(),
      details: z.record(z.any()).optional()
    })
  },
  requests: {
    // Request to get current settings
    'settings:get': {
      input: z.object({}),
      output: z.object({
        darkMode: z.boolean(),
        notifications: z.boolean(),
        syncEnabled: z.boolean(),
        lastUpdated: z.number()
      })
    },
    // Request to update settings
    'settings:update': {
      input: z.object({
        darkMode: z.boolean().optional(),
        notifications: z.boolean().optional(),
        syncEnabled: z.boolean().optional()
      }),
      output: z.object({
        success: z.boolean(),
        settings: z.object({
          darkMode: z.boolean(),
          notifications: z.boolean(),
          syncEnabled: z.boolean(),
          lastUpdated: z.number()
        })
      })
    },
    // Request to perform an action from a content script
    'page:performAction': {
      input: z.object({
        url: z.string(),
        action: z.string(),
        data: z.record(z.any()).optional()
      }),
      output: z.object({
        success: z.boolean(),
        result: z.any().optional(),
        error: z.string().optional()
      })
    }
  }
});

// Current settings (would typically be stored in extension storage)
let currentSettings = {
  darkMode: false,
  notifications: true,
  syncEnabled: true,
  lastUpdated: Date.now()
};

// Initialize the background server
async function initBackgroundServer() {
  // Create the server factory
  const serverFactory = new ChromeExtensionServerFactory(console);
  
  // Create a background configuration
  const config = createBackgroundConfig({
    namespace: 'my-extension', 
    heartbeatInterval: 60000 // 1 minute
  });
  
  // Create the server
  const server = serverFactory.create(config);
  
  // Register request handlers
  
  // Handler for settings:get request
  server.onRequest('settings:get', async (payload, context) => {
    console.log('Received settings:get request', { context });
    
    // You might load settings from storage here
    return currentSettings;
  });
  
  // Handler for settings:update request
  server.onRequest('settings:update', async (payload, context) => {
    console.log('Received settings:update request', { payload, context });
    
    // Update settings
    currentSettings = {
      ...currentSettings,
      ...payload,
      lastUpdated: Date.now()
    };
    
    // Save settings to storage (example)
    await chrome.storage.sync.set({ settings: currentSettings });
    
    // Broadcast the settings update to all components
    await server.broadcast('settings:updated', {
      darkMode: currentSettings.darkMode,
      notifications: currentSettings.notifications,
      syncEnabled: currentSettings.syncEnabled
    });
    
    return {
      success: true,
      settings: currentSettings
    };
  });
  
  // Handler for page:performAction request (from content scripts)
  server.onRequest('page:performAction', async (payload, context) => {
    console.log('Received page:performAction request', { payload, context });
    
    try {
      // Perform the requested action
      // This is just an example - real implementation would depend on the action
      let result;
      
      switch (payload.action) {
        case 'capture-screenshot':
          // Example: Capture screenshot of the tab
          result = await captureScreenshot(context.meta?.tabId);
          break;
          
        case 'fetch-data':
          // Example: Fetch data from an external API
          result = await fetchExternalData(payload.data);
          break;
          
        default:
          throw new Error(`Unknown action: ${payload.action}`);
      }
      
      // Broadcast the user action to all components
      await server.broadcast('user:action', {
        action: payload.action,
        timestamp: Date.now(),
        details: { url: payload.url, success: true }
      });
      
      return {
        success: true,
        result
      };
    } catch (error) {
      // Handle errors
      console.error('Error performing action:', error);
      
      return {
        success: false,
        error: error.message || 'Unknown error'
      };
    }
  });
  
  // Start the server
  await server.start();
  console.log('Background server started');
  
  // Handle extension lifecycle events
  chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extension installed/updated', details);
    // Initialize default settings on install
    if (details.reason === 'install') {
      chrome.storage.sync.set({ settings: currentSettings });
    }
  });
}

// Example helper functions (implementation details omitted)
async function captureScreenshot(tabId: number): Promise<string> {
  // Implementation would use chrome.tabs.captureVisibleTab
  return 'data:image/png;base64,...';
}

async function fetchExternalData(params: any): Promise<any> {
  // Implementation would use fetch or similar
  return { data: 'example data' };
}

// Initialize the background server when the script loads
initBackgroundServer().catch(console.error);