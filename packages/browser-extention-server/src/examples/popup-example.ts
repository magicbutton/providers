import { z } from 'zod';
import { createContract, Client } from '@magicbutton.cloud/messaging';
import { ChromeExtensionServerFactory } from '../chrome-extension-server-factory';
import { createPopupConfig } from '../component-configs';

// Shared contract definition
const extensionContract = createContract({
  name: 'extension',
  events: {
    'settings:updated': z.object({
      darkMode: z.boolean(),
      notifications: z.boolean(),
      syncEnabled: z.boolean()
    }),
    'user:action': z.object({
      action: z.string(),
      timestamp: z.number(),
      details: z.record(z.any()).optional()
    })
  },
  requests: {
    'settings:get': {
      input: z.object({}),
      output: z.object({
        darkMode: z.boolean(),
        notifications: z.boolean(),
        syncEnabled: z.boolean(),
        lastUpdated: z.number()
      })
    },
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
    }
  }
});

// Popup-specific contract for UI interactions
const popupContract = createContract({
  name: 'popup',
  events: {
    'ui:action': z.object({
      element: z.string(),
      action: z.string(),
      value: z.any().optional()
    })
  },
  requests: {
    'ui:update': {
      input: z.object({
        element: z.string(),
        properties: z.record(z.any())
      }),
      output: z.object({
        success: z.boolean(),
        error: z.string().optional()
      })
    },
    'ui:getData': {
      input: z.object({
        dataType: z.string()
      }),
      output: z.object({
        success: z.boolean(),
        data: z.any().optional(),
        error: z.string().optional()
      })
    }
  }
});

// Client for communicating with background
let backgroundClient: Client;

// State for the popup
let currentSettings = {
  darkMode: false,
  notifications: true,
  syncEnabled: true,
  lastUpdated: 0
};

// Initialize the popup server
async function initPopup() {
  try {
    // Create the server factory
    const serverFactory = new ChromeExtensionServerFactory(console);
    
    // Create a popup configuration
    const config = createPopupConfig({
      namespace: 'my-extension'
    });
    
    // Create the server
    const server = serverFactory.create(config);
    
    // Register UI update handler
    server.onRequest('ui:update', async (payload, context) => {
      console.log('Received ui:update request', { payload, context });
      
      try {
        const element = document.getElementById(payload.element);
        
        if (!element) {
          return {
            success: false,
            error: `Element not found: ${payload.element}`
          };
        }
        
        // Apply properties to the element
        Object.entries(payload.properties).forEach(([key, value]) => {
          if (key === 'innerHTML') {
            element.innerHTML = value as string;
          } else if (key === 'textContent') {
            element.textContent = value as string;
          } else if (key === 'className') {
            element.className = value as string;
          } else if (key === 'style') {
            Object.entries(value as object).forEach(([styleKey, styleValue]) => {
              element.style[styleKey] = styleValue as string;
            });
          } else if (key === 'attributes') {
            Object.entries(value as object).forEach(([attrName, attrValue]) => {
              element.setAttribute(attrName, attrValue as string);
            });
          } else {
            element[key] = value;
          }
        });
        
        return { success: true };
      } catch (error) {
        console.error('Error updating UI:', error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        };
      }
    });
    
    // Register UI data getter
    server.onRequest('ui:getData', async (payload, context) => {
      console.log('Received ui:getData request', { payload, context });
      
      try {
        let data;
        
        // Return different data based on requested type
        switch (payload.dataType) {
          case 'settings':
            data = currentSettings;
            break;
            
          case 'activeTabs':
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            data = tabs.map(tab => ({
              id: tab.id,
              url: tab.url,
              title: tab.title
            }));
            break;
            
          case 'extensionInfo':
            const manifest = chrome.runtime.getManifest();
            data = {
              name: manifest.name,
              version: manifest.version,
              permissions: manifest.permissions
            };
            break;
            
          default:
            return {
              success: false,
              error: `Unknown data type: ${payload.dataType}`
            };
        }
        
        return {
          success: true,
          data
        };
      } catch (error) {
        console.error('Error getting UI data:', error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        };
      }
    });
    
    // Set up UI event listeners
    setupUIListeners(server);
    
    // Start the server
    await server.start();
    console.log('Popup server started');
    
    // Create client to communicate with background
    backgroundClient = new Client({
      transport: server['transport'], // Access the server's transport
      componentId: 'popup'
    });
    
    // Connect to the background script
    await backgroundClient.connect();
    
    // Subscribe to settings updates
    backgroundClient.on('settings:updated', (settings) => {
      console.log('Received settings update', settings);
      updateSettingsUI({
        ...currentSettings,
        ...settings
      });
    });
    
    // Get initial settings and update UI
    const settings = await backgroundClient.request('settings:get', {});
    currentSettings = settings;
    updateSettingsUI(settings);
    
  } catch (error) {
    console.error('Error initializing popup:', error);
    document.getElementById('error-message').textContent = `Error: ${error.message}`;
    document.getElementById('error-container').style.display = 'block';
  }
}

