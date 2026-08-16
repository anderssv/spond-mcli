import { SpondEvent, SpondEventsQueryParams, SpondPost, SpondPostsQueryParams, SpondGroup, AttendanceStatus, calculateRegistrationStatus, resolveMyMembers, matchesSearchTerm, matchesFilename, isContentSearchable, FileResource, FileSearchResult } from './domain-types.js';
import { ISpondClient } from './spond-client-interface.js';
import { convertFileToText } from './file-converter.js';

// Custom error types to avoid MCP SDK dependency
export enum CoreErrorCode {
  InvalidParams = -32602,
  MethodNotFound = -32601,
  InternalError = -32603
}

// Result type enum for tool calls
export enum ToolCallResultType {
  Success = 'success',
  NotFound = 'not_found'
}

export class CoreError extends Error {
  constructor(public code: CoreErrorCode, message: string) {
    super(message);
    this.name = 'CoreError';
  }
}

function requireParams<T extends Record<string, unknown>>(params: T, ...names: (keyof T & string)[]): void {
  for (const name of names) {
    if (!params[name]) {
      throw new CoreError(CoreErrorCode.InvalidParams, `${name} is required`);
    }
  }
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: any;
}

export interface ResourceDefinition {
  uri: string;
  mimeType: string;
  name: string;
  description: string;
}

// Core interface types - return structured data instead of text
export type ToolCallResult = {
  data: any; // The actual data object (events, posts, groups, etc.)
  type?: ToolCallResultType; // Optional result type
};

export type ResourceReadResult = {
  data: any; // The actual data object
  uri: string;
};

export class SpondCore {
  private spondClient: ISpondClient;

  constructor(spondClient: ISpondClient) {
    this.spondClient = spondClient;
  }

  async getGroups() {
    const groups = await this.spondClient.getGroups();
    return groups.map(group => this.createGroupSummary(group));
  }

  async getEvents(params: SpondEventsQueryParams = {}) {
    const events = await this.spondClient.getEvents(params);
    const userProfileId = await this.resolveUserProfileId();
    return events.map(event => this.createEventSummary(event, userProfileId));
  }

  async getEventById(eventId: string, includeMembers: boolean = false) {
    const event = await this.spondClient.getEventById(eventId);
    if (!event) return null;

    if (!includeMembers && event.recipients?.group?.members) {
      return {
        ...event,
        recipients: {
          ...event.recipients,
          group: {
            ...event.recipients.group,
            members: []
          }
        }
      };
    }

    return event;
  }

  async getUpcomingEvents(maxResults: number = 20, addProfileInfo: boolean = false) {
    const events = await this.spondClient.getUpcomingEvents(maxResults, addProfileInfo);
    const userProfileId = await this.resolveUserProfileId();
    return events.map(event => this.createEventSummary(event, userProfileId));
  }

  async searchEvents(searchTerm: string, maxResults: number = 50) {
    const events = await this.spondClient.searchEvents(searchTerm, maxResults);
    const userProfileId = await this.resolveUserProfileId();
    return events.map(event => this.createEventSummary(event, userProfileId));
  }

  async getEventsByGroup(groupName: string, maxResults: number = 50, filterParams: Partial<SpondEventsQueryParams> = {}) {
    const events = await this.spondClient.getEventsByGroup(groupName, maxResults, filterParams);
    const userProfileId = await this.resolveUserProfileId();
    return events.map(event => this.createEventSummary(event, userProfileId));
  }

  async getMyMembers() {
    const groups = await this.spondClient.getGroups();
    const userProfileId = await this.spondClient.getCurrentUserProfileId();
    if (!userProfileId) {
      throw new CoreError(CoreErrorCode.InternalError, 'Could not determine the current user\'s profile ID');
    }
    return resolveMyMembers(groups, userProfileId);
  }

  async getPosts(params: SpondPostsQueryParams = {}) {
    const posts = await this.spondClient.getPosts(params);
    const groups = await this.spondClient.getGroups();
    return posts.map(post => this.createPostSummary(post, groups));
  }

