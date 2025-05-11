# Transport Factory Guide

This guide will help you create a TransportFactory implementation with the @magicbutton.cloud/messaging library.

## Transport Factory Overview

The TransportFactory is responsible for creating Transport instances that handle the communication between clients and servers. A well-implemented factory allows your application to:

1. Abstract the underlying transport protocol (HTTP, WebSockets, NATS, etc.)
2. Configure transport-specific settings
3. Create transports with consistent behavior
4. Implement different transport mechanisms while maintaining the same messaging API
5. Support testing with mock transports

## Key Interfaces

```typescript
interface TransportFactory {
  create(config: TransportConfig): Transport;
}

interface Transport {
  connect(options: any): Promise<void>;
  disconnect(): Promise<void>;
  send(message: any): Promise<void>;
  receive(callback: (message: any) => void): void;
  // Additional methods depending on transport type
}

interface TransportConfig {
  // Transport-specific configuration properties
  [key: string]: any;
}
```

## Implementation Template

Here's a template for implementing a custom TransportFactory:

```typescript
import {
  TransportFactory,
  TransportConfig,
  Transport,
  BaseTransport
} from '@magicbutton.cloud/messaging';

// 1. Define your config interface (extends TransportConfig)
interface WebSocketTransportConfig extends TransportConfig {
  url: string;
  protocols?: string | string[];
  reconnect?: boolean;
  reconnectOptions?: {
    maxRetries: number;
    backoffFactor: number;
    initialDelayMs: number;
  };
  pingIntervalMs?: number;
  connectTimeoutMs?: number;
}

// 2. Implement your Transport
class WebSocketTransport extends BaseTransport implements Transport {
  private readonly config: WebSocketTransportConfig;
  private socket: WebSocket | null = null;
  private messageCallback: ((message: any) => void) | null = null;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;
  private connectResolver: (() => void) | null = null;
  private connectRejecter: ((error: Error) => void) | null = null;
  
  constructor(config: WebSocketTransportConfig) {
    super();
    this.config = {
      ...config,
      reconnect: config.reconnect !== false,
      pingIntervalMs: config.pingIntervalMs || 30000,
      connectTimeoutMs: config.connectTimeoutMs || 10000,
      reconnectOptions: {
        maxRetries: config.reconnectOptions?.maxRetries || 5,
        backoffFactor: config.reconnectOptions?.backoffFactor || 1.5,
        initialDelayMs: config.reconnectOptions?.initialDelayMs || 1000
      }
    };
  }
  
  async connect(options: any = {}): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return; // Already connected
    }
    
    // If already connecting, return the existing promise
    if (this.connectPromise) {
      return this.connectPromise;
    }
    
    // Create a new connection promise
    this.connectPromise = new Promise<void>((resolve, reject) => {
      this.connectResolver = resolve;
      this.connectRejecter = reject;
      
      // Create connection timeout
      const timeout = setTimeout(() => {
        if (this.connectRejecter) {
          this.connectRejecter(new Error('Connection timeout'));
          this.connectPromise = null;
          this.connectResolver = null;
          this.connectRejecter = null;
        }
      }, this.config.connectTimeoutMs);
      
      try {
        // Create WebSocket
        this.socket = new WebSocket(this.config.url, this.config.protocols);
        
        // Set up event handlers
        this.socket.onopen = () => {
          clearTimeout(timeout);
          this.reconnectAttempts = 0;
          this.startPingInterval();
          
          if (this.connectResolver) {
            this.connectResolver();
            this.connectPromise = null;
            this.connectResolver = null;
            this.connectRejecter = null;
          }
        };
        
        this.socket.onclose = (event) => {
          clearTimeout(timeout);
          this.stopPingInterval();
          
          if (this.connectRejecter) {
            this.connectRejecter(new Error(`Connection closed: ${event.code} ${event.reason}`));
            this.connectPromise = null;
            this.connectResolver = null;
            this.connectRejecter = null;
          }
          
          // Handle reconnection if configured
          if (this.config.reconnect) {
            this.handleReconnect();
          }
        };
        
        this.socket.onerror = (error) => {
          if (this.connectRejecter) {
            this.connectRejecter(new Error(`WebSocket error: ${error}`));
            this.connectPromise = null;
            this.connectResolver = null;
            this.connectRejecter = null;
          }
        };
        
        this.socket.onmessage = (event) => {
          if (this.messageCallback) {
            try {
              const message = JSON.parse(event.data);
              this.messageCallback(message);
            } catch (error) {
              console.error('Error parsing message:', error);
            }
          }
        };
      } catch (error) {
        clearTimeout(timeout);
        if (this.connectRejecter) {
          this.connectRejecter(error);
          this.connectPromise = null;
          this.connectResolver = null;
          this.connectRejecter = null;
        }
        
        // Handle reconnection if configured
        if (this.config.reconnect) {
          this.handleReconnect();
        }
      }
    });
    
    return this.connectPromise;
  }
  
  async disconnect(): Promise<void> {
    this.stopPingInterval();
    
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    
    this.connectPromise = null;
    this.connectResolver = null;
    this.connectRejecter = null;
  }
  
  async send(message: any): Promise<void> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error('Transport not connected');
    }
    
    const messageStr = JSON.stringify(message);
    this.socket.send(messageStr);
  }
  
  receive(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }
  
  private startPingInterval(): void {
    if (this.config.pingIntervalMs) {
      this.pingInterval = setInterval(() => {
        this.sendPing();
      }, this.config.pingIntervalMs);
    }
  }
  
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
  
  private sendPing(): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      // Send ping message
      this.socket.send(JSON.stringify({ type: 'ping' }));
    }
  }
  
  private handleReconnect(): void {
    const options = this.config.reconnectOptions;
    
    if (this.reconnectAttempts < options.maxRetries) {
      this.reconnectAttempts++;
      
      // Calculate delay with exponential backoff
      const delay = options.initialDelayMs * Math.pow(options.backoffFactor, this.reconnectAttempts - 1);
      
      setTimeout(() => {
        this.connect().catch(error => {
          console.error('Reconnection failed:', error);
        });
      }, delay);
    }
  }
}

// 3. Implement your TransportFactory
export class WebSocketTransportFactory implements TransportFactory {
  create(config: TransportConfig): Transport {
    // Cast to your specific config type
    const wsConfig = config as WebSocketTransportConfig;
    
    // Validate required configuration
    if (!wsConfig.url) {
      throw new Error('WebSocket URL is required');
    }
    
    // Create and return the transport
    return new WebSocketTransport(wsConfig);
  }
}
```

