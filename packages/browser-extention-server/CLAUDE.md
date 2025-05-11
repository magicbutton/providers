# Server Factory Guide

This guide will help you create a ServerFactory implementation with the @magicbutton.cloud/messaging library.

## Server Factory Overview

The ServerFactory is responsible for creating Server instances that handle messaging requests and events. A well-implemented factory allows your application to:

1. Create configured messaging servers
2. Abstract server creation details from application code
3. Apply consistent configuration across all servers
4. Support dependency injection for components like transport and middleware
5. Configure custom authorization, authentication, and observability providers

## Key Interfaces

```typescript
interface ServerFactory {
  create(config: ServerConfig): Server;
}

interface ServerConfig {
  transportFactory: TransportFactory;
  transportConfig: TransportConfig;
  authProviderFactory?: AuthProviderFactory;
  authProviderConfig?: AuthProviderConfig;
  authorizationProviderFactory?: AuthorizationProviderFactory;
  authorizationProviderConfig?: AuthorizationProviderConfig;
  middlewareFactory?: MiddlewareFactory;
  middlewareConfig?: MiddlewareConfig;
  observabilityProviderFactory?: ObservabilityProviderFactory;
  observabilityConfig?: ObservabilityConfig;
  // Additional configuration properties
}

interface Server {
  onRequest<T = any, R = any>(type: string, handler: RequestHandler<T, R>): void;
  onEvent<T = any>(type: string, handler: EventHandler<T>): void;
  broadcast<T = any>(type: string, payload: T, context?: Partial<MessageContext>): Promise<void>;
  start(options?: IServerOptions): Promise<void>;
  stop(): Promise<void>;
  // Additional methods
}
```

## Implementation Template

Here's a template for implementing a custom ServerFactory:

```typescript
import {
  ServerFactory,
  ServerConfig,
  Server,
  TransportFactory,
  AuthProviderFactory,
  AuthorizationProviderFactory,
  MiddlewareFactory,
  ObservabilityProviderFactory
} from '@magicbutton.cloud/messaging';

// 1. Define your config interface (extends ServerConfig)
interface MyServerConfig extends ServerConfig {
  // Custom configuration properties
  port: number;
  host: string;
  maxConnections?: number;
  allowAnonymous?: boolean;
  systemEvents?: {
    enabled: boolean;
    heartbeatIntervalMs?: number;
  };
}

// 2. Implement your ServerFactory
export class MyServerFactory implements ServerFactory {
  // You can add dependencies to be injected here
  private readonly logger: any;
  
  constructor(logger: any) {
    this.logger = logger;
  }

  create(config: ServerConfig): Server {
    // Cast to your specific config type
    const myConfig = config as MyServerConfig;
    
    // Validate required config properties
    this.validateConfig(myConfig);
    
    // Get factories from config (or use defaults)
    const transportFactory = myConfig.transportFactory;
    const authProviderFactory = myConfig.authProviderFactory;
    const authorizationProviderFactory = myConfig.authorizationProviderFactory;
    const middlewareFactory = myConfig.middlewareFactory;
    const observabilityProviderFactory = myConfig.observabilityProviderFactory;
    
    // Create the transport
    const transport = transportFactory.create(myConfig.transportConfig);
    
    // Create auth provider if factory is provided
    const authProvider = authProviderFactory 
      ? authProviderFactory.create(myConfig.authProviderConfig)
      : undefined;
    
    // Create authorization provider if factory is provided
    const authorizationProvider = authorizationProviderFactory
      ? authorizationProviderFactory.create(myConfig.authorizationProviderConfig)
      : undefined;
    
    // Create middleware provider if factory is provided
    const middlewareProvider = middlewareFactory
      ? middlewareFactory.create(myConfig.middlewareConfig)
      : undefined;
    
    // Create observability provider if factory is provided
    const observabilityProvider = observabilityProviderFactory
      ? observabilityProviderFactory.create(myConfig.observabilityConfig)
      : undefined;
    
    // Log server creation
    this.logger.info(`Creating server on ${myConfig.host}:${myConfig.port}`);
    
    // Create and return the server
    return Server.create({
      transport,
      authProvider,
      authorizationProvider,
      middlewareProvider,
      observabilityProvider,
      options: {
        port: myConfig.port,
        host: myConfig.host,
        maxConnections: myConfig.maxConnections,
        allowAnonymous: myConfig.allowAnonymous,
        systemEvents: myConfig.systemEvents
      }
    });
  }
  
  private validateConfig(config: MyServerConfig): void {
    if (!config.transportFactory) {
      throw new Error('Transport factory is required');
    }
    
    if (!config.transportConfig) {
      throw new Error('Transport configuration is required');
    }
    
    if (!config.port || config.port < 1024 || config.port > 65535) {
      throw new Error('Valid port number is required (between 1024 and 65535)');
    }
    
    if (!config.host) {
      throw new Error('Host is required');
    }
  }
}
```

