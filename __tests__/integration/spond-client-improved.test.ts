import { describe, test, expect, jest } from '@jest/globals';
import { SpondEventMother, SpondGroupMother, SpondEventGroupMother, SpondEventBuilder } from '../helpers/object-mothers.js';
import { TestSpondClientBuilder } from '../helpers/test-spond-client-builder.js';

// Mock node-fetch to avoid ESM import issues in Jest
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondClient } from '../../src/spond-client.js';

describe('SpondClient Behavior', () => {
  describe('Event Retrieval', () => {
    test('should provide events for user activity planning', async () => {
      // Given: A client with various events
      const trainingEvent = SpondEventMother.createOpenRegistrationEvent();
      const matchEvent = SpondEventBuilder.anEvent()
        .withHeading('Championship Match')
        .withDescription('Final championship game')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([trainingEvent, matchEvent])
        .build();

      // When: User requests all events
      const events = await client.getEvents();

      // Then: Should receive events for planning purposes
      expect(events).toHaveLength(2);
      expect(events.some(e => e.heading.includes('Training'))).toBe(true);
      expect(events.some(e => e.heading.includes('Championship'))).toBe(true);
    });

    test('should limit events for mobile app performance', async () => {
      // Given: A client with many events
      const manyEvents = Array.from({ length: 50 }, (_, i) => 
        SpondEventBuilder.anEvent()
          .withId(`event-${i}`)
          .withHeading(`Event ${i}`)
          .build()
      );
      const client = TestSpondClientBuilder.aClient()
        .withEvents(manyEvents)
        .build();

      // When: User requests limited events for mobile display
      const limitedEvents = await client.getEvents({ max: 10 });

      // Then: Should receive exactly the requested amount
      expect(limitedEvents).toHaveLength(10);
    });

    test('should filter events by time period for scheduling', async () => {
      // Given: A client with events in different time periods
      const julyEvent = SpondEventBuilder.anEvent()
        .withStartTime('2024-07-15T10:00:00.000Z')
        .withEndTime('2024-07-15T11:00:00.000Z')
        .build();
      const septemberEvent = SpondEventBuilder.anEvent()
        .withStartTime('2024-09-15T10:00:00.000Z')
        .withEndTime('2024-09-15T11:00:00.000Z')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([julyEvent, septemberEvent])
        .build();

      // When: User requests events for summer months only
      const summerEvents = await client.getEvents({
        minEndTimestamp: '2024-06-01T00:00:00.000Z',
        maxEndTimestamp: '2024-08-31T23:59:59.999Z'
      });

      // Then: Should receive only events in the specified period
      expect(summerEvents).toHaveLength(1);
      expect(new Date(summerEvents[0].endTimestamp).getMonth()).toBe(6); // July is month 6
    });

    test('should sort events chronologically for timeline display', async () => {
      // Given: A client with events in random time order
      const laterEvent = SpondEventBuilder.anEvent()
        .withId('later')
        .withStartTime('2024-12-15T10:00:00.000Z')
        .build();
      const earlierEvent = SpondEventBuilder.anEvent()
        .withId('earlier')
        .withStartTime('2024-12-10T10:00:00.000Z')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([laterEvent, earlierEvent])
        .build();

      // When: User requests events in ascending order
      const ascendingEvents = await client.getEvents({ order: 'asc' });

      // Then: Should receive events in chronological order
      expect(ascendingEvents[0].id).toBe('earlier');
      expect(ascendingEvents[1].id).toBe('later');
    });
  });

  describe('Event Discovery', () => {
    test('should find specific event by identifier', async () => {
      // Given: A client with a known event
      const knownEvent = SpondEventBuilder.anEvent()
        .withId('known-event-123')
        .withHeading('Important Meeting')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([knownEvent])
        .build();

      // When: User looks up the specific event
      const foundEvent = await client.getEventById('known-event-123');

      // Then: Should find the exact event
      expect(foundEvent).not.toBeNull();
      expect(foundEvent?.heading).toBe('Important Meeting');
    });

    test('should return nothing for unknown event identifier', async () => {
      // Given: A client with no matching events
      const client = TestSpondClientBuilder.aClient()
        .withNoData()
        .build();

      // When: User searches for non-existent event
      const result = await client.getEventById('does-not-exist');

      // Then: Should indicate event not found
      expect(result).toBeNull();
    });

    test('should find events by search criteria', async () => {
      // Given: A client with searchable events
      const trainingEvent = SpondEventBuilder.anEvent()
        .withHeading('Weekly Training Session')
        .withDescription('Regular team practice')
        .build();
      const socialEvent = SpondEventBuilder.anEvent()
        .withHeading('Team Social Gathering')
        .withDescription('Pizza night with the team')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([trainingEvent, socialEvent])
        .build();

      // When: User searches for training-related events
      const trainingEvents = await client.searchEvents('training');

      // Then: Should find relevant events
      expect(trainingEvents).toHaveLength(1);
      expect(trainingEvents[0].heading).toContain('Training');
    });
  });

  describe('Team-Based Event Access', () => {
    test('should provide events for specific team', async () => {
      // Given: A client with events from multiple teams
      const soccerGroup = SpondEventGroupMother.createEventGroupWithCustomName('Soccer Team Alpha');
      const tennisGroup = SpondEventGroupMother.createEventGroupWithCustomName('Tennis Club');
      
      const soccerEvent = SpondEventBuilder.anEvent()
        .withHeading('Soccer Practice')
        .withGroup(soccerGroup)
        .build();
      const tennisEvent = SpondEventBuilder.anEvent()
        .withHeading('Tennis Tournament')
        .withGroup(tennisGroup)
        .build();
        
      const client = TestSpondClientBuilder.aClient()
        .withEvents([soccerEvent, tennisEvent])
        .build();

      // When: User requests events for soccer team
      const soccerEvents = await client.getEventsByGroup('Soccer');

      // Then: Should receive only soccer team events
      expect(soccerEvents).toHaveLength(1);
      expect(soccerEvents[0].heading).toBe('Soccer Practice');
    });
  });

  describe('Upcoming Event Planning', () => {
    test('should show future events for user planning', async () => {
      // Given: A client with past and future events
      const pastEvent = SpondEventMother.createExpiredEvent();
      const futureEvent = SpondEventMother.createOpenRegistrationEvent();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([pastEvent, futureEvent])
        .build();

      // When: User requests upcoming events
      const upcomingEvents = await client.getUpcomingEvents();

      // Then: Should receive only future events
      expect(upcomingEvents).toHaveLength(1);
      expect(upcomingEvents[0].id).toBe(futureEvent.id);
    });

    test('should limit upcoming events for overview display', async () => {
      // Given: A client with many future events
      const manyFutureEvents = Array.from({ length: 30 }, (_, i) => 
        SpondEventBuilder.anEvent()
          .withId(`future-${i}`)
          .withStartTime(new Date(Date.now() + (i + 1) * 86400000).toISOString()) // i+1 days from now
          .withEndTime(new Date(Date.now() + (i + 1) * 86400000 + 3600000).toISOString()) // +1 hour
          .build()
      );
      const client = TestSpondClientBuilder.aClient()
        .withEvents(manyFutureEvents)
        .build();

      // When: User requests limited upcoming events
      const limitedUpcoming = await client.getUpcomingEvents(5, false);

      // Then: Should receive requested number of upcoming events
      expect(limitedUpcoming).toHaveLength(5);
    });
  });

  describe('Error Scenarios', () => {
    test('should handle service unavailability gracefully', async () => {
      // Given: A client that cannot connect to service
      const client = TestSpondClientBuilder.aClient()
        .thatFailsNextCall('Service temporarily unavailable')
        .build();

      // When: User attempts to access events during outage
      const eventAccess = async () => await client.getEvents();

      // Then: Should provide clear error information
      await expect(eventAccess()).rejects.toThrow('Service temporarily unavailable');
    });

    test('should handle empty results appropriately', async () => {
      // Given: A client with no events
      const client = TestSpondClientBuilder.aClient()
        .withNoData()
        .build();

      // When: User searches in empty system
      const events = await client.getEvents();

      // Then: Should return empty results without error
      expect(events).toEqual([]);
    });
  });
});

