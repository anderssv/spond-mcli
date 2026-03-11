import { describe, test, expect } from '@jest/globals';
import { AttendanceStatus, RegistrationStatus } from '../../src/domain-logic.js';
import { 
  SpondEventMother, 
  SpondUserMother, 
  SpondGroupMother, 
  SpondEventGroupMother, 
  SpondEventBuilder 
} from '../helpers/object-mothers.js';

describe('Object Mothers and Domain Patterns', () => {
  describe('Event Creation Patterns', () => {
    test('should create open registration events for testing', () => {
      // Given: An event creation pattern for open registration
      const openEvent = SpondEventMother.createOpenRegistrationEvent();

      // When: Examining the event properties
      // Then: Should have characteristics of an open registration event
      expect(openEvent.id).toBe('event-open-reg-123');
      expect(openEvent.heading).toBe('Training Session');
      expect(openEvent.expired).toBe(false);
      expect(new Date(openEvent.inviteTime!).getTime()).toBeLessThan(Date.now());
    });

    test('should create pending registration events for testing workflows', () => {
      // Given: An event creation pattern for pending registration
      const pendingEvent = SpondEventMother.createPendingRegistrationEvent();

      // When: Examining the event properties
      // Then: Should have characteristics of a pending registration event
      expect(pendingEvent.id).toBe('event-pending-reg-456');
      expect(pendingEvent.heading).toBe('Championship Match');
      expect(pendingEvent.expired).toBe(false);
      expect(new Date(pendingEvent.inviteTime!).getTime()).toBeGreaterThan(Date.now());
    });

    test('should create expired events for historical data testing', () => {
      // Given: An event creation pattern for expired events
      const expiredEvent = SpondEventMother.createExpiredEvent();

      // When: Examining the event properties
      // Then: Should have characteristics of an expired event
      expect(expiredEvent.expired).toBe(true);
      expect(expiredEvent.registered).toBe(true);
      expect(new Date(expiredEvent.startTimestamp).getTime()).toBeLessThan(Date.now());
    });

    test('should create events with location for mapping features', () => {
      // Given: An event creation pattern with location
      const eventWithLocation = SpondEventMother.createEventWithLocation();

      // When: Examining the location properties
      // Then: Should have complete location information
      expect(eventWithLocation.location).toBeDefined();
      expect(eventWithLocation.location!.address).toBe('123 Sports Avenue');
      expect(eventWithLocation.location!.country).toBe('Norway');
    });
  });

  describe('Event Builder Pattern', () => {
    test('should build custom events fluently', () => {
      // Given: A builder pattern for event creation
      const customEvent = SpondEventBuilder.anEvent()
        .withId('custom-123')
        .withHeading('Custom Training')
        .withDescription('Special training session')
        .thatIsRegistered()
        .build();

      // When: Examining the built event
      // Then: Should have all specified properties
      expect(customEvent.id).toBe('custom-123');
      expect(customEvent.heading).toBe('Custom Training');
      expect(customEvent.description).toBe('Special training session');
      expect(customEvent.registered).toBe(true);
    });

    test('should build expired events with specific timing', () => {
      // Given: A builder pattern for expired event
      const pastTime = new Date(Date.now() - 86400000).toISOString(); // Yesterday
      const expiredEvent = SpondEventBuilder.anEvent()
        .withStartTime(pastTime)
        .thatIsExpired()
        .build();

      // When: Examining the expired event
      // Then: Should be marked as expired with past timing
      expect(expiredEvent.expired).toBe(true);
      expect(new Date(expiredEvent.startTimestamp).getTime()).toBeLessThan(Date.now());
    });
  });

  describe('User Creation Patterns', () => {
    test('should create different user response types', () => {
      // Given: User creation patterns for different attendance states
      const acceptedUser = SpondUserMother.createAcceptedUser();
      const declinedUser = SpondUserMother.createDeclinedUser();
      const appUser = SpondUserMother.createAppUser();

      // When: Examining user response states
      // Then: Should have appropriate attendance status
      expect(acceptedUser.response).toBe(AttendanceStatus.ACCEPTED);
      expect(declinedUser.response).toBe(AttendanceStatus.DECLINED);
      expect(appUser.response).toBe(AttendanceStatus.UNANSWERED);
    });

    test('should create users with custom names for scenarios', () => {
      // Given: A user creation pattern with custom naming
      const customUser = SpondUserMother.createUserWithCustomName('Alice', 'Johnson');

      // When: Examining the custom user
      // Then: Should have specified name and derived email
      expect(customUser.firstName).toBe('Alice');
      expect(customUser.lastName).toBe('Johnson');
      expect(customUser.email).toBe('alice.johnson@example.com');
    });

    test('should distinguish between app and non-app users', () => {
      // Given: User creation patterns for different user types
      const appUser = SpondUserMother.createAppUser();
      const nonAppUser = SpondUserMother.createNonAppUser();

      // When: Examining user app status
      // Then: Should reflect correct app usage
      expect(appUser.appUser).toBe(true);
      expect(nonAppUser.appUser).toBe(false);
    });
  });

  describe('Group Creation Patterns', () => {
    test('should create active groups with members', () => {
      // Given: A group creation pattern for active groups
      const activeGroup = SpondGroupMother.createActiveGroup();

      // When: Examining the group structure
      // Then: Should have members and proper structure
      expect(activeGroup.name).toBe('Soccer Team Alpha');
      expect(activeGroup.members).toHaveLength(2);
      expect(activeGroup.members[0].respondent).toBe(true);
    });

    test('should create empty groups for new team scenarios', () => {
      // Given: A group creation pattern for empty groups
      const emptyGroup = SpondGroupMother.createEmptyGroup();

      // When: Examining the empty group
      // Then: Should have no members but proper structure
      expect(emptyGroup.name).toBe('New Team');
      expect(emptyGroup.members).toHaveLength(0);
    });

    test('should create large groups for scalability testing', () => {
      // Given: A group creation pattern for large groups
      const largeGroup = SpondGroupMother.createLargeGroup();

      // When: Examining the large group
      // Then: Should have many members for load testing
      expect(largeGroup.members.length).toBeGreaterThan(20);
      expect(largeGroup.name).toBe('Large Soccer Club');
    });

    test('should create groups with guardians for youth teams', () => {
      // Given: A group creation pattern with guardian relationships
      const groupWithGuardians = SpondGroupMother.createGroupWithGuardians();

      // When: Examining guardian relationships
      // Then: Should have member with guardian information
      const memberWithGuardian = groupWithGuardians.members.find(m => m.guardians);
      expect(memberWithGuardian).toBeDefined();
      expect(memberWithGuardian!.guardians).toHaveLength(1);
      expect(memberWithGuardian!.guardians![0].firstName).toBe('Parent');
    });
  });

  describe('Event Group Creation for Events', () => {
    test('should create event groups with proper structure', () => {
      // Given: An event group creation pattern
      const eventGroup = SpondEventGroupMother.createActiveEventGroup();

      // When: Examining the event group structure
      // Then: Should match event recipients structure
      expect(eventGroup.name).toBe('Soccer Team Alpha');
      expect(eventGroup.members).toHaveLength(2);
      expect(eventGroup.members[0].respondent).toBe(true);
      expect(typeof eventGroup.createdTime).toBe('number');
    });

    test('should create custom named event groups', () => {
      // Given: An event group with custom naming
      const customEventGroup = SpondEventGroupMother.createEventGroupWithCustomName('Basketball Squad');

      // When: Examining the custom event group
      // Then: Should have specified name
      expect(customEventGroup.name).toBe('Basketball Squad');
    });
  });

  describe('Domain Behavior Testing Patterns', () => {
    test('should demonstrate Given-When-Then structure clearly', () => {
      // Given: A well-structured event for testing business logic
      const eventForTesting = SpondEventBuilder.anEvent()
        .withHeading('Business Logic Test Event')
        .withInviteTime(null) // Immediate registration
        .build();

      // When: Business logic processes the event
      const hasImmediateRegistration = eventForTesting.inviteTime === null;

      // Then: Should demonstrate clear domain behavior
      expect(hasImmediateRegistration).toBe(true);
      expect(eventForTesting.heading).toBe('Business Logic Test Event');
    });

    test('should support complex scenario building', () => {
      // Given: A complex event scenario with custom group
      const specialGroup = SpondEventGroupMother.createEventGroupWithCustomName('Elite Training Squad');
      const complexEvent = SpondEventBuilder.anEvent()
        .withHeading('Elite Training Session')
        .withGroup(specialGroup)
        .withInviteTime(new Date(Date.now() + 3600000).toISOString()) // 1 hour future
        .build();

      // When: Examining the complex scenario
      // Then: Should have all components working together
      expect(complexEvent.recipients.group.name).toBe('Elite Training Squad');
      expect(complexEvent.heading).toBe('Elite Training Session');
      expect(new Date(complexEvent.inviteTime!).getTime()).toBeGreaterThan(Date.now());
    });
  });
});