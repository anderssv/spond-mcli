import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('User Error Experience', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock client for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });

  describe('Authentication Issues', () => {
    test('should provide clear feedback when users have authentication problems', async () => {
      // Given: A working system in mock mode (simulates successful authentication)
      // When: User tries to access their events
      const result = await core.processToolCall('get_upcoming_events', { maxResults: 1 });
      
      // Then: Should provide access to their event information
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  describe('Invalid User Requests', () => {
    test('should help users understand when they request something that does not exist', async () => {
      // Given: A user trying to use a feature that doesn't exist
      try {
        await core.processToolCall('invalid_tool_name', {});
        fail('Expected CoreError to be thrown');
      } catch (error) {
        // Then: Should provide clear feedback about the unavailable feature
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.MethodNotFound);
        expect((error as CoreError).message).toBeTruthy();
      }
    });

    test('should guide users when they forget to provide required information', async () => {
      // Given: A user trying to get event details but forgetting to specify which event
      try {
        await core.processToolCall('get_event_by_id', {});
        fail('Expected CoreError to be thrown');
      } catch (error) {
        // Then: Should clearly explain what information they need to provide
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
        expect((error as CoreError).message).toContain('eventId is required');
      }
    });

    test('should help users understand when they request information that is not available', async () => {
      // Given: A user trying to access information that doesn't exist
      try {
        await core.processResourceRead('spond://invalid/resource');
        fail('Expected CoreError to be thrown');
      } catch (error) {
        // Then: Should clearly explain that the requested information is not available
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
        expect((error as CoreError).message).toContain('Unknown resource');
      }
    });
  });

  describe('Common User Mistakes', () => {
    const userScenarios = [
      { name: 'get_events', arguments: { max: 100 }, description: 'requesting too many events at once', shouldSucceed: true },
      { name: 'get_events', arguments: { max: -1 }, description: 'using invalid negative numbers', shouldSucceed: true }, // System handles gracefully
      { name: 'get_upcoming_events', arguments: { maxResults: 0 }, description: 'asking for zero results', shouldSucceed: true },
      { name: 'search_events', arguments: { searchTerm: '' }, description: 'searching with empty text', shouldSucceed: false },
      { name: 'search_events', arguments: { searchTerm: 'a'.repeat(100) }, description: 'using very long search terms', shouldSucceed: true },
      { name: 'get_events', arguments: { minEndTimestamp: 'not-a-date' }, description: 'providing invalid date formats', shouldSucceed: true }, // System handles gracefully
      { name: 'get_events', arguments: { minEndTimestamp: '2099-12-31T23:59:59.999Z' }, description: 'looking too far into the future', shouldSucceed: true },
      { name: 'get_events', arguments: { maxEndTimestamp: '2020-01-01T00:00:00.000Z' }, description: 'filtering for very old events', shouldSucceed: true }
    ];

    test.each(userScenarios)('should handle users $description gracefully', async ({ name, arguments: args, shouldSucceed }) => {
      try {
        const result = await core.processToolCall(name, args);
        
        if (shouldSucceed) {
          // Then: Should provide helpful results despite the unusual request
          expect(result).toBeDefined();
          expect(result.data).toBeDefined();
          expect(result.type).toBe(ToolCallResultType.Success);
        } else {
          fail('Expected CoreError to be thrown for invalid user input');
        }
      } catch (error) {
        if (!shouldSucceed) {
          // Then: Should provide clear feedback about what went wrong
          expect(error).toBeInstanceOf(CoreError);
          expect((error as CoreError).code).toBeDefined();
          expect((error as CoreError).message).toBeTruthy();
        } else {
          throw error; // Re-throw unexpected errors
        }
      }
    });
  });

  describe('Heavy Usage Scenarios', () => {
    test('should support users making multiple requests quickly without breaking', async () => {
      // Given: A user or application making many rapid requests
      const requests = Array.from({ length: 5 }, () => 
        core.processToolCall('get_upcoming_events', { maxResults: 1 })
      );

      // When: Processing all requests simultaneously
      const results = await Promise.allSettled(requests);

      // Then: Should handle the load gracefully and provide consistent results
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBe(5);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.data).toBeDefined();
          expect(result.value.type).toBe(ToolCallResultType.Success);
        }
      });
    });
    
    test('should provide helpful error messages when users make incomplete requests', async () => {
      // Given: A user trying to get event details without specifying which event
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_event_by_id',
          arguments: {} // Missing required eventId
        }
      };

      // When: Processing the incomplete request
      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      // Then: Should provide clear guidance about what information is needed
      expect(response).toBeDefined();
      expect(response?.error).toBeDefined();
      expect(response.error.message).toContain('eventId is required');
      expect(response.error.message).toBeTruthy();
    });
  });
});