## Usage Example

Here's how to use your custom ServerFactory:

```typescript
import { MyServerFactory } from './my-server-factory';
import { WebSocketTransportFactory } from './websocket-transport-factory';
import { JwtAuthProviderFactory } from './jwt-auth-provider-factory';
import { RoleBasedAuthorizationProviderFactory } from './role-based-authorization-factory';
import { DefaultMiddlewareFactory } from './default-middleware-factory';
import { ConsoleLogger } from './logger';

// Create dependencies
const logger = new ConsoleLogger();

// Create your server factory
const serverFactory = new MyServerFactory(logger);

// Create a server with your factory
const server = serverFactory.create({
  // Transport configuration
  transportFactory: new WebSocketTransportFactory(),
  transportConfig: {
    type: 'websocket',
    options: {
      path: '/messaging'
    }
  },
  
  // Auth provider configuration
  authProviderFactory: new JwtAuthProviderFactory(),
  authProviderConfig: {
    jwksUrl: 'https://auth.example.com/.well-known/jwks.json',
    audience: 'messaging-api',
    issuer: 'auth.example.com'
  },
  
  // Authorization provider configuration
  authorizationProviderFactory: new RoleBasedAuthorizationProviderFactory(),
  authorizationProviderConfig: {
    roleDefinitionsPath: './roles.json'
  },
  
  // Middleware configuration
  middlewareFactory: new DefaultMiddlewareFactory(),
  middlewareConfig: {
    validation: true,
    logging: true
  },
  
  // Custom server configuration
  port: 8080,
  host: '0.0.0.0',
  maxConnections: 1000,
  allowAnonymous: false,
  systemEvents: {
    enabled: true,
    heartbeatIntervalMs: 30000
  }
});

// Register request handlers
server.onRequest('getUserProfile', async (payload, context) => {
  // Handle request
  return { id: payload.userId, name: 'John Doe' };
});

// Register event handlers
server.onEvent('userStatusChanged', async (payload, context) => {
  // Handle event
  console.log(`User ${payload.userId} status changed to ${payload.status}`);
});

// Start the server
await server.start();
```

## Best Practices

1. **Configuration Validation**: Validate all required configuration parameters
2. **Dependency Injection**: Design your factory to accept external dependencies
3. **Consistent Logging**: Log server creation and configuration details
4. **Default Options**: Provide sensible defaults for optional parameters
5. **Environment Awareness**: Support different configurations based on environment
6. **Error Handling**: Implement proper error handling during server creation
7. **Security**: Ensure proper authentication and authorization is configured
8. **Resource Management**: Clean up resources when the server is stopped

## Advanced Scenarios

### Cluster Server Factory

For applications that need to support clustering:

```typescript
class ClusterServerFactory implements ServerFactory {
  private readonly baseFactory: ServerFactory;
  private readonly clusterService: any; // Your clustering service
  
  constructor(baseFactory: ServerFactory, clusterService: any) {
    this.baseFactory = baseFactory;
    this.clusterService = clusterService;
  }
  
  create(config: ServerConfig): Server {
    // Create base server using the base factory
    const baseServer = this.baseFactory.create(config);
    
    // Wrap the server with clustering capabilities
    return new ClusterServer(baseServer, this.clusterService, config);
  }
}

// Cluster-aware server implementation
class ClusterServer implements Server {
  private readonly baseServer: Server;
  private readonly clusterService: any;
  
  constructor(baseServer: Server, clusterService: any, config: any) {
    this.baseServer = baseServer;
    this.clusterService = clusterService;
    
    // Set up cross-node communication
    this.setupClusterCommunication();
  }
  
  private setupClusterCommunication(): void {
    // Listen for broadcast messages from other nodes
    this.clusterService.on('broadcast', (message: any) => {
      // Forward the broadcast to local clients
      this.baseServer.broadcast(message.type, message.payload, message.context);
    });
  }
  
  // Implement Server interface methods, enhancing with cluster capabilities
  
  onRequest<T = any, R = any>(type: string, handler: RequestHandler<T, R>): void {
    this.baseServer.onRequest(type, handler);
  }
  
  onEvent<T = any>(type: string, handler: EventHandler<T>): void {
    this.baseServer.onEvent(type, handler);
  }
  
  async broadcast<T = any>(type: string, payload: T, context?: Partial<MessageContext>): Promise<void> {
    // Broadcast locally
    await this.baseServer.broadcast(type, payload, context);
    
    // Broadcast to other nodes
    this.clusterService.emit('broadcast', {
      type,
      payload,
      context
    });
  }
  
  async start(options?: IServerOptions): Promise<void> {
    // Start base server
    await this.baseServer.start(options);
    
    // Register with cluster
    this.clusterService.register();
  }
  
  async stop(): Promise<void> {
    // Unregister from cluster
    this.clusterService.unregister();
    
    // Stop base server
    await this.baseServer.stop();
  }
}
```

### Environment-Based Server Factory

A factory that creates servers configured for different environments:

```typescript
class EnvironmentServerFactory implements ServerFactory {
  private readonly environment: 'development' | 'staging' | 'production';
  private readonly baseFactory: ServerFactory;
  
  constructor(environment: 'development' | 'staging' | 'production', baseFactory: ServerFactory) {
    this.environment = environment;
    this.baseFactory = baseFactory;
  }
  
  create(baseConfig: ServerConfig): Server {
    // Merge base config with environment-specific config
    const envConfig = this.getEnvironmentConfig();
    const mergedConfig = { ...baseConfig, ...envConfig };
    
    // Create server using base factory
    return this.baseFactory.create(mergedConfig);
  }
  
  private getEnvironmentConfig(): Partial<ServerConfig> {
    switch (this.environment) {
      case 'development':
        return {
          port: 8080,
          host: 'localhost',
          maxConnections: 100,
          allowAnonymous: true,
          systemEvents: {
            enabled: true,
            heartbeatIntervalMs: 10000
          }
        };
        
      case 'staging':
        return {
          port: 8080,
          host: '0.0.0.0',
          maxConnections: 500,
          allowAnonymous: false,
          systemEvents: {
            enabled: true,
            heartbeatIntervalMs: 30000
          }
        };
        
      case 'production':
        return {
          port: 443,
          host: '0.0.0.0',
          maxConnections: 5000,
          allowAnonymous: false,
          systemEvents: {
            enabled: true,
            heartbeatIntervalMs: 60000
          }
        };
        
      default:
        throw new Error(`Unknown environment: ${this.environment}`);
    }
  }
}
```

### Server with Custom Plugins

A factory that supports custom server plugins:

```typescript
// Plugin interface
interface ServerPlugin {
  name: string;
  initialize(server: Server): Promise<void>;
  shutdown?(): Promise<void>;
}

// Server with plugin support
class PluggableServer implements Server {
  private readonly baseServer: Server;
  private readonly plugins: ServerPlugin[] = [];
  
  constructor(baseServer: Server) {
    this.baseServer = baseServer;
  }
  
  registerPlugin(plugin: ServerPlugin): void {
    this.plugins.push(plugin);
  }
  
  // Implement Server interface methods, delegating to base server
  
  onRequest<T = any, R = any>(type: string, handler: RequestHandler<T, R>): void {
    this.baseServer.onRequest(type, handler);
  }
  
  onEvent<T = any>(type: string, handler: EventHandler<T>): void {
    this.baseServer.onEvent(type, handler);
  }
  
  async broadcast<T = any>(type: string, payload: T, context?: Partial<MessageContext>): Promise<void> {
    await this.baseServer.broadcast(type, payload, context);
  }
  
  async start(options?: IServerOptions): Promise<void> {
    // Initialize all plugins
    for (const plugin of this.plugins) {
      await plugin.initialize(this);
    }
    
    // Start base server
    await this.baseServer.start(options);
  }
  
  async stop(): Promise<void> {
    // Stop base server
    await this.baseServer.stop();
    
    // Shutdown all plugins that have a shutdown method
    for (const plugin of this.plugins) {
      if (plugin.shutdown) {
        await plugin.shutdown();
      }
    }
  }
}

// Factory for pluggable server
class PluggableServerFactory implements ServerFactory {
  private readonly baseFactory: ServerFactory;
  private readonly plugins: ServerPlugin[];
  
  constructor(baseFactory: ServerFactory, plugins: ServerPlugin[] = []) {
    this.baseFactory = baseFactory;
    this.plugins = plugins;
  }
  
  create(config: ServerConfig): Server {
    // Create base server
    const baseServer = this.baseFactory.create(config);
    
    // Create pluggable server
    const pluggableServer = new PluggableServer(baseServer);
    
    // Register plugins
    for (const plugin of this.plugins) {
      pluggableServer.registerPlugin(plugin);
    }
    
    return pluggableServer;
  }
}

// Example usage
const serverFactory = new PluggableServerFactory(
  new MyServerFactory(logger),
  [
    new MetricsPlugin(),
    new HealthCheckPlugin(),
    new AdminPanelPlugin()
  ]
);
```

### Auto-Scaling Server Factory

A factory that creates servers with auto-scaling capabilities:

```typescript
class AutoScalingServerFactory implements ServerFactory {
  private readonly baseFactory: ServerFactory;
  private readonly scaler: any; // Your auto-scaling service
  
  constructor(baseFactory: ServerFactory, scaler: any) {
    this.baseFactory = baseFactory;
    this.scaler = scaler;
  }
  
  create(config: ServerConfig): Server {
    // Create base server
    const baseServer = this.baseFactory.create(config);
    
    // Wrap with auto-scaling capabilities
    return new AutoScalingServer(baseServer, this.scaler, config);
  }
}

// Auto-scaling server implementation
class AutoScalingServer implements Server {
  private readonly baseServer: Server;
  private readonly scaler: any;
  private readonly config: any;
  private monitoringInterval?: NodeJS.Timeout;
  
  constructor(baseServer: Server, scaler: any, config: any) {
    this.baseServer = baseServer;
    this.scaler = scaler;
    this.config = config;
  }
  
  // Implement Server interface, delegating to base server
  
  onRequest<T = any, R = any>(type: string, handler: RequestHandler<T, R>): void {
    this.baseServer.onRequest(type, handler);
  }
  
  onEvent<T = any>(type: string, handler: EventHandler<T>): void {
    this.baseServer.onEvent(type, handler);
  }
  
  async broadcast<T = any>(type: string, payload: T, context?: Partial<MessageContext>): Promise<void> {
    await this.baseServer.broadcast(type, payload, context);
  }
  
  async start(options?: IServerOptions): Promise<void> {
    // Start base server
    await this.baseServer.start(options);
    
    // Start monitoring for auto-scaling
    this.monitoringInterval = setInterval(() => this.checkLoad(), 30000);
  }
  
  async stop(): Promise<void> {
    // Stop monitoring
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    // Stop base server
    await this.baseServer.stop();
  }
  
  private async checkLoad(): Promise<void> {
    // Example: Get current load metrics
    const connectionCount = await this.getConnectionCount();
    const cpuUsage = await this.getCpuUsage();
    const memoryUsage = await this.getMemoryUsage();
    
    // Check if scaling is needed
    if (connectionCount > this.config.maxConnections * 0.8 || cpuUsage > 80) {
      // Scale up
      await this.scaler.scaleUp();
    } else if (connectionCount < this.config.maxConnections * 0.3 && cpuUsage < 30) {
      // Scale down
      await this.scaler.scaleDown();
    }
  }
  
  private async getConnectionCount(): Promise<number> {
    // Implementation to get current connection count
    return 0;
  }
  
  private async getCpuUsage(): Promise<number> {
    // Implementation to get CPU usage
    return 0;
  }
  
  private async getMemoryUsage(): Promise<number> {
    // Implementation to get memory usage
    return 0;
  }
}
```