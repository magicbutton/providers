import { TransportAdapter, MessageContext, Message, TransportMessage } from '@magicbutton.cloud/messaging';

/**
 * Transport configuration for Chrome extension messaging
 */
export interface ChromeExtensionTransportConfig {
  // Component type (background, content, popup, etc.)
  componentType: 'background' | 'content' | 'popup' | 'sidepanel' | 'options';
  // Target for sending messages (only needed for content scripts targeting specific tabs)
  targetTabId?: number;
  // Whether this transport should handle responses
  handleResponses?: boolean;
  // Namespace to prevent collision with other extension messages
  namespace?: string;
}

/**
 * Implementation of TransportAdapter for Chrome extension messaging
 * Handles communication between different extension components
 */
export class ChromeExtensionTransport implements TransportAdapter {
  private readonly config: ChromeExtensionTransportConfig;
  private readonly messageHandlers: Map<string, Function> = new Map();
  private readonly responseHandlers: Map<string, { resolve: Function; reject: Function; timeout: NodeJS.Timeout }> = new Map();
  private readonly MESSAGE_TIMEOUT = 30000; // 30 seconds timeout for messages
  private readonly namespace: string;

  constructor(config: ChromeExtensionTransportConfig) {
    this.config = config;
    this.namespace = config.namespace || 'magicbutton';
    this.setupMessageListeners();
  }

  /**
   * Sets up Chrome extension message listeners based on component type
   */
  private setupMessageListeners(): void {
    if (this.config.componentType === 'background') {
      // Background script receives messages from all components
      chrome.runtime.onMessage.addListener(this.handleIncomingMessage);
      
      // Also handle connections for long-lived connections
      chrome.runtime.onConnect.addListener((port) => {
        if (port.name.startsWith(`${this.namespace}:`)) {
          port.onMessage.addListener((message) => this.handleIncomingMessage(message, port.sender, (response) => {
            port.postMessage(response);
          }));
        }
      });
    } else {
      // Non-background components only listen for direct messages
      chrome.runtime.onMessage.addListener(this.handleIncomingMessage);
    }
  }

  /**
   * Handles incoming messages from Chrome messaging API
   */
  private handleIncomingMessage = (message: any, sender: chrome.runtime.MessageSender, sendResponse?: Function): boolean => {
    // Check if message is meant for our transport (has the right namespace)
    if (!message || !message.namespace || message.namespace !== this.namespace) {
      return false;
    }

    const transportMessage = message.data as TransportMessage;
    
    // Handle responses to previously sent messages
    if (transportMessage.type === 'response' && transportMessage.correlationId) {
      const responseHandler = this.responseHandlers.get(transportMessage.correlationId);
      if (responseHandler) {
        this.responseHandlers.delete(transportMessage.correlationId);
        clearTimeout(responseHandler.timeout);
        
        if (transportMessage.error) {
          responseHandler.reject(transportMessage.error);
        } else {
          responseHandler.resolve(transportMessage.payload);
        }
      }
      return false;
    }

    // Handle normal messages
    const handler = this.messageHandlers.get(transportMessage.type);
    if (handler) {
      // Create message context from sender information
      const context: MessageContext = {
        source: sender.url || 'unknown',
        timestamp: Date.now(),
        user: {
          id: sender.id || 'unknown',
          roles: []
        },
        meta: {
          tabId: sender.tab?.id,
          frameId: sender.frameId,
          componentType: message.componentType || 'unknown'
        }
      };

      // Process the message
      Promise.resolve()
        .then(() => handler(transportMessage.payload, context))
        .then((result) => {
          if (sendResponse && this.config.handleResponses !== false) {
            sendResponse({
              namespace: this.namespace,
              data: {
                type: 'response',
                correlationId: transportMessage.id,
                payload: result
              }
            });
          }
        })
        .catch((error) => {
          if (sendResponse && this.config.handleResponses !== false) {
            sendResponse({
              namespace: this.namespace,
              data: {
                type: 'response',
                correlationId: transportMessage.id,
                error: {
                  code: error.code || 'UNKNOWN_ERROR',
                  message: error.message || String(error)
                }
              }
            });
          }
        });

      // Return true to indicate we'll respond asynchronously
      return this.config.handleResponses !== false;
    }

    return false;
  };

