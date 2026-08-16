import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { ISpondClient } from './spond-client-interface.js';
import { SpondEvent, SpondEventsQueryParams, SpondPost, SpondPostsQueryParams, SpondGroup } from './domain-types.js';
import { MOCK_EVENTS, MOCK_POSTS, getMockGroups } from './mock-data.js';

export class SpondClientFake implements ISpondClient {
  private events: SpondEvent[] = [];
  private posts: SpondPost[] = [];
  private groups: SpondGroup[] = [];
  private shouldFailNextCall = false;
  private nextErrorMessage = 'Network error';
  private readonly userProfileId: string | undefined;
  private fileContents = new Map<string, string>();

  constructor(userProfileId?: string) {
    this.userProfileId = userProfileId ?? 'fake-user-profile-id';
  }

  /**
   * Creates a SpondClientFake pre-loaded with realistic mock data.
   * Used for production demo mode (SPOND_TOKEN="mock-data").
   */
  static withMockData(): SpondClientFake {
    const fake = new SpondClientFake('MOCK00000000000000000000000USER');
    fake.events = [...MOCK_EVENTS];
    fake.posts = [...MOCK_POSTS];
    fake.groups = [...getMockGroups()];
    return fake;
  }

  // --- Test control methods ---

  setFailNextCall(shouldFail: boolean, errorMessage = 'Network error'): void {
    this.shouldFailNextCall = shouldFail;
    this.nextErrorMessage = errorMessage;
  }

  addEvent(event: SpondEvent): void {
    this.events.push(event);
  }

  addGroup(group: SpondGroup): void {
    this.groups.push(group);
  }

  addPost(post: SpondPost): void {
    this.posts.push(post);
  }

  clearAllData(): void {
    this.events = [];
    this.posts = [];
    this.groups = [];
  }

  clearGroups(): void {
    this.groups = [];
  }

  // --- ISpondClient implementation ---

  async getCurrentUserProfileId(): Promise<string | undefined> {
    return this.userProfileId;
  }

  async getEvents(params: SpondEventsQueryParams = {}): Promise<SpondEvent[]> {
    this.throwIfShouldFail();

    let filteredEvents = [...this.events];

    if (params.groupId) {
      filteredEvents = filteredEvents.filter(
        event => event.recipients?.group?.id === params.groupId
      );
    }

    if (params.minEndTimestamp) {
      const minDate = new Date(params.minEndTimestamp);
      filteredEvents = filteredEvents.filter(
        event => new Date(event.endTimestamp) >= minDate
      );
    }

    if (params.maxEndTimestamp) {
      const maxDate = new Date(params.maxEndTimestamp);
      filteredEvents = filteredEvents.filter(
        event => new Date(event.endTimestamp) <= maxDate
      );
    }

    if (params.order === 'desc') {
      filteredEvents.sort((a, b) =>
        new Date(b.startTimestamp).getTime() - new Date(a.startTimestamp).getTime()
      );
    } else {
      filteredEvents.sort((a, b) =>
        new Date(a.startTimestamp).getTime() - new Date(b.startTimestamp).getTime()
      );
    }

    if (params.max) {
      filteredEvents = filteredEvents.slice(0, params.max);
    }

    return filteredEvents;
  }

  async getEventById(eventId: string): Promise<SpondEvent | null> {
    this.throwIfShouldFail();
    return this.events.find(e => e.id === eventId) || null;
  }

  async getUpcomingEvents(maxResults: number = 20, _addProfileInfo: boolean = false): Promise<SpondEvent[]> {
    this.throwIfShouldFail();

    const now = new Date();
    return this.events
      .filter(event => new Date(event.endTimestamp) > now)
      .sort((a, b) => new Date(a.startTimestamp).getTime() - new Date(b.startTimestamp).getTime())
      .slice(0, maxResults);
  }

  async getEventsByGroup(groupName: string, maxResults: number = 50, filterParams: Partial<SpondEventsQueryParams> = {}): Promise<SpondEvent[]> {
    this.throwIfShouldFail();

    // Two-phase approach matching real client:
    // 1. Look up matching groups by name
    const groups = await this.getGroups();
    const groupNameLower = groupName.toLowerCase();
    const matchingGroups = groups.filter(group =>
      group.name?.toLowerCase().includes(groupNameLower)
    );

    if (matchingGroups.length > 0) {
      // 2a. Fetch events for each matching group and merge results
      const eventArrays = await Promise.all(
        matchingGroups.map(group =>
          this.getEvents({
            max: maxResults,
            groupId: group.id,
            ...filterParams
          })
        )
      );
      return eventArrays.flat().slice(0, maxResults);
    } else {
      // 2b. Fallback to name-based filtering if no group found
      const events = await this.getEvents({
        max: maxResults,
        ...filterParams
      });

      return events.filter(event =>
        event.recipients?.group?.name?.toLowerCase().includes(groupNameLower)
      );
    }
  }

