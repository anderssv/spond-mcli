import { describe, test, expect, jest } from '@jest/globals';
import { readFileSync } from 'fs';
import { join } from 'path';

jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SERVER_VERSION } from '../../src/mcp-server.js';

describe('SERVER_VERSION', () => {
  test('matches package.json version', () => {
    const packageJson = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf-8'));

    expect(SERVER_VERSION).toBe(packageJson.version);
  });
});
