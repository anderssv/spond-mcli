import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondCore, CoreError, CoreErrorCode, ToolCallResultType } from '../../src/spond-core.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';
import { SpondGroupMother } from '../helpers/object-mothers.js';

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
      
      expect(tools).toHaveLength(17);
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
});