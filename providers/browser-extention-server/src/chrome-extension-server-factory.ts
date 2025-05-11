import {
  ServerFactory,
  ServerConfig,
  Server,
  AuthProviderFactory,
  AuthorizationProviderFactory,
  MiddlewareFactory,
  ObservabilityProviderFactory
} from '@magicbutton.cloud/messaging';

import { ChromeExtensionTransportFactory } from './chrome-extension-transport-factory';

/**
 * Configuration for Chrome extension server components
 */
export interface ChromeExtensionServerConfig extends ServerConfig {
  // Component type
  componentType: 'background' | 'content' | 'popup' | 'sidepanel' | 'options';
  
  // Target tab ID (required for content scripts targeting specific tabs)
  targetTabId?: number;
  
  // Namespace to prevent collision with other extension messages
  namespace?: string;
  
  // Extension-specific options
  extensionOptions?: {
    // Whether to automatically connect to the background script on startup
    autoConnectToBackground?: boolean;
    
    // Whether to use long-lived connections (ports) instead of one-off messages
    useLongLivedConnections?: boolean;
    
    // Whether to handle system events (connect, disconnect, etc.)
    handleSystemEvents?: boolean;
    
    // Time interval for heartbeat messages in ms (0 to disable)
    heartbeatInterval?: number;
  };
}

/**
 * Factory for creating messaging servers optimized for Chrome extension components
 */
export class ChromeExtensionServerFactory implements ServerFactory {
  // Optional logger for diagnostic information
  private readonly logger?: any;
  
  constructor(logger?: any) {
    this.logger = logger;
  }

  /**
   * Creates a new server instance configured for Chrome extension messaging
   */
  create(config: ServerConfig): Server {
    // Cast to our specific config type
    const extensionConfig = config as ChromeExtensionServerConfig;
    
    // Validate required config properties
    this.validateConfig(extensionConfig);
    
    // Get or create a transport factory
    const transportFactory = extensionConfig.transportFactory || 
      new ChromeExtensionTransportFactory();
    
    // Get optional factories from config
    const authProviderFactory = extensionConfig.authProviderFactory;
    const authorizationProviderFactory = extensionConfig.authorizationProviderFactory;
    const middlewareFactory = extensionConfig.middlewareFactory;
    const observabilityProviderFactory = extensionConfig.observabilityProviderFactory;
    
    // Create transport configuration
    const transportConfig = {
      ...extensionConfig.transportConfig,
      componentType: extensionConfig.componentType,
      targetTabId: extensionConfig.targetTabId,
      namespace: extensionConfig.namespace || 'magicbutton',
      handleResponses: true
    };
    
    // Create the transport
    const transport = transportFactory.create(transportConfig);
    
    // Create auth provider if factory is provided
    const authProvider = authProviderFactory 
      ? authProviderFactory.create(extensionConfig.authProviderConfig)
      : undefined;
    
    // Create authorization provider if factory is provided
    const authorizationProvider = authorizationProviderFactory
      ? authorizationProviderFactory.create(extensionConfig.authorizationProviderConfig)
      : undefined;
    
    // Create middleware provider if factory is provided
    const middlewareProvider = middlewareFactory
      ? middlewareFactory.create(extensionConfig.middlewareConfig)
      : undefined;
    
    // Create observability provider if factory is provided
    const observabilityProvider = observabilityProviderFactory
      ? observabilityProviderFactory.create(extensionConfig.observabilityConfig)
      : undefined;
    
    // Log server creation
    if (this.logger) {
      this.logger.info(`Creating ${extensionConfig.componentType} server with namespace ${transportConfig.namespace}`);
    }
    
    // Create and configure the server
    const server = Server.create({
      transport,
      authProvider,
      authorizationProvider,
      middlewareProvider,
      observabilityProvider,
      options: {
        // Extension-specific options
        ...extensionConfig.extensionOptions,
        
        // System events like client connection/disconnection
        systemEvents: {
          enabled: extensionConfig.extensionOptions?.handleSystemEvents ?? true,
          heartbeatIntervalMs: extensionConfig.extensionOptions?.heartbeatInterval ?? 0
        }
      }
    });
    
    // For non-background components, set up auto-connect to background
    if (extensionConfig.componentType !== 'background' && 
        extensionConfig.extensionOptions?.autoConnectToBackground !== false) {
      this.setupBackgroundConnection(server, extensionConfig);
    }
    
    return server;
  }
  
  /**
   * Validates the extension server configuration
   */
  private validateConfig(config: ChromeExtensionServerConfig): void {
    if (!config.componentType) {
      throw new Error('ChromeExtensionServerConfig requires componentType');
    }
    
    const validComponentTypes = ['background', 'content', 'popup', 'sidepanel', 'options'];
    if (!validComponentTypes.includes(config.componentType)) {
      throw new Error(`Invalid componentType: ${config.componentType}. Must be one of: ${validComponentTypes.join(', ')}`);
    }
    
    // Content scripts targeting specific tabs need a tabId
    if (config.componentType === 'content' && config.targetTabId === undefined) {
      console.warn('Content script server with no targetTabId will only communicate with the background script');
    }
    
    // No transport factory provided, we'll create one
    if (!config.transportFactory && !config.transportConfig) {
      console.warn('No transportFactory or transportConfig provided, using defaults');
    }
  }
  
  /**
   * Sets up automatic connection to the background script for non-background components
   */
  private setupBackgroundConnection(server: Server, config: ChromeExtensionServerConfig): void {
    // Register system event handlers
    server.onEvent('system:connected', async (payload, context) => {
      if (this.logger) {
        this.logger.debug(`${config.componentType} connected to background`, { payload, context });
      }
    });
    
    server.onEvent('system:disconnected', async (payload, context) => {
      if (this.logger) {
        this.logger.debug(`${config.componentType} disconnected from background`, { payload, context });
      }
      
      // Attempt to reconnect after a short delay if needed
      // This can be implemented based on specific requirements
    });
    
    server.onEvent('system:heartbeat', async (payload, context) => {
      if (this.logger) {
        this.logger.trace(`Received heartbeat from background`, { payload, context });
      }
    });
  }
}