  async getPostById(postId: string) {
    return await this.spondClient.getPostById(postId);
  }

  async searchPosts(searchTerm: string, maxResults: number = 50) {
    const posts = await this.spondClient.searchPosts(searchTerm, maxResults);
    const groups = await this.spondClient.getGroups();
    return posts.map(post => this.createPostSummary(post, groups));
  }

  async searchAll(searchTerm: string, maxResults: number = 50) {
    const postTypes: Array<'PLAIN' | 'POLL' | 'PAYMENT'> = ['PLAIN', 'POLL', 'PAYMENT'];

    const [events, ...postLists] = await Promise.all([
      this.spondClient.searchEvents(searchTerm, maxResults),
      ...postTypes.map(type => this.spondClient.getPosts({ type, max: maxResults }))
    ]);

    const [userProfileId, groups] = await Promise.all([
      this.resolveUserProfileId(),
      this.spondClient.getGroups()
    ]);

    const eventResults = events.map(event => ({
      kind: 'event' as const,
      ...this.createEventSummary(event, userProfileId)
    }));

    const matchingPosts = postLists.flat().filter(post => matchesSearchTerm(post, searchTerm));
    const postResults = matchingPosts.map(post => ({
      kind: 'post' as const,
      ...this.createPostSummary(post, groups)
    }));

    const sortKey = (result: Record<string, unknown>) =>
      new Date((result.startTime ?? result.timestamp ?? 0) as string | number).getTime();

    return [...eventResults, ...postResults]
      .sort((a, b) => sortKey(b) - sortKey(a))
      .slice(0, maxResults);
  }

  async getPostsByGroup(groupName: string, maxResults: number = 50) {
    const posts = await this.spondClient.getPostsByGroup(groupName, maxResults);
    const groups = await this.spondClient.getGroups();
    return posts.map(post => this.createPostSummary(post, groups));
  }

  async getAttachment(url: string, groupId: string, filePath: string) {
    return await this.spondClient.fetchAttachmentToFile(url, filePath, groupId);
  }

  async getGroupFiles(groupId: string) {
    return await this.spondClient.getGroupFiles(groupId);
  }

  async getGroupFile(fileUrl: string, groupId: string, filePath: string) {
    return await this.spondClient.fetchGroupFileToFile(fileUrl, filePath, groupId);
  }

  async acceptEvent(eventId: string, memberId: string) {
    try {
      await this.spondClient.sendEventResponse(eventId, memberId, true);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new CoreError(CoreErrorCode.InternalError,
        `Failed to accept event: ${msg}. Check the event's registration status — it may not be open for responses yet.`);
    }
  }

  async declineEvent(eventId: string, memberId: string) {
    try {
      await this.spondClient.sendEventResponse(eventId, memberId, false);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      throw new CoreError(CoreErrorCode.InternalError,
        `Failed to decline event: ${msg}. Check the event's registration status — it may not be open for responses yet.`);
    }
  }

  getToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'get_events',
        description: 'Get Spond events with optional filtering parameters',
        inputSchema: {
          type: 'object',
          properties: {
            includeComments: {
              type: 'boolean',
              description: 'Include comments in the response',
              default: true
            },
            includeHidden: {
              type: 'boolean',
              description: 'Include hidden events',
              default: false
            },
            addProfileInfo: {
              type: 'boolean',
              description: 'Include profile information',
              default: true
            },
            scheduled: {
              type: 'boolean',
              description: 'Only include scheduled events',
              default: true
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order for events',
              default: 'asc'
            },
            max: {
              type: 'number',
              description: 'Maximum number of events to return',
              default: 20,
              minimum: 1,
              maximum: 100
            },
            minEndTimestamp: {
              type: 'string',
              description: 'Minimum end timestamp (ISO 8601 format)',
              format: 'date-time'
            },
            maxEndTimestamp: {
              type: 'string',
              description: 'Maximum end timestamp (ISO 8601 format)',
              format: 'date-time'
            },
            groupId: {
              type: 'string',
              description: 'Filter events by specific group ID'
            }
          }
        }
      },
      {
        name: 'get_event_by_id',
        description: 'Get a specific Spond event by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'The unique ID of the event'
            },
            includeMembers: {
              type: 'boolean',
              description: 'Include member/participant information in the response',
              default: false
            }
          },
          required: ['eventId']
        }
      },
      {
        name: 'get_upcoming_events',
        description: 'Get upcoming Spond events (events ending in the future)',
        inputSchema: {
          type: 'object',
          properties: {
            maxResults: {
              type: 'number',
              description: 'Maximum number of events to return',
              default: 20,
              minimum: 1,
              maximum: 100
            },
            addProfileInfo: {
              type: 'boolean',
              description: 'Include profile information',
              default: false
            }
          }
        }
      },
      {
        name: 'search_events',
        description: 'Search Spond events by keyword in title, description, or group name',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to look for in events'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of events to return',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'get_events_by_group',
        description: 'Get events from a specific group by group name',
        inputSchema: {
          type: 'object',
          properties: {
            groupName: {
              type: 'string',
              description: 'Name or partial name of the group'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of events to return',
              default: 50,
              minimum: 1,
              maximum: 100
            },
            includeComments: {
              type: 'boolean',
              description: 'Include comments in the response',
              default: true
            },
            includeHidden: {
              type: 'boolean',
              description: 'Include hidden events',
              default: false
            },
            addProfileInfo: {
              type: 'boolean',
              description: 'Include profile information',
              default: true
            },
            scheduled: {
              type: 'boolean',
              description: 'Only include scheduled events',
              default: true
            },
            order: {
              type: 'string',
              enum: ['asc', 'desc'],
              description: 'Sort order for events',
              default: 'asc'
            },
            minEndTimestamp: {
              type: 'string',
              description: 'Minimum end timestamp (ISO 8601 format)',
              format: 'date-time'
            },
            maxEndTimestamp: {
              type: 'string',
              description: 'Maximum end timestamp (ISO 8601 format)',
              format: 'date-time'
            }
          },
          required: ['groupName']
        }
      },
      {
        name: 'get_posts',
        description: 'Get Spond posts/messages with optional filtering parameters',
        inputSchema: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['PLAIN', 'POLL', 'PAYMENT'],
              description: 'Type of posts to fetch',
              default: 'PLAIN'
            },
            includeComments: {
              type: 'boolean',
              description: 'Include comments in the response',
              default: true
            },
            includeReadStatus: {
              type: 'boolean',
              description: 'Include read status information',
              default: true
            },
            includeSeenCount: {
              type: 'boolean',
              description: 'Include seen count information',
              default: true
            },
            max: {
              type: 'number',
              description: 'Maximum number of posts to return',
              default: 5,
              minimum: 1,
              maximum: 100
            },
            groupId: {
              type: 'string',
              description: 'Filter posts by specific group ID'
            },
            createdAfter: {
              type: 'string',
              description: 'Only include posts created after this timestamp (ISO 8601 format)',
              format: 'date-time'
            },
            createdBefore: {
              type: 'string',
              description: 'Only include posts created before this timestamp (ISO 8601 format)',
              format: 'date-time'
            }
          }
        }
      },
      {
        name: 'get_post_by_id',
        description: 'Get a specific Spond post by its ID',
        inputSchema: {
          type: 'object',
          properties: {
            postId: {
              type: 'string',
              description: 'The unique ID of the post'
            }
          },
          required: ['postId']
        }
      },
      {
        name: 'search_posts',
        description: 'Search Spond posts by keyword in title, text, or group name',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to look for in posts'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of posts to return',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'search_all',
        description: 'Search across everything at once — events, plain posts, polls, and payment requests — by keyword. Each result is tagged with kind ("event" or "post") so you can tell them apart.',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to look for'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of combined results to return',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'search_files',
        description: 'Search group files by filename, across all your groups by default (or one group with groupName). Spond has no unified search including files, so this is separate from search_all. Set content=true to also download and text-search inside PDF/DOCX file contents — this is much slower since every candidate file is downloaded and converted, so it is opt-in and requires pdftotext/docx2txt to be installed.',
        inputSchema: {
          type: 'object',
          properties: {
            searchTerm: {
              type: 'string',
              description: 'Search term to look for in filenames (and file contents if content=true)'
            },
            groupName: {
              type: 'string',
              description: 'Restrict the search to groups whose name contains this (optional — searches all groups if omitted)'
            },
            content: {
              type: 'boolean',
              description: 'Also search inside PDF/DOCX file contents, not just filenames. Slower — downloads and converts each candidate file.',
              default: false
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of results to return',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          required: ['searchTerm']
        }
      },
      {
        name: 'get_posts_by_group',
        description: 'Get posts from a specific group by group name',
        inputSchema: {
          type: 'object',
          properties: {
            groupName: {
              type: 'string',
              description: 'Name or partial name of the group'
            },
            maxResults: {
              type: 'number',
              description: 'Maximum number of posts to return',
              default: 50,
              minimum: 1,
              maximum: 100
            }
          },
          required: ['groupName']
        }
      },
      {
        name: 'get_groups',
        description: 'Get all Spond groups that the user is a member of',
        inputSchema: {
          type: 'object',
          properties: {},
          additionalProperties: false
        }
      },
      {
        name: 'get_attachment',
        description: 'Fetch and save a Spond attachment to a specified file path using authenticated requests',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'The URL of the attachment to fetch'
            },
            groupId: {
              type: 'string',
              description: 'The Spond group ID that posted this attachment (required for authentication)'
            },
            filePath: {
              type: 'string',
              description: 'Full file path (including filename) where to save the attachment. Usually a temporary storage.'
            }
          },
          required: ['url', 'groupId', 'filePath']
        }
      },
      {
        name: 'get_group_files',
        description: 'Get files from a specific Spond group',
        inputSchema: {
          type: 'object',
          properties: {
            groupId: {
              type: 'string',
              description: 'The unique ID of the group to fetch files from'
            }
          },
          required: ['groupId']
        }
      },
      {
        name: 'get_group_file',
        description: 'Fetch and save a specific file from a Spond group to a local file path',
        inputSchema: {
          type: 'object',
          properties: {
            fileUrl: {
              type: 'string',
              description: 'The URL of the file to fetch from the group'
            },
            groupId: {
              type: 'string',
              description: 'The Spond group ID that contains this file (required for authentication)'
            },
            filePath: {
              type: 'string',
              description: 'Full file path (including filename) where to save the file. Usually a temporary storage.'
            }
          },
          required: ['fileUrl', 'groupId', 'filePath']
        }
      },
      {
        name: 'convert_pdf_to_text',
        description: 'Convert a PDF file to plain text using pdftotext',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Full file path to the input PDF file'
            },
            outputPath: {
              type: 'string',
              description: 'Full file path where to save the converted text file'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'convert_docx_to_text',
        description: 'Convert a DOCX file to plain text using docx2txt',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Full file path to the input DOCX file'
            },
            outputPath: {
              type: 'string',
              description: 'Full file path where to save the converted text file'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'convert_xlsx_to_text',
        description: 'Convert an XLSX (or legacy XLS) spreadsheet to CSV text using ssconvert (part of the gnumeric package)',
        inputSchema: {
          type: 'object',
          properties: {
            inputPath: {
              type: 'string',
              description: 'Full file path to the input XLSX file'
            },
            outputPath: {
              type: 'string',
              description: 'Full file path where to save the converted CSV file'
            }
          },
          required: ['inputPath', 'outputPath']
        }
      },
      {
        name: 'accept_event',
        description: 'Accept a Spond event for a specific member. IMPORTANT: Check the event\'s registrationStatus first — only events with status "open" can be responded to. Use "get event --include-members" to find the memberId from recipients.group.members[].',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'The unique ID of the event'
            },
            memberId: {
              type: 'string',
              description: 'The member ID to respond for (from recipients.group.members[].id)'
            }
          },
          required: ['eventId', 'memberId']
        }
      },
      {
        name: 'decline_event',
        description: 'Decline a Spond event for a specific member. IMPORTANT: Check the event\'s registrationStatus first — only events with status "open" can be responded to. Use "get event --include-members" to find the memberId from recipients.group.members[].',
        inputSchema: {
          type: 'object',
          properties: {
            eventId: {
              type: 'string',
              description: 'The unique ID of the event'
            },
            memberId: {
              type: 'string',
              description: 'The member ID to respond for (from recipients.group.members[].id)'
            }
          },
          required: ['eventId', 'memberId']
        }
      }
    ];
  }

  getResourceDefinitions(): ResourceDefinition[] {
    return [
      {
        uri: 'spond://events/upcoming',
        mimeType: 'application/json',
        name: 'Upcoming Events',
        description: 'All upcoming Spond events'
      },
      {
        uri: 'spond://events/all',
        mimeType: 'application/json',
        name: 'All Events',
        description: 'All Spond events (up to 100)'
      },
      {
        uri: 'spond://posts/recent',
        mimeType: 'application/json',
        name: 'Recent Posts',
        description: 'Recent Spond posts/messages'
      },
      {
        uri: 'spond://posts/all',
        mimeType: 'application/json',
        name: 'All Posts',
        description: 'All Spond posts/messages (up to 50)'
      },
      {
        uri: 'spond://groups/all',
        mimeType: 'application/json',
        name: 'All Groups',
        description: 'All Spond groups the user is a member of'
      }
    ];
  }

  async processToolCall(toolName: string, params: any) {
    try {
      switch (toolName) {
        case 'get_events': {
          const typedParams = params as SpondEventsQueryParams;
          return {
            data: await this.getEvents(typedParams),
            type: ToolCallResultType.Success
          };
        }

        case 'get_event_by_id': {
          const { eventId, includeMembers = false } = params as { 
            eventId: string; 
            includeMembers?: boolean; 
          };
          requireParams(params, 'eventId');
          
          const event = await this.getEventById(eventId, includeMembers);
          return {
            data: event,
            type: event ? ToolCallResultType.Success : ToolCallResultType.NotFound
          };
        }

        case 'get_upcoming_events': {
          const { maxResults = 20, addProfileInfo = false } = params as { 
            maxResults?: number; 
            addProfileInfo?: boolean; 
          };
          return {
            data: await this.getUpcomingEvents(maxResults, addProfileInfo),
            type: ToolCallResultType.Success
          };
        }

        case 'search_events': {
          const { searchTerm, maxResults = 50 } = params as { 
            searchTerm: string; 
            maxResults?: number; 
          };
          requireParams(params, 'searchTerm');
          return {
            data: await this.searchEvents(searchTerm, maxResults),
            type: ToolCallResultType.Success
          };
        }

        case 'get_events_by_group': {
          const { groupName, maxResults = 50, ...filterParams } = params as { 
            groupName: string; 
            maxResults?: number;
            includeComments?: boolean;
            includeHidden?: boolean;
            addProfileInfo?: boolean;
            scheduled?: boolean;
            order?: 'asc' | 'desc';
            minEndTimestamp?: string;
            maxEndTimestamp?: string;
          };
          requireParams(params, 'groupName');
          return {
            data: await this.getEventsByGroup(groupName, maxResults, filterParams),
            type: ToolCallResultType.Success
          };
        }

        case 'get_posts': {
          const typedParams = params as SpondPostsQueryParams;
          return {
            data: await this.getPosts(typedParams),
            type: ToolCallResultType.Success
          };
        }

        case 'get_post_by_id': {
          const { postId } = params as { postId: string };
          requireParams(params, 'postId');
          const post = await this.getPostById(postId);
          return {
            data: post,
            type: post ? ToolCallResultType.Success : ToolCallResultType.NotFound
          };
        }

        case 'search_posts': {
          const { searchTerm, maxResults = 50 } = params as {
            searchTerm: string;
            maxResults?: number;
          };
          requireParams(params, 'searchTerm');
          return {
            data: await this.searchPosts(searchTerm, maxResults),
            type: ToolCallResultType.Success
          };
        }

        case 'search_all': {
          const { searchTerm, maxResults = 50 } = params as {
            searchTerm: string;
            maxResults?: number;
          };
          requireParams(params, 'searchTerm');
          return {
            data: await this.searchAll(searchTerm, maxResults),
            type: ToolCallResultType.Success
          };
        }

        case 'search_files': {
          const { searchTerm, groupName, content = false, maxResults = 50 } = params as {
            searchTerm: string;
            groupName?: string;
            content?: boolean;
            maxResults?: number;
          };
          requireParams(params, 'searchTerm');
          return {
            data: await this.searchFiles(searchTerm, { groupName, content }, maxResults),
            type: ToolCallResultType.Success
          };
        }

        case 'get_posts_by_group': {
          const { groupName, maxResults = 50 } = params as { 
            groupName: string; 
            maxResults?: number; 
          };
          requireParams(params, 'groupName');
          return {
            data: await this.getPostsByGroup(groupName, maxResults),
            type: ToolCallResultType.Success
          };
        }

        case 'get_groups': {
          return {
            data: await this.getGroups(),
            type: ToolCallResultType.Success
          };
        }

        case 'get_attachment': {
          const { url, groupId, filePath } = params as { 
            url: string; 
            groupId: string;
            filePath: string;
          };
          requireParams(params, 'url', 'groupId', 'filePath');
          return {
            data: { message: await this.getAttachment(url, groupId, filePath) },
            type: ToolCallResultType.Success
          };
        }

        case 'get_group_files': {
          const { groupId } = params as { 
            groupId: string;
          };
          requireParams(params, 'groupId');
          return {
            data: await this.getGroupFiles(groupId),
            type: ToolCallResultType.Success
          };
        }

        case 'get_group_file': {
          const { fileUrl, groupId, filePath } = params as { 
            fileUrl: string; 
            groupId: string;
            filePath: string;
          };
          requireParams(params, 'fileUrl', 'groupId', 'filePath');
          return {
            data: { message: await this.getGroupFile(fileUrl, groupId, filePath) },
            type: ToolCallResultType.Success
          };
        }

        case 'convert_pdf_to_text': {
          const { inputPath, outputPath } = params as { 
            inputPath: string; 
            outputPath: string;
          };
          requireParams(params, 'inputPath', 'outputPath');
          
          const result = await this.convertPdfToText(inputPath, outputPath);
          return {
            data: { message: result },
            type: ToolCallResultType.Success
          };
        }

        case 'convert_docx_to_text': {
          const { inputPath, outputPath } = params as {
            inputPath: string;
            outputPath: string;
          };
          requireParams(params, 'inputPath', 'outputPath');

          const result = await this.convertDocxToText(inputPath, outputPath);
          return {
            data: { message: result },
            type: ToolCallResultType.Success
          };
        }

        case 'convert_xlsx_to_text': {
          const { inputPath, outputPath } = params as {
            inputPath: string;
            outputPath: string;
          };
          requireParams(params, 'inputPath', 'outputPath');

          const result = await this.convertXlsxToText(inputPath, outputPath);
          return {
            data: { message: result },
            type: ToolCallResultType.Success
          };
        }

        case 'accept_event': {
          const { eventId, memberId } = params as { eventId: string; memberId: string };
          requireParams(params, 'eventId', 'memberId');
          await this.acceptEvent(eventId, memberId);
          return {
            data: { message: `Event ${eventId} accepted for member ${memberId}` },
            type: ToolCallResultType.Success
          };
        }

        case 'decline_event': {
          const { eventId, memberId } = params as { eventId: string; memberId: string };
          requireParams(params, 'eventId', 'memberId');
          await this.declineEvent(eventId, memberId);
          return {
            data: { message: `Event ${eventId} declined for member ${memberId}` },
            type: ToolCallResultType.Success
          };
        }

        default:
          throw new CoreError(CoreErrorCode.MethodNotFound, `Unknown tool: ${toolName}`);
      }
    } catch (error) {
      if (error instanceof CoreError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CoreError(CoreErrorCode.InternalError, `Tool execution failed: ${errorMessage}`);
    }
  }

  async processResourceRead(uri: string) {
    try {
      switch (uri) {
        case 'spond://events/upcoming': {
          const events = await this.spondClient.getUpcomingEvents(50, false);
          const userProfileId = await this.resolveUserProfileId();
          const eventSummaries = events.map(event => this.createEventSummary(event, userProfileId));
          return {
            data: eventSummaries,
            uri,
          };
        }

        case 'spond://events/all': {
          const events = await this.spondClient.getEvents({ max: 100 });
          const userProfileId = await this.resolveUserProfileId();
          const eventSummaries = events.map(event => this.createEventSummary(event, userProfileId));
          return {
            data: eventSummaries,
            uri,
          };
        }

        case 'spond://posts/recent': {
          const posts = await this.spondClient.getPosts({ max: 10 });
          const groups = await this.spondClient.getGroups();
          const postSummaries = posts.map(post => this.createPostSummary(post, groups));
          return {
            data: postSummaries,
            uri,
          };
        }

        case 'spond://posts/all': {
          const posts = await this.spondClient.getPosts({ max: 50 });
          const groups = await this.spondClient.getGroups();
          const postSummaries = posts.map(post => this.createPostSummary(post, groups));
          return {
            data: postSummaries,
            uri,
          };
        }

        case 'spond://groups/all': {
          const groups = await this.spondClient.getGroups();
          return {
            data: groups,
            uri,
          };
        }

        default:
          throw new CoreError(CoreErrorCode.InvalidParams, `Unknown resource: ${uri}`);
      }
    } catch (error) {
      if (error instanceof CoreError) {
        throw error;
      }
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new CoreError(CoreErrorCode.InternalError, `Resource read failed: ${errorMessage}`);
    }
  }

  private async resolveUserProfileId(): Promise<string | undefined> {
    try {
      return await this.spondClient.getCurrentUserProfileId();
    } catch {
      return undefined;
    }
  }

  private createEventSummary(event: SpondEvent, userProfileId?: string) {
    if (!event) {
      throw new Error('Event is undefined or null');
    }

    let childAttendanceStatus: AttendanceStatus | undefined;

    if (userProfileId && event.responses) {
      const userChildren = event.recipients?.group?.members?.filter(member => 
        member.guardians?.some(guardian => guardian.profile?.id === userProfileId)
      ) || [];
      
      if (userChildren.length > 0) {
        const childIds = userChildren.map(child => child.id);
        const hasAccepted = childIds.some(id => event.responses?.acceptedIds?.includes(id));
        const hasDeclined = childIds.some(id => event.responses?.declinedIds?.includes(id));
        const hasWaitlisted = childIds.some(id => event.responses?.waitinglistIds?.includes(id));
        const hasUnconfirmed = childIds.some(id => event.responses?.unconfirmedIds?.includes(id));
        
        if (hasAccepted) {
          childAttendanceStatus = AttendanceStatus.ACCEPTED;
        } else if (hasDeclined) {
          childAttendanceStatus = AttendanceStatus.DECLINED;
        } else if (hasWaitlisted) {
          childAttendanceStatus = AttendanceStatus.WAITLISTED;
        } else if (hasUnconfirmed) {
          childAttendanceStatus = AttendanceStatus.UNCONFIRMED;
        } else {
          childAttendanceStatus = AttendanceStatus.UNANSWERED;
        }
      }
    }
    
    const registrationStatus = calculateRegistrationStatus(event);
    
    const summary = {
      id: event.id || 'unknown-id',
      heading: event.heading || 'Unknown Event',
      groupName: event.recipients?.group?.name || 'Unknown Group',
      groupId: event.recipients?.group?.id || 'unknown',
      startTime: event.startTimestamp || 'unknown',
      endTime: event.endTimestamp || 'unknown', 
      location: event.location?.feature || event.location?.address || 'Not specified',
      description: event.description?.length > 50 ? event.description.substring(0, 50) + '...' : (event.description || 'No description'),
      registrationStatus,
      inviteTime: event.inviteTime
    };
    
    if (childAttendanceStatus !== undefined) {
      return { ...summary, attendanceStatus: childAttendanceStatus };
    }
    
    return summary;
  }

  private createPostSummary(post: SpondPost, groups: SpondGroup[]) {
    if (!post) {
      throw new Error('Post is undefined or null');
    }

    const group = groups.find(g => g.id === post.groupId);
    const title = post.title ?? post.poll?.question ?? post.clubPayment?.title;
    const body = post.body ?? post.poll?.description;

    const summary: Record<string, unknown> = {
      id: post.id,
      title,
      groupName: group?.name || 'Unknown Group',
      groupId: post.groupId,
      timestamp: post.timestamp,
      ownerId: post.ownerId,
      body: body && body.length > 100 ? body.substring(0, 100) + '...' : body,
      type: post.type,
      commentCount: post.comments?.length || 0,
      seenCount: post.seenCount || 0,
      unread: post.unread
    };

    if (post.poll) {
      summary.poll = {
        dueBy: post.poll.dueBy,
        expired: post.poll.expired,
        multipleChoice: post.poll.multipleChoice,
        options: post.poll.options.map(option => ({ text: option.text, voteCount: option.votes.length }))
      };
    }

    if (post.clubPayment) {
      summary.payment = {
        status: post.clubPayment.status,
        amountFormatted: post.clubPayment.amountFormatted,
        dueTimestamp: post.dueTimestamp
      };
    }

    return summary;
  }

  private createGroupSummary(group: SpondGroup) {
    if (!group) {
      throw new Error('Group is undefined or null');
    }
    return {
      id: group.id,
      name: group.name,
      activity: group.activity || 'Not specified',
      memberCount: group.members?.length || 0,
      createdTime: group.createdTime,
      contactPerson: group.contactPerson ? 
        `${group.contactPerson.firstName} ${group.contactPerson.lastName}` : 
        'Not specified',
      imageUrl: group.imageUrl
    };
  }

  async convertPdfToText(inputPath: string, outputPath: string): Promise<string> {
    return convertFileToText('pdftotext', 'PDF', inputPath, outputPath, 'Make sure pdftotext is installed (usually part of poppler-utils package).');
  }

  async convertDocxToText(inputPath: string, outputPath: string): Promise<string> {
    return convertFileToText('docx2txt', 'DOCX', inputPath, outputPath, 'Make sure docx2txt is installed.');
  }

  async convertXlsxToText(inputPath: string, outputPath: string): Promise<string> {
    return convertFileToText('ssconvert', 'XLSX', inputPath, outputPath, 'Make sure ssconvert is installed (part of the gnumeric package).');
  }

  async searchFiles(
    searchTerm: string,
    options: { groupName?: string; content?: boolean } = {},
    maxResults: number = 50
  ): Promise<FileSearchResult[]> {
    const allGroups = await this.spondClient.getGroups();
    const groups = options.groupName
      ? allGroups.filter(g => g.name?.toLowerCase().includes(options.groupName!.toLowerCase()))
      : allGroups;

    const results: FileSearchResult[] = [];

    for (const group of groups) {
      const listing = await this.spondClient.getGroupFiles(group.id);
      const resources: FileResource[] = listing?.resources ?? [];

      for (const resource of resources) {
        if (results.length >= maxResults) break;

        if (matchesFilename(resource.name, searchTerm)) {
          results.push(this.toFileSearchResult(resource, group, 'filename'));
          continue;
        }

        if (options.content && isContentSearchable(resource.mediaType)) {
          const text = await this.spondClient.extractFileText(resource, group.id);
          if (text && text.toLowerCase().includes(searchTerm.toLowerCase())) {
            results.push(this.toFileSearchResult(resource, group, 'content'));
          }
        }
      }

      if (results.length >= maxResults) break;
    }

    return results.slice(0, maxResults);
  }

  private toFileSearchResult(resource: FileResource, group: SpondGroup, matchType: 'filename' | 'content'): FileSearchResult {
    return {
      matchType,
      id: resource.id,
      name: resource.name,
      type: resource.type,
      url: resource.url,
      groupId: group.id,
      groupName: group.name
    };
  }
}