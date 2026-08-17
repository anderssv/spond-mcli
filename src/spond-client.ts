import fetch from 'node-fetch';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { ISpondClient } from './spond-client-interface.js';
import type { SpondEvent, SpondEventsQueryParams, SpondPost, SpondPostsQueryParams, SpondGroup, FileResource } from './domain-types.js';
import { getConverterCommand } from './domain-logic.js';
import { convertFileToText } from './file-converter.js';

// searchEvents/searchPosts fetch a window of raw records and filter client-side
// (the Spond API has no server-side search). This window must stay decoupled
// from the caller's maxResults — a match past the front of the raw feed would
// otherwise be silently invisible to a small maxResults request.
const SEARCH_SCAN_WINDOW = 200;

export class SpondClient implements ISpondClient {
  private readonly baseUrl = 'https://api.spond.com';
  private readonly apiLevel = '2.7.9';
  private readonly token: string;
  private cachedProfileId?: string;
  private readonly fetchFn: typeof fetch;

  constructor(token: string, fetchFn?: typeof fetch) {
    this.token = token;
    this.fetchFn = fetchFn || fetch;
  }

  public async getCurrentUserProfileId(): Promise<string | undefined> {
    if (this.cachedProfileId) {
      return this.cachedProfileId;
    }

    try {
      const url = `${this.baseUrl}/core/v1/profile`;

      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      const profile = await response.json() as { id: string };
      this.cachedProfileId = profile.id;
      return this.cachedProfileId;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond profile: ${error.message}`);
      }
      throw new Error('Failed to fetch Spond profile: Unknown error');
    }
  }

  private getHeaders(): Record<string, string> {
    return {
      'accept': 'application/json',
      'accept-language': 'nb-NO,nb;q=0.9,en-GB;q=0.8,en;q=0.7,no;q=0.6,nn;q=0.5,en-US;q=0.4',
      'api-level': this.apiLevel,
      'authorization': `Bearer ${this.token}`,
      'cache-control': 'no-cache',
      'content-type': 'application/json',
      'dnt': '1',
      'origin': 'https://spond.com',
      'pragma': 'no-cache',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36'
    };
  }

  private buildQueryString(params: SpondEventsQueryParams | SpondPostsQueryParams): string {
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return searchParams.toString();
  }

  async getEvents(params: SpondEventsQueryParams = {}): Promise<SpondEvent[]> {
    // If both min and max timestamps are specified, use lightweight mode to reduce data size
    const hasDateRange = params.minEndTimestamp && params.maxEndTimestamp;
    const defaultParams: SpondEventsQueryParams = {
      includeComments: !hasDateRange,
      includeHidden: false,
      addProfileInfo: params.addProfileInfo !== undefined ? params.addProfileInfo : !hasDateRange,
      scheduled: true,
      order: 'asc',
      max: 20,
      ...params
    };

    const queryString = this.buildQueryString(defaultParams);
    const url = `${this.baseUrl}/core/v1/sponds?${queryString}`;

    try {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json() as SpondEvent[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond events: ${error.message}`);
      }
      throw new Error('Failed to fetch Spond events: Unknown error');
    }
  }

  async getEventById(eventId: string): Promise<SpondEvent | null> {
    try {
      const url = `${this.baseUrl}/core/v1/sponds/${eventId}`;
      
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json() as SpondEvent;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond event ${eventId}: ${error.message}`);
      }
      throw new Error(`Failed to fetch Spond event ${eventId}: Unknown error`);
    }
  }

  async getUpcomingEvents(maxResults: number = 20, addProfileInfo: boolean = false): Promise<SpondEvent[]> {
    const now = new Date();
    const minEndTimestamp = now.toISOString();

    return this.getEvents({
      scheduled: true,
      order: 'asc',
      max: maxResults,
      minEndTimestamp,
      addProfileInfo
    });
  }

  async getEventsByGroup(groupName: string, maxResults: number = 50, filterParams: Partial<SpondEventsQueryParams> = {}): Promise<SpondEvent[]> {
    // First get all groups to find matching group IDs by name
    const groups = await this.getGroups();
    const matchingGroups = groups.filter(group => 
      group.name?.toLowerCase()?.includes(groupName.toLowerCase())
    );

    if (matchingGroups.length > 0) {
      // Fetch events for each matching group and merge results
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
      // Fallback to name-based filtering if no group found
      const events = await this.getEvents({ 
        max: maxResults, 
        ...filterParams 
      });
      
      return events.filter(event => 
        event.recipients?.group?.name?.toLowerCase()?.includes(groupName.toLowerCase())
      );
    }
  }

  async searchEvents(searchTerm: string, maxResults: number = 50): Promise<SpondEvent[]> {
    const events = await this.getEvents({ max: SEARCH_SCAN_WINDOW });

    const lowerSearchTerm = searchTerm.toLowerCase();

    return events.filter(event =>
      (event.heading?.toLowerCase()?.includes(lowerSearchTerm)) ||
      (event.description?.toLowerCase()?.includes(lowerSearchTerm)) ||
      (event.recipients?.group?.name?.toLowerCase()?.includes(lowerSearchTerm))
    ).slice(0, maxResults);
  }

  async getPosts(params: SpondPostsQueryParams = {}): Promise<SpondPost[]> {
    const defaultParams: SpondPostsQueryParams = {
      type: 'PLAIN',
      includeComments: true,
      includeReadStatus: true,
      includeSeenCount: true,
      max: 5,
      ...params
    };

    const queryString = this.buildQueryString(defaultParams);
    const url = `${this.baseUrl}/core/v1/posts?${queryString}`;

    try {
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json() as SpondPost[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond posts: ${error.message}`);
      }
      throw new Error('Failed to fetch Spond posts: Unknown error');
    }
  }

  async getPostById(postId: string): Promise<SpondPost | null> {
    try {
      const url = `${this.baseUrl}/core/v1/posts/${postId}`;
      
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (response.status === 404) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json() as SpondPost;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond post ${postId}: ${error.message}`);
      }
      throw new Error(`Failed to fetch Spond post ${postId}: Unknown error`);
    }
  }

  async getPostsByGroup(groupName: string, maxResults: number = 50): Promise<SpondPost[]> {
    const posts = await this.getPosts({ max: maxResults });
    
    // For posts by group, we need to get groups first to match group name to ID
    const groups = await this.getGroups();
    const matchingGroup = groups.find(group => 
      group.name?.toLowerCase()?.includes(groupName.toLowerCase())
    );
    
    if (matchingGroup) {
      return posts.filter(post => post.groupId === matchingGroup.id);
    } else {
      return [];
    }
  }

  async searchPosts(searchTerm: string, maxResults: number = 50): Promise<SpondPost[]> {
    const posts = await this.getPosts({ max: SEARCH_SCAN_WINDOW });

    const lowerSearchTerm = searchTerm.toLowerCase();

    return posts.filter(post =>
      (post.title?.toLowerCase()?.includes(lowerSearchTerm)) ||
      (post.body?.toLowerCase()?.includes(lowerSearchTerm))
    ).slice(0, maxResults);
  }

  async getGroups(): Promise<SpondGroup[]> {
    try {
      const url = `${this.baseUrl}/core/v1/groups`;
      
      const response = await this.fetchFn(url, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return await response.json() as SpondGroup[];
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch Spond groups: ${error.message}`);
      }
      throw new Error('Failed to fetch Spond groups: Unknown error');
    }
  }

  async sendEventResponse(eventId: string, memberId: string, accepted: boolean): Promise<void> {
    try {
      const url = `${this.baseUrl}/core/v1/sponds/${eventId}/responses/${memberId}`;

      const response = await this.fetchFn(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({ accepted })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to send event response: ${error.message}`);
      }
      throw new Error('Failed to send event response: Unknown error');
    }
  }

  private async getFileToken(groupId: string): Promise<string> {
    try {
      const fileTokenUrl = `${this.baseUrl}/core/v1/group/${groupId}/filesToken`;
      
      const response = await this.fetchFn(fileTokenUrl, {
        method: 'GET',
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`Failed to get file token - HTTP ${response.status}: ${await response.text()}`);
      }

      const tokenData = await response.json() as { value: string };
      if (!tokenData.value) {
        throw new Error('No file token returned from Spond API');
      }

      return tokenData.value;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get file token: ${error.message}`);
      }
      throw new Error('Failed to get file token: Unknown error');
    }
  }


  async fetchAttachmentToFile(url: string, filePath: string, groupId: string): Promise<string> {
    try {
      // Check if this is a Spond storage URL
      if (!url.includes('spond.com/storage/')) {
        throw new Error('Invalid Spond attachment URL - must be a spond.com/storage/ URL');
      }

      // Ensure directory exists
      const dir = dirname(filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // Convert storage URL to API URL
      // Extract the path after /storage/
      const storagePath = url.replace('https://spond.com/storage/', '');
      
      
      // Get fresh file token dynamically
      const fileToken = await this.getFileToken(groupId);
      const apiUrl = `${this.baseUrl}/storage/${storagePath}?auth=${fileToken}`;

      // Step 1: Get the signed S3 URL from Spond API
      const response = await this.fetchFn(apiUrl, {
        method: 'GET',
        headers: { ...this.getHeaders(), accept: 'application/json, text/plain, */*' }
      });

      if (!response.ok) {
        throw new Error(`Failed to get signed URL - HTTP ${response.status}: ${await response.text()}`);
      }

      const urlData = await response.json() as { url: string };
      if (!urlData.url) {
        throw new Error('No signed URL returned from Spond API');
      }

      // Step 2: Fetch the actual content from the signed S3 URL
      const contentResponse = await this.fetchFn(urlData.url, {
        method: 'GET'
        // No special headers needed for S3 signed URLs
      });

      if (!contentResponse.ok) {
        throw new Error(`Failed to fetch content from S3 - HTTP ${contentResponse.status}: ${await contentResponse.text()}`);
      }

      // Write content to file
      const buffer = Buffer.from(await contentResponse.arrayBuffer());
      writeFileSync(filePath, buffer);

      // Get file info for response
      const contentType = contentResponse.headers.get('content-type') || 'unknown';
      const fileSize = buffer.length;
      
      return `Attachment successfully downloaded and saved to: ${filePath}\nFile size: ${fileSize} bytes\nContent type: ${contentType}`;

    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch attachment to file: ${error.message}`);
      }
      throw new Error('Failed to fetch attachment to file: Unknown error');
    }
  }

  async getGroupFiles(groupId: string): Promise<any> {
    const url = `${this.baseUrl}/core/v1/group/${groupId}/resources/folders/${groupId}`;
    
    const response = await this.fetchFn(url, {
      method: 'GET',
      headers: this.getHeaders()
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch group files - HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  async fetchGroupFileToFile(fileUrl: string, filePath: string, groupId: string): Promise<string> {
    return this.fetchAttachmentToFile(fileUrl, filePath, groupId);
  }

  async extractFileText(resource: FileResource, groupId: string): Promise<string | null> {
    const command = getConverterCommand(resource.mediaType);
    if (!command) {
      return null;
    }

    const { mkdtemp, readFile, rm } = await import('fs/promises');
    const { tmpdir } = await import('os');

    const tmpDir = await mkdtemp(join(tmpdir(), 'spond-content-search-'));
    const inputPath = join(tmpDir, 'input');
    // ssconvert infers the output format from the destination extension;
    // pdftotext/docx2txt ignore it and always write plain text.
    const outputPath = join(tmpDir, command === 'ssconvert' ? 'output.csv' : 'output.txt');

    try {
      await this.fetchAttachmentToFile(resource.url, inputPath, groupId);
      await convertFileToText(command, resource.mediaType!, inputPath, outputPath, `Make sure ${command} is installed.`);
      return await readFile(outputPath, 'utf-8');
    } catch {
      return null;
    } finally {
      await rm(tmpDir, { recursive: true, force: true });
    }
  }
}