# Chrome Transport Provider for Magic Button Cloud

This package provides a Chrome Transport implementation for the Magic Button Cloud messaging library, enabling seamless communication within Chrome Extensions and between extensions.

## Features

- Communication between background scripts, popup, content scripts, and side panels
- Side panel support with full control API (open, close, configure)
- Cross-extension messaging
- Automatic reconnection support
- Error handling and timeouts
- Fully type-safe messaging
- Compatible with the Magic Button Cloud messaging framework

## Installation

```bash
npm install @magicbutton.cloud/chrome-transport
```

## Usage Examples

### 1. Background Script (Service Worker)

```typescript
import { Server } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a server
const server = Server.create({
  transportFactory,
  transportConfig: {
    connectionName: 'background-server',
    debug: true
  }
});

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

// Start the server
server.start().then(() => {
  console.log('Background server started');
});
```

### 2. Popup Script

```typescript
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'popup-client',
    reconnect: true,
    reconnectOptions: {
      maxRetries: 3,
      backoffFactor: 1.5,
      initialDelayMs: 1000
    },
    debug: true
  }
});

// Connect to the background script
client.connect().then(() => {
  console.log('Connected to background service worker');

  // Make a request
  client.request('getUsers', {})
    .then(response => {
      console.log('Users:', response.users);
      // Update UI with users...
    })
    .catch(error => {
      console.error('Error fetching users:', error);
    });
});

// Subscribe to events
client.on('userAdded', (user) => {
  console.log('New user added:', user);
  // Update UI...
});

// Clean up when popup closes
window.addEventListener('unload', () => {
  client.disconnect().catch(console.error);
});
```

### 3. Content Script

```typescript
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'content-script-client',
    debug: true
  }
});

// Connect to the background script
client.connect().then(() => {
  console.log('Content script connected to background service worker');
  
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

### 4. Working with Side Panels (Background Script)

```typescript
import { Server } from '@magicbutton.cloud/messaging';
import { ChromeTransport, ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a server in the background script
const server = Server.create({
  transportFactory,
  transportConfig: {
    connectionName: 'background-server',
    context: 'background',
    sidePanel: {
      path: 'sidepanel.html',
      initialWidth: 400
    },
    debug: true
  }
});

// Get the transport instance to control the side panel
const transport = server.getTransport() as ChromeTransport;

// Handle show side panel requests
server.onRequest('showSidePanel', async (payload) => {
  await transport.openSidePanel();
  return { success: true };
});

// Handle hide side panel requests
server.onRequest('hideSidePanel', async (payload) => {
  await transport.closeSidePanel();
  return { success: true };
});

// Handle get side panel state requests
server.onRequest('getSidePanelState', async (payload) => {
  const state = await transport.getSidePanelState();
  return state;
});

// Handle set side panel width requests
server.onRequest('setSidePanelWidth', async (payload) => {
  await transport.setSidePanelState({
    width: payload.width
  });
  return { success: true };
});

// Start the server
server.start().then(() => {
  console.log('Background server started');
});
```

### 5. Side Panel Implementation

```typescript
import { Client } from '@magicbutton.cloud/messaging';
import { ChromeTransportFactory } from '@magicbutton.cloud/chrome-transport';

// Create a transport factory
const transportFactory = new ChromeTransportFactory();

// Create a client in the side panel
const client = Client.create({
  transportFactory,
  transportConfig: {
    connectionName: 'sidepanel-client',
    context: 'side-panel',
    debug: true
  }
});

// Connect to the background script
client.connect().then(() => {
  console.log('Side panel connected to background service worker');

  // Request data when the side panel loads
  client.request('getData', { view: 'sidepanel' })
    .then(response => {
      console.log('Data received:', response);
      // Update UI with the data...
    })
    .catch(error => {
      console.error('Error fetching data:', error);
    });

  // Set up UI handlers
  document.getElementById('closeButton').addEventListener('click', () => {
    client.request('hideSidePanel', {}).catch(console.error);
  });
});

// Clean up when the side panel unloads
window.addEventListener('unload', () => {
  client.disconnect().catch(console.error);
});
```

### 6. Communicating with External Extensions

```typescript
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
    debug: true
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
});
```

## API Reference

### ChromeTransportConfig

```typescript
interface ChromeTransportConfig {
  /**
   * Extension ID to connect to. If not provided, will use internal communication
   * within the same extension.
   */
  extensionId?: string;

  /**
   * Connection name to identify this connection
   */
  connectionName: string;

  /**
   * Transport context (identifies the part of the extension this transport is running in)
   */
  context?: 'background' | 'popup' | 'content-script' | 'side-panel' | 'devtools';

  /**
   * Whether to reconnect automatically on disconnection
   */
  reconnect?: boolean;

  /**
   * Reconnection options
   */
  reconnectOptions?: {
    maxRetries: number;
    backoffFactor: number;
    initialDelayMs: number;
  };

  /**
   * Connection timeout in milliseconds
   */
  connectTimeoutMs?: number;

  /**
   * Side panel specific options
   */
  sidePanel?: {
    /**
     * Path to the side panel HTML file (relative to the extension root)
     */
    path?: string;

    /**
     * Initial width for the side panel in pixels
     */
    initialWidth?: number;
  };

  /**
   * Debug mode - will log additional information
   */
  debug?: boolean;
}
```

### ChromeTransportFactory

The factory class used to create ChromeTransport instances.

```typescript
class ChromeTransportFactory {
  create(config: any): Transport<any, any>;
}
```

### ChromeTransport

The Chrome Transport implementation with side panel support.

```typescript
class ChromeTransport implements Transport<any, any> {
  constructor(config: ChromeTransportConfig);

  // Transport interface methods
  connect(options?: any): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(type: string, payload: any, context?: any): Promise<any>;
  subscribe<K extends string>(eventType: K, handler: (data: any) => void): () => void;
  registerRequestHandler<K extends string>(type: K, handler: (data: any) => Promise<any>): () => void;
  publish(eventType: string, payload: any): Promise<void>;

  // Side panel methods
  openSidePanel(): Promise<void>;
  closeSidePanel(): Promise<void>;
  setSidePanelState(options: {
    path?: string;
    enabled?: boolean;
    width?: number;
  }): Promise<void>;
  getSidePanelState(): Promise<chrome.sidePanel.GetPanelOptions>;
}
```

## Best Practices

1. **Use unique connection names**: Make sure your connection names are descriptive and unique to avoid conflicts.

2. **Specify the context**: Always set the `context` property in the config to identify which part of the extension the transport is running in (background, popup, content-script, side-panel, etc.).

3. **Handle disconnections**: Chrome extensions can be unloaded or reloaded at any time. Use the automatic reconnection feature to ensure your messaging remains robust.

4. **Clean up resources**: Always call `disconnect()` when your component is being unloaded to prevent memory leaks.

5. **Error handling**: Implement proper error handling for all requests to ensure your extension remains functional even when communication fails.

6. **Side Panel control**: Always control side panels from the background script using the dedicated methods.

7. **Security considerations**: When communicating with external extensions, validate the source and content of messages to prevent security vulnerabilities.

8. **Manifest configuration**: When using side panels, ensure your manifest.json includes the necessary permissions and configurations:

```json
{
  "manifest_version": 3,
  "name": "My Extension",
  "version": "1.0",
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "permissions": [
    "sidePanel"
  ],
  "background": {
    "service_worker": "background.js",
    "type": "module"
  }
}
```

## License

MIT