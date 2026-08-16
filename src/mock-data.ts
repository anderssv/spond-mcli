import { SpondEvent, SpondPost, SpondGroup } from './domain-types.js';
import { getRelativeTimeISO } from './test-time.js';

// Generate mock events with dynamic timestamps
function createMockEvents(): SpondEvent[] {
  return [
    {
      id: 'MUSIC_GROUP_EVENT_001',
      creatorId: 'CREATOR_EXAMPLE_001',
      owners: [
        {
          id: 'OWNER_EXAMPLE_001',
          response: 'accepted',
          firstName: 'Jane',
          lastName: 'Doe',
          email: 'jane.doe@example.com',
          phoneNumber: '+47 123 45 678',
          appUser: true,
          unableToReach: false,
          imageUrl: 'https://example.com/images/user.jpg'
        }
      ],
      heading: 'Summer Concert - Practice',
      description: 'Practice session for summer concerts 2025. We meet in the music room at Example School. Bring sheet music and instruments.',
      startTimestamp: getRelativeTimeISO({ days: 30, hours: 18 }),
      endTimestamp: getRelativeTimeISO({ days: 30, hours: 20 }),
      inviteTime: getRelativeTimeISO({ days: 27, hours: 18 }),
      registered: false,
      expired: true,
      location: {
        id: 'LOC_EXAMPLE_SCHOOL',
        feature: 'Example School Music Room',
        address: 'Example Street 123, 0123 Oslo',
        latitude: 59.9139,
        longitude: 10.7522,
        postalCode: '0123',
        country: 'Norway',
        administrativeAreaLevel1: 'Example City',
        administrativeAreaLevel2: 'Example City'
      },
      recipients: {
        group: {
          id: 'ABBCC22A87EF4513913022D56D58569F',
          contactPersonId: 'CONTACT_JANE',
          name: 'Example Music Corps',
          imageUrl: 'https://example.com/images/group.jpg',
          createdTime: 1691505528000,
          members: []
        }
      },
      responses: {
        acceptedIds: [],
        declinedIds: [],
        unansweredIds: [],
        waitinglistIds: [],
        unconfirmedIds: []
      }
    },
    {
      id: 'FE5E94BA079947CB98302FFF6C931963',
      creatorId: 'CREATOR_GAMING_001',
      owners: [
        {
          id: 'OWNER_GAMING_001',
          response: 'accepted',
          firstName: 'John',
          lastName: 'Smith',
          email: 'john.smith@example.com',
          phoneNumber: '+47 123 45 679',
          appUser: true,
          unableToReach: false,
          imageUrl: 'https://example.com/images/john.jpg'
        }
      ],
      heading: 'Gaming Center Last Session Before Summer',
      description: 'Final gaming session before summer break. Tournament starts at 6 PM.',
      startTimestamp: getRelativeTimeISO({ days: 35, hours: 18 }),
      endTimestamp: getRelativeTimeISO({ days: 35, hours: 22 }),
      inviteTime: getRelativeTimeISO({ days: 32, hours: 18 }),
      registered: false,
      expired: true,
      location: {
        id: 'LOC_GAMING_CENTER',
        feature: 'Gaming Center Main Hall',
        address: 'Gaming Street 456, 0124 Oslo',
        latitude: 59.9150,
        longitude: 10.7530,
        postalCode: '0124',
        country: 'Norway',
        administrativeAreaLevel1: 'Example City',
        administrativeAreaLevel2: 'Example City'
      },
      recipients: {
        group: {
          id: 'GROUP_GAMING_CENTER',
          contactPersonId: 'CONTACT_JOHN',
          name: 'Gaming Center Junior',
          imageUrl: 'https://example.com/images/gaming.jpg',
          createdTime: 1691505528000,
          members: []
        }
      },
      responses: {
        acceptedIds: [],
        declinedIds: [],
        unansweredIds: [],
        waitinglistIds: [],
        unconfirmedIds: []
      }
    },
    {
      id: '209AB44159AD4C5C88054C44A3F51CA0',
      creatorId: 'CREATOR_SPORTS_001',
      owners: [
        {
          id: 'OWNER_SPORTS_001',
          response: 'accepted',
          firstName: 'Mike',
          lastName: 'Wilson',
          email: 'mike.wilson@example.com',
          phoneNumber: '+47 123 45 681',
          appUser: true,
          unableToReach: false,
          imageUrl: 'https://example.com/images/mike.jpg'
        }
      ],
      heading: 'Handball Training Session',
      description: 'Weekly handball training for G2013 team. Bring water and proper shoes.',
      startTimestamp: getRelativeTimeISO({ days: 40, hours: 16 }),
      endTimestamp: getRelativeTimeISO({ days: 40, hours: 18 }),
      inviteTime: getRelativeTimeISO({ days: 37, hours: 16 }),
      registered: false,
      expired: true,
      location: {
        id: 'LOC_SPORTS_HALL',
        feature: 'Sports Hall A',
        address: 'Sports Street 321, 0126 Oslo',
        latitude: 59.9170,
        longitude: 10.7550,
        postalCode: '0126',
        country: 'Norway',
        administrativeAreaLevel1: 'Example City',
        administrativeAreaLevel2: 'Example City'
      },
      recipients: {
        group: {
          id: 'GROUP_SPORTS_HANDBALL',
          contactPersonId: 'CONTACT_MIKE',
          name: 'Example Sports Club Handball G2013',
          imageUrl: 'https://example.com/images/handball.jpg',
          createdTime: 1691505528000,
          members: []
        }
      },
      responses: {
        acceptedIds: [],
        declinedIds: [],
        unansweredIds: [],
        waitinglistIds: [],
        unconfirmedIds: []
      }
    },
    {
      id: 'B4097F9546E2418EBF43CC92A8B906A0',
      creatorId: 'CREATOR_FLEA_001',
      owners: [
        {
          id: 'OWNER_FLEA_001',
          response: 'accepted',
          firstName: 'Sarah',
          lastName: 'Johnson',
          email: 'sarah.johnson@example.com',
          phoneNumber: '+47 123 45 680',
          appUser: true,
          unableToReach: false,
          imageUrl: 'https://example.com/images/sarah.jpg'
        }
      ],
      heading: 'Community Flea Market Setup',
      description: 'Help us set up for the annual community flea market. Volunteers needed!',
      startTimestamp: getRelativeTimeISO({ days: 45, hours: 9 }),
      endTimestamp: getRelativeTimeISO({ days: 45, hours: 17 }),
      inviteTime: null,
      registered: false,
      expired: false,
      location: {
        id: 'LOC_COMMUNITY_CENTER',
        feature: 'Community Center Plaza',
        address: 'Community Street 789, 0125 Oslo',
        latitude: 59.9160,
        longitude: 10.7540,
        postalCode: '0125',
        country: 'Norway',
        administrativeAreaLevel1: 'Example City',
        administrativeAreaLevel2: 'Example City'
      },
      recipients: {
        group: {
          id: 'GROUP_FLEA_MARKET',
          contactPersonId: 'CONTACT_SARAH',
          name: 'Community Flea Market 2025',
          imageUrl: 'https://example.com/images/flea.jpg',
          createdTime: 1691505528000,
          members: []
        }
      },
      responses: {
        acceptedIds: [],
        declinedIds: [],
        unansweredIds: [],
        waitinglistIds: [],
        unconfirmedIds: []
      }
    }
  ];
}

