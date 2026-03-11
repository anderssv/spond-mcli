import { getTokenAndMockMode, getTokenWithFileFallback } from '../../src/token-config.js';
import { writeFileSync, unlinkSync, mkdtempSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('Token Validation', () => {
  let originalToken: string | undefined;

  beforeEach(() => {
    // Save original token
    originalToken = process.env.SPOND_TOKEN;
  });

  afterEach(() => {
    // Restore original token
    if (originalToken !== undefined) {
      process.env.SPOND_TOKEN = originalToken;
    } else {
      delete process.env.SPOND_TOKEN;
    }
  });

  describe('when SPOND_TOKEN is not set', () => {
    it('should fail with clear error message', () => {
      // Arrange
      delete process.env.SPOND_TOKEN;

      // Act & Assert
      expect(() => getTokenAndMockMode()).toThrow('SPOND_TOKEN environment variable is required');
    });
  });

  describe('when SPOND_TOKEN is empty string', () => {
    it('should fail with clear error message', () => {
      // Arrange
      process.env.SPOND_TOKEN = '';

      // Act & Assert
      expect(() => getTokenAndMockMode()).toThrow('SPOND_TOKEN environment variable is required');
    });
  });

  describe('when SPOND_TOKEN is "mock-data"', () => {
    it('should use mock data mode', () => {
      // Arrange
      process.env.SPOND_TOKEN = 'mock-data';

      // Act
      const result = getTokenAndMockMode();

      // Assert
      expect(result.token).toBe('mock-data');
      expect(result.useMockData).toBe(true);
    });
  });

  describe('when SPOND_TOKEN is a real token', () => {
    it('should attempt real API authentication', () => {
      // Arrange
      const realToken = 'abcdefghijklmnopqrstuvwxyz123456789'; // Valid length token
      process.env.SPOND_TOKEN = realToken;

      // Act
      const result = getTokenAndMockMode();

      // Assert
      expect(result.token).toBe(realToken);
      expect(result.useMockData).toBe(false);
    });
  });
});

describe('getTokenWithFileFallback', () => {
  let originalToken: string | undefined;
  let tempDir: string;

  beforeEach(() => {
    originalToken = process.env.SPOND_TOKEN;
    tempDir = mkdtempSync(join(tmpdir(), 'spond-test-'));
  });

  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.SPOND_TOKEN = originalToken;
    } else {
      delete process.env.SPOND_TOKEN;
    }
  });

  it('uses SPOND_TOKEN env var when set', () => {
    const token = 'abcdefghijklmnopqrstuvwxyz123456789';
    process.env.SPOND_TOKEN = token;

    const result = getTokenWithFileFallback(join(tempDir, 'nonexistent.txt'));

    expect(result.token).toBe(token);
    expect(result.useMockData).toBe(false);
  });

  it('falls back to token file when env var is not set', () => {
    delete process.env.SPOND_TOKEN;
    const tokenFile = join(tempDir, 'spond-token.txt');
    writeFileSync(tokenFile, 'file-token-abcdefghijklmnopqrst');

    const result = getTokenWithFileFallback(tokenFile);

    expect(result.token).toBe('file-token-abcdefghijklmnopqrst');
    expect(result.useMockData).toBe(false);
  });

  it('trims whitespace from token file content', () => {
    delete process.env.SPOND_TOKEN;
    const tokenFile = join(tempDir, 'spond-token.txt');
    writeFileSync(tokenFile, '  file-token-abcdefghijklmnopqrst  \n');

    const result = getTokenWithFileFallback(tokenFile);

    expect(result.token).toBe('file-token-abcdefghijklmnopqrst');
  });

  it('throws when neither env var nor token file exists', () => {
    delete process.env.SPOND_TOKEN;

    expect(() => getTokenWithFileFallback(join(tempDir, 'nonexistent.txt'))).toThrow();
  });

  it('supports mock-data in token file', () => {
    delete process.env.SPOND_TOKEN;
    const tokenFile = join(tempDir, 'spond-token.txt');
    writeFileSync(tokenFile, 'mock-data\n');

    const result = getTokenWithFileFallback(tokenFile);

    expect(result.token).toBe('mock-data');
    expect(result.useMockData).toBe(true);
  });

  it('prefers env var over token file', () => {
    const envToken = 'env-token-abcdefghijklmnopqrstuvw';
    process.env.SPOND_TOKEN = envToken;
    const tokenFile = join(tempDir, 'spond-token.txt');
    writeFileSync(tokenFile, 'file-token-abcdefghijklmnopqrst');

    const result = getTokenWithFileFallback(tokenFile);

    expect(result.token).toBe(envToken);
  });
});