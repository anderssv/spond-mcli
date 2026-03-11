import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('MCP Tool Capabilities for Users', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock mode for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });

  describe('Event Discovery Tools', () => {
    test('should help users discover available Spond tools for managing their activities', () => {
      // Given: A user wanting to understand what capabilities are available
      const tools = core.getToolDefinitions();
      
      // Then: Should provide access to event management tools
      const getEventsTool = tools.find(t => t.name === 'get_events');
      expect(getEventsTool).toBeDefined();
      expect(getEventsTool!.description).toBeTruthy();
      expect(getEventsTool!.name).toBe('get_events');
      
      // Should have reasonable defaults for user convenience
      expect(tools.length).toBeGreaterThan(0);
    });
    
    test('should provide tools that actually help users retrieve their events', async () => {
      // Given: A user wanting to see their events
      // When: Using the get_events tool
      const result = await core.processToolCall('get_events', {});
      
      // Then: Should successfully retrieve event information
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
    
    test('should provide tools that help users search for specific activities', async () => {
      // Given: A user looking for gaming activities
      // When: Using the search functionality
      const result = await core.processToolCall('search_events', {
        searchTerm: 'Gaming',
        maxResults: 10
      });
      
      // Then: Should find relevant activities
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
    
    test('should provide tools that help users focus on upcoming activities', async () => {
      // Given: A user planning their future activities
      // When: Using the upcoming events tool
      const result = await core.processToolCall('get_upcoming_events', {
        maxResults: 5
      });
      
      // Then: Should provide future activities for planning
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
    
    test('should provide tools that help users get detailed information about specific events', async () => {
      // Given: A user interested in a specific gaming event
      const eventId = 'FE5E94BA079947CB98302FFF6C931963';
      
      // When: Using the event details tool
      const result = await core.processToolCall('get_event_by_id', { eventId });
      
      // Then: Should provide comprehensive event information
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.id).toBe(eventId);
      expect(result.data.heading).toBeTruthy();
  });

  describe('Event Response Tools', () => {
    test('should allow accepting an event for a member', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      const core = new SpondCore(fake);

      const result = await core.processToolCall('accept_event', {
        eventId: 'evt-1',
        memberId: 'member-1'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
    });

    test('should allow declining an event for a member', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      const core = new SpondCore(fake);

      const result = await core.processToolCall('decline_event', {
        eventId: 'evt-1',
        memberId: 'member-1'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
    });

    test('should require eventId for accept_event', async () => {
      await expect(
        core.processToolCall('accept_event', { memberId: 'member-1' })
      ).rejects.toThrow('eventId is required');
    });

    test('should require memberId for accept_event', async () => {
      await expect(
        core.processToolCall('accept_event', { eventId: 'evt-1' })
      ).rejects.toThrow('memberId is required');
    });

    test('should hint about registration status when accept fails', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      fake.setFailNextCall(true, 'HTTP 403: Forbidden');
      const core = new SpondCore(fake);

      await expect(
        core.processToolCall('accept_event', { eventId: 'evt-1', memberId: 'member-1' })
      ).rejects.toThrow(/registration.*status|not.*open/i);
    });

    test('should hint about registration status when decline fails', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      fake.setFailNextCall(true, 'HTTP 403: Forbidden');
      const core = new SpondCore(fake);

      await expect(
        core.processToolCall('decline_event', { eventId: 'evt-1', memberId: 'member-1' })
      ).rejects.toThrow(/registration.*status|not.*open/i);
    });
  });

});

function createMinimalEvent(id: string, heading: string) {
  return {
    id,
    creatorId: 'creator-1',
    owners: [{ id: 'owner-1', response: 'accepted', firstName: 'Host', lastName: 'User', appUser: true, unableToReach: false }],
    heading,
    description: 'A test event',
    startTimestamp: new Date(Date.now() + 86400000).toISOString(),
    endTimestamp: new Date(Date.now() + 90000000).toISOString(),
    recipients: {
      group: {
        id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
        members: [{ id: 'member-1', firstName: 'Test', lastName: 'Player', respondent: true }]
      }
    }
  };
}
});