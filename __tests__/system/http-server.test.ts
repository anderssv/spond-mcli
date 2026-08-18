import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import type { Server } from 'http';
import { mkdirSync, writeFileSync } from 'fs';
import { startHttpServer } from '../../src/http-server.js';
import { getOrCreateTokenWorkspaceDir, resolveResourcePath } from '../../src/workspace-manager.js';

const REAL_LOOKING_TOKEN_A = 'a-fake-but-valid-looking-spond-token-for-isolation-testing-A';
const REAL_LOOKING_TOKEN_B = 'a-fake-but-valid-looking-spond-token-for-isolation-testing-B';

async function callSearchResourceText(baseUrl: string, token: string, resourceId: string): Promise<any> {
  const response = await fetch(`${baseUrl}/mcp`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: { name: 'search_resource_text', arguments: { resourceId, searchTerm: 'practice' } }
    })
  });
  return response;
}

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

  test('POST /mcp surfaces a truncation note as a second content block when results are capped', async () => {
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
        params: { name: 'get_events', arguments: { maxResults: 1 } }
      })
    });

    expect(response.status).toBe(200);
    const body = await readSseJsonRpcResponse(response);
    expect(body.result.content).toHaveLength(2);
    expect(JSON.parse(body.result.content[0].text)).toHaveLength(1);
    expect(body.result.content[1].text).toMatch(/more results/i);
  });

  test('a resourceId created under one token is not reachable via a different token', async () => {
    const workspaceA = await getOrCreateTokenWorkspaceDir(REAL_LOOKING_TOKEN_A);
    const resourceId = 'isolation-test-resource';
    const textPath = resolveResourcePath(workspaceA, 'text', resourceId);
    mkdirSync(require('path').dirname(textPath), { recursive: true });
    writeFileSync(textPath, 'Practice moved to Tuesday\n');

    const ownRequest = await callSearchResourceText(baseUrl, REAL_LOOKING_TOKEN_A, resourceId);
    const ownBody = await readSseJsonRpcResponse(ownRequest);
    expect(ownBody.result.content[0].text).toContain('Practice moved to Tuesday');

    const otherRequest = await callSearchResourceText(baseUrl, REAL_LOOKING_TOKEN_B, resourceId);
    const otherBody = await readSseJsonRpcResponse(otherRequest);
    expect(otherBody.error?.message).toContain('Unknown resourceId');
  });

  test('a resource created in one HTTP request is reachable in a later request with the same token', async () => {
    const token = `${REAL_LOOKING_TOKEN_A}-reuse`;
    const workspaceDir = await getOrCreateTokenWorkspaceDir(token);
    const resourceId = 'reuse-test-resource';
    const textPath = resolveResourcePath(workspaceDir, 'text', resourceId);
    mkdirSync(require('path').dirname(textPath), { recursive: true });
    writeFileSync(textPath, 'Practice moved to Tuesday\n');

    const laterRequest = await callSearchResourceText(baseUrl, token, resourceId);
    const laterBody = await readSseJsonRpcResponse(laterRequest);
    expect(laterBody.result.content[0].text).toContain('Practice moved to Tuesday');
  });

  test('unknown path returns 404', async () => {
    const response = await fetch(`${baseUrl}/nonexistent`);

    expect(response.status).toBe(404);
  });

  test('POST /mcp with Bearer mock-data lists prompts', async () => {
    const response = await fetch(`${baseUrl}/mcp`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        authorization: 'Bearer mock-data'
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'prompts/list', params: {} })
    });

    expect(response.status).toBe(200);
    const body = await readSseJsonRpcResponse(response);
    expect(body.result.prompts.some((p: any) => p.name === 'upcoming_events_for_group')).toBe(true);
  });

  test('POST /mcp with Bearer mock-data can get a prompt with substituted arguments', async () => {
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
        method: 'prompts/get',
        params: { name: 'upcoming_events_for_group', arguments: { groupName: 'U12 Boys' } }
      })
    });

    expect(response.status).toBe(200);
    const body = await readSseJsonRpcResponse(response);
    expect(body.result.messages[0].content.text).toContain('U12 Boys');
  });
});
