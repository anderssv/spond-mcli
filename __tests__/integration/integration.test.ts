import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { MCPTestHelper } from '../helpers/mcp-test-helper.js';
import { TestAssertions } from '../helpers/test-utilities.js';
import { SpondCore, CoreError, CoreErrorCode } from '../../src/spond-core.js';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch to avoid ES module issues in tests
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

describe('Full-Stack Integration Tests', () => {
  let core: SpondCore;

  beforeEach(() => {
    // Use mock mode for testing
    const mockClient = SpondClientFake.withMockData();
    core = new SpondCore(mockClient);
  });
  describe('MCP Server Protocol Compliance', () => {
    test('should handle tool calls through MCP server', async () => {
      const request = MCPTestHelper.createToolCallRequest('get_events', { max: 1 });

      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      TestAssertions.validateMCPResponse(response, request.id);
      TestAssertions.validateMCPToolResponse(response);
      
      const events = JSON.parse(response.result.content[0].text);
      expect(Array.isArray(events)).toBe(true);
    });

    test('should handle resource reads through MCP server', async () => {
      const uri = 'spond://events/upcoming';
      const request = MCPTestHelper.createResourceReadRequest(uri);

      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      TestAssertions.validateMCPResponse(response, request.id);
      TestAssertions.validateMCPResourceResponse(response, uri);
      
      const events = JSON.parse(response.result.contents[0].text);
      expect(Array.isArray(events)).toBe(true);
    });

    test('should handle tool listing through MCP server', async () => {
      const request = MCPTestHelper.createToolsListRequest();

      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      TestAssertions.validateMCPResponse(response, request.id);
      expect(response.result.tools).toBeDefined();
      expect(Array.isArray(response.result.tools)).toBe(true);
      expect(response.result.tools.length).toBeGreaterThan(0);
    });

    test('should handle resource listing through MCP server', async () => {
      const request = MCPTestHelper.createResourcesListRequest();

      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      TestAssertions.validateMCPResponse(response, request.id);
      expect(response.result.resources).toBeDefined();
      expect(Array.isArray(response.result.resources)).toBe(true);
      expect(response.result.resources.length).toBeGreaterThan(0);
    });

    test('should handle errors through MCP server', async () => {
      const request = MCPTestHelper.createToolCallRequest('invalid_tool', {});

      const result = await MCPTestHelper.sendMCPRequest(request, true);
      const response = result.responses.find(r => r.id === request.id);
      
      TestAssertions.validateMCPResponse(response, request.id);
      TestAssertions.validateMCPError(response);
    });
  });

  describe('MCP Resources Integration', () => {
    test('should read upcoming events resource', async () => {
      const result = await core.processResourceRead('spond://events/upcoming');
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.uri).toBe('spond://events/upcoming');
      
      expect(Array.isArray(result.data)).toBe(true);
    });

    test('should read all events resource', async () => {
      const result = await core.processResourceRead('spond://events/all');
      
      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.uri).toBe('spond://events/all');
      
      expect(Array.isArray(result.data)).toBe(true);
    });
  });
});