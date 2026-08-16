import { extractTokenFromLocalStorage, pollForToken } from '../../src/login.js';

describe('extractTokenFromLocalStorage', () => {
  it('returns null when localStorage value is null', () => {
    const result = extractTokenFromLocalStorage(null);

    expect(result).toBeNull();
  });

  it('returns the raw localStorage value unchanged', () => {
    const raw = 'eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0In0.signature';

    const result = extractTokenFromLocalStorage(raw);

    expect(result).toBe(raw);
  });

  it('returns null when token is empty string', () => {
    const result = extractTokenFromLocalStorage('');

    expect(result).toBeNull();
  });
});

describe('pollForToken', () => {
  it('retries after a transient page.evaluate failure (e.g. mid-poll navigation) and returns the token once available', async () => {
    let callCount = 0;
    const page = {
      evaluate: async () => {
        callCount++;
        if (callCount === 1) throw new Error('Execution context was destroyed, most likely because of a navigation');
        return 'the-token';
      }
    };

    const result = await pollForToken(page, 1, 1000);

    expect(result).toBe('the-token');
  });

  it('throws a timeout error when no token appears before the deadline', async () => {
    const page = { evaluate: async () => null };

    await expect(pollForToken(page, 1, 5)).rejects.toThrow('Login timed out');
  });
});
