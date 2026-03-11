import { SpondEvent, SpondGroup, AttendanceStatus, RegistrationStatus } from '../../src/domain-types.js';

type SpondUser = SpondEvent['owners'][0];
type SpondEventGroup = SpondEvent['recipients']['group'];
type SpondGroupMember = SpondGroup['members'][0];

export class SpondEventMother {
  static createOpenRegistrationEvent(): SpondEvent {
    return {
      id: 'event-open-reg-123',
      creatorId: 'creator-123',
      owners: [SpondUserMother.createAppUser()],
      heading: 'Training Session',
      description: 'Weekly training session',
      startTimestamp: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
      endTimestamp: new Date(Date.now() + 90000000).toISOString(), // Tomorrow + 1 hour
      inviteTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
      registered: false,
      expired: false,
      recipients: {
        group: SpondEventGroupMother.createActiveEventGroup()
      }
    };
  }

  static createPendingRegistrationEvent(): SpondEvent {
    return {
      id: 'event-pending-reg-456',
      creatorId: 'creator-456',
      owners: [SpondUserMother.createAppUser()],
      heading: 'Championship Match',
      description: 'Important championship match',
      startTimestamp: new Date(Date.now() + 172800000).toISOString(), // Day after tomorrow
      endTimestamp: new Date(Date.now() + 176400000).toISOString(), // Day after tomorrow + 1 hour
      inviteTime: new Date(Date.now() + 86400000).toISOString(), // Tomorrow (future)
      registered: false,
      expired: false,
      recipients: {
        group: SpondEventGroupMother.createActiveEventGroup()
      }
    };
  }

  static createExpiredEvent(): SpondEvent {
    return {
      id: 'event-expired-789',
      creatorId: 'creator-789',
      owners: [SpondUserMother.createAppUser()],
      heading: 'Past Training',
      description: 'Training session that has expired',
      startTimestamp: new Date(Date.now() - 86400000).toISOString(), // Yesterday
      endTimestamp: new Date(Date.now() - 82800000).toISOString(), // Yesterday + 1 hour
      inviteTime: new Date(Date.now() - 172800000).toISOString(), // Day before yesterday
      registered: true,
      expired: true,
      recipients: {
        group: SpondEventGroupMother.createActiveEventGroup()
      }
    };
  }

  static createEventWithLocation(): SpondEvent {
    const event = this.createOpenRegistrationEvent();
    event.location = {
      id: 'location-123',
      feature: 'Sports Complex',
      address: '123 Sports Avenue',
      latitude: 59.9139,
      longitude: 10.7522,
      postalCode: '0184',
      country: 'Norway',
      administrativeAreaLevel1: 'Oslo',
      administrativeAreaLevel2: 'Oslo'
    };
    return event;
  }

  static createEventWithCustomHeading(heading: string): SpondEvent {
    const event = this.createOpenRegistrationEvent();
    event.heading = heading;
    return event;
  }

  static createEventInDateRange(startDate: Date, endDate: Date): SpondEvent {
    const event = this.createOpenRegistrationEvent();
    event.startTimestamp = startDate.toISOString();
    event.endTimestamp = endDate.toISOString();
    return event;
  }
}

export class SpondUserMother {
  static createAppUser(): SpondUser {
    return {
      id: 'user-app-123',
      response: AttendanceStatus.UNANSWERED,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      phoneNumber: '+47 123 45 678',
      appUser: true,
      unableToReach: false,
      imageUrl: 'https://example.com/avatar/john.jpg'
    };
  }

  static createAcceptedUser(): SpondUser {
    return {
      id: 'user-accepted-456',
      response: AttendanceStatus.ACCEPTED,
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
      phoneNumber: '+47 987 65 432',
      appUser: true,
      unableToReach: false,
      imageUrl: 'https://example.com/avatar/jane.jpg'
    };
  }

  static createDeclinedUser(): SpondUser {
    return {
      id: 'user-declined-789',
      response: AttendanceStatus.DECLINED,
      firstName: 'Bob',
      lastName: 'Wilson',
      email: 'bob.wilson@example.com',
      phoneNumber: '+47 555 12 34',
      appUser: true,
      unableToReach: false
    };
  }

  static createNonAppUser(): SpondUser {
    return {
      id: 'user-non-app-321',
      response: AttendanceStatus.UNANSWERED,
      firstName: 'Alice',
      lastName: 'Brown',
      email: 'alice.brown@example.com',
      phoneNumber: '+47 555 98 76',
      appUser: false,
      unableToReach: false
    };
  }

