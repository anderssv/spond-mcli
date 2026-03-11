import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { getTokenAndMockMode, shouldUseMockMode } from '../../src/token-config.js';

describe('Magic Token Mode Support', () => {
  let originalToken: string | undefined;
  
  beforeEach(() => {
    originalToken = process.env.SPOND_TOKEN;
  });
  
  afterEach(() => {
    if (originalToken !== undefined) {
      process.env.SPOND_TOKEN = originalToken;
    } else {
      delete process.env.SPOND_TOKEN;
    }
  });
  
  describe('Token Reading and Mode Detection', () => {
    test('should detect mock mode when SPOND_TOKEN equals "mock-data"', () => {
      process.env.SPOND_TOKEN = 'mock-data';
      
      const mockResult = shouldUseMockMode();
      expect(mockResult).toBe(true);
      
      const config = getTokenAndMockMode();
      expect(config.useMockData).toBe(true);
      expect(config.token).toBe('mock-data');
    });
    
    test('should detect real mode when SPOND_TOKEN is a valid token', () => {
      process.env.SPOND_TOKEN = 'real-token-1234567890';
      
      const mockResult = shouldUseMockMode();
      expect(mockResult).toBe(false);
      
      const config = getTokenAndMockMode();
      expect(config.useMockData).toBe(false);
      expect(config.token).toBe('real-token-1234567890');
    });
    
    test('should fail with error when SPOND_TOKEN is missing', () => {
      delete process.env.SPOND_TOKEN;
      
      expect(() => getTokenAndMockMode()).toThrow('SPOND_TOKEN environment variable is required');
      
      // shouldUseMockMode should also handle this gracefully
      const mockResult = shouldUseMockMode();
      expect(mockResult).toBe(true); // Falls back to true when token reading fails
    });
  });
});

// Functions are now imported from token-config.ts