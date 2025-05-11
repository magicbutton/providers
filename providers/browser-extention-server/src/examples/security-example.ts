import { ChromeExtensionServerFactory } from '../chrome-extension-server-factory';
import { createBackgroundConfig } from '../component-configs';
import { 
  ExtensionAuthProviderFactory, 
  ExtensionAuthorizationProviderFactory 
} from '../security';

// Example of setting up a secure background server with auth and authorization
async function initSecureBackgroundServer() {
  // Create the server factory
  const serverFactory = new ChromeExtensionServerFactory(console);
  
  // Create auth provider factory
  const authProviderFactory = new ExtensionAuthProviderFactory();
  
  // Create authorization provider factory
  const authorizationProviderFactory = new ExtensionAuthorizationProviderFactory();
  
  // Create auth provider config
  const authProviderConfig = {
    requireOriginCheck: true,
    // Allow content scripts only from these domains
    allowedOrigins: [
      'https://*.example.com/*',
      'https://*.trusted-site.com/*'
    ],
    requireComponentTypeCheck: true,
    // Only allow these component types
    allowedComponentTypes: ['background', 'content', 'popup', 'sidepanel', 'options'],
    // Optional: validate extension ID
    extensionId: chrome.runtime.id
  };
  
  // Create authorization provider config with custom permissions
  const authorizationProviderConfig = {
    // Override default permissions for specific components
    permissions: {
      // Content scripts have limited permissions
      content: {
        canHandle: ['dom:*', 'page:*', 'content:*'],
        canSend: ['page:performAction', 'page:getData', 'settings:get'],
        canBroadcast: false
      },
      // Popup has UI-focused permissions
      popup: {
        canHandle: ['ui:*'],
        canSend: ['settings:*', 'ui:*'],
        canBroadcast: true // Allow broadcast for UI updates
      }
    },
    // Don't allow undefined messages
    allowUndefinedMessages: false,
    
    // Enforce origin restrictions for content scripts
    enforceContentScriptOrigins: true,
    
    // Add origin-specific permissions for content scripts
    contentScriptOriginPermissions: {
      'https://*.example.com/*': {
        canHandle: ['dom:*', 'page:*'],
        canSend: ['page:performAction', 'settings:get'],
        canBroadcast: false
      },
      'https://*.trusted-site.com/*': {
        canHandle: ['dom:*', 'page:*', 'content:*'],
        canSend: ['page:performAction', 'page:getData', 'settings:get'],
        canBroadcast: true // This trusted site can broadcast
      }
    }
  };
  
  // Create a base configuration
  const config = createBackgroundConfig({
    namespace: 'my-extension',
    heartbeatInterval: 60000 // 1 minute
  });
  
  // Add auth and authorization providers to the config
  const secureConfig = {
    ...config,
    authProviderFactory,
    authProviderConfig,
    authorizationProviderFactory,
    authorizationProviderConfig
  };
  
  // Create the secure server
  const server = serverFactory.create(secureConfig);
  
  // Register request handlers as normal
  server.onRequest('settings:get', async (payload, context) => {
    console.log('Received settings:get request', { context });
    
    // Log the authenticated user from context
    console.log('Authenticated user:', context.user);
    
    // Check the component type from the authenticated user roles
    const componentType = context.user?.roles?.[0];
    console.log('Component type:', componentType);
    
    // Create a customized response based on the caller's component type
    let settings = {
      darkMode: false,
      notifications: true,
      syncEnabled: true,
      lastUpdated: Date.now()
    };
    
    // Content scripts only get limited settings
    if (componentType === 'content') {
      // Limit what settings we expose to content scripts
      return {
        darkMode: settings.darkMode,
        notifications: false, // Hide notification settings
        syncEnabled: false,   // Hide sync settings
        lastUpdated: settings.lastUpdated
      };
    }
    
    // Other components get full settings
    return settings;
  });
  
  // Start the server
  await server.start();
  console.log('Secure background server started');
  
  // Register error handler for auth/permission failures
  server.on('system:error', (payload, context) => {
    console.error('Security error:', payload);
    
    // Log security violations
    if (payload.code === 'AUTH_FAILED' || payload.code === 'PERMISSION_DENIED') {
      // In a real app, you might want to log these to a security monitoring system
      console.error('Security violation:', {
        error: payload,
        context: {
          source: context.source,
          user: context.user,
          meta: context.meta
        }
      });
    }
  });
}

// Example of content script that respects the security model
async function initSecureContentScript() {
  try {
    // Get current tab ID
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const currentTabId = tabs[0]?.id;
    
    if (!currentTabId) {
      console.error('Could not determine current tab ID');
      return;
    }
    
    // Check if we're on an allowed domain
    const currentUrl = window.location.href;
    const allowedDomains = [
      'https://example.com',
      'https://trusted-site.com'
    ];
    
    const isAllowedDomain = allowedDomains.some(domain => currentUrl.startsWith(domain));
    
    if (!isAllowedDomain) {
      console.warn('Content script running on non-allowed domain, some features will be limited');
      // Continue with limited functionality or exit based on your security model
    }
    
    // Initialize with content security settings...
    // (rest of initialization code would go here)
  } catch (error) {
    console.error('Error initializing secure content script:', error);
  }
}

// Example of how to initialize the secure servers
if (chrome.runtime && chrome.runtime.getManifest) {
  // We're in the extension context, determine which component we are
  const manifest = chrome.runtime.getManifest();
  
  if (manifest.background) {
    // We're in the background script
    initSecureBackgroundServer().catch(console.error);
  } else {
    // Check if we're in a content script (simplified check)
    if (document && document.querySelector) {
      initSecureContentScript().catch(console.error);
    }
    // Other initializations for popup, options, etc. would go here
  }
}