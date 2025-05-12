import { Transport } from '@magicbutton.cloud/messaging';

/**
 * Configuration for Chrome Transport
 */
export interface ChromeTransportConfig {
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

/**
 * Type definitions for message handlers
 */
type MessageHandler = (payload: any, context: any) => void | Promise<any>;
type RequestHandler = (payload: any, context: any) => Promise<any>;
type EventHandler = (payload: any, context: any) => void;

/**
 * Message types
 */
interface Message {
  type: string;
  payload: any;
  requestId?: string;
  [key: string]: any;
}

/**
 * Side panel options type
 */
interface SidePanelOptions {
  path?: string;
  enabled?: boolean;
  width?: number;
}

/**
 * Chrome extension transport implementation for communication 
 * between popup, content scripts, background scripts, and external extensions
 */
export class ChromeTransport implements Transport<any, any> {
  private readonly config: ChromeTransportConfig;
  private port: chrome.runtime.Port | null = null;
  private messageCallback: ((message: any) => void) | null = null;
  private reconnectAttempts = 0;
  private connectPromise: Promise<void> | null = null;
  private connectResolver: (() => void) | null = null;
  private connectRejecter: ((error: Error) => void) | null = null;
  private isConnected = false;
  private sidePanelWindow: Window | null = null;
  
  // Event and request handlers
  private eventHandlers: Map<string, Set<EventHandler>> = new Map();
  private requestHandlers: Map<string, RequestHandler> = new Map();
  
  constructor(config: ChromeTransportConfig) {
    this.config = {
      ...config,
      reconnect: config.reconnect !== false,
      connectTimeoutMs: config.connectTimeoutMs || 10000,
      reconnectOptions: {
        maxRetries: config.reconnectOptions?.maxRetries || 5,
        backoffFactor: config.reconnectOptions?.backoffFactor || 1.5,
        initialDelayMs: config.reconnectOptions?.initialDelayMs || 1000
      }
    };
  }
  
  /**
   * Connect to the target (background script, other extension, etc)
   */
  async connect(options?: any): Promise<void> {
    // Use options if provided, otherwise use empty object
    const connectOptions = options || {};
    
    if (this.isConnected && this.port) {
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
          this.cleanupConnectionPromise();
        }
      }, this.config.connectTimeoutMs);
      
