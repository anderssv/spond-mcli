import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';
import { SpondGroupMother } from '../helpers/object-mothers.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

// A minimal but valid single-page PDF containing the text "Hello World",
// used to exercise the real pdftotext binary in tests.
const MINIMAL_PDF = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 200 200] /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
5 0 obj
<< /Length 44 >>
stream
BT /F1 24 Tf 20 100 Td (Hello World) Tj ET
endstream
endobj
trailer
<< /Size 6 /Root 1 0 R >>
%%EOF
`;

describe('MCP Tool Capabilities for Users', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock mode for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });

  describe('Event Discovery Tools', () => {
    test('should help users discover available Spond tools for managing their activities', () => {
      // Given: A user wanting to understand what capabilities are available
      const tools = core.getToolDefinitions();
      
      // Then: Should provide access to event management tools
      const getEventsTool = tools.find(t => t.name === 'get_events');
      expect(getEventsTool).toBeDefined();
      expect(getEventsTool!.description).toBeTruthy();
      expect(getEventsTool!.name).toBe('get_events');
      
      // Should have reasonable defaults for user convenience
      expect(tools.length).toBeGreaterThan(0);
    });
    
    test('should provide tools that actually help users retrieve their events', async () => {
      // Given: A user wanting to see their events
      // When: Using the get_events tool
      const result = await core.processToolCall('get_events', {});

      // Then: Should successfully retrieve event information
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should surface a truncation note on get_events when more results exist than maxResults', async () => {
      const truncated = await core.processToolCall('get_events', { maxResults: 1 });
      expect(truncated.data).toHaveLength(1);
      expect(truncated.note).toMatch(/more results/i);

      const untruncated = await core.processToolCall('get_events', { maxResults: 100 });
      expect(untruncated.note).toBeUndefined();
    });

    test('should filter get_events results with a JMESPath query', async () => {
      const result = await core.processToolCall('get_events', {
        query: "[?contains(heading, 'Gaming')]"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((event: any) => event.heading.includes('Gaming'))).toBe(true);
    });

    test('should not leak the query param into the real getEvents API call', async () => {
      const client = SpondClientFake.withMockData();
      const spyCore = new SpondCore(client);
      const getEventsSpy = jest.spyOn(client, 'getEvents');

      await spyCore.processToolCall('get_events', { groupId: 'GROUP_GAMING_CENTER', query: '[?heading]' });

      expect(getEventsSpy).toHaveBeenCalledWith(expect.not.objectContaining({ query: expect.anything() }));
    });

    test('should provide tools that help users search for specific activities', async () => {
      // Given: A user looking for gaming activities
      // When: Using the search functionality
      const result = await core.processToolCall('search_events', {
        searchTerm: 'Gaming',
        maxResults: 10
      });
      
      // Then: Should find relevant activities
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
    
    test('should filter get_events results with groupName and a JMESPath query', async () => {
      const result = await core.processToolCall('get_events', {
        groupName: 'Gaming Center',
        query: "[?contains(heading, 'Gaming')].heading"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((heading: string) => heading.includes('Gaming'))).toBe(true);
    });

    test('should not leak the query/groupName params into the real getEventsByGroup API call', async () => {
      const client = SpondClientFake.withMockData();
      const spyCore = new SpondCore(client);
      const getEventsByGroupSpy = jest.spyOn(client, 'getEventsByGroup');

      await spyCore.processToolCall('get_events', { groupName: 'Gaming Center', query: '[?heading]' });

      expect(getEventsByGroupSpy).toHaveBeenCalledWith(
        'Gaming Center',
        expect.any(Number),
        expect.not.objectContaining({ query: expect.anything(), groupName: expect.anything() })
      );
    });

    test('should provide tools that help users focus on upcoming activities', async () => {
      // Given: A user planning their future activities
      // When: Using the upcoming events tool
      const result = await core.processToolCall('get_upcoming_events', {
        maxResults: 5
      });
      
      // Then: Should provide future activities for planning
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });
    
    test('should provide tools that help users get detailed information about specific events', async () => {
      // Given: A user interested in a specific gaming event
      const eventId = 'FE5E94BA079947CB98302FFF6C931963';
      
      // When: Using the event details tool
      const result = await core.processToolCall('get_event_by_id', { eventId });
      
      // Then: Should provide comprehensive event information
      expect(result).toBeDefined();
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.id).toBe(eventId);
      expect(result.data.heading).toBeTruthy();
  });

  describe('Event Response Tools', () => {
    test('should allow accepting an event for a member', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      const core = new SpondCore(fake);

      const result = await core.processToolCall('accept_event', {
        eventId: 'evt-1',
        memberId: 'member-1'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
    });

    test('should allow declining an event for a member', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      const core = new SpondCore(fake);

      const result = await core.processToolCall('decline_event', {
        eventId: 'evt-1',
        memberId: 'member-1'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
    });

    test('should require eventId for accept_event', async () => {
      await expect(
        core.processToolCall('accept_event', { memberId: 'member-1' })
      ).rejects.toThrow('eventId is required');
    });

    test('should require memberId for accept_event', async () => {
      await expect(
        core.processToolCall('accept_event', { eventId: 'evt-1' })
      ).rejects.toThrow('memberId is required');
    });

    test('should hint about registration status when accept fails', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      fake.setFailNextCall(true, 'HTTP 403: Forbidden');
      const core = new SpondCore(fake);

      await expect(
        core.processToolCall('accept_event', { eventId: 'evt-1', memberId: 'member-1' })
      ).rejects.toThrow(/registration.*status|not.*open/i);
    });

    test('should hint about registration status when decline fails', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-1', 'Training'),
        responses: { acceptedIds: [], declinedIds: [], unansweredIds: ['member-1'], waitinglistIds: [], unconfirmedIds: [] }
      });
      fake.setFailNextCall(true, 'HTTP 403: Forbidden');
      const core = new SpondCore(fake);

      await expect(
        core.processToolCall('decline_event', { eventId: 'evt-1', memberId: 'member-1' })
      ).rejects.toThrow(/registration.*status|not.*open/i);
    });
  });

  describe('Post Tools', () => {
    test('should retrieve posts with summaries', async () => {
      const result = await core.processToolCall('get_posts', {});

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('title');
      expect(result.data[0]).toHaveProperty('groupName');
    });

    test('should surface a truncation note on get_posts when more results exist than maxResults', async () => {
      const truncated = await core.processToolCall('get_posts', { maxResults: 1 });
      expect(truncated.data).toHaveLength(1);
      expect(truncated.note).toMatch(/more results/i);

      const untruncated = await core.processToolCall('get_posts', { maxResults: 100 });
      expect(untruncated.note).toBeUndefined();
    });

    test('should retrieve a specific post by ID', async () => {
      const result = await core.processToolCall('get_post_by_id', { postId: 'POST_001' });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('POST_001');
    });

    test('should filter get_posts results with a JMESPath query', async () => {
      const result = await core.processToolCall('get_posts', {
        query: "[?contains(title, 'Gaming')].title"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((title: string) => title.includes('Gaming'))).toBe(true);
    });

    test('should not leak the query param into the real getPosts API call', async () => {
      const client = SpondClientFake.withMockData();
      const spyCore = new SpondCore(client);
      const getPostsSpy = jest.spyOn(client, 'getPosts');

      await spyCore.processToolCall('get_posts', { groupId: 'GROUP_GAMING_CENTER', query: '[?title]' });

      expect(getPostsSpy).toHaveBeenCalledWith(expect.not.objectContaining({ query: expect.anything() }));
    });

    test('should return not-found for non-existent post', async () => {
      const result = await core.processToolCall('get_post_by_id', { postId: 'NON_EXISTENT_POST' });

      expect(result.type).toBe(ToolCallResultType.NotFound);
      expect(result.data).toBeNull();
    });

    test('should require postId for get_post_by_id', async () => {
      await expect(
        core.processToolCall('get_post_by_id', {})
      ).rejects.toThrow('postId is required');
    });

    test('should search posts by keyword', async () => {
      const result = await core.processToolCall('search_posts', {
        searchTerm: 'Gaming',
        maxResults: 10
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should require searchTerm for search_posts', async () => {
      await expect(
        core.processToolCall('search_posts', {})
      ).rejects.toThrow('searchTerm is required');
    });

    test('should reject a non-string searchTerm for search_posts with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_posts', { searchTerm: 123 })
      ).rejects.toThrow(CoreError);
    });

    test('should reject an invalid maxResults for search_posts with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_posts', { searchTerm: 'Gaming', maxResults: 0 })
      ).rejects.toThrow(CoreError);
    });

    test('should require searchTerm for search_events', async () => {
      await expect(
        core.processToolCall('search_events', {})
      ).rejects.toThrow('searchTerm is required');
    });

    test('should reject a non-string searchTerm for search_events with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_events', { searchTerm: 123 })
      ).rejects.toThrow(CoreError);
    });

    test('should reject an invalid maxResults for search_events with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_events', { searchTerm: 'Gaming', maxResults: 0 })
      ).rejects.toThrow(CoreError);
    });

    test('should search across events and posts at once via search_all', async () => {
      const result = await core.processToolCall('search_all', {
        searchTerm: 'Gaming',
        maxResults: 10
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.every((item: any) => item.kind === 'event' || item.kind === 'post')).toBe(true);
    });

    test('should filter search_all results with a JMESPath query', async () => {
      const result = await core.processToolCall('search_all', {
        searchTerm: 'Gaming',
        maxResults: 10,
        query: "[?kind=='event']"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((item: any) => item.kind === 'event')).toBe(true);
    });

    test('should surface a truncation note on search_all when more results exist than maxResults', async () => {
      const truncated = await core.processToolCall('search_all', { searchTerm: 'a', maxResults: 1 });
      expect(truncated.data).toHaveLength(1);
      expect(truncated.note).toMatch(/more results/i);

      const untruncated = await core.processToolCall('search_all', { searchTerm: 'a', maxResults: 100 });
      expect(untruncated.note).toBeUndefined();
    });

    test('should require searchTerm for search_all', async () => {
      await expect(
        core.processToolCall('search_all', {})
      ).rejects.toThrow('searchTerm is required');
    });

    test('should reject a non-string searchTerm with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_all', { searchTerm: 123 })
      ).rejects.toThrow(CoreError);

      try {
        await core.processToolCall('search_all', { searchTerm: 123 });
        fail('expected processToolCall to throw');
      } catch (error) {
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
        expect((error as Error).message).toContain('searchTerm');
      }
    });

    test('should reject a non-positive maxResults with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_all', { searchTerm: 'Gaming', maxResults: 0 })
      ).rejects.toThrow(CoreError);

      await expect(
        core.processToolCall('search_all', { searchTerm: 'Gaming', maxResults: -5 })
      ).rejects.toThrow(CoreError);
    });

    test('should reject a non-numeric maxResults with a clear InvalidParams error', async () => {
      await expect(
        core.processToolCall('search_all', { searchTerm: 'Gaming', maxResults: 'abc' })
      ).rejects.toThrow(CoreError);
    });

    test('should retrieve posts by group name via get_posts', async () => {
      const result = await core.processToolCall('get_posts', {
        groupName: 'Gaming Center',
        maxResults: 10
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].groupName).toContain('Gaming');
    });

    test('should return an empty array for get_posts with an unmatched groupName', async () => {
      const result = await core.processToolCall('get_posts', { groupName: 'Nonexistent Group XYZ' });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toEqual([]);
    });

    test('should combine get_posts groupName with type filtering (capability improvement over old get_posts_by_group)', async () => {
      const result = await core.processToolCall('get_posts', {
        groupName: 'Gaming Center',
        type: 'PLAIN',
        maxResults: 10
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should filter search_files results with a JMESPath query', async () => {
      const result = await core.processToolCall('search_files', {
        searchTerm: 'meeting',
        query: "[?matchType=='filename'].name"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data.every((name: string) => name === 'meeting-notes.pdf')).toBe(true);
    });

    test('should surface a truncation note on search_files when more results exist than maxResults', async () => {
      const truncated = await core.processToolCall('search_files', { searchTerm: 'meeting', maxResults: 1 });
      expect(truncated.data).toHaveLength(1);
      expect(truncated.note).toMatch(/more results/i);

      const untruncated = await core.processToolCall('search_files', { searchTerm: 'meeting', maxResults: 100 });
      expect(untruncated.note).toBeUndefined();
    });
  });

  describe('Members Tools', () => {
    test('should list members the caller is a guardian for', async () => {
      const client = new SpondClientFake('my-profile-id');
      const group = SpondGroupMother.createActiveGroup();
      client.addGroup({
        ...group,
        members: [{
          id: 'member-1',
          firstName: 'Kid',
          lastName: 'One',
          guardians: [{ profile: { id: 'my-profile-id' } }]
        } as any]
      });
      const scopedCore = new SpondCore(client);

      const result = await scopedCore.processToolCall('get_my_members', {});

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toEqual([
        expect.objectContaining({ memberId: 'member-1', firstName: 'Kid', lastName: 'One' })
      ]);
    });

    test('should filter get_my_members results with a JMESPath query', async () => {
      const client = new SpondClientFake('my-profile-id');
      const group = SpondGroupMother.createActiveGroup();
      client.addGroup({
        ...group,
        members: [{
          id: 'member-1',
          firstName: 'Kid',
          lastName: 'One',
          guardians: [{ profile: { id: 'my-profile-id' } }]
        } as any]
      });
      const scopedCore = new SpondCore(client);

      const result = await scopedCore.processToolCall('get_my_members', { query: '[].memberId' });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toEqual(['member-1']);
    });
  });

  describe('Group Tools', () => {
    test('should retrieve groups with summaries', async () => {
      const result = await core.processToolCall('get_groups', {});

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('name');
      expect(result.data[0]).toHaveProperty('memberCount');
    });

    test('should filter get_groups results with a JMESPath query', async () => {
      const result = await core.processToolCall('get_groups', {
        query: "[?activity=='esports'].name"
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toEqual(['Gaming Center Junior']);
    });

    test('should reject a malformed JMESPath query with an InvalidParams CoreError', async () => {
      await expect(
        core.processToolCall('get_groups', { query: '[invalid(' })
      ).rejects.toThrow(CoreError);

      try {
        await core.processToolCall('get_groups', { query: '[invalid(' });
        fail('expected processToolCall to throw');
      } catch (error) {
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
      }
    });

    test('should retrieve group files', async () => {
      const result = await core.processToolCall('get_group_files', {
        groupId: 'GROUP_GAMING_CENTER'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toBeDefined();
      expect(result.data.resources).toBeDefined();
      expect(result.data.resources.length).toBeGreaterThan(0);
    });

    test('should require groupId for get_group_files', async () => {
      await expect(
        core.processToolCall('get_group_files', {})
      ).rejects.toThrow('groupId is required');
    });
  });

  describe('File Tools', () => {
    test('should fetch a file and return a resourceId (attachment URL)', async () => {
      const result = await core.processToolCall('get_file', {
        url: 'https://example.com/attachment.pdf',
        groupId: 'GROUP_GAMING_CENTER'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.resourceId).toEqual(expect.any(String));
      expect(result.data.sizeBytes).toBeGreaterThan(0);
    });

    test('should fetch a file and return a resourceId (group file URL)', async () => {
      const result = await core.processToolCall('get_file', {
        url: 'https://example.com/group-file.pdf',
        groupId: 'GROUP_GAMING_CENTER'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.resourceId).toEqual(expect.any(String));
      expect(result.data.sizeBytes).toBeGreaterThan(0);
    });

    test('should require url and groupId for get_file', async () => {
      await expect(
        core.processToolCall('get_file', { groupId: 'g' })
      ).rejects.toThrow('url is required');

      await expect(
        core.processToolCall('get_file', { url: 'http://x' })
      ).rejects.toThrow('groupId is required');
    });
  });

  describe('File Conversion Tools', () => {
    function seedResource(workspaceDir: string, resourceId: string, rawContent: string, contentType: string) {
      const fs = require('fs');
      const path = require('path');
      const { resolveResourcePath } = require('../../src/workspace-manager.js');

      const rawPath = resolveResourcePath(workspaceDir, 'raw', resourceId);
      fs.mkdirSync(path.dirname(rawPath), { recursive: true });
      fs.writeFileSync(rawPath, rawContent);

      const metaPath = resolveResourcePath(workspaceDir, 'meta', resourceId);
      fs.mkdirSync(path.dirname(metaPath), { recursive: true });
      fs.writeFileSync(metaPath, JSON.stringify({ contentType }), 'utf-8');
    }

    test('should require resourceId for convert_resource_to_text', async () => {
      await expect(
        core.processToolCall('convert_resource_to_text', {})
      ).rejects.toThrow('resourceId is required');
    });

    test('should fail with an unknown resourceId for convert_resource_to_text', async () => {
      await expect(
        core.processToolCall('convert_resource_to_text', { resourceId: 'nonexistent-resource-12345' })
      ).rejects.toThrow('Unknown resourceId');
    });

    test('should auto-detect PDF and convert a real PDF resource to text', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-convert-test-'));
      const scopedCore = new SpondCore(SpondClientFake.withMockData(), workspaceDir);
      const resourceId = 'real-pdf-resource';
      seedResource(workspaceDir, resourceId, MINIMAL_PDF, 'application/pdf');

      const result = await scopedCore.processToolCall('convert_resource_to_text', { resourceId });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.preview).toContain('Hello World');
      expect(result.data.lineCount).toBeGreaterThan(0);
    });

    test('should auto-detect XLSX and convert a real spreadsheet resource to CSV text, without relying on a file extension', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-convert-test-'));
      const scopedCore = new SpondCore(SpondClientFake.withMockData(), workspaceDir);
      const resourceId = 'real-xlsx-resource';
      seedResource(workspaceDir, resourceId, 'name,age\nAlice,30\n', 'application/vnd.ms-excel');

      const result = await scopedCore.processToolCall('convert_resource_to_text', { resourceId });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.preview).toContain('Alice');
    });

    test('should reject an unsupported content type with a clear InvalidParams error', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');

      const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-convert-test-'));
      const scopedCore = new SpondCore(SpondClientFake.withMockData(), workspaceDir);
      const resourceId = 'real-image-resource';
      seedResource(workspaceDir, resourceId, 'not-really-an-image', 'image/jpeg');

      await expect(
        scopedCore.processToolCall('convert_resource_to_text', { resourceId })
      ).rejects.toThrow(/Cannot convert content type/);
    });
  });

  describe('Resource Search', () => {
    test('should find matching lines in a converted resource, without returning the whole document', async () => {
      const fs = require('fs');
      const os = require('os');
      const path = require('path');
      const { resolveResourcePath } = require('../../src/workspace-manager.js');

      const workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-search-test-'));
      const scopedCore = new SpondCore(SpondClientFake.withMockData(), workspaceDir);
      const resourceId = 'abc123-report.pdf';
      const textPath = resolveResourcePath(workspaceDir, 'text', resourceId);
      fs.mkdirSync(path.dirname(textPath), { recursive: true });
      fs.writeFileSync(textPath, 'line one\nPractice moved to Tuesday\nline three\n');

      const result = await scopedCore.processToolCall('search_resource_text', {
        resourceId,
        searchTerm: 'tuesday'
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.matches).toEqual([{ lineNumber: 2, line: 'Practice moved to Tuesday' }]);
      expect(result.data.totalMatches).toBe(1);
      expect(result.data.truncated).toBe(false);
    });

    test('should require resourceId and searchTerm for search_resource_text', async () => {
      await expect(
        core.processToolCall('search_resource_text', { searchTerm: 'x' })
      ).rejects.toThrow('resourceId is required');

      await expect(
        core.processToolCall('search_resource_text', { resourceId: 'r' })
      ).rejects.toThrow('searchTerm is required');
    });

    test('should fail with an unknown resourceId for search_resource_text', async () => {
      await expect(
        core.processToolCall('search_resource_text', { resourceId: 'nonexistent-resource-12345', searchTerm: 'x' })
      ).rejects.toThrow('Unknown resourceId');
    });
  });

  describe('Resource Reads', () => {
    test('should read posts/all resource', async () => {
      const result = await core.processResourceRead('spond://posts/all');

      expect(result).toBeDefined();
      expect(result.uri).toBe('spond://posts/all');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0]).toHaveProperty('id');
      expect(result.data[0]).toHaveProperty('title');
      expect(result.data[0]).toHaveProperty('groupName');
    });

    test('should read groups/all resource', async () => {
      const result = await core.processResourceRead('spond://groups/all');

      expect(result).toBeDefined();
      expect(result.uri).toBe('spond://groups/all');
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
    });

    test('should return error for unknown resource', async () => {
      await expect(
        core.processResourceRead('spond://unknown/resource')
      ).rejects.toThrow('Unknown resource');
    });
  });

  describe('Edge Cases', () => {
    test('should return full event with members when includeMembers is true', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-members', 'Event With Members'),
        recipients: {
          group: {
            id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
            members: [
              { id: 'member-1', firstName: 'Test', lastName: 'Player', respondent: true },
              { id: 'member-2', firstName: 'Another', lastName: 'Player', respondent: true }
            ]
          }
        }
      });
      const coreWithFake = new SpondCore(fake);

      const result = await coreWithFake.processToolCall('get_event_by_id', {
        eventId: 'evt-members',
        includeMembers: true
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.recipients.group.members.length).toBe(2);
    });

    test('should strip members when includeMembers is false', async () => {
      const fake = new SpondClientFake();
      fake.addEvent({
        ...createMinimalEvent('evt-no-members', 'Event Without Members'),
        recipients: {
          group: {
            id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
            members: [
              { id: 'member-1', firstName: 'Test', lastName: 'Player', respondent: true }
            ]
          }
        }
      });
      const coreWithFake = new SpondCore(fake);

      const result = await coreWithFake.processToolCall('get_event_by_id', {
        eventId: 'evt-no-members',
        includeMembers: false
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data.recipients.group.members).toEqual([]);
    });

    test('should show waitlisted attendance status for child on waitlist', async () => {
      const userProfileId = 'parent-profile-123';
      const fake = new SpondClientFake(userProfileId);
      fake.addEvent({
        ...createMinimalEvent('evt-waitlist', 'Waitlisted Event'),
        recipients: {
          group: {
            id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
            members: [{
              id: 'child-1', firstName: 'Child', lastName: 'Player', respondent: true,
              guardians: [{
                id: 'guardian-1', firstName: 'Parent', lastName: 'Player',
                profile: {
                  contactMethod: 'email', id: userProfileId,
                  firstName: 'Parent', lastName: 'Player',
                  unableToReach: false
                }
              }]
            }]
          }
        },
        responses: {
          acceptedIds: [], declinedIds: [], unansweredIds: [],
          waitinglistIds: ['child-1'], unconfirmedIds: []
        }
      });
      const coreWithFake = new SpondCore(fake);

      const result = await coreWithFake.processToolCall('get_events', {});

      expect(result.data[0].attendanceStatus).toBe('waitlisted');
    });

    test('should show unconfirmed attendance status for unconfirmed child', async () => {
      const userProfileId = 'parent-profile-456';
      const fake = new SpondClientFake(userProfileId);
      fake.addEvent({
        ...createMinimalEvent('evt-unconfirmed', 'Unconfirmed Event'),
        recipients: {
          group: {
            id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
            members: [{
              id: 'child-2', firstName: 'Child', lastName: 'Two', respondent: true,
              guardians: [{
                id: 'guardian-2', firstName: 'Parent', lastName: 'Two',
                profile: {
                  contactMethod: 'email', id: userProfileId,
                  firstName: 'Parent', lastName: 'Two',
                  unableToReach: false
                }
              }]
            }]
          }
        },
        responses: {
          acceptedIds: [], declinedIds: [], unansweredIds: [],
          waitinglistIds: [], unconfirmedIds: ['child-2']
        }
      });
      const coreWithFake = new SpondCore(fake);

      const result = await coreWithFake.processToolCall('get_events', {});

      expect(result.data[0].attendanceStatus).toBe('unconfirmed');
    });

    test('should wrap unexpected errors in processToolCall as CoreError', async () => {
      const fake = new SpondClientFake();
      fake.addPost({
        id: 'post-1', type: 'PLAIN', groupId: 'g1', subGroupIds: [],
        title: 'Test', body: 'Body', ownerId: 'o1',
        timestamp: '2024-01-01T00:00:00Z', media: [], reactions: {},
        attachments: [], visibility: 'ALL', unread: false,
        commentsDisabled: false, seenCount: 0, muted: false, selectMemberPoll: false
      });
      // getPosts calls getGroups internally; make the second call fail
      fake.setFailNextCall(true, 'Unexpected network failure');
      const coreWithFake = new SpondCore(fake);

      await expect(
        coreWithFake.processToolCall('get_posts', {})
      ).rejects.toThrow('Unexpected network failure');
    });

    test('should wrap unexpected errors in processResourceRead as CoreError', async () => {
      const fake = new SpondClientFake();
      fake.setFailNextCall(true, 'Connection timeout');
      const coreWithFake = new SpondCore(fake);

      await expect(
        coreWithFake.processResourceRead('spond://groups/all')
      ).rejects.toThrow('Connection timeout');
    });
  });

});

function createMinimalEvent(id: string, heading: string) {
  return {
    id,
    creatorId: 'creator-1',
    owners: [{ id: 'owner-1', response: 'accepted', firstName: 'Host', lastName: 'User', appUser: true, unableToReach: false }],
    heading,
    description: 'A test event',
    startTimestamp: new Date(Date.now() + 86400000).toISOString(),
    endTimestamp: new Date(Date.now() + 90000000).toISOString(),
    recipients: {
      group: {
        id: 'group-1', contactPersonId: 'owner-1', name: 'Test Group', createdTime: Date.now(),
        members: [{ id: 'member-1', firstName: 'Test', lastName: 'Player', respondent: true }]
      }
    }
  };
}
});