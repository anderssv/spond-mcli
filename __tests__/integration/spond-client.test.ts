import { describe, test, expect, beforeAll, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondClientFake } from '../../src/spond-client-fake.js';
import { TestClock } from '../../src/test-time.js';

describe('SpondClient Unit Tests (Mock Mode)', () => {
  let client: SpondClientFake;

  beforeAll(() => {
    // Initialize mock client
    client = SpondClientFake.withMockData();
  });

  describe('getEvents', () => {
    test('should provide events for user activity planning', async () => {
      // Given: A client with available events
      const events = await client.getEvents();
      
      // Then: Should receive events suitable for planning activities
      expect(events.length).toBeGreaterThan(0);
      expect(events.length).toBeLessThanOrEqual(20); // Reasonable default limit
      expect(events.every(e => e.heading && e.startTimestamp)).toBe(true);
    });

    test('should help users avoid information overload by limiting results', async () => {
      // Given: A request for a manageable number of events
      const events = await client.getEvents({ max: 3 });
      
      // Then: Should return a focused list for easier decision making
      expect(events.length).toBeLessThanOrEqual(3);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should help users plan for specific time periods', async () => {
      // Given: A user planning for specific period activities
      const testClock = TestClock.getInstance();
      const periodStart = testClock.getRelativeTimeISO({ days: 35 });
      const periodEnd = testClock.getRelativeTimeISO({ days: 45, hours: 23, minutes: 59 });
      
      // When: Requesting events for that time period
      const events = await client.getEvents({
        minEndTimestamp: periodStart,
        maxEndTimestamp: periodEnd
      });
      
      // Then: Should only receive events relevant to that timeframe
      expect(events.every(event => {
        const endDate = new Date(event.endTimestamp);
        return endDate >= new Date(periodStart) && endDate <= new Date(periodEnd);
      })).toBe(true);
    });

    test('should present events in user-preferred chronological order', async () => {
      // Given: Different user preferences for viewing events
      const eventsAsc = await client.getEvents({ order: 'asc' });
      const eventsDesc = await client.getEvents({ order: 'desc' });
      
      // Then: Should support both upcoming-first and latest-first planning styles
      if (eventsAsc.length > 1) {
        const isChronological = eventsAsc.every((event, i) => {
          if (i === 0) return true;
          return new Date(event.startTimestamp) >= new Date(eventsAsc[i-1].startTimestamp);
        });
        expect(isChronological).toBe(true);
      }
      
      if (eventsDesc.length > 1) {
        const isReverseChronological = eventsDesc.every((event, i) => {
          if (i === 0) return true;
          return new Date(event.startTimestamp) <= new Date(eventsDesc[i-1].startTimestamp);
        });
        expect(isReverseChronological).toBe(true);
      }
    });
  });

  describe('getEventById', () => {
    test('should help users get detailed information about specific events', async () => {
      // Given: A user interested in a specific gaming session
      const eventId = 'FE5E94BA079947CB98302FFF6C931963';
      
      // When: Looking up that specific event
      const event = await client.getEventById(eventId);
      
      // Then: Should provide complete event details for planning
      expect(event).not.toBeNull();
      expect(event?.id).toBe(eventId);
      expect(event?.heading).toContain('Gaming Center');
    });

    test('should gracefully handle requests for non-existent events', async () => {
      // Given: A user with an invalid or outdated event reference
      // When: Attempting to access that event
      const event = await client.getEventById('NON_EXISTENT_ID');
      
      // Then: Should clearly indicate the event is not available
      expect(event).toBeNull();
    });
  });

  describe('getUpcomingEvents', () => {
    test('should help users focus on events they can still participate in', async () => {
      // Given: A user wanting to plan future activities
      const events = await client.getUpcomingEvents(10);
      const now = new Date();
      
      // Then: Should only show events that haven't passed yet
      expect(events.every(event => {
        const endDate = new Date(event.endTimestamp);
        return endDate > now;
      })).toBe(true);
    });

    test('should provide focused results for quick decision making', async () => {
      // Given: A user who wants to see just the next few events
      const events = await client.getUpcomingEvents(2);
      
      // Then: Should provide exactly what they need without overwhelming them
      expect(events.length).toBeLessThanOrEqual(2);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should present upcoming events in natural chronological order for planning', async () => {
      // Given: A user planning their schedule
      const events = await client.getUpcomingEvents(5);
      
      // Then: Should show soonest events first to help with immediate planning
      if (events.length > 1) {
        const isChronological = events.every((event, i) => {
          if (i === 0) return true;
          return new Date(event.startTimestamp) >= new Date(events[i-1].startTimestamp);
        });
        expect(isChronological).toBe(true);
      }
    });

    test('should support different levels of detail based on user needs', async () => {
      // Given: Different user scenarios - quick overview vs detailed planning
      const basicEvents = await client.getUpcomingEvents(5, false);
      const detailedEvents = await client.getUpcomingEvents(5, true);
      
      // Then: Should provide events in both simple and detailed formats
      expect(Array.isArray(basicEvents)).toBe(true);
      expect(Array.isArray(detailedEvents)).toBe(true);
      expect(basicEvents.length).toBeGreaterThan(0);
      expect(detailedEvents.length).toBeGreaterThan(0);
    });
  });

  describe('searchEvents', () => {
    test('should help users find events by activity type', async () => {
      // Given: A user looking for gaming-related activities
      const events = await client.searchEvents('Gaming Center');
      
      // Then: Should find all gaming events to help with activity planning
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => {
        const searchTerm = 'gaming center';
        return event.heading?.toLowerCase().includes(searchTerm) ||
               event.description?.toLowerCase().includes(searchTerm) ||
               event.recipients?.group?.name?.toLowerCase().includes(searchTerm);
      })).toBe(true);
    });

    test('should help users discover events through detailed descriptions', async () => {
      // Given: A user interested in community marketplace activities
      const events = await client.searchEvents('flea market');
      
      // Then: Should find events even when terms appear in descriptions
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => {
        const searchTerm = 'flea market';
        return event.heading?.toLowerCase().includes(searchTerm) ||
               event.description?.toLowerCase().includes(searchTerm) ||
               event.recipients?.group?.name?.toLowerCase().includes(searchTerm);
      })).toBe(true);
    });

    test('should help users find events from organizations they know', async () => {
      // Given: A user familiar with community organizations
      const events = await client.searchEvents('Community');
      
      // Then: Should find events from those organizations
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => {
        const searchTerm = 'community';
        return event.heading?.toLowerCase().includes(searchTerm) ||
               event.description?.toLowerCase().includes(searchTerm) ||
               event.recipients?.group?.name?.toLowerCase().includes(searchTerm);
      })).toBe(true);
    });

    test('should clearly indicate when no matching activities are found', async () => {
      // Given: A user searching for activities that don't exist
      const events = await client.searchEvents('NonExistentSearchTerm');
      
      // Then: Should clearly show no results rather than error
      expect(events).toEqual([]);
    });

    test('should prevent overwhelming users with too many search results', async () => {
      // Given: A user wanting focused search results
      const events = await client.searchEvents('Gaming Center', 1);
      
      // Then: Should limit results to what they can reasonably process
      expect(events.length).toBeLessThanOrEqual(1);
      if (events.length > 0) {
        expect(events[0].heading || events[0].description).toBeTruthy();
      }
    });
  });

  describe('getEventsByGroup', () => {
    test('should help users focus on their specific team or organization', async () => {
      // Given: A user involved with a specific junior gaming team
      const events = await client.getEventsByGroup('Gaming Center Junior');
      
      // Then: Should show only events relevant to that group
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => 
        event.recipients?.group?.name?.toLowerCase().includes('gaming center junior')
      )).toBe(true);
    });

    test('should help users find events across related groups', async () => {
      // Given: A user interested in all gaming center activities
      const events = await client.getEventsByGroup('Gaming Center');
      
      // Then: Should find events from all gaming center subgroups
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => 
        event.recipients?.group?.name?.toLowerCase().includes('gaming center')
      )).toBe(true);
    });

    test('should support users involved in multiple types of organizations', async () => {
      // Given: A user active in community organizations
      const events = await client.getEventsByGroup('Community');
      
      // Then: Should find all community-related events
      expect(events.length).toBeGreaterThan(0);
      expect(events.every(event => 
        event.recipients?.group?.name?.toLowerCase().includes('community')
      )).toBe(true);
    });

    test('should gracefully handle requests for unknown groups', async () => {
      // Given: A user searching for a group that doesn't exist
      const events = await client.getEventsByGroup('NonExistentGroup');
      
      // Then: Should clearly indicate no events are available for that group
      expect(events).toEqual([]);
    });

    test('should provide manageable result sets for group planning', async () => {
      // Given: A user wanting a quick overview of group activities
      const events = await client.getEventsByGroup('Gaming Center', 2);
      
      // Then: Should limit results to support focused planning
      expect(events.length).toBeLessThanOrEqual(2);
      expect(events.length).toBeGreaterThan(0);
    });

    test('should work naturally regardless of how users type group names', async () => {
      // Given: Users typing group names in different cases
      const eventsLower = await client.getEventsByGroup('gaming center');
      const eventsUpper = await client.getEventsByGroup('GAMING CENTER');
      const eventsMixed = await client.getEventsByGroup('Gaming Center');
      
      // Then: Should find the same events regardless of case
      expect(eventsLower.length).toBe(eventsUpper.length);
      expect(eventsLower.length).toBe(eventsMixed.length);
      expect(eventsLower.length).toBeGreaterThan(0);
    });
  });

  describe('Event Registration Timing', () => {
    test('should provide registration timing information for user planning', async () => {
      // Given: A user wanting to understand when they can register
      const events = await client.getEvents({ max: 1 });
      
      // Then: Should include timing information to help plan registration
      expect(events.length).toBeGreaterThan(0);
      const event = events[0];
      expect(event.inviteTime === null || typeof event.inviteTime === 'string').toBe(true);
    });

    test('should provide clear registration status options for users', async () => {
      // Given: A system that tracks registration states
      const { RegistrationStatus } = await import('../../src/domain-types.js');
      
      // Then: Should offer intuitive status categories for user understanding
      expect(RegistrationStatus).toBeDefined();
      expect(RegistrationStatus.PENDING).toBe('pending');
      expect(RegistrationStatus.OPEN).toBe('open');
      expect(RegistrationStatus.CLOSED).toBe('closed');
    });

    test('should calculate registration status for events', async () => {
      // This test will fail until calculateRegistrationStatus function is created
      const { calculateRegistrationStatus, RegistrationStatus } = await import('../../src/domain-types.js');
      
      expect(calculateRegistrationStatus).toBeDefined();
      
      const testClock = TestClock.getInstance();
      const now = testClock.getRelativeTime({ days: 0 }); // Use base time as "now"
      
      // Test PENDING: inviteTime is in the future
      const pendingEvent = {
        inviteTime: testClock.getRelativeTimeISO({ days: 1 }),
        expired: false
      };
      expect(calculateRegistrationStatus(pendingEvent, now)).toBe(RegistrationStatus.PENDING);
      
      // Test OPEN: inviteTime is in the past, not expired
      const openEvent = {
        inviteTime: testClock.getRelativeTimeISO({ days: -1 }),
        expired: false
      };
      expect(calculateRegistrationStatus(openEvent, now)).toBe(RegistrationStatus.OPEN);
      
      // Test OPEN: inviteTime is null (immediately open), not expired
      const immediatelyOpenEvent = {
        inviteTime: null,
        expired: false
      };
      expect(calculateRegistrationStatus(immediatelyOpenEvent, now)).toBe(RegistrationStatus.OPEN);
      
      // Test CLOSED: expired is true
      const closedEvent = {
        inviteTime: testClock.getRelativeTimeISO({ days: -1 }),
        expired: true
      };
      expect(calculateRegistrationStatus(closedEvent, now)).toBe(RegistrationStatus.CLOSED);
    });
  });

  describe('Test Environment Reliability', () => {
    test('should provide consistent test data for reliable testing', async () => {
      // Given: A test environment that needs predictable data
      const events = await client.getEvents({ max: 100 });
      
      // Then: Should include specific test events for consistent test behavior
      const eventIds = events.map(e => e.id);
      expect(eventIds).toContain('FE5E94BA079947CB98302FFF6C931963');
      expect(eventIds).toContain('B4097F9546E2418EBF43CC92A8B906A0');
      expect(eventIds).toContain('209AB44159AD4C5C88054C44A3F51CA0');
    });

    test('should provide diverse organizational scenarios for comprehensive testing', async () => {
      // Given: A need to test various types of organizations
      const events = await client.getEvents({ max: 100 });
      
      // Then: Should include events from different organization types
      const groupNames = events.map(e => e.recipients?.group?.name).filter(Boolean);
      expect(groupNames).toContain('Gaming Center Junior');
      expect(groupNames).toContain('Community Flea Market 2025');
      expect(groupNames).toContain('Example Sports Club Handball G2013');
    });

    test('should use realistic event timing for meaningful test scenarios', async () => {
      // Given: A need for realistic event scheduling in tests
      const events = await client.getEvents({ max: 100 });
      
      // Then: Should have logical event timing that mirrors real usage
      expect(events.every(event => {
        const startDate = new Date(event.startTimestamp);
        const endDate = new Date(event.endTimestamp);
        return startDate < endDate && 
               startDate.getFullYear() >= 2024 && 
               endDate.getFullYear() >= 2024;
      })).toBe(true);
    });
  });
});