      try {
        // Create port connection
        if (this.config.extensionId) {
          // Connect to external extension
          this.port = chrome.runtime.connect(this.config.extensionId, {
            name: this.config.connectionName
          });
        } else {
          // Connect within the same extension
          this.port = chrome.runtime.connect({ name: this.config.connectionName });
        }
        
        // Handle connection events
        this.setupConnectionHandlers();
        
        clearTimeout(timeout);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        if (this.connectResolver) {
          this.connectResolver();
          this.cleanupConnectionPromise();
        }
      } catch (error) {
        clearTimeout(timeout);
        
        if (this.connectRejecter) {
          this.connectRejecter(error as Error);
          this.cleanupConnectionPromise();
        }
        
        // Handle reconnection if configured
        if (this.config.reconnect) {
          this.handleReconnect();
        }
      }
    });
    
    return this.connectPromise;
  }
  
  /**
   * Disconnect from the port
   */
  async disconnect(): Promise<void> {
    if (this.port) {
      try {
        this.port.disconnect();
      } catch (e) {
        // Ignore errors during disconnect
      }
      this.port = null;
    }
    
    this.isConnected = false;
    this.cleanupConnectionPromise();
  }
  
  /**
   * Send a request
   */
  async sendRequest(type: string, payload: any, context?: any): Promise<any> {
    const message: Message = {
      type,
      payload,
      ...(context || {})
    };
    
    return this.send(message);
  }
  
  /**
   * Subscribe to events
   * @returns A function to unsubscribe
   */
  subscribe<K extends string>(eventType: K, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, new Set());
    }
    
    const eventHandler = (payload: any, context: any) => handler(payload);
    this.eventHandlers.get(eventType)!.add(eventHandler);
    
    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        handlers.delete(eventHandler);
        if (handlers.size === 0) {
          this.eventHandlers.delete(eventType);
        }
      }
    };
  }
  
  /**
   * Register a request handler
   * @returns A function to unregister the handler
   */
  registerRequestHandler<K extends string>(type: K, handler: (data: any) => Promise<any>): () => void {
    const wrappedHandler = async (payload: any, context: any) => handler(payload);
    this.requestHandlers.set(type, wrappedHandler);
    
    // Return unregister function
    return () => {
      this.requestHandlers.delete(type);
    };
  }
  
  /**
   * Publish an event
   */
  async publish(eventType: string, payload: any): Promise<void> {
    const message: Message = {
      type: `event:${eventType}`,
      payload
    };
    
    return this.send(message);
  }
  
  /**
   * Send a message over the port
   */
  private async send(message: any): Promise<void> {
    if (!this.port || !this.isConnected) {
      throw new Error('Transport not connected');
    }
    
    try {
      this.port.postMessage(message);
    } catch (error) {
      this.logDebug('Error sending message:', error);
      this.handleDisconnection();
      throw error;
    }
  }
  
  /**
   * Register a callback to receive messages
   */
  private receive(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }
  
  /**
   * Set up connection event handlers
   */
  private setupConnectionHandlers(): void {
    if (!this.port) return;
    
    this.port.onMessage.addListener(async (message: Message) => {
      try {
        await this.handleMessage(message);
      } catch (error) {
        this.logDebug('Error handling message:', error);
      }
    });
    
    this.port.onDisconnect.addListener(() => {
      this.handleDisconnection();
    });
  }
  
  /**
   * Handle received messages
   */
  private async handleMessage(message: Message): Promise<void> {
    if (this.messageCallback) {
      this.messageCallback(message);
    }
    
    // Check if it's an event
    if (message.type && message.type.startsWith('event:')) {
      const eventType = message.type.substring(6); // Remove 'event:' prefix
      const handlers = this.eventHandlers.get(eventType);
      
      if (handlers) {
        for (const handler of handlers) {
          try {
            const context = { ...message };
            handler(message.payload, context);
          } catch (error) {
            this.logDebug(`Error in event handler for ${eventType}:`, error);
          }
        }
      }
    } 
    // Check if it's a request
    else if (message.type && message.requestId && !message.type.endsWith('_response')) {
      const handler = this.requestHandlers.get(message.type);
      
      if (handler) {
        try {
          const context = { 
            requestId: message.requestId,
            ...message 
          };
          
          const result = await handler(message.payload, context);
          
          // Send response
          await this.send({
            type: `${message.type}_response`,
            payload: result,
            requestId: message.requestId
          });
        } catch (error) {
          this.logDebug(`Error in request handler for ${message.type}:`, error);
          
          // Send error response
          await this.send({
            type: `${message.type}_response`,
            error: {
              message: (error as Error).message,
              stack: (error as Error).stack
            },
            requestId: message.requestId
          });
        }
      }
    }
  }
  
  /**
   * Handle disconnect events
   */
  private handleDisconnection(): void {
    const wasConnected = this.isConnected;
    this.isConnected = false;
    this.port = null;
    
    if (wasConnected && this.config.reconnect) {
      this.handleReconnect();
    }
  }
  
  /**
   * Handle reconnection logic
   */
  private handleReconnect(): void {
    const options = this.config.reconnectOptions!;
    
    if (this.reconnectAttempts < options.maxRetries) {
      this.reconnectAttempts++;
      
      // Calculate delay with exponential backoff
      const delay = options.initialDelayMs * Math.pow(options.backoffFactor, this.reconnectAttempts - 1);
      
      this.logDebug(`Reconnecting (attempt ${this.reconnectAttempts}) in ${delay}ms`);
      
      setTimeout(() => {
        this.connect().catch(error => {
          this.logDebug('Reconnection failed:', error);
        });
      }, delay);
    } else {
      this.logDebug(`Max reconnection attempts (${options.maxRetries}) reached`);
    }
  }
  
  /**
   * Clean up connection promise resources
   */
  private cleanupConnectionPromise(): void {
    this.connectPromise = null;
    this.connectResolver = null;
    this.connectRejecter = null;
  }
  
  /**
   * Log debug messages if debug mode is enabled
   */
  private logDebug(...args: any[]): void {
    if (this.config.debug) {
      console.log('[ChromeTransport]', ...args);
    }
  }
  
  /**
   * Open a side panel
   * This method works only when called from a background script
   * @returns A promise that resolves when the side panel is opened
   */
  async openSidePanel(): Promise<void> {
    // Check if chrome.sidePanel API is available
    if (!chrome.sidePanel) {
      throw new Error('Side panel API is not available');
    }

    if (this.config.context !== 'background') {
      throw new Error('Side panels can only be opened from a background script');
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Open the side panel with configured options
        const sidePanelOptions: {path?: string, width?: number} = {};

        if (this.config.sidePanel?.path) {
          sidePanelOptions.path = this.config.sidePanel.path;
        }

        if (this.config.sidePanel?.initialWidth) {
          sidePanelOptions.width = this.config.sidePanel.initialWidth;
        }
        
        // Use the Chrome API to open the side panel
        if (chrome.sidePanel && chrome.sidePanel.open) {
          // @ts-ignore - TypeScript might not recognize this API yet
          chrome.sidePanel.open(sidePanelOptions)
            .then(() => {
              this.logDebug('Side panel opened successfully');
              resolve();
            })
            .catch((error: any) => {
              this.logDebug('Failed to open side panel:', error);
              reject(error);
            });
        } else {
          reject(new Error('Chrome sidePanel.open API not available'));
        }
      } catch (error: any) {
        this.logDebug('Error opening side panel:', error);
        reject(error);
      }
    });
  }

  /**
   * Close the side panel
   * This method works only when called from a background script
   * @returns A promise that resolves when the side panel is closed
   */
  async closeSidePanel(): Promise<void> {
    // Check if chrome.sidePanel API is available
    if (!chrome.sidePanel) {
      throw new Error('Side panel API is not available');
    }

    if (this.config.context !== 'background') {
      throw new Error('Side panels can only be closed from a background script');
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Use the Chrome API to close the side panel
        if (chrome.sidePanel && chrome.sidePanel.close) {
          // @ts-ignore - TypeScript might not recognize this API yet
          chrome.sidePanel.close()
            .then(() => {
              this.logDebug('Side panel closed successfully');
              resolve();
            })
            .catch((error: any) => {
              this.logDebug('Failed to close side panel:', error);
              reject(error);
            });
        } else {
          reject(new Error('Chrome sidePanel.close API not available'));
        }
      } catch (error: any) {
        this.logDebug('Error closing side panel:', error);
        reject(error);
      }
    });
  }

  /**
   * Set the side panel state
   * This method works only when called from a background script
   * @param options Options for configuring the side panel
   * @returns A promise that resolves when the side panel state is set
   */
  async setSidePanelState(options: SidePanelOptions): Promise<void> {
    // Check if chrome.sidePanel API is available
    if (!chrome.sidePanel) {
      throw new Error('Side panel API is not available');
    }

    if (this.config.context !== 'background') {
      throw new Error('Side panel state can only be set from a background script');
    }
    
    return new Promise<void>((resolve, reject) => {
      try {
        // Use the Chrome API to set side panel options
        if (chrome.sidePanel && chrome.sidePanel.setOptions) {
          // @ts-ignore - TypeScript might not recognize this API yet
          chrome.sidePanel.setOptions(options)
            .then(() => {
              this.logDebug('Side panel state set successfully');
              resolve();
            })
            .catch((error: any) => {
              this.logDebug('Failed to set side panel state:', error);
              reject(error);
            });
        } else {
          reject(new Error('Chrome sidePanel.setOptions API not available'));
        }
      } catch (error: any) {
        this.logDebug('Error setting side panel state:', error);
        reject(error);
      }
    });
  }

  /**
   * Get the side panel state
   * This method works only when called from a background script
   * @returns A promise that resolves with the current side panel state
   */
  async getSidePanelState(): Promise<SidePanelOptions> {
    // Check if chrome.sidePanel API is available
    if (!chrome.sidePanel) {
      throw new Error('Side panel API is not available');
    }

    if (this.config.context !== 'background') {
      throw new Error('Side panel state can only be retrieved from a background script');
    }
    
    return new Promise<SidePanelOptions>((resolve, reject) => {
      try {
        // Use the Chrome API to get side panel options
        if (chrome.sidePanel && chrome.sidePanel.getOptions) {
          // @ts-ignore - TypeScript might not recognize this API yet
          chrome.sidePanel.getOptions()
            .then((options: any) => {
              this.logDebug('Side panel state retrieved successfully');
              resolve(options);
            })
            .catch((error: any) => {
              this.logDebug('Failed to get side panel state:', error);
              reject(error);
            });
        } else {
          reject(new Error('Chrome sidePanel.getOptions API not available'));
        }
      } catch (error: any) {
        this.logDebug('Error getting side panel state:', error);
        reject(error);
      }
    });
  }
}