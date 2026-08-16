import { describe, test, expect, afterEach, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { extractAccessToken } from '../../src/domain-logic.js';
import { performPasswordLogin } from '../../src/login.js';

describe('extractAccessToken', () => {
  test('returns the token from a successful login response', () => {
    const response = { accessToken: { token: 'the-real-token', expiration: '2026-01-01T00:00:00Z' } };

    const result = extractAccessToken(response);

    expect(result).toBe('the-real-token');
  });

  test('throws with the safe error fields when accessToken is missing', () => {
    const response = { error: 'invalid_credentials', errorKey: 'wrongPassword', message: 'Wrong email or password' };

    expect(() => extractAccessToken(response)).toThrow(/wrongPassword/);
  });

  test('does not leak unsafe fields like phoneNumber or 2FA challenge tokens in the error', () => {
    const response = { error: 'two_factor_required', phoneNumber: '+4712345678', challengeToken: 'super-secret-otp-token' };

    let thrown: Error | undefined;
    try {
      extractAccessToken(response);
    } catch (e) {
      thrown = e as Error;
    }

    expect(thrown).toBeDefined();
    expect(thrown!.message).not.toContain('+4712345678');
    expect(thrown!.message).not.toContain('super-secret-otp-token');
  });

  test('throws a generic message when the response has no recognised diagnostic fields', () => {
    const response = {};

    expect(() => extractAccessToken(response)).toThrow('Login failed');
  });

  test('throws when accessToken.token is missing', () => {
    const response = { accessToken: { expiration: '2026-01-01T00:00:00Z' } };

    expect(() => extractAccessToken(response)).toThrow('Login failed');
  });

  test('throws when accessToken.token is empty', () => {
    const response = { accessToken: { token: '' } };

    expect(() => extractAccessToken(response)).toThrow('Login failed');
  });
});

describe('performPasswordLogin', () => {
  const tempPaths: string[] = [];

  function newTempTokenPath(): string {
    const dir = mkdtempSync(join(tmpdir(), 'spond-password-login-'));
    tempPaths.push(dir);
    return join(dir, 'token');
  }

  afterEach(() => {
    tempPaths.forEach(p => rmSync(p, { recursive: true, force: true }));
    tempPaths.length = 0;
  });

  function stubFetch(responseBody: unknown, ok = true) {
    const captured: { url: string; options: any }[] = [];
    const fn = (async (url: string, options: any) => {
      captured.push({ url, options });
      return {
        ok,
        status: ok ? 200 : 401,
        json: async () => responseBody
      };
    }) as unknown as typeof import('node-fetch').default;
    return { captured, fn };
  }

  test('posts email and password to the login endpoint', async () => {
    const { captured, fn } = stubFetch({ accessToken: { token: 'a'.repeat(40) } });
    const path = newTempTokenPath();

    await performPasswordLogin('me@example.com', 'hunter2', path, fn);

    expect(captured[0].url).toBe('https://api.spond.com/core/v1/auth2/login');
    expect(JSON.parse(captured[0].options.body)).toEqual({ email: 'me@example.com', password: 'hunter2' });
  });

  test('saves the returned token to the token file with restrictive permissions', async () => {
    const token = 'a'.repeat(40);
    const { fn } = stubFetch({ accessToken: { token } });
    const path = newTempTokenPath();

    await performPasswordLogin('me@example.com', 'hunter2', path, fn);

    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf-8')).toBe(token);
    expect(statSync(path).mode & 0o777).toBe(0o600);
  });

  test('throws a descriptive error and does not write a file when login fails', async () => {
    const { fn } = stubFetch({ error: 'invalid_credentials', errorKey: 'wrongPassword' });
    const path = newTempTokenPath();

    await expect(performPasswordLogin('me@example.com', 'wrong', path, fn)).rejects.toThrow(/wrongPassword/);
    expect(existsSync(path)).toBe(false);
  });
});
