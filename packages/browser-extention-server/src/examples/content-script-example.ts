import { z } from 'zod';
import { createContract, Client } from '@magicbutton.cloud/messaging';
import { ChromeExtensionServerFactory } from '../chrome-extension-server-factory';
import { createContentScriptConfig } from '../component-configs';

// Share the same contract definition as background
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
    },
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

// Content script-specific contract for page interactions
const pageContract = createContract({
  name: 'page',
  events: {
    // Event for when page content changes
    'content:changed': z.object({
      selector: z.string(),
      newContent: z.any()
    }),
    // Event for when user interacts with the page
    'user:interaction': z.object({
      type: z.string(),
      target: z.string(),
      data: z.record(z.any()).optional()
    })
  },
  requests: {
    // Request to interact with the page DOM
    'dom:modify': {
      input: z.object({
        action: z.enum(['insert', 'remove', 'update']),
        selector: z.string(),
        content: z.any().optional()
      }),
      output: z.object({
        success: z.boolean(),
        error: z.string().optional()
      })
    },
    // Request to read data from the page
    'dom:read': {
      input: z.object({
        selector: z.string(),
        attribute: z.string().optional()
      }),
      output: z.object({
        success: z.boolean(),
        data: z.any().optional(),
        error: z.string().optional()
      })
    }
  }
});

// State for content script
let currentSettings = {
  darkMode: false,
  notifications: true,
  syncEnabled: true
};

// Client reference to communicate with background
let backgroundClient: Client;

// Initialize the content script server
async function initContentScript() {
  try {
    // Get current tab ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs[0]?.id;
    
    if (!currentTabId) {
      console.error('Could not determine current tab ID');
      return;
    }
    
    // Create the server factory
    const serverFactory = new ChromeExtensionServerFactory(console);
    
    // Create a content script configuration with current tab ID
    const config = createContentScriptConfig({
      namespace: 'my-extension',
      targetTabId: currentTabId,
      autoConnectToBackground: true
    });
    
    // Create the server
    const server = serverFactory.create(config);
    
    // Register DOM modification handler
    server.onRequest('dom:modify', async (payload, context) => {
      console.log('Received dom:modify request', { payload, context });
      
      try {
        let success = false;
        
        switch (payload.action) {
          case 'insert':
            success = await insertContent(payload.selector, payload.content);
            break;
            
          case 'remove':
            success = await removeContent(payload.selector);
            break;
            
          case 'update':
            success = await updateContent(payload.selector, payload.content);
            break;
        }
        
        return { success };
      } catch (error) {
        console.error('Error modifying DOM:', error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        };
      }
    });
    
    // Register DOM read handler
    server.onRequest('dom:read', async (payload, context) => {
      console.log('Received dom:read request', { payload, context });
      
      try {
        const element = document.querySelector(payload.selector);
        
        if (!element) {
          return {
            success: false,
            error: `Element not found: ${payload.selector}`
          };
        }
        
        let data;
        
        if (payload.attribute) {
          // Read specific attribute
          data = element.getAttribute(payload.attribute);
        } else {
          // Read inner content as default
          data = element.textContent;
        }
        
        return {
          success: true,
          data
        };
      } catch (error) {
        console.error('Error reading from DOM:', error);
        return {
          success: false,
          error: error.message || 'Unknown error'
        };
      }
    });
    
    // Setup event listeners for page interactions
    setupPageListeners(server);
    
    // Start the server
    await server.start();
    console.log('Content script server started');
    
    // Create client to communicate with background
    backgroundClient = new Client({
      transport: server['transport'], // Access the server's transport
      componentId: `content-${currentTabId}`
    });
    
    // Connect to the background script
    await backgroundClient.connect();
    
    // Subscribe to settings updates from background
    backgroundClient.on('settings:updated', (settings) => {
      console.log('Received settings update', settings);
      currentSettings = settings;
      
      // Apply settings to the page (e.g., dark mode)
      applySettings(settings);
    });
    
    // Get initial settings
    const settings = await backgroundClient.request('settings:get', {});
    currentSettings = settings;
    applySettings(settings);
    
    // Register content script with background (example)
    informBackground();
  } catch (error) {
    console.error('Error initializing content script:', error);
  }
}

// Helper function to set up page event listeners
function setupPageListeners(server) {
  // Listen for DOM changes that might be interesting
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' || mutation.type === 'characterData') {
        server.broadcast('content:changed', {
          selector: getSelector(mutation.target),
          newContent: mutation.target.textContent
        });
      }
    }
  });
  
  // Start observing important page elements
  observer.observe(document.body, { 
    childList: true, 
    subtree: true, 
    characterData: true 
  });
  
  // Listen for user interactions
  document.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    
    // Only broadcast clicks on interactive elements
    if (target.tagName === 'BUTTON' || target.tagName === 'A' || 
        target.tagName === 'INPUT' || target.closest('[role="button"]')) {
      server.broadcast('user:interaction', {
        type: 'click',
        target: getSelector(target),
        data: {
          text: target.textContent?.trim(),
          href: (target as HTMLAnchorElement).href
        }
      });
    }
  });
  
  // Listen for form submissions
  document.addEventListener('submit', (event) => {
    const form = event.target as HTMLFormElement;
    
    server.broadcast('user:interaction', {
      type: 'form-submit',
      target: getSelector(form),
      data: {
        action: form.action,
        method: form.method
      }
    });
  });
}

// Helper function to get a CSS selector for an element
function getSelector(element: Node): string {
  if (element.nodeType !== Node.ELEMENT_NODE) {
    return '';
  }
  
  const el = element as HTMLElement;
  
  if (el.id) {
    return `#${el.id}`;
  }
  
  if (el.className) {
    return `.${el.className.split(' ').join('.')}`;
  }
  
  // Fallback to tag name and position
  const sameTagSiblings = Array.from(el.parentElement?.children || [])
    .filter(sibling => sibling.tagName === el.tagName);
  
  const index = sameTagSiblings.indexOf(el) + 1;
  
  return `${el.tagName.toLowerCase()}:nth-of-type(${index})`;
}

// Helper DOM manipulation functions
async function insertContent(selector: string, content: any): Promise<boolean> {
  const targetElement = document.querySelector(selector);
  
  if (!targetElement) {
    throw new Error(`Target element not found: ${selector}`);
  }
  
  if (typeof content === 'string') {
    targetElement.innerHTML = content;
  } else if (content.html) {
    targetElement.innerHTML = content.html;
  } else if (content.text) {
    targetElement.textContent = content.text;
  } else {
    throw new Error('Invalid content format');
  }
  
  return true;
}

async function removeContent(selector: string): Promise<boolean> {
  const elements = document.querySelectorAll(selector);
  
  if (!elements.length) {
    throw new Error(`Elements not found: ${selector}`);
  }
  
  elements.forEach(el => el.remove());
  return true;
}

async function updateContent(selector: string, content: any): Promise<boolean> {
  return insertContent(selector, content);
}

// Apply settings to the page
function applySettings(settings) {
  if (settings.darkMode) {
    document.documentElement.classList.add('dark-mode');
  } else {
    document.documentElement.classList.remove('dark-mode');
  }
}

// Inform background script about this content script instance
async function informBackground() {
  if (backgroundClient) {
    await backgroundClient.request('page:performAction', {
      url: window.location.href,
      action: 'content-script-loaded',
      data: {
        title: document.title,
        timestamp: Date.now()
      }
    });
  }
}

// Initialize the content script when the page is loaded
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript().catch(console.error);
}