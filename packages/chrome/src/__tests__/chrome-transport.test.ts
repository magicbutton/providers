import { describe, expect, it, jest, beforeEach } from '@jest/globals';
import {
  ChromeTransport,
  ChromeTransportConfig,
} from "../transport/chrome-transport";
import { ChromeTransportFactory } from "../transport/chrome-transport-factory";

// Mock Chrome API
const mockPort = {
  onMessage: {
    addListener: jest.fn(),
  },
  onDisconnect: {
    addListener: jest.fn(),
  },
  postMessage: jest.fn(),
  disconnect: jest.fn(),
};

const mockChrome = {
  runtime: {
    connect: jest.fn().mockReturnValue(mockPort),
    lastError: null,
  },
};

// Assign mock to global
(global as any).chrome = mockChrome;

describe("ChromeTransport", () => {
  let transport: ChromeTransport;
  let config: ChromeTransportConfig;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Setup config
    config = {
      connectionName: "test-connection",
      debug: true,
    };

    // Create transport
    transport = new ChromeTransport(config);
  });

  describe("connect", () => {
    it("should establish a connection successfully", async () => {
      // Connect
      await transport.connect();

      // Verify connection was made
      expect(mockChrome.runtime.connect).toHaveBeenCalledWith({
        name: "test-connection",
      });

      // Verify event listeners were registered
      expect(mockPort.onMessage.addListener).toHaveBeenCalled();
      expect(mockPort.onDisconnect.addListener).toHaveBeenCalled();
    });

    it("should connect to an external extension when extensionId is provided", async () => {
      // Setup config with external extension ID
      config.extensionId = "external-extension-id";
      transport = new ChromeTransport(config);

      // Connect
      await transport.connect();

      // Verify connection was made with extension ID
      expect(mockChrome.runtime.connect).toHaveBeenCalledWith(
        "external-extension-id",
        {
          name: "test-connection",
        }
      );
    });

    it("should not reconnect if already connected", async () => {
      // First connection
      await transport.connect();
      expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(1);

      // Second connection should not create a new port
      await transport.connect();
      expect(mockChrome.runtime.connect).toHaveBeenCalledTimes(1);
    });
  });

  describe("disconnect", () => {
    it("should disconnect the port", async () => {
      // First connect
      await transport.connect();

      // Then disconnect
      await transport.disconnect();

      // Verify disconnect was called
      expect(mockPort.disconnect).toHaveBeenCalled();
    });

    it("should not throw if already disconnected", async () => {
      // Disconnect without connecting first
      await expect(transport.disconnect()).resolves.not.toThrow();
    });
  });

  describe("sendRequest", () => {
    it("should send request messages through the port", async () => {
      // Connect
      await transport.connect();

      // Mock send method to verify it's called
      const sendSpy = jest.spyOn(transport as any, "send");

      // Send message
      const type = "testRequest";
      const payload = { value: "test-data" };
      const context = { requestId: "123" };

      await transport.sendRequest(type, payload, context);

      // Verify send was called with correct parameters
      expect(sendSpy).toHaveBeenCalledWith({
        type,
        payload,
        ...context,
      });
    });
  });

  describe("subscribe", () => {
    it("should register a callback for specific event types", async () => {
      // Connect
      await transport.connect();

      // Subscribe to event
      const handler = jest.fn();
      transport.subscribe("userAdded", handler);

      // Find the message listener that was registered
      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0] as (message: any) => void;

      // Simulate receiving a message of the subscribed type
      const testMessage = {
        type: "event:userAdded",
        payload: { id: 1, name: "Test User" },
      };
      messageListener(testMessage);

      // Verify handler was called with the message payload
      expect(handler).toHaveBeenCalledWith(testMessage.payload);

      // Simulate receiving a message of a different type
      const differentMessage = {
        type: "event:otherEvent",
        payload: { data: "test" },
      };
      messageListener(differentMessage);

      // Verify handler was not called for the different type
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe("registerRequestHandler", () => {
    it("should register a handler for specific request types", async () => {
      // Connect
      await transport.connect();

      // Register request handler
      const handler = jest.fn().mockResolvedValue({ result: "success" });
      transport.registerRequestHandler("getData", handler as any);

      // Mock send method to verify response is sent
      const sendSpy = jest.spyOn(transport as any, "send");

      // Find the message listener that was registered
      const messageListener = mockPort.onMessage.addListener.mock.calls[0][0] as (message: any) => Promise<void>;

      // Simulate receiving a request
      const requestMessage = {
        type: "getData",
        payload: { query: "test" },
        requestId: "req-123",
      };

      await messageListener(requestMessage);

      // Verify handler was called with the message payload
      expect(handler).toHaveBeenCalledWith(requestMessage.payload);

      // Verify response was sent
      expect(sendSpy).toHaveBeenCalledWith({
        type: "getData_response",
        payload: { result: "success" },
        requestId: "req-123",
      });
    });
  });

  describe("publish", () => {
    it("should publish events through the port", async () => {
      // Connect
      await transport.connect();

      // Mock send method to verify it's called
      const sendSpy = jest.spyOn(transport as any, "send");

      // Publish event
      const type = "userAdded";
      const payload = { id: 1, name: "Test User" };

      await transport.publish(type, payload);

      // Verify send was called with correct parameters
      expect(sendSpy).toHaveBeenCalledWith({
        type: `event:${type}`,
        payload,
      });
    });
  });
});

describe("ChromeTransportFactory", () => {
  it("should create a ChromeTransport instance", () => {
    const factory = new ChromeTransportFactory();
    const config = { connectionName: "test-connection" };
    const transport = factory.create(config);

    expect(transport).toBeInstanceOf(ChromeTransport);
  });

  it("should throw an error if connectionName is not provided", () => {
    const factory = new ChromeTransportFactory();
    const config = {}; // Missing connectionName

    expect(() => factory.create(config)).toThrow(
      "Chrome connection name is required"
    );
  });
});
