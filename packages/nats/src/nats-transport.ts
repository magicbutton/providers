import { Transport } from './nats-transport-factory';
import { NatsTransportConfig } from './types';
import {
  connect,
  NatsConnection,
  Subscription,
  JSONCodec,
  ConnectionOptions,
  headers
} from 'nats';

export class NatsTransport implements Transport {
  private readonly config: NatsTransportConfig;
  private nats: NatsConnection | null = null;
  private messageCallback: ((message: any) => void) | null = null;
  private subscriptions: Subscription[] = [];
  private connected = false;
  private connecting = false;
  private jsonCodec = JSONCodec();
  
  constructor(config: NatsTransportConfig) {
    this.config = {
      ...config,
      connectTimeout: config.connectTimeout || 10000,
      subjects: {
        requests: config.subjects?.requests || 'messaging.requests',
        events: config.subjects?.events || 'messaging.events'
      }
    };
  }
  
  async connect(options: any = {}): Promise<void> {
    if (this.connected) {
      return; // Already connected
    }
    
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }
    
    this.connecting = true;
    
    try {
      const connectionOptions: ConnectionOptions = {
        servers: this.config.servers,
        token: this.config.token,
        user: this.config.user,
        pass: this.config.pass,
        timeout: this.config.connectTimeout
      };
      
      // Connect to NATS server
      this.nats = await connect(connectionOptions);
      
      // Set up subscriptions
      await this.setupSubscriptions();
      
      this.connected = true;
      this.connecting = false;
      
      // Handle disconnect
      (async () => {
        if (this.nats) {
          for await (const status of this.nats.status()) {
            if (status.type === 'disconnect') {
              this.connected = false;
              if (this.messageCallback) {
                this.messageCallback({
                  type: 'system:disconnected',
                  payload: { reason: status.data }
                });
              }
            }
          }
        }
      })().catch(err => {
        console.error('Error in NATS status handler:', err);
      });
      
    } catch (error) {
      this.connecting = false;
      throw error;
    }
  }
  
  async disconnect(): Promise<void> {
    // Close subscriptions
    for (const sub of this.subscriptions) {
      await sub.unsubscribe();
    }
    this.subscriptions = [];
    
    // Close NATS connection
    if (this.nats) {
      await this.nats.close();
      this.nats = null;
      this.connected = false;
    }
  }
  
  async send(message: any): Promise<void> {
    if (!this.nats || !this.connected) {
      throw new Error('Transport not connected');
    }
    
    const messageHeaders = headers();
    
    // Add request ID to headers if available
    if (message.requestId) {
      messageHeaders.append('requestId', message.requestId);
    }
    
    if (message.type.startsWith('event:')) {
      // Publish event
      const eventType = message.type.substring(6);
      const subject = `${this.config.subjects!.events}.${eventType}`;
      
      await this.nats.publish(
        subject, 
        this.jsonCodec.encode(message.payload), 
        { headers: messageHeaders }
      );
    } else {
      // Send request
      const subject = `${this.config.subjects!.requests}.${message.type}`;
      const replySubject = message.replyTo || '';
      
      await this.nats.publish(
        subject,
        this.jsonCodec.encode(message.payload),
        {
          reply: replySubject,
          headers: messageHeaders
        }
      );
    }
  }
  
  receive(callback: (message: any) => void): void {
    this.messageCallback = callback;
  }
  
  private async setupSubscriptions(): Promise<void> {
    if (!this.nats) return;
    
    // Subscribe to request responses
    // This subscribes to any reply subject that our requests might use
    const requestResponseSub = this.nats.subscribe('>');
    this.subscriptions.push(requestResponseSub);
    
    // Process responses
    this.processSubscription(requestResponseSub, (subject, headers, data) => {
      const requestId = headers?.get('requestId')?.[0];
      
      if (requestId && this.messageCallback) {
        this.messageCallback({
          type: 'response',
          payload: data,
          requestId
        });
      }
    });
    
    // Subscribe to events
    const eventsSubject = `${this.config.subjects!.events}.*`;
    const eventsSub = this.nats.subscribe(eventsSubject);
    this.subscriptions.push(eventsSub);
    
    // Process events
    this.processSubscription(eventsSub, (subject, headers, data) => {
      const parts = subject.split('.');
      const eventType = parts[parts.length - 1]; // Extract event type
      
      if (this.messageCallback) {
        this.messageCallback({
          type: `event:${eventType}`,
          payload: data
        });
      }
    });
  }
  
  private async processSubscription(
    subscription: Subscription,
    handler: (subject: string, msgHeaders: ReturnType<typeof headers> | undefined, data: any) => void
  ): Promise<void> {
    // Handle messages from subscription
    (async () => {
      for await (const message of subscription) {
        try {
          const data = this.jsonCodec.decode(message.data);
          handler(message.subject, message.headers, data);
        } catch (error) {
          console.error('Error processing NATS message:', error);
        }
      }
    })().catch(err => {
      console.error('NATS subscription error:', err);
    });
  }
  
  isConnected(): boolean {
    return this.connected;
  }
}