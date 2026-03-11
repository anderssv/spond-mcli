import { describe, test, expect, beforeAll, afterEach, jest } from '@jest/globals';
import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondClient } from '../../src/spond-client.js';
import { getTokenAndMockMode, MOCK_TOKEN_VALUE } from '../../src/token-config.js';

describe('Startup and Configuration Tests', () => {
  let originalSpondToken: string | undefined;

  beforeAll(async () => {
    // Ensure the project is built
    expect(existsSync('dist/index.js')).toBe(true);
    // Store original environment variable
    originalSpondToken = process.env.SPOND_TOKEN;
  });

  afterEach(() => {
    // Restore original environment variable after each test
    if (originalSpondToken !== undefined) {
      process.env.SPOND_TOKEN = originalSpondToken;
    } else {
      delete process.env.SPOND_TOKEN;
    }
  });

  describe('Configuration Files', () => {
    test('should have all required files', () => {
      expect(existsSync('package.json')).toBe(true);
      expect(existsSync('tsconfig.json')).toBe(true);
      expect(existsSync('dist/index.js')).toBe(true);
      expect(existsSync('dist/spond-client.js')).toBe(true);
    });

    test('package.json should have required fields', () => {
      const packageJson = JSON.parse(readFileSync('package.json', 'utf-8'));
      
      expect(packageJson).toHaveProperty('name');
      expect(packageJson).toHaveProperty('version');
      expect(packageJson).toHaveProperty('main');
      expect(packageJson).toHaveProperty('dependencies');
      
      expect(packageJson.dependencies).toHaveProperty('@modelcontextprotocol/sdk');
      expect(packageJson.dependencies).toHaveProperty('node-fetch');
    });
  });

  describe('Token Configuration', () => {
    test('should fail with error when SPOND_TOKEN is not provided', () => {
      // Clear environment variable
      delete process.env.SPOND_TOKEN;
      delete process.env.SPOND_MOCK_MODE;
      
      // This should now throw an error instead of defaulting to mock mode
      expect(() => getTokenAndMockMode()).toThrow('SPOND_TOKEN environment variable is required');
    });

    test('should accept mock-data token for testing', () => {
      // Set mock token
      process.env.SPOND_TOKEN = 'mock-data';
      delete process.env.SPOND_MOCK_MODE;
      
      // This should work with mock data
      const config = getTokenAndMockMode();
      expect(config.useMockData).toBe(true);
      expect(config.token).toBe('mock-data');
      
      expect(() => {
        new SpondClient(config.token);
      }).not.toThrow();
    });

    test('should accept valid SPOND_TOKEN environment variable', () => {
      // Set valid token (at least 20 characters)
      process.env.SPOND_TOKEN = 'test-token-1234567890';
      delete process.env.SPOND_MOCK_MODE;
      
      // This should not throw
      expect(() => {
        const config = getTokenAndMockMode();
        new SpondClient(config.token);
      }).not.toThrow();
      
      const config = getTokenAndMockMode();
      expect(config.useMockData).toBe(false);
      expect(config.token).toBe('test-token-1234567890');
    });

    test('should fail for invalid SPOND_TOKEN (too short)', () => {
      // Set invalid token (too short)
      process.env.SPOND_TOKEN = 'short';
      delete process.env.SPOND_MOCK_MODE;
      
      // This should throw an error because token is invalid
      expect(() => getTokenAndMockMode()).toThrow();
    });
  });

  describe('Server Startup', () => {
    test('should start server successfully', async () => {
      // Set mock token for server startup
      process.env.SPOND_TOKEN = 'mock-data';
      
      // Use a simple initialize request to test server startup
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        },
        id: 1
      };

      const result = await MCPTestHelper.sendMCPRequest(initRequest, true);
      
      // Check that we got a valid initialize response
      const response = result.responses.find(r => r.id === initRequest.id);
      expect(response?.result).toBeDefined();
      expect(response.result.protocolVersion).toBe('2024-11-05');
      expect(response.result.serverInfo).toBeDefined();
      expect(response.result.serverInfo.name).toBe('spond-mcli');
      
      // Check that the startup message was logged to stderr
      expect(result.stderr).toContain('Spond MCLI server running on stdio');
    });

  });
});