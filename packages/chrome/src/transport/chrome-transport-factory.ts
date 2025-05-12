import { Transport } from '@magicbutton.cloud/messaging';
import { ChromeTransport, ChromeTransportConfig } from './chrome-transport';

/**
 * Factory for creating Chrome Transports
 */
export class ChromeTransportFactory {
  /**
   * Create a new Chrome transport instance
   * @param config The transport configuration
   * @returns A new Transport instance
   */
  create(config: any): Transport<any, any> {
    // Cast to your specific config type
    const chromeConfig = config as ChromeTransportConfig;
    
    // Validate required configuration
    if (!chromeConfig.connectionName) {
      throw new Error('Chrome connection name is required');
    }
    
    // Create and return the transport
    return new ChromeTransport(chromeConfig);
  }
}