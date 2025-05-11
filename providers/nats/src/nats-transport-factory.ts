import { TransportFactory, TransportConfig, Transport } from '@magicbutton.cloud/messaging';
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