## Usage Example

Here's how to use your custom TransportFactory:

```typescript
import { Client } from '@magicbutton.cloud/messaging';
import { WebSocketTransportFactory } from './websocket-transport-factory';

// Create your transport factory
const transportFactory = new WebSocketTransportFactory();

// Create a client with your transport
const client = Client.create({
  transportFactory,
  transportConfig: {
    url: 'wss://messaging.example.com',
    reconnect: true,
    reconnectOptions: {
      maxRetries: 5,
      backoffFactor: 1.5,
      initialDelayMs: 1000
    },
    pingIntervalMs: 30000
  }
});

// Connect the client
await client.connect();

// Make a request
const response = await client.request('getUsers', { filter: 'active' });

// Subscribe to events
client.on('userAdded', (user) => {
  console.log('New user added:', user);
});

// Disconnect when done
await client.disconnect();
```

## Best Practices

1. **Error Handling**: Implement robust error handling for transport failures
2. **Reconnection Logic**: Include automatic reconnection with exponential backoff
3. **Keep-Alive Mechanism**: Implement ping/pong or similar for detecting connection issues
4. **Serialization**: Handle message serialization and deserialization consistently
5. **Logging**: Include appropriate logging for connection events and errors
6. **Configuration Validation**: Validate all required configuration parameters
7. **Resource Cleanup**: Ensure proper cleanup of resources on disconnect
8. **Timeouts**: Implement reasonable timeouts for connect and request operations

## Advanced Scenarios

### HTTP Transport Implementation

For HTTP-based communication:

```typescript
interface HttpTransportConfig extends TransportConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
  retryConfig?: {
    maxRetries: number;
    backoffFactor: number;
    initialDelayMs: number;
  };
}

class HttpTransport extends BaseTransport implements Transport {
  private readonly config: HttpTransportConfig;
  private messageCallback: ((message: any) => void) | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  
  constructor(config: HttpTransportConfig) {
    super();
    this.config = {
      ...config,
      timeout: config.timeout || 30000,
      retryConfig: {
        maxRetries: config.retryConfig?.maxRetries || 3,
        backoffFactor: config.retryConfig?.backoffFactor || 1.5,
        initialDelayMs: config.retryConfig?.initialDelayMs || 1000
      }
    };
  }
  
  async connect(options: any = {}): Promise<void> {
    // For HTTP transport, there's no persistent connection
    // We might set up polling for events here
    this.startEventPolling();
  }
  
  async disconnect(): Promise<void> {
    // Stop polling for events
    this.stopEventPolling();
  }
  
  async send(message: any): Promise<void> {
    const url = `${this.config.baseUrl}/${message.type}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers
        },
        body: JSON.stringify(message.payload),
        timeout: this.config.timeout
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
      }
      
      const responseData = await response.json();
      
      // Notify about the response
      if (this.messageCallback) {
        this.messageCallback({
          type: `${message.type}_response`,
          payload: responseData,
          requestId: message.requestId
        });
      }
    } catch (error) {
      // Handle retry logic here
    }
  }
  
  receive(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }
  
  private startEventPolling(): void {
    // Set up polling for events (simplified example)
    this.pollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`${this.config.baseUrl}/events`, {
          method: 'GET',
          headers: this.config.headers
        });
        
        if (response.ok) {
          const events = await response.json();
          
          // Process events
          for (const event of events) {
            if (this.messageCallback) {
              this.messageCallback(event);
            }
          }
        }
      } catch (error) {
        console.error('Error polling for events:', error);
      }
    }, 5000); // Poll every 5 seconds
  }
  
  private stopEventPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }
}

class HttpTransportFactory implements TransportFactory {
  create(config: TransportConfig): Transport {
    const httpConfig = config as HttpTransportConfig;
    
    if (!httpConfig.baseUrl) {
      throw new Error('HTTP base URL is required');
    }
    
    return new HttpTransport(httpConfig);
  }
}
```

### NATS Transport Implementation

For NATS-based communication:

```typescript
interface NatsTransportConfig extends TransportConfig {
  servers: string[];
  token?: string;
  user?: string;
  pass?: string;
  subjects?: {
    requests: string;
    events: string;
  };
}

class NatsTransport extends BaseTransport implements Transport {
  private readonly config: NatsTransportConfig;
  private nats: any; // NATS client instance
  private messageCallback: ((message: any) => void) | null = null;
  private subscriptions: any[] = [];
  
  constructor(config: NatsTransportConfig) {
    super();
    this.config = {
      ...config,
      subjects: {
        requests: config.subjects?.requests || 'messaging.requests',
        events: config.subjects?.events || 'messaging.events'
      }
    };
  }
  
  async connect(options: any = {}): Promise<void> {
    // Import NATS (assuming NATS.js is being used)
    const { connect } = require('nats');
    
    // Connect to NATS server
    this.nats = await connect({
      servers: this.config.servers,
      token: this.config.token,
      user: this.config.user,
      pass: this.config.pass
    });
    
    // Set up subscriptions
    this.setupSubscriptions();
  }
  
  async disconnect(): Promise<void> {
    // Close subscriptions
    for (const sub of this.subscriptions) {
      await sub.unsubscribe();
    }
    
    // Close NATS connection
    if (this.nats) {
      await this.nats.close();
      this.nats = null;
    }
  }
  
  async send(message: any): Promise<void> {
    if (!this.nats) {
      throw new Error('Transport not connected');
    }
    
    if (message.type.startsWith('event:')) {
      // Publish event
      const subject = `${this.config.subjects.events}.${message.type.substring(6)}`;
      await this.nats.publish(subject, this.encode(message.payload));
    } else {
      // Send request
      const subject = `${this.config.subjects.requests}.${message.type}`;
      await this.nats.publish(subject, this.encode({
        payload: message.payload,
        requestId: message.requestId
      }));
    }
  }
  
  receive(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }
  
