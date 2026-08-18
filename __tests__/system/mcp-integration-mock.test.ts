import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { 
  createTestMcpCore, 
  TestAssertions, 
  TestDataGenerators,
  CommonTestScenarios,
  TEST_CONSTANTS 
} from '../helpers/test-utilities.js';
import type { SpondCore } from '../../src/spond-core.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('MCP Integration Tests (Mock Mode)', () => {
  let core: SpondCore;

  beforeEach(async () => {
    core = await createTestMcpCore();
  });

  describe('Tool Calls with Mock Data', () => {
    test('get_events should return mock data', async () => {
      const result = await CommonTestScenarios.validateEventArrayResult(
        core, 
        'get_events', 
        { max: 5 }
      );
      
      expect(result.data.length).toBeLessThanOrEqual(5);
      
      // Verify known mock event exists
      const knownEvent = result.data.find((e: any) => e.id === TEST_CONSTANTS.KNOWN_EVENT_IDS.GAMING_CENTER);
      expect(knownEvent).toBeDefined();
      expect(knownEvent.heading).toBe('Gaming Center Last Session Before Summer');
    });

    test('event summaries should include registration status and inviteTime fields', async () => {
      const result = await CommonTestScenarios.validateEventArrayResult(
        core, 
        'get_events', 
        { max: 10 }
      );
      
      // Check each event summary has the new fields
      result.data.forEach((eventSummary: any) => {
        expect(eventSummary).toHaveProperty('registrationStatus');
        expect(eventSummary).toHaveProperty('inviteTime');
        
        // Validate registrationStatus is one of the enum values
        expect(['pending', 'open', 'closed']).toContain(eventSummary.registrationStatus);
        
        // Validate inviteTime is either string or null
        expect(eventSummary.inviteTime === null || typeof eventSummary.inviteTime === 'string').toBe(true);
      });
      
      // Find a specific event and verify its calculated registration status
      const expiredEvent = result.data.find((e: any) => e.id === TEST_CONSTANTS.KNOWN_EVENT_IDS.GAMING_CENTER);
      if (expiredEvent) {
        expect(expiredEvent.registrationStatus).toBe('closed'); // This event should be expired
      }
    });

    test('get_event_by_id should return specific mock event', async () => {
      const eventId = TEST_CONSTANTS.KNOWN_EVENT_IDS.GAMING_CENTER;
      const result = await CommonTestScenarios.validateBasicToolCall(
        core, 
        'get_event_by_id', 
        { eventId }
      );
      
      expect(result.data.id).toBe(eventId);
      expect(result.data.heading).toBe('Gaming Center Last Session Before Summer');
    });

    test('get_upcoming_events should return future mock events', async () => {
      const result = await CommonTestScenarios.validateEventArrayResult(
        core, 
        'get_upcoming_events', 
        { maxResults: 10 }
      );
      
      TestAssertions.validateUpcomingEvents(result.data);
    });

    test('search_events should find matching mock events', async () => {
      const searchTerm = TEST_CONSTANTS.SEARCH_TERMS.GAMING_CENTER;
      const result = await CommonTestScenarios.validateEventArrayResult(
        core, 
        'search_events', 
        TestDataGenerators.getSearchParams.byHeading(searchTerm)
      );
      
      TestAssertions.validateSearchResults(result.data, searchTerm);
    });

    test('get_events with groupName should filter by group name', async () => {
      const groupName = TEST_CONSTANTS.SEARCH_TERMS.COMMUNITY;
      const result = await CommonTestScenarios.validateEventArrayResult(
        core,
        'get_events',
        TestDataGenerators.getSearchParams.byGroup(groupName)
      );

      TestAssertions.validateGroupFilter(result.data, groupName);
    });
  });

  describe('Resource Reads with Mock Data', () => {
    test('should read upcoming events resource', async () => {
      const uri = 'spond://events/upcoming';
      const result = await CommonTestScenarios.validateBasicResourceRead(core, uri);
      
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should read all events resource', async () => {
      const uri = 'spond://events/all';
      const result = await CommonTestScenarios.validateBasicResourceRead(core, uri);
      
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });
  });

  describe('Mock Data Validation', () => {
    test('should return null for non-existent event ID', async () => {
      const { ToolCallResultType } = await import('../../src/spond-core.js');
      const result = await CommonTestScenarios.validateBasicToolCall(
        core, 
        'get_event_by_id', 
        { eventId: TestDataGenerators.getTestEventId.nonExistent() },
        ToolCallResultType.NotFound
      );
      
      expect(result.data).toBeNull();
    });
  });
});