import { NatsTransportFactory } from '../nats-transport-factory';
import { NatsTransport } from '../nats-transport';
import { NatsTransportConfig } from '../types';

// Mock the NATS library
jest.mock('nats', () => {
  const mockNatsConnection = {
    close: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue({
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          return {
            done: true,
            value: undefined
          };
        }
      })
    }),
    status: () => ({
      [Symbol.asyncIterator]: () => ({
        next: async () => {
          return {
            done: true,
            value: undefined
          };
        }
      })
    })
  };

  return {
    connect: jest.fn().mockResolvedValue(mockNatsConnection),
    JSONCodec: jest.fn().mockReturnValue({
      encode: jest.fn().mockImplementation((data) => Buffer.from(JSON.stringify(data))),
      decode: jest.fn().mockImplementation((data) => JSON.parse(data.toString()))
    }),
    headers: jest.fn().mockReturnValue({
      append: jest.fn(),
      get: jest.fn()
    })
  };
});

describe('NatsTransport', () => {
  let factory: NatsTransportFactory;
  let transport: NatsTransport;
  let config: NatsTransportConfig;

  beforeEach(() => {
    config = {
      servers: ['nats://localhost:4222'],
      connectTimeout: 5000,
      subjects: {
        requests: 'test.requests',
        events: 'test.events'
      }
    };

    factory = new NatsTransportFactory();
    transport = factory.create(config) as NatsTransport;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('NatsTransportFactory', () => {
    it('should create a NatsTransport instance', () => {
      expect(transport).toBeInstanceOf(NatsTransport);
    });

    it('should throw error if servers are not provided', () => {
      expect(() => {
        factory.create({} as NatsTransportConfig);
      }).toThrow('NATS servers configuration is required');
    });
  });

  describe('NatsTransport', () => {
    it('should connect to NATS server', async () => {
      await transport.connect();
      
      const { connect } = require('nats');
      expect(connect).toHaveBeenCalledWith(expect.objectContaining({
        servers: ['nats://localhost:4222'],
        timeout: 5000
      }));
    });

    it('should disconnect from NATS server', async () => {
      await transport.connect();
      await transport.disconnect();
      
      const { connect } = require('nats');
      const mockConnection = await connect();
      expect(mockConnection.close).toHaveBeenCalled();
    });

    it('should send a message', async () => {
      await transport.connect();
      
      const message = {
        type: 'testRequest',
        payload: { test: 'data' },
        requestId: '123'
      };
      
      await transport.send(message);
      
      const { connect } = require('nats');
      const mockConnection = await connect();
      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test.requests.testRequest',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.anything()
        })
      );
    });

    it('should send an event', async () => {
      await transport.connect();
      
      const message = {
        type: 'event:testEvent',
        payload: { test: 'data' }
      };
      
      await transport.send(message);
      
      const { connect } = require('nats');
      const mockConnection = await connect();
      expect(mockConnection.publish).toHaveBeenCalledWith(
        'test.events.testEvent',
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.anything()
        })
      );
    });

    it('should throw error when sending message without connection', async () => {
      const message = {
        type: 'testRequest',
        payload: { test: 'data' }
      };
      
      await expect(transport.send(message)).rejects.toThrow('Transport not connected');
    });

    it('should register message callback', () => {
      const callback = jest.fn();
      transport.receive(callback);
      
      // This is an indirect test since we can't directly invoke the callback
      // from outside the class, but we can verify it was stored
      expect(transport).toHaveProperty('messageCallback', callback);
    });
  });
});