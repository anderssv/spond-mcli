import { decodeTokenFromLocalStorage } from '../../src/login.js';

describe('decodeTokenFromLocalStorage', () => {
  // [TEST] Returns null when localStorage value is null
  it('returns null when localStorage value is null', () => {
    const result = decodeTokenFromLocalStorage(null);

    expect(result).toBeNull();
  });

  it('decodes base64-encoded JWT from localStorage value', () => {
    const jwt = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.signature';
    const base64Encoded = Buffer.from(jwt).toString('base64');

    const result = decodeTokenFromLocalStorage(base64Encoded);

    expect(result).toBe(jwt);
  });

  it('returns null when token is empty string', () => {
    const result = decodeTokenFromLocalStorage('');

    expect(result).toBeNull();
  });
});
