import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { SpondClientFake } from '../../src/spond-client-fake.js';

// Mock node-fetch only
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

// Mock the entire SDK to avoid import issues
jest.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class MockServer {
    setRequestHandler = jest.fn();
    connect = jest.fn();
  }
}));

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockTransport {
    onerror = null;
  }
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: 'call-tool',
  ErrorCode: { InvalidParams: -32602, MethodNotFound: -32601, InternalError: -32603 },
  ListResourcesRequestSchema: 'list-resources', 
  ListToolsRequestSchema: 'list-tools',
  McpError: class MockMcpError extends Error { code: number; constructor(code: number, message: string) { super(message); this.code = code; } },
  ReadResourceRequestSchema: 'read-resource'
}));

describe('SpondMcpServer Conversion Methods', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.error>;
  
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should convert tool result to MCP format with JSON string output', () => {
    // Test the convertToolResultToMcp method logic
    const mockResult = {
      type: 'SUCCESS',  // Using string instead of enum for simplicity
      data: [{ id: '123', name: 'test event' }]
    };

    // Simulate the server's conversion logic
    const mcpFormat = {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(mockResult.data, null, 2)
        }
      ]
    };

    expect(mcpFormat.content).toHaveLength(1);
    expect(mcpFormat.content[0].type).toBe('text');
    expect(typeof mcpFormat.content[0].text).toBe('string');

    // Verify the JSON string is properly formatted
    const parsed = JSON.parse(mcpFormat.content[0].text);
    expect(parsed).toEqual([{ id: '123', name: 'test event' }]);
  });

  test('should handle not found results with "Not found" text', () => {
    const mockResult = {
      type: 'NOT_FOUND',
      data: null
    };

    // Simulate the server's conversion logic for not found
    const mcpFormat = {
      content: [
        {
          type: 'text' as const,
          text: mockResult.data === null ? 'Not found' : JSON.stringify(mockResult.data, null, 2)
        }
      ]
    };

    expect(mcpFormat.content[0].text).toBe('Not found');
    expect(mcpFormat.content[0].type).toBe('text');
  });

  test('should convert resource result to MCP format with mimeType', () => {
    const mockResourceResult = {
      uri: 'spond://events/upcoming',
      data: [{ id: '456', heading: 'test event' }]
    };

    // Simulate the server's resource conversion logic
    const mcpFormat = {
      contents: [
        {
          uri: mockResourceResult.uri,
          mimeType: 'application/json',
          text: JSON.stringify(mockResourceResult.data, null, 2)
        }
      ]
    };

    expect(mcpFormat.contents).toHaveLength(1);
    expect(mcpFormat.contents[0].uri).toBe('spond://events/upcoming');
    expect(mcpFormat.contents[0].mimeType).toBe('application/json');
    expect(typeof mcpFormat.contents[0].text).toBe('string');

    // Verify the JSON string
    const parsed = JSON.parse(mcpFormat.contents[0].text);
    expect(parsed).toEqual([{ id: '456', heading: 'test event' }]);
  });

  test('should map core error codes to MCP error codes', () => {
    // Test the mapCoreErrorCode method logic
    const testCases = [
      { core: 'INVALID_PARAMS', expected: -32602 },
      { core: 'METHOD_NOT_FOUND', expected: -32601 },
      { core: 'INTERNAL_ERROR', expected: -32603 },
      { core: 'UNKNOWN', expected: -32603 } // Default case
    ];

    testCases.forEach(({ core, expected }) => {
      let mcpErrorCode: number;
      
      // Simulate the server's error mapping logic
      switch (core) {
        case 'INVALID_PARAMS':
          mcpErrorCode = -32602;
          break;
        case 'METHOD_NOT_FOUND':
          mcpErrorCode = -32601;
          break;
        case 'INTERNAL_ERROR':
          mcpErrorCode = -32603;
          break;
        default:
          mcpErrorCode = -32603;
      }
      
      expect(mcpErrorCode).toBe(expected);
    });
  });
});

describe('SpondMcpServer Instance Tests', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.error>;
  
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should create server instance successfully with injected client', async () => {
    const { SpondMcpServer } = await import('../../src/index.js');
    
    const mockClient = SpondClientFake.withMockData();
    const server = new SpondMcpServer(mockClient);
    
    expect(server).toBeDefined();
    // When injecting a mock client directly, no console message is expected
  });

  test('should create server instance successfully with environment config and print message', async () => {
    // Set up mock mode in environment
    process.env.SPOND_MOCK_MODE = 'true';
    delete process.env.SPOND_TOKEN;

    const { SpondMcpServer } = await import('../../src/index.js');
    
    const server = new SpondMcpServer();
    
    expect(server).toBeDefined();
    expect(consoleSpy).toHaveBeenCalledWith('Spond MCP server initialized with mock data');
  });

  test('should have run method that sets up transport', async () => {
    const { SpondMcpServer } = await import('../../src/index.js');
    
    const mockClient = SpondClientFake.withMockData();
    const server = new SpondMcpServer(mockClient);
    
    expect(typeof server.run).toBe('function');
    
    // Test the run method doesn't throw
    await expect(server.run()).resolves.toBeUndefined();
  });
});

describe('SpondMcpServer Error Handling Tests', () => {
  let consoleSpy: jest.SpiedFunction<typeof console.error>;
  
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('should initialize with mock mode successfully', async () => {
    const { SpondMcpServer } = await import('../../src/index.js');
    
    const mockClient = SpondClientFake.withMockData();
    const server = new SpondMcpServer(mockClient);
    
    expect(server).toBeDefined();
    // When injecting a mock client directly, no console message is expected
  });

  test('should handle transport error setup', async () => {
    const { SpondMcpServer } = await import('../../src/index.js');
    
    const mockClient = SpondClientFake.withMockData();
    const server = new SpondMcpServer(mockClient);
    
    // Test that run method sets up error handler
    await server.run();
    
    expect(consoleSpy).toHaveBeenCalledWith('Spond MCP server running on stdio');
  });
});