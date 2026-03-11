import { SpondEvent, SpondGroup } from '../../src/domain-types.js';
import { ISpondClient } from '../../src/spond-client-interface.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';
import {
  SpondEventMother,
  SpondGroupMother,
  SpondEventBuilder
} from './object-mothers.js';

/**
 * Builder for creating SpondClientFake instances with controlled test data.
 */
export class TestSpondClientBuilder {
  private fake: SpondClientFake;

  constructor() {
    this.fake = new SpondClientFake();
    this.setupDefaultData();
  }

  static aClient(): TestSpondClientBuilder {
    return new TestSpondClientBuilder();
  }

  private setupDefaultData(): void {
    this.fake.addEvent(SpondEventMother.createOpenRegistrationEvent());
    this.fake.addEvent(SpondEventMother.createPendingRegistrationEvent());
    this.fake.addEvent(SpondEventMother.createExpiredEvent());
    this.fake.addEvent(SpondEventMother.createEventWithLocation());
    this.fake.addEvent(
      SpondEventBuilder.anEvent()
        .withHeading('Soccer Practice')
        .withDescription('Weekly practice session')
        .withStartTime(new Date(Date.now() + 172800000).toISOString())
        .build()
    );

    this.fake.addGroup(SpondGroupMother.createActiveGroup());
    this.fake.addGroup(SpondGroupMother.createEmptyGroup());
    this.fake.addGroup(SpondGroupMother.createGroupWithCustomName('Basketball Team'));

    this.fake.addPost({
      id: 'post-1',
      type: 'PLAIN',
      groupId: 'group-active-123',
      title: 'Training Update',
      body: 'Tomorrow training is moved to 7 PM',
      ownerId: 'owner-1',
      timestamp: new Date().toISOString(),
      visibility: 'GROUP',
      unread: false,
      commentsDisabled: false,
      muted: false,
      selectMemberPoll: false
    });
  }

  withNoData(): TestSpondClientBuilder {
    this.fake.clearAllData();
    return this;
  }

  withEvents(events: SpondEvent[]): TestSpondClientBuilder {
    this.fake.clearAllData();
    events.forEach(event => this.fake.addEvent(event));
    return this;
  }

  withGroups(groups: SpondGroup[]): TestSpondClientBuilder {
    this.fake.clearGroups();
    groups.forEach(group => this.fake.addGroup(group));
    return this;
  }

  thatFailsNextCall(errorMessage = 'Network error'): TestSpondClientBuilder {
    this.fake.setFailNextCall(true, errorMessage);
    return this;
  }

  build(): ISpondClient {
    return this.fake;
  }
}
