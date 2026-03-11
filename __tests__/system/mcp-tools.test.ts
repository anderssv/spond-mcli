import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

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

    test('should retrieve a specific post by ID', async () => {
      const result = await core.processToolCall('get_post_by_id', { postId: 'POST_001' });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(result.data).toBeDefined();
      expect(result.data.id).toBe('POST_001');
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

    test('should retrieve posts by group name', async () => {
      const result = await core.processToolCall('get_posts_by_group', {
        groupName: 'Gaming Center',
        maxResults: 10
      });

      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].groupName).toContain('Gaming');
    });

    test('should require groupName for get_posts_by_group', async () => {
      await expect(
        core.processToolCall('get_posts_by_group', {})
      ).rejects.toThrow('groupName is required');
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

  describe('Attachment Tools', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    test('should fetch and save an attachment', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-test-'));
      const filePath = path.join(tmpDir, 'test-attachment.txt');

      try {
        const result = await core.processToolCall('get_attachment', {
          url: 'https://example.com/attachment.pdf',
          groupId: 'GROUP_GAMING_CENTER',
          filePath
        });

        expect(result.type).toBe(ToolCallResultType.Success);
        expect(result.data.message).toContain(filePath);
        expect(fs.existsSync(filePath)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('should require url, groupId, and filePath for get_attachment', async () => {
      await expect(
        core.processToolCall('get_attachment', { groupId: 'g', filePath: '/tmp/f' })
      ).rejects.toThrow('url is required');

      await expect(
        core.processToolCall('get_attachment', { url: 'http://x', filePath: '/tmp/f' })
      ).rejects.toThrow('groupId is required');

      await expect(
        core.processToolCall('get_attachment', { url: 'http://x', groupId: 'g' })
      ).rejects.toThrow('filePath is required');
    });

    test('should fetch and save a group file', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'spond-test-'));
      const filePath = path.join(tmpDir, 'test-group-file.pdf');

      try {
        const result = await core.processToolCall('get_group_file', {
          fileUrl: 'https://example.com/group-file.pdf',
          groupId: 'GROUP_GAMING_CENTER',
          filePath
        });

        expect(result.type).toBe(ToolCallResultType.Success);
        expect(result.data.message).toContain(filePath);
        expect(fs.existsSync(filePath)).toBe(true);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    test('should require fileUrl, groupId, and filePath for get_group_file', async () => {
      await expect(
        core.processToolCall('get_group_file', { groupId: 'g', filePath: '/tmp/f' })
      ).rejects.toThrow('fileUrl is required');

      await expect(
        core.processToolCall('get_group_file', { fileUrl: 'http://x', filePath: '/tmp/f' })
      ).rejects.toThrow('groupId is required');

      await expect(
        core.processToolCall('get_group_file', { fileUrl: 'http://x', groupId: 'g' })
      ).rejects.toThrow('filePath is required');
    });
  });

  describe('File Conversion Tools', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    test('should require inputPath and outputPath for convert_pdf_to_text', async () => {
      await expect(
        core.processToolCall('convert_pdf_to_text', { outputPath: '/tmp/out.txt' })
      ).rejects.toThrow('inputPath is required');

      await expect(
        core.processToolCall('convert_pdf_to_text', { inputPath: '/tmp/in.pdf' })
      ).rejects.toThrow('outputPath is required');
    });

    test('should require inputPath and outputPath for convert_docx_to_text', async () => {
      await expect(
        core.processToolCall('convert_docx_to_text', { outputPath: '/tmp/out.txt' })
      ).rejects.toThrow('inputPath is required');

      await expect(
        core.processToolCall('convert_docx_to_text', { inputPath: '/tmp/in.docx' })
      ).rejects.toThrow('outputPath is required');
    });

    test('should fail when input PDF file does not exist', async () => {
      await expect(
        core.processToolCall('convert_pdf_to_text', {
          inputPath: '/tmp/nonexistent-file-12345.pdf',
          outputPath: '/tmp/output.txt'
        })
      ).rejects.toThrow('Input PDF file not found');
    });

    test('should fail when input DOCX file does not exist', async () => {
      await expect(
        core.processToolCall('convert_docx_to_text', {
          inputPath: '/tmp/nonexistent-file-12345.docx',
          outputPath: '/tmp/output.txt'
        })
      ).rejects.toThrow('Input DOCX file not found');
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