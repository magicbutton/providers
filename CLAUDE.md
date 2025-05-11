# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Messaging Library

```bash
# Navigate to the messaging directory
cd messaging

# Install dependencies
npm install

# Build the library
npm run build

# Watch mode for development
npm run dev

# Lint code
npm run lint

# Type check without emitting files
npm run typecheck

# Clean build artifacts
npm run clean
```

### Documentation

```bash
# Navigate to the docs directory
cd docs

# Install dependencies
npm install

# Start documentation development server
npm start

# Build documentation
npm run build

# Deploy documentation
npm run deploy
```

## Project Architecture

Magic Button Cloud is composed of two main parts:

1. **Messaging Library**: A type-safe, domain-driven framework for distributed systems communication
2. **Documentation**: Built with Docusaurus to document the library's usage and features

### Messaging Library Architecture

The messaging library follows a contract-first approach with a client-server architecture that abstracts away the transport layer. The core components include:

#### Core Concepts

1. **Contract-First Design**: Uses Zod schemas for type safety. Contracts define events, requests/responses, and error codes.
2. **Transport Abstraction**: The `TransportAdapter` interface abstracts the underlying communication protocol (HTTP, WebSockets, etc.).
3. **Client/Server Architecture**: The library provides dedicated client and server classes for communication.
4. **Access Control**: Built-in role-based access control system for securing communications.
5. **Message Context**: Context information (auth, tracing, etc.) can be passed through the communication chain.
6. **Middleware**: Extensible middleware system for logging, authentication, validation, etc.
7. **Error Handling**: Standardized error handling with retry capabilities.

#### Key Components

- **Contracts**: Define the shape of communication (events, requests, errors) using Zod schemas
- **Client**: Used to connect to servers, send requests, and subscribe to events
- **Server**: Handles requests and broadcasts events to clients
- **TransportAdapter**: Interface for implementing different communication protocols
- **AccessControl**: Role-based permission system
- **Middleware**: Pipeline for request/response processing
- **Observability**: Tools for logging, metrics, and tracing

#### Important Files

- `client.ts`: Client implementation for connecting to servers
- `server.ts`: Server implementation for handling requests and managing clients
- `transport-adapter.ts`: Interface for transport implementations
- `in-memory-transport.ts`: In-memory transport implementation for testing
- `access-control.ts`: Role-based access control system
- `types.ts`: Core type definitions
- `system-contract.ts`: System-level events and requests
- `utils.ts`: Utility functions for creating contracts, events, etc.
- `middleware.ts`: Middleware system for request/response pipeline
- `observability.ts`: Tools for logging, metrics, and tracing
- `errors.ts`: Error handling utilities and error registry

## Development Workflow

When working with this codebase:

1. **Define Contracts First**: Start by defining your contracts using Zod schemas
2. **Implement Transports**: Choose an existing transport or implement a custom one
3. **Create Server and Client**: Initialize the server and client with appropriate configurations
4. **Register Handlers**: Set up request handlers on the server
5. **Connect Clients**: Connect clients to the server and make requests/subscribe to events
6. **Use Middleware**: Add middleware for cross-cutting concerns
7. **Error Handling**: Implement proper error handling using the provided utilities

## Testing Patterns

The library includes testing utilities to help test your contracts and implementations:

- Use `InMemoryTransport` for mocking transport in tests
- Create test contracts to verify behavior
- Use the error handling utilities to test error cases