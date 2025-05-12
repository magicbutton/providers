# Chrome Transport Usage Guide

This guide provides detailed examples of how to use the `@magicbutton.cloud/chrome-transport` package in your Chrome extension.

## Table of Contents

1. [Installation](#installation)
2. [Basic Setup](#basic-setup)
3. [Background Script Setup](#background-script-setup)
4. [Popup Script Setup](#popup-script-setup)
5. [Content Script Setup](#content-script-setup)
6. [Side Panel Setup](#side-panel-setup)
7. [Cross-Extension Communication](#cross-extension-communication)
8. [Advanced Usage](#advanced-usage)
9. [Troubleshooting](#troubleshooting)

## Installation

```bash
# Using npm
npm install @magicbutton.cloud/chrome-transport @magicbutton.cloud/messaging

# Using yarn
yarn add @magicbutton.cloud/chrome-transport @magicbutton.cloud/messaging

# Using pnpm
pnpm add @magicbutton.cloud/chrome-transport @magicbutton.cloud/messaging
```

## Basic Setup

Before using the Chrome transport, ensure your extension's manifest.json is properly configured:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0.0",
  "description": "An extension using Magic Button Cloud messaging",
  "background": {
    "service_worker": "background.js",
    "type": "module"
  },
  "action": {
    "default_popup": "popup.html"
  },
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["content-script.js"]
    }
  ],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "permissions": [
    "sidePanel"
  ]
}
```

## Background Script Setup

The background script acts as the central hub for communication in your extension:

```typescript
// background.js
import { Server } from '@magicbutton.cloud/messaging';
import { ChromeTransport, ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a server
const server = Server.create({
  transportFactory,
  transportConfig: {
    connectionName: 'background-server',
    context: 'background',
    sidePanel: {
      path: 'sidepanel.html',
      initialWidth: 400
    },
    debug: true // Set to false in production
  }
});

// Get transport for side panel operations
const transport = server.getTransport() as ChromeTransport;

// Define request handlers
server.onRequest('getUsers', async (payload, context) => {
  // Handle the request
  return {
    users: [
      { id: 1, name: 'User 1' },
      { id: 2, name: 'User 2' }
    ]
  };
});

// Handle side panel requests
server.onRequest('showSidePanel', async () => {
  await transport.openSidePanel();
  return { success: true };
});

server.onRequest('hideSidePanel', async () => {
  await transport.closeSidePanel();
  return { success: true };
});

// Broadcast events
setInterval(() => {
  server.broadcast('heartbeat', { timestamp: Date.now() });
}, 30000);

// Start the server
server.start().then(() => {
  console.log('Background server started');
});
```

## Popup Script Setup

Your popup can connect to the background script:

```typescript
// popup.js
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'popup-client',
    context: 'popup',
    reconnect: true,
    reconnectOptions: {
      maxRetries: 3,
      backoffFactor: 1.5,
      initialDelayMs: 1000
    },
    debug: true // Set to false in production
  }
});

// DOM elements
const userListEl = document.getElementById('userList');
const sidePanelBtn = document.getElementById('openSidePanel');

// Connect to the background script
client.connect().then(() => {
  console.log('Connected to background service worker');

  // Fetch users
  client.request('getUsers', {})
    .then(response => {
      // Display users
      userListEl.innerHTML = response.users
        .map(user => `<li>${user.name}</li>`)
        .join('');
    })
    .catch(error => {
      console.error('Error fetching users:', error);
    });
  
  // Set up side panel button
  sidePanelBtn.addEventListener('click', () => {
    client.request('showSidePanel', {})
      .then(response => {
        console.log('Side panel opened:', response);
      })
      .catch(error => {
        console.error('Error opening side panel:', error);
      });
  });

  // Subscribe to events
  client.on('heartbeat', (data) => {
    console.log('Received heartbeat:', data.timestamp);
  });
});

// Clean up when popup closes
window.addEventListener('unload', () => {
  client.disconnect().catch(console.error);
});
```

## Content Script Setup

Content scripts can communicate with the background script:

```typescript
// content-script.js
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'content-script-client',
    context: 'content-script',
    reconnect: true,
    debug: true // Set to false in production
  }
});

// Connect to the background script
client.connect().then(() => {
  console.log('Content script connected to background service worker');
  
  // Notify about page load
  client.request('pageLoaded', {
    url: window.location.href,
    title: document.title
  }).catch(console.error);
  
  // Create UI controls if needed
  const button = document.createElement('button');
  button.textContent = 'Open Side Panel';
  button.style.position = 'fixed';
  button.style.top = '10px';
  button.style.right = '10px';
  button.style.zIndex = '9999';
  
  button.addEventListener('click', () => {
    client.request('showSidePanel', {}).catch(console.error);
  });
  
  document.body.appendChild(button);
  
  // Set up page observer
  const observer = new MutationObserver(() => {
    // When page changes, notify the background script
    client.request('pageContentChanged', {
      url: window.location.href,
      title: document.title
    }).catch(console.error);
  });
  
  // Start observing
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});

// Clean up when page unloads
window.addEventListener('unload', () => {
  client.disconnect().catch(console.error);
});
```

## Side Panel Setup

Side panels can communicate with the background script:

```typescript
// sidepanel.js
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'sidepanel-client',
    context: 'side-panel',
    reconnect: true,
    debug: true // Set to false in production
  }
});

