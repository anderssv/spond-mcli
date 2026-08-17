import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import type { Server } from 'http';
import { startHttpServer } from '../../src/http-server.js';

// The Streamable HTTP transport responds via SSE (one "data:" event per
// message) rather than a plain JSON body. Any real MCP client already
// parses this; this helper does the same for test purposes.
async function readSseJsonRpcResponse(response: Response): Promise<any> {
  const text = await response.text();
  const dataLine = text.split('\n').find(line => line.startsWith('data:'));
  if (!dataLine) {
    throw new Error(`No SSE data line found in response body: ${text}`);
  }
  return JSON.parse(dataLine.slice('data:'.length).trim());
}

describe('HTTP MCP server', () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startHttpServer(0);
    const address = server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Expected server to bind to a TCP port');
    }
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  test('GET /health returns 200 ok without auth', async () => {
    const response = await fetch(`${baseUrl}/health`);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  test('POST /mcp without an Authorization header returns 401', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });

    expect(response.status).toBe(401);
  });

  test('POST /mcp with an invalid token returns 401', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer short'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });

    expect(response.status).toBe(401);
  });

  test('POST /mcp with Bearer mock-data lists real tools', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer mock-data'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} })
    });

    expect(response.status).toBe(200);
    const body = await readSseJsonRpcResponse(response);
    expect(Array.isArray(body.result.tools)).toBe(true);
    expect(body.result.tools.some((t: any) => t.name === 'search_all')).toBe(true);
  });

  test('POST /mcp with Bearer mock-data can call a tool', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer mock-data'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'get_groups', arguments: {} }
      })
    });

    expect(response.status).toBe(200);
    const body = await readSseJsonRpcResponse(response);
    const data = JSON.parse(body.result.content[0].text);
    expect(Array.isArray(data)).toBe(true);
  });

  test('unknown path returns 404', async () => {
    const response = await fetch(`${baseUrl}/nonexistent`);

    expect(response.status).toBe(404);
  });
});
