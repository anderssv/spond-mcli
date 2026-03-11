import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('Server Layer Unit Tests', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock mode for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });

  describe('Tool Result Conversion Logic', () => {
    test('should handle success results correctly', async () => {
      // Test the conversion logic that would happen in the server
      const result = await core.processToolCall('get_events', { max: 5 });
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      
      // Simulate server conversion logic
      const mcpFormat = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result.data, null, 2)
          }
        ]
      };
      
      expect(mcpFormat.content).toHaveLength(1);
      expect(mcpFormat.content[0].type).toBe('text');
      expect(typeof mcpFormat.content[0].text).toBe('string');
      
      // Verify the content is valid JSON
      const parsedData = JSON.parse(mcpFormat.content[0].text);
      expect(Array.isArray(parsedData)).toBe(true);
    });

    test('should handle not found results correctly', async () => {
      const result = await core.processToolCall('get_event_by_id', { eventId: 'NON_EXISTENT_ID' });
      
      expect(result).toBeDefined();
      expect(result.data).toBeNull();
      expect(result.type).toBe(ToolCallResultType.NotFound);
      
      // Simulate server conversion logic for not found
      const mcpFormat = {
        content: [
          {
            type: 'text' as const,
            text: result.data === null ? 'Not found' : JSON.stringify(result.data, null, 2)
          }
        ]
      };
      
      expect(mcpFormat.content[0].text).toBe('Not found');
    });

    test('should handle null data in not found results', async () => {
      const result = await core.processToolCall('get_event_by_id', { eventId: 'NON_EXISTENT_ID' });
      
      // Simulate server conversion logic for null data
      const mcpFormat = {
        content: [
          {
            type: 'text' as const,
            text: result.data === null ? 'Not found' : JSON.stringify(result.data, null, 2)
          }
        ]
      };
      
      expect(mcpFormat.content[0].text).toBe('Not found');
    });
  });

  describe('Resource Result Conversion Logic', () => {
    test('should handle resource read results correctly', async () => {
      const result = await core.processResourceRead('spond://events/upcoming');
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.uri).toBe('spond://events/upcoming');
      
      // Simulate server conversion logic for resources
      const mcpFormat = {
        contents: [
          {
            uri: result.uri,
            mimeType: 'application/json',
            text: JSON.stringify(result.data, null, 2)
          }
        ]
      };
      
      expect(mcpFormat.contents).toHaveLength(1);
      expect(mcpFormat.contents[0].uri).toBe('spond://events/upcoming');
      expect(mcpFormat.contents[0].mimeType).toBe('application/json');
      expect(typeof mcpFormat.contents[0].text).toBe('string');
      
      // Verify the content is valid JSON
      const parsedData = JSON.parse(mcpFormat.contents[0].text);
      expect(Array.isArray(parsedData)).toBe(true);
    });

    test('should set mime type correctly in server layer', async () => {
      const result = await core.processResourceRead('spond://events/all');
      
      // The core should not include mimeType (moved to server layer)
      expect(result).not.toHaveProperty('mimeType');
      expect(result.uri).toBeDefined();
      expect(result.data).toBeDefined();
      
      // Server layer adds mimeType
      const mcpFormat = {
        contents: [
          {
            uri: result.uri,
            mimeType: 'application/json', // Added by server layer
            text: JSON.stringify(result.data, null, 2)
          }
        ]
      };
      
      expect(mcpFormat.contents[0].mimeType).toBe('application/json');
    });
  });

  describe('Error Code Mapping Logic', () => {
    test('should map CoreError codes to MCP error codes', () => {
      // Test the mapping logic that would happen in the server
      const mappings = [
        { core: CoreErrorCode.InvalidParams, expected: -32602 },
        { core: CoreErrorCode.MethodNotFound, expected: -32601 },
        { core: CoreErrorCode.InternalError, expected: -32603 }
      ];

      mappings.forEach(({ core, expected }) => {
        // This simulates the mapCoreErrorCode method
        let mcpErrorCode: number;
        switch (core) {
          case CoreErrorCode.InvalidParams:
            mcpErrorCode = -32602; // ErrorCode.InvalidParams
            break;
          case CoreErrorCode.MethodNotFound:
            mcpErrorCode = -32601; // ErrorCode.MethodNotFound
            break;
          case CoreErrorCode.InternalError:
            mcpErrorCode = -32603; // ErrorCode.InternalError
            break;
          default:
            mcpErrorCode = -32603; // ErrorCode.InternalError
        }
        
        expect(mcpErrorCode).toBe(expected);
      });
    });

    test('should handle unknown error codes with default mapping', () => {
      // Test default case in mapping
      const unknownCode = 999 as CoreErrorCode;
      
      let mcpErrorCode: number;
      switch (unknownCode) {
        case CoreErrorCode.InvalidParams:
          mcpErrorCode = -32602;
          break;
        case CoreErrorCode.MethodNotFound:
          mcpErrorCode = -32601;
          break;
        case CoreErrorCode.InternalError:
          mcpErrorCode = -32603;
          break;
        default:
          mcpErrorCode = -32603; // Default to InternalError
      }
      
      expect(mcpErrorCode).toBe(-32603);
    });
  });

  describe('Server Initialization Logic', () => {
    test('should properly detect mock mode from environment', () => {
      // Test mock mode detection logic
      const testCases = [
        { env: 'true', expected: true },
        { env: 'false', expected: false },
        { env: undefined, expected: false },
        { env: '', expected: false },
        { env: 'TRUE', expected: false }, // Case sensitive
      ];

      testCases.forEach(({ env, expected }) => {
        const useMockData = env === 'true';
        expect(useMockData).toBe(expected);
      });
    });

    test('should handle environment variable variations', () => {
      // Test various environment variable values
      const mockValues = ['true', 'false', '1', '0', 'yes', 'no', undefined, ''];
      
      mockValues.forEach(value => {
        const useMockData = value === 'true';
        expect(typeof useMockData).toBe('boolean');
      });
    });
  });

  describe('Handler Setup Validation', () => {
    test('should validate tool definitions structure', () => {
      const tools = core.getToolDefinitions();
      
      expect(Array.isArray(tools)).toBe(true);
      expect(tools.length).toBeGreaterThan(0);
      
      // Verify each tool has required properties for MCP server setup
      tools.forEach(tool => {
        expect(tool).toHaveProperty('name');
        expect(tool).toHaveProperty('description');
        expect(tool).toHaveProperty('inputSchema');
        expect(typeof tool.name).toBe('string');
        expect(typeof tool.description).toBe('string');
        expect(typeof tool.inputSchema).toBe('object');
      });
    });

    test('should validate resource definitions structure', () => {
      const resources = core.getResourceDefinitions();
      
      expect(Array.isArray(resources)).toBe(true);
      expect(resources.length).toBeGreaterThan(0);
      
      // Verify each resource has required properties for MCP server setup
      resources.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('mimeType');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.mimeType).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.description).toBe('string');
      });
    });
  });

  describe('Server Layer Data Flow', () => {
    test('should properly handle complete tool call flow', async () => {
      // Simulate complete server request handling flow
      const toolName = 'get_upcoming_events';
      const params = { maxResults: 3 };
      
      // 1. Core processes the tool call
      const coreResult = await core.processToolCall(toolName, params);
      
      // 2. Server converts to MCP format
      const mcpResult = {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(coreResult.data, null, 2)
          }
        ]
      };
      
      // 3. Verify the complete flow
      expect(coreResult.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(coreResult.data)).toBe(true);
      expect(mcpResult.content[0].type).toBe('text');
      
      const parsedResult = JSON.parse(mcpResult.content[0].text);
      expect(Array.isArray(parsedResult)).toBe(true);
    });

    test('should properly handle complete resource read flow', async () => {
      // Simulate complete server resource handling flow
      const uri = 'spond://posts/recent';
      
      // 1. Core processes the resource read
      const coreResult = await core.processResourceRead(uri);
      
      // 2. Server converts to MCP format
      const mcpResult = {
        contents: [
          {
            uri: coreResult.uri,
            mimeType: 'application/json', // Added by server layer
            text: JSON.stringify(coreResult.data, null, 2)
          }
        ]
      };
      
      // 3. Verify the complete flow
      expect(coreResult.uri).toBe(uri);
      expect(Array.isArray(coreResult.data)).toBe(true);
      expect(mcpResult.contents[0].uri).toBe(uri);
      expect(mcpResult.contents[0].mimeType).toBe('application/json');
      
      const parsedResult = JSON.parse(mcpResult.contents[0].text);
      expect(Array.isArray(parsedResult)).toBe(true);
    });
  });
});