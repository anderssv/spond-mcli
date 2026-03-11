import { SpondEvent, SpondEventsQueryParams, SpondPost, SpondPostsQueryParams, SpondGroup } from './domain-types.js';

export interface ISpondClient {
  getEvents(params?: SpondEventsQueryParams): Promise<SpondEvent[]>;
  getEventById(eventId: string): Promise<SpondEvent | null>;
  getUpcomingEvents(maxResults?: number, addProfileInfo?: boolean): Promise<SpondEvent[]>;
  getEventsByGroup(groupName: string, maxResults?: number, filterParams?: Partial<SpondEventsQueryParams>): Promise<SpondEvent[]>;
  searchEvents(searchTerm: string, maxResults?: number): Promise<SpondEvent[]>;
  
  getPosts(params?: SpondPostsQueryParams): Promise<SpondPost[]>;
  getPostById(postId: string): Promise<SpondPost | null>;
  getPostsByGroup(groupName: string, maxResults?: number): Promise<SpondPost[]>;
  searchPosts(searchTerm: string, maxResults?: number): Promise<SpondPost[]>;
  
  getGroups(): Promise<SpondGroup[]>;
  
  sendEventResponse(eventId: string, memberId: string, accepted: boolean): Promise<void>;
  
  fetchAttachmentToFile(url: string, filePath: string, groupId: string): Promise<string>;
  getGroupFiles(groupId: string): Promise<any>;
  fetchGroupFileToFile(fileUrl: string, filePath: string, groupId: string): Promise<string>;
  
  getCurrentUserProfileId(): string | undefined;
}