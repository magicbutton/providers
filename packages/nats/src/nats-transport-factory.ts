// Import from our local types
import { TransportConfig } from './types';

// Define interfaces for our transport system
export interface Transport<TEvents = any, TRequests = any> {
  connect(options?: any): Promise<void>;
  disconnect(): Promise<void>;
  send(message: any): Promise<void>;
  receive(callback: (message: any) => void): void;
  isConnected?(): boolean;
}

export interface TransportFactory {
  create(config: TransportConfig): Transport;
}
import { NatsTransportConfig } from './types';
import { NatsTransport } from './nats-transport';

/**
 * Factory for creating NATS transport instances
 */
export class NatsTransportFactory implements TransportFactory {
  /**
   * Creates a new NATS transport instance
   * 
   * @param config - Transport configuration
   * @returns A configured Transport instance
   */
  create(config: TransportConfig): Transport {
    // Cast to NatsTransportConfig
    const natsConfig = config as NatsTransportConfig;
    
    // Validate required configuration
    if (!natsConfig.servers || natsConfig.servers.length === 0) {
      throw new Error('NATS servers configuration is required');
    }
    
    // Create and return the transport
    return new NatsTransport(natsConfig);
  }
}