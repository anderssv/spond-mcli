import type fetch from 'node-fetch';
import { ISpondClient } from './spond-client-interface.js';
import { SpondClient } from './spond-client.js';
import { SpondClientFake } from './spond-client-fake.js';
import { MOCK_TOKEN_VALUE } from './token-config.js';

export function buildSpondClient(token: string, fetchFn?: typeof fetch): ISpondClient {
  return token === MOCK_TOKEN_VALUE
    ? SpondClientFake.withMockData()
    : new SpondClient(token, fetchFn);
}
