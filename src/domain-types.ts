export { AttendanceStatus, RegistrationStatus, calculateRegistrationStatus, resolveMyMembers, MyMember, extractAccessToken, matchesSearchTerm, matchesFilename, isContentSearchable, getConverterCommand } from './domain-logic.js';

export interface FileResource {
  id: string;
  name: string;
  url: string;
  type: string;
  mediaType?: string;
  size?: number;
}

export interface FileSearchResult {
  matchType: 'filename' | 'content';
  id: string;
  name: string;
  type: string;
  url: string;
  groupId: string;
  groupName: string;
}

export interface SpondEvent {
  id: string;
  creatorId: string;
  owners: Array<{
    id: string;
    response: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    appUser: boolean;
    unableToReach: boolean;
    imageUrl?: string;
  }>;
  heading: string;
  description: string;
  startTimestamp: string;
  endTimestamp: string;
  inviteTime?: string | null;
  registered?: boolean;
  expired?: boolean;
  location?: {
    id: string;
    feature: string;
    address: string;
    latitude: number;
    longitude: number;
    postalCode: string;
    country: string;
    administrativeAreaLevel1: string;
    administrativeAreaLevel2: string;
  };
  recipients: {
    group: {
      id: string;
      contactPersonId: string;
      name: string;
      imageUrl?: string;
      createdTime: number;
      members: Array<{
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phoneNumber?: string;
        respondent: boolean;
        guardians?: Array<{
          id: string;
          firstName: string;
          lastName: string;
          profile?: {
            contactMethod: string;
            id: string;
            firstName: string;
            lastName: string;
            email?: string;
            phoneNumber?: string;
            imageUrl?: string;
            unableToReach: boolean;
          };
        }>;
        profile?: {
          contactMethod: string;
          id: string;
          firstName: string;
          lastName: string;
          email?: string;
          phoneNumber?: string;
          imageUrl?: string;
          unableToReach: boolean;
        };
      }>;
    };
  };
  responses?: {
    acceptedIds: string[];
    declinedIds: string[];
    unansweredIds: string[];
    waitinglistIds: string[];
    unconfirmedIds: string[];
  };
}

export interface SpondGroup {
  id: string;
  contactPersonId?: string;
  contactPerson?: {
    contactMethod: string;
    id: string;
    email?: string;
    firstName: string;
    lastName: string;
    phoneNumber?: string;
    unableToReach: boolean;
  };
  name: string;
  activity?: string;
  imageUrl?: string;
  createdTime: string;
  members: Array<{
    id: string;
    firstName: string;
    lastName: string;
    email?: string;
    phoneNumber?: string;
    createdTime: string;
    guardians?: Array<{
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber?: string;
      profile?: {
        contactMethod: string;
        id: string;
        firstName: string;
        lastName: string;
        email?: string;
        phoneNumber?: string;
        imageUrl?: string;
        unableToReach: boolean;
      };
    }>;
    profile?: {
      contactMethod: string;
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phoneNumber?: string;
      imageUrl?: string;
      unableToReach: boolean;
    };
    subGroups?: string[];
    roles?: string[];
    fields?: Record<string, any>;
    respondent: boolean;
    imageUrl?: string;
    dateOfBirth?: string;
    verifiedDateOfBirth?: boolean;
    address?: string[];
  }>;
}

export interface SpondEventsQueryParams {
  includeComments?: boolean;
  includeHidden?: boolean;
  addProfileInfo?: boolean;
  scheduled?: boolean;
  order?: 'asc' | 'desc';
  max?: number;
  minEndTimestamp?: string;
  maxEndTimestamp?: string;
  groupId?: string;
}

export interface SpondPost {
  id: string;
  // The API's own discriminator on the response. Requesting `type=PAYMENT`
  // returns items whose actual type is "CLUB_PAYMENT" (or possibly others) —
  // this is intentionally looser than SpondPostsQueryParams['type'].
  type: 'PLAIN' | 'POLL' | 'CLUB_PAYMENT' | string;
  groupId: string;
  subGroupIds?: string[];
  // PLAIN posts have title/body; POLL and (CLUB_)PAYMENT posts carry their
  // content in `poll`/`clubPayment` instead and may omit these entirely.
  title?: string;
  body?: string;
  poll?: {
    id: string;
    question: string;
    description?: string;
    multipleChoice: boolean;
    dueBy?: string;
    expired?: boolean;
    options: Array<{
      id: string;
      text: string;
      votes: string[];
    }>;
    blankVotes?: string[];
    behalfOfIds?: string[];
  };
  clubPayment?: {
    id: string;
    title: string;
    clubName?: string;
    currency?: string;
    status?: string;
    amount?: number;
    amountFormatted?: string;
  };
  dueTimestamp?: string;
  ownerId: string;
  timestamp: string;
  media?: Array<{
    id: string;
    url: string;
    type: string;
  }>;
  reactions?: Record<string, Record<string, number>>;
  attachments?: Array<{
    id: string;
    name: string;
    type: string;
    url: string;
  }>;
  visibility: string;
  unread: boolean;
  commentsDisabled: boolean;
  seenCount?: number;
  muted: boolean;
  selectMemberPoll: boolean;
  comments?: Array<{
    id: string;
    fromProfileId: string;
    timestamp: string;
    text: string;
    children?: Array<{
      id: string;
      fromProfileId: string;
      timestamp: string;
      text: string;
      reactions?: Record<string, Record<string, number>>;
    }>;
    reactions?: Record<string, Record<string, number>>;
  }>;
}

export interface SpondPostsQueryParams {
  type?: 'PLAIN' | 'POLL' | 'PAYMENT';
  includeComments?: boolean;
  includeReadStatus?: boolean;
  includeSeenCount?: boolean;
  max?: number;
  groupId?: string;
  createdAfter?: string;
  createdBefore?: string;
}