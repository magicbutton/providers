# NATS Transport Provider

NATS transport provider for the Magic Button Cloud messaging library.

[![npm version](https://img.shields.io/npm/v/@magicbutton.cloud/nats-transport.svg)](https://www.npmjs.com/package/@magicbutton.cloud/nats-transport)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Part of the [Magic Button Cloud Providers](https://github.com/magicbutton-cloud/providers) collection.

## Installation

```bash
# With npm
npm install @magicbutton.cloud/nats-transport

# With pnpm
pnpm add @magicbutton.cloud/nats-transport

# With yarn
yarn add @magicbutton.cloud/nats-transport
```

## Usage

```typescript
import { Client } from '@magicbutton.cloud/messaging';
import { NatsTransportFactory } from '@magicbutton.cloud/nats-transport';

// Create your transport factory
const transportFactory = new NatsTransportFactory();

// Create a client with your transport
const client = Client.create({
  transportFactory,
  transportConfig: {
    servers: ['nats://localhost:4222'],
    subjects: {
      requests: 'myapp.requests',
      events: 'myapp.events'
    }
  }
});

// Connect the client
await client.connect();

// Make a request
const response = await client.request('getUsers', { filter: 'active' });

// Subscribe to events
client.on('userAdded', (user) => {
  console.log('New user added:', user);
});

// Disconnect when done
await client.disconnect();
```

## Configuration Options

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| servers | string[] | Yes | Array of NATS server URLs |
| token | string | No | Authentication token |
| user | string | No | Username for authentication |
| pass | string | No | Password for authentication |
| subjects.requests | string | No | Base subject for requests (default: 'messaging.requests') |
| subjects.events | string | No | Base subject for events (default: 'messaging.events') |
| connectTimeout | number | No | Connection timeout in milliseconds (default: 10000) |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.