  private setupSubscriptions(): void {
    if (!this.nats) return;
    
    // Subscribe to request responses
    const requestResponseSub = this.nats.subscribe(`${this.config.subjects.requests}.*.response`);
    this.subscriptions.push(requestResponseSub);
    
    this.processSubscription(requestResponseSub, (subject, message) => {
      const parts = subject.split('.');
      const type = parts[parts.length - 2]; // Extract request type
      
      if (this.messageCallback) {
        this.messageCallback({
          type: `${type}_response`,
          payload: message.payload,
          requestId: message.requestId
        });
      }
    });
    
    // Subscribe to events
    const eventsSub = this.nats.subscribe(`${this.config.subjects.events}.*`);
    this.subscriptions.push(eventsSub);
    
    this.processSubscription(eventsSub, (subject, payload) => {
      const parts = subject.split('.');
      const eventType = parts[parts.length - 1]; // Extract event type
      
      if (this.messageCallback) {
        this.messageCallback({
          type: `event:${eventType}`,
          payload
        });
      }
    });
  }
  
  private async processSubscription(subscription: any, handler: (subject: string, message: any) => void): Promise<void> {
    for await (const message of subscription) {
      try {
        const decoded = this.decode(message.data);
        handler(message.subject, decoded);
      } catch (error) {
        console.error('Error processing message:', error);
      }
    }
  }
  
  private encode(data: any): Uint8Array {
    return new TextEncoder().encode(JSON.stringify(data));
  }
  
  private decode(data: Uint8Array): any {
    const json = new TextDecoder().decode(data);
    return JSON.parse(json);
  }
}

class NatsTransportFactory implements TransportFactory {
  create(config: TransportConfig): Transport {
    const natsConfig = config as NatsTransportConfig;
    
    if (!natsConfig.servers || natsConfig.servers.length === 0) {
      throw new Error('NATS servers are required');
    }
    
    return new NatsTransport(natsConfig);
  }
}
```

### Multi-Protocol Transport Factory

A factory that creates different transport types based on configuration:

```typescript
class MultiProtocolTransportFactory implements TransportFactory {
  private readonly factories: Record<string, TransportFactory>;
  
  constructor(factories: Record<string, TransportFactory>) {
    this.factories = factories;
  }
  
  create(config: TransportConfig & { type: string }): Transport {
    // Get the factory for the specified protocol
    const factory = this.factories[config.type];
    
    if (!factory) {
      throw new Error(`Unsupported transport type: ${config.type}`);
    }
    
    // Create transport using the appropriate factory
    return factory.create(config);
  }
}

// Example usage
const transportFactory = new MultiProtocolTransportFactory({
  websocket: new WebSocketTransportFactory(),
  http: new HttpTransportFactory(),
  nats: new NatsTransportFactory()
});

const transport = transportFactory.create({
  type: 'websocket', // Specify which transport to create
  url: 'wss://messaging.example.com'
});
```

### Secure Transport Factory

A factory that adds security features to any transport:

```typescript
class SecureTransportWrapper implements Transport {
  private readonly baseTransport: Transport;
  private readonly encryptionService: any; // Your encryption service
  
  constructor(baseTransport: Transport, encryptionService: any) {
    this.baseTransport = baseTransport;
    this.encryptionService = encryptionService;
  }
  
  async connect(options: any): Promise<void> {
    return this.baseTransport.connect(options);
  }
  
  async disconnect(): Promise<void> {
    return this.baseTransport.disconnect();
  }
  
  async send(message: any): Promise<void> {
    // Encrypt payload before sending
    const encryptedMessage = {
      ...message,
      payload: await this.encryptionService.encrypt(message.payload)
    };
    
    return this.baseTransport.send(encryptedMessage);
  }
  
  receive(callback: (message: any) => void): void {
    // Decrypt payload after receiving
    this.baseTransport.receive(async (message) => {
      const decryptedMessage = {
        ...message,
        payload: await this.encryptionService.decrypt(message.payload)
      };
      
      callback(decryptedMessage);
    });
  }
}

class SecureTransportFactory implements TransportFactory {
  private readonly baseFactory: TransportFactory;
  private readonly encryptionService: any;
  
  constructor(baseFactory: TransportFactory, encryptionService: any) {
    this.baseFactory = baseFactory;
    this.encryptionService = encryptionService;
  }
  
  create(config: TransportConfig): Transport {
    // Create base transport
    const baseTransport = this.baseFactory.create(config);
    
    // Wrap with security
    return new SecureTransportWrapper(baseTransport, this.encryptionService);
  }
}
```