// Lazy-loaded events with caching
let _mockEventsCache: SpondEvent[] | null = null;

export const MOCK_EVENTS: SpondEvent[] = new Proxy([] as SpondEvent[], {
  get(target, prop) {
    if (!_mockEventsCache) {
      _mockEventsCache = createMockEvents();
    }
    return _mockEventsCache[prop as keyof SpondEvent[]];
  },
  has(target, prop) {
    if (!_mockEventsCache) {
      _mockEventsCache = createMockEvents();
    }
    return prop in _mockEventsCache;
  },
  ownKeys(_target) {
    if (!_mockEventsCache) {
      _mockEventsCache = createMockEvents();
    }
    return Object.keys(_mockEventsCache);
  },
  getOwnPropertyDescriptor(target, prop) {
    if (!_mockEventsCache) {
      _mockEventsCache = createMockEvents();
    }
    return Object.getOwnPropertyDescriptor(_mockEventsCache, prop);
  }
});

// Reset cache for testing
export function resetMockEventsCache(): void {
  _mockEventsCache = null;
}

export const MOCK_POSTS: SpondPost[] = [
  {
    id: 'POST_001',
    type: 'PLAIN',
    groupId: 'GROUP_GAMING_CENTER',
    subGroupIds: [],
    title: 'Welcome to Gaming Center!',
    body: 'Welcome everyone to our gaming center community! We are excited to have you all join us for gaming sessions, tournaments, and fun activities. Please remember to bring your own headphones and follow our community guidelines.',
    ownerId: 'OWNER_001',
    timestamp: '2024-06-20T10:30:00.000Z',
    media: [],
    reactions: {},
    attachments: [],
    visibility: 'ALL',
    unread: false,
    commentsDisabled: false,
    seenCount: 12,
    muted: false,
    selectMemberPoll: false,
    comments: [
      {
        id: 'COMMENT_001',
        fromProfileId: 'MEMBER_001',
        timestamp: '2024-06-20T11:00:00.000Z',
        text: 'Thanks for the warm welcome! Looking forward to the sessions.'
      }
    ]
  },
  {
    id: 'POST_002',
    type: 'PLAIN',
    groupId: 'GROUP_MUSIC',
    subGroupIds: [],
    title: 'Event Reminder: Summer Concert',
    body: 'Just a reminder that our summer concert is coming up next week! We will be performing at the community center on Saturday at 7 PM. Please make sure to arrive by 6 PM for setup and sound check.',
    ownerId: 'OWNER_002',
    timestamp: '2024-06-22T14:00:00.000Z',
    media: [],
    reactions: {},
    attachments: [],
    visibility: 'ALL',
    unread: false,
    commentsDisabled: false,
    seenCount: 8,
    muted: false,
    selectMemberPoll: false
  },
  {
    id: 'POST_003',
    type: 'PLAIN',
    groupId: 'GROUP_FLEA_MARKET',
    subGroupIds: [],
    title: 'Flea Market Preparations',
    body: 'Hi everyone! We need volunteers for the upcoming flea market. We need help with setup, managing stalls, and cleanup. Please let us know if you can help!',
    ownerId: 'OWNER_003',
    timestamp: '2024-06-15T09:00:00.000Z',
    media: [],
    reactions: {},
    attachments: [],
    visibility: 'ALL',
    unread: true,
    commentsDisabled: false,
    seenCount: 15,
    muted: false,
    selectMemberPoll: false
  }
];

export const MOCK_GROUPS: SpondGroup[] = [
  {
    id: 'GROUP_GAMING_CENTER',
    name: 'Gaming Center Junior',
    activity: 'esports',
    createdTime: '2022-08-12T09:10:36Z',
    members: []
  },
  {
    id: 'GROUP_MUSIC',
    name: 'Community Music Band',
    activity: 'music',
    createdTime: '2023-05-14T20:06:23Z',
    members: []
  },
  {
    id: 'GROUP_FLEA_MARKET',
    name: 'Community Flea Market 2025',
    activity: 'social',
    createdTime: '2024-01-01T00:00:00Z',
    members: []
  }
];

export function getMockGroups(): SpondGroup[] {
  return MOCK_GROUPS;
}