describe('Group Management', () => {
  test('should provide access to user groups', async () => {
    // Given: A client with user group memberships
    const userGroups = [
      SpondGroupMother.createActiveGroup(),
      SpondGroupMother.createGroupWithCustomName('Basketball Team')
    ];
    const client = TestSpondClientBuilder.aClient()
      .withNoData()
      .withGroups(userGroups)
      .build();

    // When: User requests their group memberships
    const groups = await client.getGroups();

    // Then: Should receive all accessible groups
    expect(groups).toHaveLength(2);
    expect(groups.some(g => g.name.includes('Soccer'))).toBe(true);
    expect(groups.some(g => g.name.includes('Basketball'))).toBe(true);
  });
});

describe('Post Communication', () => {
  test('should provide team communications', async () => {
    // Given: A client with team posts
    const client = TestSpondClientBuilder.aClient().build();

    // When: User requests recent posts
    const posts = await client.getPosts({ max: 10 });

    // Then: Should receive communication posts
    expect(Array.isArray(posts)).toBe(true);
  });

  test('should find posts by content search', async () => {
    // Given: A client with searchable posts
    const client = TestSpondClientBuilder.aClient().build();

    // When: User searches for specific content
    const searchResults = await client.searchPosts('training');

    // Then: Should return relevant posts
    expect(Array.isArray(searchResults)).toBe(true);
  });
});

