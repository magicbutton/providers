// Import types from the messaging library
// Note: This is a placeholder import. In a real implementation, you'd import from the actual library
export interface TransportConfig {
  [key: string]: any;
};

/**
 * Configuration options for the NATS transport
 */
export interface NatsTransportConfig extends TransportConfig {
  /**
   * Array of NATS server URLs
   * @example ['nats://localhost:4222']
   */
  servers: string[];

  /**
   * Authentication token
   */
  token?: string;

  /**
   * Username for authentication
   */
  user?: string;

  /**
   * Password for authentication
   */
  pass?: string;

  /**
   * Connection timeout in milliseconds
   * @default 10000
   */
  connectTimeout?: number;

  /**
   * Subject configuration for NATS messaging
   */
  subjects?: {
    /**
     * Base subject for requests
     * @default 'messaging.requests'
     */
    requests: string;

    /**
     * Base subject for events
     * @default 'messaging.events'
     */
    events: string;
  };
}