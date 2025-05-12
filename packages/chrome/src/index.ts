/**
 * Chrome Transport Provider for Magic Button Cloud Messaging
 * 
 * This package provides a transport implementation for Chrome extensions,
 * allowing communication between popup, content scripts, background scripts,
 * and even between different extensions.
 */

// Export transport implementations
export * from './transport/chrome-transport';
export * from './transport/chrome-transport-factory';

// Re-export main factory for convenience
import { ChromeTransportFactory } from './transport/chrome-transport-factory';
export default ChromeTransportFactory;