describe('SpondClient HTTP Communication', () => {
  function createCapturingFetch(status: number = 200) {
    const captured: { url: string; options: any }[] = [];
    const stubFetch = (async (url: string, options: any) => {
      captured.push({ url, options });
      return {
        ok: status >= 200 && status < 300,
        status,
        text: async () => 'error response body',
        json: async () => ({}),
        headers: new Map()
      };
    }) as unknown as typeof import('node-fetch').default;
    return { captured, stubFetch };
  }

  describe('sendEventResponse', () => {
    test('should send PUT to correct URL with accepted=true for accepting', async () => {
      // Given: A client configured to capture HTTP requests
      const { captured, stubFetch } = createCapturingFetch();
      const client = new SpondClient('test-token', stubFetch);

      // When: Accepting an event
      await client.sendEventResponse('event-123', 'member-456', true);

      // Then: Should send correct PUT request
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe('https://api.spond.com/core/v1/sponds/event-123/responses/member-456');
      expect(captured[0].options.method).toBe('PUT');
      expect(JSON.parse(captured[0].options.body)).toEqual({ accepted: true });
    });

    test('should send PUT with accepted=false for declining', async () => {
      // Given: A client configured to capture HTTP requests
      const { captured, stubFetch } = createCapturingFetch();
      const client = new SpondClient('test-token', stubFetch);

      // When: Declining an event
      await client.sendEventResponse('event-789', 'member-abc', false);

      // Then: Should send decline request with accepted=false
      expect(captured).toHaveLength(1);
      expect(captured[0].url).toBe('https://api.spond.com/core/v1/sponds/event-789/responses/member-abc');
      expect(captured[0].options.method).toBe('PUT');
      expect(JSON.parse(captured[0].options.body)).toEqual({ accepted: false });
    });

    test('should throw descriptive error when API returns failure', async () => {
      // Given: A client where the API returns 403 Forbidden
      const { stubFetch } = createCapturingFetch(403);
      const client = new SpondClient('test-token', stubFetch);

      // When: Attempting to respond to an event
      const attempt = client.sendEventResponse('event-123', 'member-456', true);

      // Then: Should throw with meaningful error message
      await expect(attempt).rejects.toThrow('Failed to send event response');
      await expect(attempt).rejects.toThrow('403');
    });

    test('should include authorization header in request', async () => {
      // Given: A client with a specific token
      const { captured, stubFetch } = createCapturingFetch();
      const client = new SpondClient('my-secret-token', stubFetch);

      // When: Sending a response
      await client.sendEventResponse('event-123', 'member-456', true);

      // Then: Should include the Bearer token in headers
      expect(captured[0].options.headers.authorization).toBe('Bearer my-secret-token');
    });
  });
});