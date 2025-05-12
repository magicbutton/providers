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
 * Chrome extension transport implementation for communication
 * between popup, content scripts, background scripts, side panels, and external extensions
 */
export class ChromeTransport implements Transport<any, any> {
  constructor(config: ChromeTransportConfig);

  connect(options?: any): Promise<void>;
  disconnect(): Promise<void>;
  sendRequest(type: string, payload: any, context?: any): Promise<any>;
  subscribe<K extends string>(eventType: K, handler: (data: any) => void): () => void;
  registerRequestHandler<K extends string>(type: K, handler: (data: any) => Promise<any>): () => void;
  publish(eventType: string, payload: any): Promise<void>;

  /**
   * Open a side panel
   * This method works only when called from a background script
   */
  openSidePanel(): Promise<void>;

  /**
   * Close the side panel
   * This method works only when called from a background script
   */
  closeSidePanel(): Promise<void>;

  /**
   * Set the side panel state
   * This method works only when called from a background script
   */
  setSidePanelState(options: {
    path?: string;
    enabled?: boolean;
    width?: number;
  }): Promise<void>;

  /**
   * Get the side panel state
   * This method works only when called from a background script
   */
  getSidePanelState(): Promise<{path?: string, enabled?: boolean, width?: number}>;
}

/**
 * Factory for creating Chrome Transports
 */
export class ChromeTransportFactory {
  create(config: any): Transport<any, any>;
}

export default ChromeTransportFactory;