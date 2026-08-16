import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';
import { SpondGroupMother, SpondEventBuilder } from '../helpers/object-mothers.js';

describe('SpondCore Independent Unit Tests', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock mode for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });

  describe('Tool Definitions', () => {
    test('should return all expected tool definitions', () => {
      const tools = core.getToolDefinitions();
      
      expect(tools).toHaveLength(20);
      expect(tools.map(t => t.name)).toContain('get_events');
      expect(tools.map(t => t.name)).toContain('get_upcoming_events');
      expect(tools.map(t => t.name)).toContain('search_events');
      expect(tools.map(t => t.name)).toContain('get_group_files');
      expect(tools.map(t => t.name)).toContain('get_group_file');
      expect(tools.map(t => t.name)).toContain('convert_pdf_to_text');
      expect(tools.map(t => t.name)).toContain('convert_docx_to_text');
      expect(tools.map(t => t.name)).toContain('accept_event');
      expect(tools.map(t => t.name)).toContain('decline_event');
    });

    test('should have proper tool schema structure', () => {
      const tools = core.getToolDefinitions();
      const getEventsTool = tools.find(t => t.name === 'get_events');
      
      expect(getEventsTool).toBeDefined();
      expect(getEventsTool!.description).toBe('Get Spond events with optional filtering parameters');
      expect(getEventsTool!.inputSchema.type).toBe('object');
      expect(getEventsTool!.inputSchema.properties.max.default).toBe(20);
    });
  });

  describe('Resource Definitions', () => {
    test('should return all expected resource definitions', () => {
      const resources = core.getResourceDefinitions();
      
      expect(resources).toHaveLength(5);
      expect(resources.map(r => r.uri)).toEqual([
        'spond://events/upcoming',
        'spond://events/all',
        'spond://posts/recent',
        'spond://posts/all',
        'spond://groups/all'
      ]);
    });
  });

  describe('Tool Processing', () => {
    test('should process get_upcoming_events tool call', async () => {
      const result = await core.processToolCall('get_upcoming_events', {
        maxResults: 10,
        addProfileInfo: false
      });

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('type');
      expect(result.type).toBe(ToolCallResultType.Success);
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should handle error for missing required parameters', async () => {
      try {
        await core.processToolCall('get_event_by_id', {});
        fail('Expected CoreError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
        expect((error as CoreError).message).toBe('eventId is required');
      }
    });

    test('should handle error for unknown tool', async () => {
      try {
        await core.processToolCall('unknown_tool', {});
        fail('Expected CoreError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.MethodNotFound);
        expect((error as CoreError).message).toContain('Unknown tool');
      }
    });
  });

  describe('Resource Processing', () => {
    test('should process upcoming events resource', async () => {
      const result = await core.processResourceRead('spond://events/upcoming');

      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('uri');
      expect(result.uri).toBe('spond://events/upcoming');
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should handle error for unknown resource', async () => {
      try {
        await core.processResourceRead('spond://unknown/resource');
        fail('Expected CoreError to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(CoreError);
        expect((error as CoreError).code).toBe(CoreErrorCode.InvalidParams);
        expect((error as CoreError).message).toContain('Unknown resource');
      }
    });
  });

  describe('Custom Error Types', () => {
    test('should use custom CoreError instead of MCP SDK types', () => {
      const error = new CoreError(CoreErrorCode.InvalidParams, 'Test error');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CoreError);
      expect(error.code).toBe(CoreErrorCode.InvalidParams);
      expect(error.message).toBe('Test error');
      expect(error.name).toBe('CoreError');
    });

    test('should have correct error codes matching MCP protocol', () => {
      expect(CoreErrorCode.InvalidParams).toBe(-32602);
      expect(CoreErrorCode.MethodNotFound).toBe(-32601);
      expect(CoreErrorCode.InternalError).toBe(-32603);
    });
  });

  describe('getMyMembers', () => {
    test('should return members guarded by the current user, across groups', async () => {
      const client = new SpondClientFake('me-profile-id');
      const group = SpondGroupMother.createActiveGroup();
      group.members = [
        {
          id: 'child-1',
          firstName: 'Kid',
          lastName: 'One',
          createdTime: new Date().toISOString(),
          respondent: true,
          guardians: [{ id: 'g1', firstName: 'Me', lastName: 'Parent', profile: { id: 'me-profile-id' } as any }]
        }
      ];
      client.addGroup(group);
      const myCore = new SpondCore(client);

      const members = await myCore.getMyMembers();

      expect(members).toEqual([
        { memberId: 'child-1', firstName: 'Kid', lastName: 'One', groupId: group.id, groupName: group.name }
      ]);
    });

    test('should throw a CoreError when the current user profile id cannot be determined', async () => {
      const client = new SpondClientFake('');
      const myCore = new SpondCore(client);

      await expect(myCore.getMyMembers()).rejects.toThrow(CoreError);
    });
  });

  describe('getPosts poll/payment enrichment', () => {
    test('should fall back to the poll question/description when title/body are absent', async () => {
      const client = new SpondClientFake();
      client.addPost({
        id: 'poll-post-1',
        type: 'POLL',
        groupId: 'group-1',
        ownerId: 'owner-1',
        timestamp: new Date().toISOString(),
        visibility: 'ALL',
        unread: false,
        commentsDisabled: false,
        muted: false,
        selectMemberPoll: false,
        poll: {
          id: 'poll-1',
          question: 'Bytte treningstid?',
          description: 'Kort beskrivelse',
          multipleChoice: false,
          options: [
            { id: 'opt-1', text: 'Ja', votes: ['a', 'b'] },
            { id: 'opt-2', text: 'Nei', votes: [] }
          ]
        }
      } as any);
      const myCore = new SpondCore(client);

      const [summary] = await myCore.getPosts({ type: 'POLL' });

      expect(summary.title).toBe('Bytte treningstid?');
      expect(summary.body).toBe('Kort beskrivelse');
      expect((summary as any).poll.options).toEqual([
        { text: 'Ja', voteCount: 2 },
        { text: 'Nei', voteCount: 0 }
      ]);
    });

    test('should fall back to the club payment title when title/body are absent', async () => {
      const client = new SpondClientFake();
      client.addPost({
        id: 'payment-post-1',
        type: 'CLUB_PAYMENT',
        groupId: 'group-1',
        ownerId: 'owner-1',
        timestamp: new Date().toISOString(),
        visibility: 'ALL',
        unread: false,
        commentsDisabled: false,
        muted: false,
        selectMemberPoll: false,
        clubPayment: {
          id: 'payment-1',
          title: 'Treningsavgift 2026',
          status: 'unanswered',
          amountFormatted: 'Kr 500'
        }
      } as any);
      const myCore = new SpondCore(client);

      const [summary] = await myCore.getPosts({ type: 'PAYMENT' });

      expect(summary.title).toBe('Treningsavgift 2026');
      expect((summary as any).payment).toEqual({ status: 'unanswered', amountFormatted: 'Kr 500', dueTimestamp: undefined });
    });
  });

  describe('searchAll', () => {
    test('should return matching events and posts of every type, tagged by kind', async () => {
      const client = new SpondClientFake();
      client.addEvent(SpondEventBuilder.anEvent().withHeading('Dugnad kveld').build());
      client.addPost({
        id: 'plain-1',
        type: 'PLAIN',
        groupId: 'group-1',
        title: 'Dugnad i helgen',
        body: 'Kom og hjelp til',
        ownerId: 'owner-1',
        timestamp: new Date().toISOString(),
        visibility: 'ALL',
        unread: false,
        commentsDisabled: false,
        muted: false,
        selectMemberPoll: false
      } as any);
      client.addPost({
        id: 'poll-1',
        type: 'POLL',
        groupId: 'group-1',
        ownerId: 'owner-1',
        timestamp: new Date().toISOString(),
        visibility: 'ALL',
        unread: false,
        commentsDisabled: false,
        muted: false,
        selectMemberPoll: false,
        poll: { id: 'p1', question: 'Dugnad lørdag eller søndag?', multipleChoice: false, options: [] }
      } as any);
      client.addPost({
        id: 'other-plain',
        type: 'PLAIN',
        groupId: 'group-1',
        title: 'Uten treff',
        body: 'Ingenting relevant',
        ownerId: 'owner-1',
        timestamp: new Date().toISOString(),
        visibility: 'ALL',
        unread: false,
        commentsDisabled: false,
        muted: false,
        selectMemberPoll: false
      } as any);
      const myCore = new SpondCore(client);

      const results = await myCore.searchAll('dugnad');

      expect(results.every(r => typeof (r as any).kind === 'string')).toBe(true);
      expect(results.map(r => (r as any).kind).sort()).toEqual(['event', 'post', 'post']);
      expect(results.some(r => (r as any).kind === 'event' && (r as any).heading === 'Dugnad kveld')).toBe(true);
      expect(results.some(r => (r as any).kind === 'post' && (r as any).id === 'plain-1')).toBe(true);
      expect(results.some(r => (r as any).kind === 'post' && (r as any).id === 'poll-1')).toBe(true);
      expect(results.some(r => (r as any).id === 'other-plain')).toBe(false);
    });

    test('should respect maxResults across the combined results', async () => {
      const client = new SpondClientFake();
      for (let i = 0; i < 5; i++) {
        client.addEvent(SpondEventBuilder.anEvent().withId(`evt-${i}`).withHeading(`Match event ${i}`).build());
      }
      const myCore = new SpondCore(client);

      const results = await myCore.searchAll('match', 3);

      expect(results).toHaveLength(3);
    });
  });

  describe('searchFiles', () => {
    test('should find a filename match without needing the content option', async () => {
      const client = new SpondClientFake();
      client.addGroup(SpondGroupMother.createActiveGroup());
      const myCore = new SpondCore(client);

      const results = await myCore.searchFiles('meeting');

      expect(results).toEqual([
        expect.objectContaining({ matchType: 'filename', id: 'file1', name: 'meeting-notes.pdf' })
      ]);
    });

    test('should not search file content unless the content option is set', async () => {
      const client = new SpondClientFake();
      client.addGroup(SpondGroupMother.createActiveGroup());
      client.setFileContent('file1', 'this document mentions dugnad several times');
      const myCore = new SpondCore(client);

      const results = await myCore.searchFiles('dugnad');

      expect(results).toEqual([]);
    });

    test('should find a content match when the content option is set', async () => {
      const client = new SpondClientFake();
      client.addGroup(SpondGroupMother.createActiveGroup());
      client.setFileContent('file1', 'this document mentions dugnad several times');
      const myCore = new SpondCore(client);

      const results = await myCore.searchFiles('dugnad', { content: true });

      expect(results).toEqual([
        expect.objectContaining({ matchType: 'content', id: 'file1', name: 'meeting-notes.pdf' })
      ]);
    });

    test('should only search groups matching groupName when provided', async () => {
      const client = new SpondClientFake();
      client.addGroup(SpondGroupMother.createGroupWithCustomName('Other Group'));
      const myCore = new SpondCore(client);

      const results = await myCore.searchFiles('meeting', { groupName: 'Nonexistent' });

      expect(results).toEqual([]);
    });

    test('should respect maxResults', async () => {
      const client = new SpondClientFake();
      client.addGroup(SpondGroupMother.createActiveGroup());
      client.addGroup(SpondGroupMother.createGroupWithCustomName('Second Group'));
      const myCore = new SpondCore(client);

      const results = await myCore.searchFiles('e', {}, 1);

      expect(results).toHaveLength(1);
    });
  });
});