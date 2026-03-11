#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResult, ResourceReadResult, ToolCallResultType } from './spond-core.js';
import { getTokenAndMockMode, TokenConfig } from './token-config.js';
import { ISpondClient } from './spond-client-interface.js';
import { SpondClient } from './spond-client.js';
import { SpondClientFake } from './spond-client-fake.js';


class SpondMcpServer {
  private server: Server;
  private core: SpondCore;

  constructor(spondClient?: ISpondClient) {
    this.server = new Server(
      {
        name: 'spond-mcli',
        version: '1.0.0',
      },
      {
        capabilities: {
          resources: {},
          tools: {},
        },
      }
    );

    try {
      // Use provided client or create one based on environment config
      if (spondClient) {
        this.core = new SpondCore(spondClient);
      } else {
        const config = getTokenAndMockMode();
        const client = config.useMockData 
          ? SpondClientFake.withMockData()
          : new SpondClient(config.token, config.fetchFn);
        
        this.core = new SpondCore(client);
        
        if (config.useMockData) {
          console.error('Spond MCP server initialized with mock data');
        }
      }
    } catch (error) {
      console.error('Failed to initialize Spond MCP core:', error);
      if (process.env.NODE_ENV !== 'test') {
        process.exit(1);
      }
      throw error; // Re-throw in test environment
    }

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: this.core.getToolDefinitions()
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const result = await this.core.processToolCall(request.params.name, request.params.arguments);
        return this.convertToolResultToMcp(result);
      } catch (error) {
        if (error instanceof CoreError) {
          throw new McpError(this.mapCoreErrorCode(error.code), error.message);
        }
        throw error;
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: this.core.getResourceDefinitions()
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      try {
        const result = await this.core.processResourceRead(request.params.uri);
        return this.convertResourceResultToMcp(result);
      } catch (error) {
        if (error instanceof CoreError) {
          throw new McpError(this.mapCoreErrorCode(error.code), error.message);
        }
        throw error;
      }
    });
  }

  private convertToolResultToMcp(result: ToolCallResult) {
    if (result.type === ToolCallResultType.NotFound) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.data === null ? 'Not found' : JSON.stringify(result.data, null, 2)
          }
        ]
      };
    }

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result.data, null, 2)
        }
      ]
    };
  }

  private convertResourceResultToMcp(result: ResourceReadResult) {
    return {
      contents: [
        {
          uri: result.uri,
          mimeType: 'application/json',
          text: JSON.stringify(result.data, null, 2)
        }
      ]
    };
  }

  private mapCoreErrorCode(coreErrorCode: CoreErrorCode): ErrorCode {
    switch (coreErrorCode) {
      case CoreErrorCode.InvalidParams:
        return ErrorCode.InvalidParams;
      case CoreErrorCode.MethodNotFound:
        return ErrorCode.MethodNotFound;
      case CoreErrorCode.InternalError:
        return ErrorCode.InternalError;
      default:
        return ErrorCode.InternalError;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    
    // Set up proper error handling for the transport
    transport.onerror = (error) => {
      console.error('Transport error:', error);
    };
    
    await this.server.connect(transport);
    console.error('Spond MCLI server running on stdio');
  }

}

// Export the server class for testing
export { SpondMcpServer };

// Start the server only if this file is run directly
// For testing purposes, we'll check if NODE_ENV is not 'test'
if (process.env.NODE_ENV !== 'test') {
  const server = new SpondMcpServer();
  server.run().catch((error) => {
    console.error('Failed to start server:', error);
    process.exit(1);
  });
}