// DOM elements
const userListEl = document.getElementById('userList');
const closeBtn = document.getElementById('closePanel');
const statusEl = document.getElementById('status');

// Connect to the background script
client.connect().then(() => {
  console.log('Side panel connected to background service worker');
  statusEl.textContent = 'Connected';
  
  // Fetch data when the side panel loads
  client.request('getUsers', {})
    .then(response => {
      // Display users
      userListEl.innerHTML = response.users
        .map(user => `<li>${user.name}</li>`)
        .join('');
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      statusEl.textContent = 'Error loading data';
    });
  
  // Set up close button
  closeBtn.addEventListener('click', () => {
    client.request('hideSidePanel', {}).catch(console.error);
  });
  
  // Subscribe to events
  client.on('heartbeat', (data) => {
    statusEl.textContent = `Last heartbeat: ${new Date(data.timestamp).toLocaleTimeString()}`;
  });
});

// Clean up when the side panel unloads
window.addEventListener('unload', () => {
  client.disconnect().catch(console.error);
});
```

## Cross-Extension Communication

To communicate with another extension:

```typescript
// external-communication.js
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client that connects to an external extension
const externalClient = Client.create({
  transportFactory,
  transportConfig: {
    extensionId: 'external-extension-id', // ID of the external extension
    connectionName: 'external-client',
    reconnect: true,
    debug: true // Set to false in production
  }
});

// Connect to the external extension
externalClient.connect().then(() => {
  console.log('Connected to external extension');
  
  // Make requests to the external extension
  externalClient.request('getData', { query: 'example' })
    .then(response => {
      console.log('Data from external extension:', response);
    })
    .catch(error => {
      console.error('Error communicating with external extension:', error);
    });
    
  // Subscribe to events from the external extension
  externalClient.on('externalEvent', (data) => {
    console.log('Received event from external extension:', data);
  });
});

// Disconnect when done
document.getElementById('disconnectBtn').addEventListener('click', () => {
  externalClient.disconnect().then(() => {
    console.log('Disconnected from external extension');
  });
});
```

## Advanced Usage

### Using Multiple Transports

You can create multiple transport instances for different purposes:

```typescript
// Multiple transports example
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

const transportFactory = new ChromeTransportFactory();

// Client for background communication
const backgroundClient = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'background-client',
    context: 'popup'
  }
});

// Client for external extension
const externalClient = Client.create({
  transportFactory,
  transportConfig: {
    extensionId: 'external-extension-id',
    connectionName: 'external-client',
    context: 'popup'
  }
});

// Connect both clients
Promise.all([
  backgroundClient.connect(),
  externalClient.connect()
]).then(() => {
  console.log('All clients connected');
}).catch(error => {
  console.error('Error connecting clients:', error);
});
```

### Handling Authentication

You can implement authentication with middleware:

```typescript
// Authentication example
import { Client, Middleware } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create an authentication middleware
const authMiddleware: Middleware = {
  name: 'auth',
  beforeRequest: (request, context) => {
    // Add auth token to all requests
    return {
      ...request,
      authToken: 'your-auth-token'
    };
  }
};

// Create a client with middleware
const client = Client.create({
  transportFactory: new ChromeTransportFactory(),
  transportConfig: {
    connectionName: 'authenticated-client'
  },
  middleware: [authMiddleware]
});

// Connect and make authenticated requests
client.connect().then(() => {
  client.request('secureEndpoint', { data: 'test' })
    .then(response => {
      console.log('Authenticated response:', response);
    });
});
```

## Troubleshooting

### Connection Issues

If you're having trouble connecting:

1. Check that all extension parts are properly loaded
2. Verify the connection names are correct
3. Enable debugging with `debug: true` to see detailed logs
4. Ensure permissions are properly set in the manifest

### Side Panel Issues

If the side panel isn't working properly:

1. Make sure you have the `sidePanel` permission in your manifest
2. Check that the side panel HTML file exists at the path you specified
3. Call side panel methods only from a background script context
4. Look for errors in the background script console

### Message Handling Issues

If messages aren't being received:

1. Verify that handlers are registered before messages are sent
2. Check for typos in event and request names
3. Ensure callbacks return the expected data types
4. Look for errors in the sending or receiving console