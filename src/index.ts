#!/usr/bin/env node

import { SpondMcpServer } from './mcp-server.js';

// Re-exported for backward compatibility and existing tests.
export { SpondMcpServer };

// Start the server only if this file is run directly.
// For testing purposes, we check if NODE_ENV is not 'test'.
if (process.env.NODE_ENV !== 'test') {
  const server = new SpondMcpServer();
  server.run().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}
