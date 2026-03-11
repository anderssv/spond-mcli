import { describe, test, expect, beforeAll, jest } from '@jest/globals';

// Token validation will be done in beforeAll to avoid module-level initialization issues

// Provide a minimal mock for ES module compatibility, but don't use it for real tokens
// Real API tests will use Node.js built-in fetch to bypass this mock
jest.mock('node-fetch', () => ({
  default: jest.fn(),
  __esModule: true
}));

import { SpondCore, ToolCallResultType } from '../../src/spond-core.js';
import { getTokenForRealApiTests, findValidTokenForIntegration } from '../../src/token-config.js';
import { TestAssertions, CommonTestScenarios, TEST_CONSTANTS } from '../helpers/test-utilities.js';

// NOTE: This test file conditionally mocks node-fetch based on token availability
// Real tokens enable actual HTTP requests to the Spond API for integration testing

/**
 * Real API Integration Tests for SpondCore
 * Tests the core business logic against the actual Spond API when token is available
 * 
 * This addresses real API coverage gaps and validates authentication, error handling,
 * and data transformation with actual API responses.
 * 
 * Priority: HIGH - Essential for production reliability
 */
describe('SpondCore Real API Integration Tests', () => {
  let core: SpondCore;

  beforeAll(async () => {
    // Check if we have a real token available using the integration validation
    const tokenResult = findValidTokenForIntegration();
    const hasRealToken = tokenResult.isValid && 
                         tokenResult.token !== 'mock' && 
                         tokenResult.token && tokenResult.token.length > 20;

    // Fail fast if no valid token is available for real API integration tests
    if (!hasRealToken) {
      const errorMsg = tokenResult.error || 'No valid token found';
      throw new Error(
        `Real API integration tests require a valid SPOND_TOKEN. ${errorMsg}. ` +
        'Please set SPOND_TOKEN in your environment or .env file with a valid Spond API token. ' +
        'Token source checked: ' + tokenResult.source
      );
    }

    // Use Node.js built-in fetch (available in Node 18+) to bypass Jest mocks
    const realFetch = (globalThis as any).fetch || global.fetch;
    if (!realFetch) {
      throw new Error('Built-in fetch not available. Node.js 18+ required.');
    }
    
    try {
      const tokenConfig = getTokenForRealApiTests();
      const { SpondClient } = await import('../../src/spond-client.js');
      const realClient = new SpondClient(tokenConfig.token, realFetch);
      core = new SpondCore(realClient);
      console.log(`Real API integration tests enabled with valid token from ${tokenResult.source}`);
    } catch (error) {
      throw new Error(`Failed to initialize real API tests: ${error}`);
    }
  });

  describe('Authentication and Token Validation', () => {
    test('should successfully authenticate with real token', async () => {
      // Test a simple API call to verify authentication works
      const result = await core.processToolCall('get_events', { max: 1 });
      
      await TestAssertions.validateSuccessfulToolResult(result);
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should handle rate limiting gracefully', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array(3).fill(null).map(() => 
        core.processToolCall('get_events', { max: 1 })
      );

      const results = await Promise.allSettled(requests);
      
      // At least one should succeed, others may be rate limited
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThan(0);
    });

  });

  describe('Real API Data Validation', () => {
    test('should return valid event data structure from real API', async () => {
      const result = await CommonTestScenarios.validateEventArrayResult(
        core,
        'get_events',
        { max: 5 }
      );

      // Validate real API response structure
      result.data.forEach((event: any) => {
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('heading');
        expect(event).toHaveProperty('startTime');
        expect(event).toHaveProperty('endTime');
        expect(event).toHaveProperty('groupName');
        
        // Validate data types
        expect(typeof event.id).toBe('string');
        expect(typeof event.heading).toBe('string');
        expect(event.id.length).toBeGreaterThan(10);
      });
    });

    test('should return valid upcoming events from real API', async () => {
      const result = await CommonTestScenarios.validateEventArrayResult(
        core,
        'get_upcoming_events',
        { maxResults: 3 }
      );

      // Verify all events are actually upcoming
      TestAssertions.validateUpcomingEvents(result.data);
    });

    test('should handle event by ID lookup with real API', async () => {
      // First get an event to find a real ID
      const eventsResult = await core.processToolCall('get_events', { max: 5 });
      await TestAssertions.validateSuccessfulToolResult(eventsResult);
      
      if (eventsResult.data.length > 0) {
        const eventId = eventsResult.data[0].id;
        
        // Now look up that specific event - it may return success or not_found depending on API
        const result = await core.processToolCall('get_event_by_id', { eventId });
        
        // Either success with matching ID, or not_found is acceptable
        if (result.type === 'success') {
          expect(result.data.id).toBe(eventId);
        } else if (result.type === 'not_found') {
          expect(result.data).toBeNull();
        } else {
          throw new Error(`Unexpected result type: ${result.type}`);
        }
      } else {
        // If no events available, test with a known non-existent ID
        const result = await core.processToolCall('get_event_by_id', { 
          eventId: 'DEFINITELY_NONEXISTENT_ID_12345' 
        });
        expect(result.type).toBe('not_found');
        expect(result.data).toBeNull();
      }
    });

    test('should search events with real API', async () => {
      // Use a generic search term that's likely to have results
      const result = await core.processToolCall('search_events', {
        searchTerm: 'a', // Very broad search to likely get results
        maxResults: 5
      });

      await TestAssertions.validateSuccessfulToolResult(result);
      expect(Array.isArray(result.data)).toBe(true);
      // Note: May return empty array if no events match, which is valid
    });
  });

  describe('Resource Reading with Real API', () => {
    test('should read upcoming events resource from real API', async () => {
      const result = await CommonTestScenarios.validateBasicResourceRead(
        core,
        'spond://events/upcoming'
      );

      expect(Array.isArray(result.data)).toBe(true);
      TestAssertions.validateUpcomingEvents(result.data);
    });

    test('should read all events resource from real API', async () => {
      const result = await CommonTestScenarios.validateBasicResourceRead(
        core,
        'spond://events/all'
      );

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThanOrEqual(0);
    });

    test('should read posts resource from real API', async () => {
      const result = await CommonTestScenarios.validateBasicResourceRead(
        core,
        'spond://posts/recent'
      );

      expect(Array.isArray(result.data)).toBe(true);
      // Posts may be empty, which is valid
    });

    test('should read groups resource from real API', async () => {
      const result = await CommonTestScenarios.validateBasicResourceRead(
        core,
        'spond://groups/all'
      );

      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0); // User should have at least one group
    });
  });

  describe('Error Handling with Real API', () => {
    test('should handle non-existent event ID gracefully', async () => {
      const { ToolCallResultType } = await import('../../src/spond-core.js');
      
      const result = await CommonTestScenarios.validateBasicToolCall(
        core,
        'get_event_by_id',
        { eventId: 'DEFINITELY_NONEXISTENT_ID_12345' },
        ToolCallResultType.NotFound
      );

      expect(result.data).toBeNull();
    });

    test('should handle empty search results gracefully', async () => {
      const result = await core.processToolCall('search_events', {
        searchTerm: 'ZzXxYyVvUuTtSsRrQqPpOoNnMmLlKkJjIiHhGgFf', // Very unlikely search term
        maxResults: 10
      });

      await TestAssertions.validateSuccessfulToolResult(result);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBe(0);
    });

  });


  describe('Performance and Reliability', () => {
    test('should handle multiple concurrent requests', async () => {
      const requests = [
        core.processToolCall('get_events', { max: 2 }),
        core.processToolCall('get_upcoming_events', { maxResults: 2 }),
        core.processResourceRead('spond://events/all')
      ];

      const results = await Promise.allSettled(requests);
      
      // At least 2 should succeed (allowing for potential rate limiting)
      const successCount = results.filter(r => r.status === 'fulfilled').length;
      expect(successCount).toBeGreaterThanOrEqual(2);
    });

    test('should complete requests within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await core.processToolCall('get_events', { max: 3 });
      
      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(10000); // 10 seconds max
      
      await TestAssertions.validateSuccessfulToolResult(result);
    });
  });
});