  static createUserWithCustomName(firstName: string, lastName: string): SpondUser {
    return {
      id: `user-${firstName.toLowerCase()}-${lastName.toLowerCase()}`,
      response: AttendanceStatus.UNANSWERED,
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
      appUser: true,
      unableToReach: false
    };
  }
}

export class SpondEventGroupMother {
  static createActiveEventGroup(): SpondEventGroup {
    return {
      id: 'group-active-123',
      contactPersonId: 'contact-123',
      name: 'Soccer Team Alpha',
      imageUrl: 'https://example.com/group/soccer-team.jpg',
      createdTime: Date.now() - 86400000, // Created yesterday
      members: [
        {
          id: 'member-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+47 123 45 678',
          respondent: true
        },
        {
          id: 'member-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          respondent: true
        }
      ]
    };
  }

  static createEventGroupWithCustomName(name: string): SpondEventGroup {
    const group = this.createActiveEventGroup();
    group.name = name;
    return group;
  }
}

export class SpondGroupMother {
  static createActiveGroup(): SpondGroup {
    return {
      id: 'group-active-123',
      contactPersonId: 'contact-123',
      name: 'Soccer Team Alpha',
      imageUrl: 'https://example.com/group/soccer-team.jpg',
      createdTime: new Date(Date.now() - 86400000).toISOString(), // Created yesterday
      members: [
        {
          id: 'member-1',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phoneNumber: '+47 123 45 678',
          createdTime: new Date().toISOString(),
          respondent: true
        },
        {
          id: 'member-2',
          firstName: 'Jane',
          lastName: 'Smith',
          email: 'jane.smith@example.com',
          createdTime: new Date().toISOString(),
          respondent: true
        }
      ]
    };
  }

  static createEmptyGroup(): SpondGroup {
    return {
      id: 'group-empty-456',
      contactPersonId: 'contact-456',
      name: 'New Team',
      createdTime: new Date().toISOString(),
      members: []
    };
  }

  static createLargeGroup(): SpondGroup {
    const group = this.createActiveGroup();
    group.id = 'group-large-789';
    group.name = 'Large Soccer Club';
    
    // Add many members
    const additionalMembers = Array.from({ length: 20 }, (_, index) => ({
      id: `member-${index + 3}`,
      firstName: `Player${index + 1}`,
      lastName: 'Surname',
      email: `player${index + 1}@example.com`,
      createdTime: new Date().toISOString(),
      respondent: true
    }));
    
    group.members = [...group.members, ...additionalMembers];
    return group;
  }

  static createGroupWithCustomName(name: string): SpondGroup {
    const group = this.createActiveGroup();
    group.name = name;
    return group;
  }

  static createGroupWithGuardians(): SpondGroup {
    const group = this.createActiveGroup();
    
    // Add members with guardians
    const memberWithGuardian = {
      id: 'member-with-guardian',
      firstName: 'Child',
      lastName: 'Player',
      email: 'child@example.com',
      createdTime: new Date().toISOString(),
      respondent: true,
      guardians: [{
        id: 'guardian-123',
        firstName: 'Parent',
        lastName: 'Guardian',
        email: 'parent@example.com',
        phoneNumber: '+47 987 65 432'
      }]
    };
    
    group.members.push(memberWithGuardian);
    return group;
  }
}

// Builder patterns for complex test scenarios
export class SpondEventBuilder {
  private event: SpondEvent;

  constructor() {
    this.event = SpondEventMother.createOpenRegistrationEvent();
  }

  static anEvent(): SpondEventBuilder {
    return new SpondEventBuilder();
  }

  withId(id: string): SpondEventBuilder {
    this.event.id = id;
    return this;
  }

  withHeading(heading: string): SpondEventBuilder {
    this.event.heading = heading;
    return this;
  }

  withDescription(description: string): SpondEventBuilder {
    this.event.description = description;
    return this;
  }

  withStartTime(timestamp: string): SpondEventBuilder {
    this.event.startTimestamp = timestamp;
    return this;
  }

  withEndTime(timestamp: string): SpondEventBuilder {
    this.event.endTimestamp = timestamp;
    return this;
  }

  withInviteTime(timestamp: string | null): SpondEventBuilder {
    this.event.inviteTime = timestamp;
    return this;
  }

  thatIsExpired(): SpondEventBuilder {
    this.event.expired = true;
    return this;
  }

  thatIsRegistered(): SpondEventBuilder {
    this.event.registered = true;
    return this;
  }

  withGroup(group: SpondEventGroup): SpondEventBuilder {
    this.event.recipients.group = group;
    return this;
  }

  build(): SpondEvent {
    return { ...this.event };
  }
}