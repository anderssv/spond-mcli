import { describe, test, expect } from '@jest/globals';
import { extractBearerToken } from '../../src/http-auth.js';

describe('extractBearerToken', () => {
  test('extracts the token from a well-formed Authorization header', () => {
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
  });

  test('is case-insensitive on the Bearer prefix', () => {
    expect(extractBearerToken('bearer abc123')).toBe('abc123');
  });

  test('trims surrounding whitespace from the token', () => {
    expect(extractBearerToken('Bearer   abc123  ')).toBe('abc123');
  });

  test('returns null when the header is missing', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  test('returns null when the header has no Bearer prefix', () => {
    expect(extractBearerToken('abc123')).toBeNull();
  });

  test('returns null when the header is an array (malformed request)', () => {
    expect(extractBearerToken(['Bearer abc123', 'Bearer def456'])).toBeNull();
  });

  test('returns null when the token portion is empty', () => {
    expect(extractBearerToken('Bearer ')).toBeNull();
  });
});