// Set up UI event listeners
function setupUIListeners(server) {
  // Toggle button handlers
  document.getElementById('toggle-dark-mode').addEventListener('change', async (event) => {
    const checkbox = event.target as HTMLInputElement;
    
    // Broadcast UI action
    server.broadcast('ui:action', {
      element: 'toggle-dark-mode',
      action: 'change',
      value: checkbox.checked
    });
    
    // Update settings via background
    if (backgroundClient) {
      await updateSetting('darkMode', checkbox.checked);
    }
  });
  
  document.getElementById('toggle-notifications').addEventListener('change', async (event) => {
    const checkbox = event.target as HTMLInputElement;
    
    server.broadcast('ui:action', {
      element: 'toggle-notifications',
      action: 'change',
      value: checkbox.checked
    });
    
    if (backgroundClient) {
      await updateSetting('notifications', checkbox.checked);
    }
  });
  
  document.getElementById('toggle-sync').addEventListener('change', async (event) => {
    const checkbox = event.target as HTMLInputElement;
    
    server.broadcast('ui:action', {
      element: 'toggle-sync',
      action: 'change',
      value: checkbox.checked
    });
    
    if (backgroundClient) {
      await updateSetting('syncEnabled', checkbox.checked);
    }
  });
  
  // Button for interacting with active tab
  document.getElementById('btn-interact-with-tab').addEventListener('click', async () => {
    // Get active tab
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeTab = tabs[0];
    
    if (!activeTab || !activeTab.id) {
      alert('No active tab found');
      return;
    }
    
    server.broadcast('ui:action', {
      element: 'btn-interact-with-tab',
      action: 'click'
    });
    
    // Send message to content script of active tab
    try {
      const response = await chrome.tabs.sendMessage(activeTab.id, {
        namespace: 'my-extension',
        data: {
          type: 'dom:read',
          id: crypto.randomUUID(),
          payload: {
            selector: 'h1',
            attribute: 'textContent'
          },
          timestamp: Date.now()
        }
      });
      
      if (response && response.data && response.data.success) {
        // Update UI with result
        document.getElementById('tab-data').textContent = response.data.data || 'No data';
      } else {
        document.getElementById('tab-data').textContent = 'Failed to get data';
      }
    } catch (error) {
      console.error('Error communicating with tab:', error);
      document.getElementById('tab-data').textContent = `Error: ${error.message}`;
    }
  });
}

// Update settings UI
function updateSettingsUI(settings) {
  document.getElementById('toggle-dark-mode').checked = settings.darkMode;
  document.getElementById('toggle-notifications').checked = settings.notifications;
  document.getElementById('toggle-sync').checked = settings.syncEnabled;
  
  // Update last updated timestamp
  const date = new Date(settings.lastUpdated);
  document.getElementById('last-updated').textContent = date.toLocaleString();
  
  // Apply dark mode to popup if enabled
  if (settings.darkMode) {
    document.body.classList.add('dark-theme');
  } else {
    document.body.classList.remove('dark-theme');
  }
}

// Helper to update a single setting
async function updateSetting(name: string, value: any) {
  try {
    const updatePayload = {};
    updatePayload[name] = value;
    
    const result = await backgroundClient.request('settings:update', updatePayload);
    
    if (result.success) {
      currentSettings = result.settings;
    }
  } catch (error) {
    console.error(`Error updating ${name}:`, error);
    alert(`Failed to update ${name}: ${error.message}`);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', initPopup);