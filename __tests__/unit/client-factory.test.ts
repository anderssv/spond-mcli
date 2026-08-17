import { describe, test, expect, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { buildSpondClient } from '../../src/client-factory.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';
import { SpondClient } from '../../src/spond-client.js';
import { MOCK_TOKEN_VALUE } from '../../src/token-config.js';

describe('buildSpondClient', () => {
  test('returns a mock-data-backed fake client for the mock token', () => {
    const client = buildSpondClient(MOCK_TOKEN_VALUE);

    expect(client).toBeInstanceOf(SpondClientFake);
  });

  test('returns a real client for any other token', () => {
    const client = buildSpondClient('a-real-looking-token-value');

    expect(client).toBeInstanceOf(SpondClient);
  });
});
