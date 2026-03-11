import { describe, test, expect } from '@jest/globals';
import { calculateRegistrationStatus, RegistrationStatus } from '../../src/domain-logic.js';
import { SpondEventMother, SpondEventBuilder, SpondEventGroupMother, SpondGroupMother } from '../helpers/object-mothers.js';
import { TestSpondClientBuilder } from '../helpers/test-spond-client-builder.js';

describe('Event Registration Domain Behavior', () => {
  describe('Registration Status Calculation', () => {
    test('should allow registration when event is open', () => {
      // Given: An event with open registration
      const openEvent = SpondEventMother.createOpenRegistrationEvent();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(openEvent, currentTime);

      // Then: Registration should be open
      expect(status).toBe(RegistrationStatus.OPEN);
    });

    test('should show pending when registration time is in future', () => {
      // Given: An event with future registration time
      const futureTime = new Date(Date.now() + 3600000); // 1 hour from now
      const pendingEvent = SpondEventBuilder.anEvent()
        .withInviteTime(futureTime.toISOString())
        .build();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(pendingEvent, currentTime);

      // Then: Registration should be pending
      expect(status).toBe(RegistrationStatus.PENDING);
    });

    test('should close registration when event is expired', () => {
      // Given: An expired event
      const expiredEvent = SpondEventMother.createExpiredEvent();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(expiredEvent, currentTime);

      // Then: Registration should be closed
      expect(status).toBe(RegistrationStatus.CLOSED);
    });

    test('should open registration immediately when no invite time is set', () => {
      // Given: An event with no invite time
      const immediateEvent = SpondEventBuilder.anEvent()
        .withInviteTime(null)
        .build();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(immediateEvent, currentTime);

      // Then: Registration should be open
      expect(status).toBe(RegistrationStatus.OPEN);
    });

    test('should open registration when invite time is undefined', () => {
      // Given: An event with null invite time (same as undefined in practice)
      const undefinedInviteEvent = SpondEventBuilder.anEvent()
        .withInviteTime(null)
        .build();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(undefinedInviteEvent, currentTime);

      // Then: Registration should be open
      expect(status).toBe(RegistrationStatus.OPEN);
    });

    test('should prioritize expired status over invite time', () => {
      // Given: An expired event with valid invite time in the past
      const expiredEventWithValidInvite = SpondEventMother.createExpiredEvent();
      const currentTime = new Date();

      // When: Registration status is calculated
      const status = calculateRegistrationStatus(expiredEventWithValidInvite, currentTime);

      // Then: Registration should be closed due to expiration
      expect(status).toBe(RegistrationStatus.CLOSED);
    });
  });

  describe('Event Retrieval Workflows', () => {
    test('should find upcoming events for user planning', async () => {
      // Given: A client with upcoming and past events
      const upcomingEvent = SpondEventMother.createOpenRegistrationEvent();
      const pastEvent = SpondEventMother.createExpiredEvent();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([upcomingEvent, pastEvent])
        .build();

      // When: User requests upcoming events
      const upcomingEvents = await client.getUpcomingEvents();

      // Then: Only future events should be returned
      expect(upcomingEvents).toHaveLength(1);
      expect(upcomingEvents[0].id).toBe(upcomingEvent.id);
      expect(new Date(upcomingEvents[0].endTimestamp).getTime()).toBeGreaterThan(new Date().getTime());
    });

    test('should filter events by date range for scheduling', async () => {
      // Given: A client with events across different time periods
      const julyEvent = SpondEventBuilder.anEvent()
        .withId('july-event')
        .withStartTime('2024-07-15T10:00:00.000Z')
        .withEndTime('2024-07-15T11:00:00.000Z')
        .build();
      const augustEvent = SpondEventBuilder.anEvent()
        .withId('august-event')
        .withStartTime('2024-08-15T10:00:00.000Z')
        .withEndTime('2024-08-15T11:00:00.000Z')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([julyEvent, augustEvent])
        .build();

      // When: User requests events for July only
      const julyEvents = await client.getEvents({
        minEndTimestamp: '2024-07-01T00:00:00.000Z',
        maxEndTimestamp: '2024-07-31T23:59:59.999Z'
      });

      // Then: Only July events should be returned
      expect(julyEvents).toHaveLength(1);
      expect(julyEvents[0].id).toBe('july-event');
    });

    test('should handle search for specific training types', async () => {
      // Given: A client with different types of events
      const trainingEvent = SpondEventBuilder.anEvent()
        .withHeading('Soccer Training')
        .withDescription('Weekly practice session')
        .build();
      const matchEvent = SpondEventBuilder.anEvent()
        .withHeading('Championship Match')
        .withDescription('Important game')
        .build();
      const client = TestSpondClientBuilder.aClient()
        .withEvents([trainingEvent, matchEvent])
        .build();

      // When: User searches for training events
      const trainingEvents = await client.searchEvents('training');

      // Then: Only training-related events should be returned
      expect(trainingEvents).toHaveLength(1);
      expect(trainingEvents[0].heading).toContain('Training');
    });
  });

  describe('Error Handling Scenarios', () => {
    test('should handle network failures gracefully', async () => {
      // Given: A client that will fail the next call
      const client = TestSpondClientBuilder.aClient()
        .thatFailsNextCall('Connection timeout')
        .build();

      // When: User attempts to retrieve events
      const eventRetrievalAttempt = async () => {
        await client.getEvents();
      };

      // Then: Should throw appropriate error
      await expect(eventRetrievalAttempt()).rejects.toThrow('Connection timeout');
    });

    test('should handle empty results for unknown group', async () => {
      // Given: A client with no matching groups
      const client = TestSpondClientBuilder.aClient()
        .withNoData()
        .build();

      // When: User searches for events by non-existent group
      const events = await client.getEventsByGroup('NonExistentTeam');

      // Then: Should return empty array without error
      expect(events).toEqual([]);
    });
  });

  describe('Group-Based Event Access', () => {
    test('should retrieve events for specific team', async () => {
      // Given: A client with events from different teams
      const soccerGroup = SpondEventGroupMother.createActiveEventGroup();
      const basketballGroup = { ...soccerGroup, id: 'basketball-group', name: 'Basketball Team' };
      
      const soccerEvent = SpondEventBuilder.anEvent()
        .withHeading('Soccer Practice')
        .withGroup(soccerGroup)
        .build();
      const basketballEvent = SpondEventBuilder.anEvent()
        .withHeading('Basketball Game')
        .withGroup(basketballGroup)
        .build();
        
      const client = TestSpondClientBuilder.aClient()
        .withEvents([soccerEvent, basketballEvent])
        .build();

      // When: User requests events for soccer team
      const soccerEvents = await client.getEventsByGroup('Soccer');

      // Then: Only soccer events should be returned
      expect(soccerEvents).toHaveLength(1);
      expect(soccerEvents[0].heading).toBe('Soccer Practice');
      expect(soccerEvents[0].recipients.group.name).toContain('Soccer');
    });

    test('should use group lookup for efficient filtering when groups are available', async () => {
      // Given: A client with matching groups AND events from those groups
      const soccerGroup = SpondEventGroupMother.createActiveEventGroup();
      const basketballGroup = { ...soccerGroup, id: 'basketball-group', name: 'Basketball Team' };

      const soccerEvent = SpondEventBuilder.anEvent()
        .withHeading('Soccer Practice')
        .withGroup(soccerGroup)
        .build();
      const basketballEvent = SpondEventBuilder.anEvent()
        .withHeading('Basketball Game')
        .withGroup(basketballGroup)
        .build();

      const client = TestSpondClientBuilder.aClient()
        .withEvents([soccerEvent, basketballEvent])
        .withGroups([
          SpondGroupMother.createActiveGroup(), // id: 'group-active-123', name: 'Soccer Team Alpha'
          SpondGroupMother.createGroupWithCustomName('Basketball Team'),
        ])
        .build();

      // When: User requests events for soccer team
      const soccerEvents = await client.getEventsByGroup('Soccer');

      // Then: Should find soccer events via group lookup + groupId filtering
      expect(soccerEvents).toHaveLength(1);
      expect(soccerEvents[0].heading).toBe('Soccer Practice');
    });

    test('should fall back to name filtering when no matching group found', async () => {
      // Given: A client with events but no matching groups (simulates API inconsistency)
      const soccerGroup = SpondEventGroupMother.createActiveEventGroup();

      const soccerEvent = SpondEventBuilder.anEvent()
        .withHeading('Soccer Practice')
        .withGroup(soccerGroup)
        .build();

      const client = TestSpondClientBuilder.aClient()
        .withEvents([soccerEvent])
        .withGroups([]) // No groups at all
        .build();

      // When: User requests events for soccer team
      const soccerEvents = await client.getEventsByGroup('Soccer');

      // Then: Should still find events via fallback name filtering
      expect(soccerEvents).toHaveLength(1);
      expect(soccerEvents[0].heading).toBe('Soccer Practice');
    });
  });
});