  /**
   * Sends a message to the appropriate destination based on component type
   */
  async send(message: Message, context?: MessageContext): Promise<any> {
    const transportMessage: TransportMessage = {
      id: message.id,
      type: message.type,
      payload: message.payload,
      timestamp: Date.now(),
      correlationId: message.correlationId
    };

    const wrappedMessage = {
      namespace: this.namespace,
      componentType: this.config.componentType,
      data: transportMessage
    };

    // If we're in a content script and have a target tab ID, send to that specific tab
    if (this.config.componentType === 'content' && this.config.targetTabId) {
      return this.sendToTab(this.config.targetTabId, wrappedMessage);
    }

    // If we're in a background script and context has a tab ID, send to that tab
    if (this.config.componentType === 'background' && context?.meta?.tabId) {
      return this.sendToTab(context.meta.tabId, wrappedMessage);
    }

    // Default: send message via runtime messaging
    return this.sendViaRuntime(wrappedMessage);
  }

  /**
   * Sends a message to a specific tab
   */
  private sendToTab(tabId: number, message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const correlationId = message.data.id;
      
      // Set up timeout for response
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        reject(new Error(`Message timeout: ${message.data.type}`));
      }, this.MESSAGE_TIMEOUT);
      
      // Store handlers for the response
      this.responseHandlers.set(correlationId, { resolve, reject, timeout });
      
      // Send the message to the tab
      chrome.tabs.sendMessage(tabId, message, (response) => {
        // Handle the chrome.runtime.lastError
        if (chrome.runtime.lastError) {
          this.responseHandlers.delete(correlationId);
          clearTimeout(timeout);
          reject(new Error(chrome.runtime.lastError.message || 'Failed to send message to tab'));
          return;
        }
        
        // If the response is immediate and not async, handle it now
        if (response) {
          this.responseHandlers.delete(correlationId);
          clearTimeout(timeout);
          
          if (response.data?.error) {
            reject(response.data.error);
          } else {
            resolve(response.data?.payload);
          }
        }
        // Otherwise, wait for async response via the message listener
      });
    });
  }

  /**
   * Sends a message via chrome.runtime messaging
   */
  private sendViaRuntime(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const correlationId = message.data.id;
      
      // Set up timeout for response
      const timeout = setTimeout(() => {
        this.responseHandlers.delete(correlationId);
        reject(new Error(`Message timeout: ${message.data.type}`));
      }, this.MESSAGE_TIMEOUT);
      
      // Store handlers for the response
      this.responseHandlers.set(correlationId, { resolve, reject, timeout });
      
      // Send message via runtime messaging
      chrome.runtime.sendMessage(message, (response) => {
        // Handle the chrome.runtime.lastError
        if (chrome.runtime.lastError) {
          this.responseHandlers.delete(correlationId);
          clearTimeout(timeout);
          reject(new Error(chrome.runtime.lastError.message || 'Failed to send message'));
          return;
        }
        
        // If the response is immediate and not async, handle it now
        if (response) {
          this.responseHandlers.delete(correlationId);
          clearTimeout(timeout);
          
          if (response.data?.error) {
            reject(response.data.error);
          } else {
            resolve(response.data?.payload);
          }
        }
        // Otherwise, wait for async response via the message listener
      });
    });
  }

  /**
   * Broadcasts a message to all relevant components
   */
  async broadcast(message: Message, context?: MessageContext): Promise<void> {
    const transportMessage: TransportMessage = {
      id: message.id,
      type: message.type,
      payload: message.payload,
      timestamp: Date.now()
    };

    const wrappedMessage = {
      namespace: this.namespace,
      componentType: this.config.componentType,
      data: transportMessage
    };

    switch (this.config.componentType) {
      case 'background':
        // Background script broadcasts to all tabs
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, wrappedMessage).catch(() => {
              // Ignore errors for broadcast operations
            });
          }
        });
        break;
      
      case 'content':
      case 'popup':
      case 'sidepanel':
      case 'options':
        // Non-background components broadcast via the background script
        chrome.runtime.sendMessage({
          ...wrappedMessage,
          action: 'broadcast'
        }).catch(() => {
          // Ignore errors for broadcast operations
        });
        break;
    }
  }

  /**
   * Registers a message handler for a specific message type
   */
  onMessage(type: string, handler: Function): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Removes a message handler for a specific message type
   */
  offMessage(type: string): void {
    this.messageHandlers.delete(type);
  }

  /**
   * Cleanup resources when the transport is closed
   */
  close(): void {
    // Clear all response handlers
    this.responseHandlers.forEach(({ timeout }) => clearTimeout(timeout));
    this.responseHandlers.clear();
    
    // Remove message listeners
    if (this.config.componentType === 'background') {
      chrome.runtime.onMessage.removeListener(this.handleIncomingMessage);
    } else {
      chrome.runtime.onMessage.removeListener(this.handleIncomingMessage);
    }
  }
}