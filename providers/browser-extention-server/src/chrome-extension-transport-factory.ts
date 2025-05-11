import { TransportFactory, TransportConfig } from '@magicbutton.cloud/messaging';
import { 
  ChromeExtensionTransport, 
  ChromeExtensionTransportConfig 
} from './chrome-extension-transport';

/**
 * Factory for creating Chrome extension transport adapters
 */
export class ChromeExtensionTransportFactory implements TransportFactory {
  /**
   * Creates a new ChromeExtensionTransport instance
   */
  create(config: TransportConfig): ChromeExtensionTransport {
    // Cast to our expected config type
    const transportConfig = config as ChromeExtensionTransportConfig;
    
    // Validate required config properties
    this.validateConfig(transportConfig);
    
    // Create and return the transport
    return new ChromeExtensionTransport(transportConfig);
  }
  
  /**
   * Validates the transport configuration
   */
  private validateConfig(config: ChromeExtensionTransportConfig): void {
    if (!config.componentType) {
      throw new Error('ChromeExtensionTransportConfig requires componentType');
    }
    
    const validComponentTypes = ['background', 'content', 'popup', 'sidepanel', 'options'];
    if (!validComponentTypes.includes(config.componentType)) {
      throw new Error(`Invalid componentType: ${config.componentType}. Must be one of: ${validComponentTypes.join(', ')}`);
    }
    
    // Content scripts targeting specific tabs need a tabId
    if (config.componentType === 'content' && config.targetTabId === undefined) {
      console.warn('Content script transport with no targetTabId will only communicate with the background script');
    }
  }
}