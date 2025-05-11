// This is an example of how to use the NATS transport in a real application
// (Not intended to be run as part of automated tests)

import { Client, Server } from '@magicbutton.cloud/messaging';
import { NatsTransportFactory } from '../nats-transport-factory';
import { z } from 'zod';

async function runExample() {
  // Create a NATS transport factory
  const transportFactory = new NatsTransportFactory();

  // Define a simple contract
  const contract = {
    requests: {
      getUser: {
        input: z.object({
          id: z.string()
        }),
        output: z.object({
          id: z.string(),
          name: z.string(),
          email: z.string().optional()
        })
      }
    },
    events: {
      userCreated: z.object({
        id: z.string(),
        name: z.string(),
        timestamp: z.number()
      })
    }
  };

  // Create a server with the NATS transport
  const server = Server.create({
    name: 'user-service',
    contract,
    transportFactory,
    transportConfig: {
      servers: ['nats://localhost:4222'],
      subjects: {
        requests: 'myapp.requests',
        events: 'myapp.events'
      }
    }
  });

  // Register a handler for the getUser request
  server.handle('getUser', async (params) => {
    // In a real application, you would fetch this from a database
    return {
      id: params.id,
      name: `User ${params.id}`,
      email: `user${params.id}@example.com`
    };
  });

  // Start the server
  await server.start();

  // Create a client with the NATS transport
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

  // Subscribe to the userCreated event
  client.on('userCreated', (user) => {
    console.log('User created:', user);
  });

  // Make a request to get a user
  try {
    const user = await client.request('getUser', { id: '123' });
    console.log('User:', user);
  } catch (error) {
    console.error('Error getting user:', error);
  }

  // Clean up
  await client.disconnect();
  await server.stop();
}

// Only run this example directly (not imported)
if (require.main === module) {
  runExample().catch(console.error);
}