  async searchEvents(searchTerm: string, maxResults: number = 50): Promise<SpondEvent[]> {
    this.throwIfShouldFail();

    const searchLower = searchTerm.toLowerCase();
    return this.events
      .filter(event =>
        event.heading?.toLowerCase().includes(searchLower) ||
        event.description?.toLowerCase().includes(searchLower) ||
        event.recipients?.group?.name?.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);
  }

  async getPosts(params: SpondPostsQueryParams = {}): Promise<SpondPost[]> {
    this.throwIfShouldFail();

    let filteredPosts = [...this.posts];

    if (params.type) {
      // Mirrors the real API: requesting type=PAYMENT returns posts whose
      // actual `type` is CLUB_PAYMENT.
      filteredPosts = filteredPosts.filter(post =>
        params.type === 'PAYMENT' ? post.type === 'CLUB_PAYMENT' : post.type === params.type
      );
    }

    if (params.groupId) {
      filteredPosts = filteredPosts.filter(post => post.groupId === params.groupId);
    }

    if (params.createdAfter) {
      const afterDate = new Date(params.createdAfter);
      filteredPosts = filteredPosts.filter(
        post => new Date(post.timestamp) > afterDate
      );
    }

    if (params.createdBefore) {
      const beforeDate = new Date(params.createdBefore);
      filteredPosts = filteredPosts.filter(
        post => new Date(post.timestamp) < beforeDate
      );
    }

    // Sort newest first
    filteredPosts.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return filteredPosts.slice(0, params.max || 5);
  }

  async getPostById(postId: string): Promise<SpondPost | null> {
    this.throwIfShouldFail();
    return this.posts.find(p => p.id === postId) || null;
  }

  async getPostsByGroup(groupName: string, maxResults: number = 50): Promise<SpondPost[]> {
    this.throwIfShouldFail();

    const groupNameLower = groupName.toLowerCase();
    const matchingGroups = this.groups.filter(group =>
      group.name?.toLowerCase().includes(groupNameLower)
    );

    const groupIds = matchingGroups.map(group => group.id);
    return this.posts
      .filter(post => groupIds.includes(post.groupId))
      .slice(0, maxResults);
  }

  async searchPosts(searchTerm: string, maxResults: number = 50): Promise<SpondPost[]> {
    this.throwIfShouldFail();

    const searchLower = searchTerm.toLowerCase();
    return this.posts
      .filter(post =>
        post.title?.toLowerCase().includes(searchLower) ||
        post.body?.toLowerCase().includes(searchLower)
      )
      .slice(0, maxResults);
  }

  async getGroups(): Promise<SpondGroup[]> {
    this.throwIfShouldFail();
    return [...this.groups];
  }

  async sendEventResponse(_eventId: string, _memberId: string, _accepted: boolean): Promise<void> {
    this.throwIfShouldFail();
  }

  async fetchAttachmentToFile(url: string, filePath: string, _groupId: string): Promise<string> {
    this.throwIfShouldFail();

    const dir = dirname(filePath);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    writeFileSync(filePath, `Mock attachment content for URL: ${url}`);
    return `Mock attachment saved to: ${filePath}`;
  }

  async getGroupFiles(groupId: string): Promise<any> {
    this.throwIfShouldFail();

    return {
      id: groupId,
      name: '_RESOURCES_ROOT',
      visibility: 'ALL',
      groupId: groupId,
      resources: [
        {
          id: 'file1',
          parentId: groupId,
          name: 'meeting-notes.pdf',
          url: 'https://spond.com/storage/upload/group/file1',
          groupId: groupId,
          type: 'PDF',
          mediaType: 'application/pdf',
          size: 1024000,
          creatorId: 'creator1',
          createdAt: 1640995800000
        },
        {
          id: 'file2',
          parentId: groupId,
          name: 'team-photo.jpg',
          url: 'https://spond.com/storage/upload/group/file2',
          groupId: groupId,
          type: 'IMAGE',
          mediaType: 'image/jpeg',
          size: 512000,
          creatorId: 'creator2',
          createdAt: 1641427200000
        }
      ],
      itemCount: 2,
      systemFolder: true
    };
  }

  async fetchGroupFileToFile(fileUrl: string, filePath: string, groupId: string): Promise<string> {
    return this.fetchAttachmentToFile(fileUrl, filePath, groupId);
  }

  setFileContent(resourceId: string, text: string): void {
    this.fileContents.set(resourceId, text);
  }

  async extractFileText(resource: { id: string }): Promise<string | null> {
    return this.fileContents.get(resource.id) ?? null;
  }

  // --- Internal ---

  private throwIfShouldFail(): void {
    if (this.shouldFailNextCall) {
      this.shouldFailNextCall = false;
      throw new Error(this.nextErrorMessage);
    }
  }
}
