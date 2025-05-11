# Magic Button Cloud

A monorepo for the Magic Button Cloud messaging framework and related packages.

## Repository Structure

This repository is a pnpm-based monorepo that contains the following packages:

- **messaging**: Core messaging library with client-server architecture
- **auth**: Authentication library
- **state**: State management library
- **providers**: Various transport providers for the messaging library
  - **nats**: NATS transport provider
  - **browser-extension-server**: Browser extension server provider

## Getting Started

### Prerequisites

- Node.js 14.x or higher
- [pnpm](https://pnpm.io/) 7.x or higher

### Installation

```bash
# Install pnpm if you don't have it
npm install -g pnpm@7

# Install all dependencies
pnpm install
```

### Build

```bash
# Build all packages
pnpm build

# Build a specific package
pnpm --filter @magicbutton.cloud/messaging build
```

### Development

```bash
# Start development mode for all packages
pnpm dev

# Start development mode for a specific package
pnpm --filter @magicbutton.cloud/nats-transport dev
```

### Testing

```bash
# Run tests for all packages
pnpm test

# Run tests for a specific package
pnpm --filter @magicbutton.cloud/messaging test
```

### Linting

```bash
# Lint all packages
pnpm lint

# Lint a specific package
pnpm --filter @magicbutton.cloud/auth lint
```

## Package Management

### Adding Dependencies

```bash
# Add a dependency to a specific package
pnpm --filter @magicbutton.cloud/messaging add lodash

# Add a dev dependency to a specific package
pnpm --filter @magicbutton.cloud/messaging add -D typescript

# Add a dependency to all packages
pnpm add -w lodash
```

### Creating a New Package

1. Create a new directory in the appropriate location (e.g., `providers/new-provider`)
2. Add a `package.json` with the following minimal structure:

```json
{
  "name": "@magicbutton.cloud/new-provider",
  "version": "0.1.0",
  "description": "Description of your package",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit",
    "clean": "rimraf dist",
    "test": "jest"
  },
  "peerDependencies": {
    "@magicbutton.cloud/messaging": "^0.1.0"
  }
}
```

3. Create a `tsconfig.json` file
4. Add your source code in a `src` directory
5. Run `pnpm install` from the root to link the new package

## Publishing

```bash
# Publish a specific package
pnpm --filter @magicbutton.cloud/messaging publish

# Build all packages before publishing
pnpm build
```

## Documentation

For more detailed documentation, see the [docs](./docs) directory or visit the [documentation site](https://docs.magicbutton.cloud).

## License

MIT