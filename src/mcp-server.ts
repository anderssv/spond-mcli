import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { SpondCore, CoreError, CoreErrorCode, ToolCallResult, ResourceReadResult, ToolCallResultType } from './spond-core.js';
import { getTokenWithFileFallback } from './token-config.js';
import { ISpondClient } from './spond-client-interface.js';
import { buildSpondClient } from './client-factory.js';
import { getPromptDefinitions, getPrompt } from './prompts.js';

// Kept in sync with package.json's "version" — __tests__/unit/server-version.test.ts
// asserts they match, since ESM JSON-import syntax isn't portable across
// tsc's build output and ts-jest's per-file transpile mode.
export const SERVER_VERSION = '3.3.0';

export class SpondMcpServer {
  private server: Server;
  private core: SpondCore;

  constructor(spondClient?: ISpondClient, workspaceDir?: string) {
    this.server = new Server(
      {
        name: 'spond-mcli',
        version: SERVER_VERSION,
      },
      {
        capabilities: {
          resources: {},
          tools: {},
          prompts: {},
        },
      }
    );

    try {
      // Use provided client or create one based on environment config
      if (spondClient) {
        this.core = new SpondCore(spondClient, workspaceDir);
      } else {
        const config = getTokenWithFileFallback();
        const client = buildSpondClient(config.token, config.fetchFn);

        this.core = new SpondCore(client, workspaceDir);

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

    // List available prompts
    this.server.setRequestHandler(ListPromptsRequestSchema, async () => {
      return {
        prompts: getPromptDefinitions()
      };
    });

    // Handle prompt retrieval
    this.server.setRequestHandler(GetPromptRequestSchema, async (request) => {
      try {
        return getPrompt(request.params.name, request.params.arguments ?? {}) as ReturnType<typeof getPrompt> & Record<string, unknown>;
      } catch (error) {
        throw new McpError(ErrorCode.InvalidParams, (error as Error).message);
      }
    });
  }

  private convertToolResultToMcp(result: ToolCallResult) {
    if (result.type === ToolCallResultType.NotFound) {
      return {
        content: [
          {
            type: 'text' as const,
            text: result.data === null ? 'Not found' : JSON.stringify(result.data)
          }
        ]
      };
    }

    const content: { type: 'text'; text: string }[] = [
      { type: 'text', text: JSON.stringify(result.data) }
    ];
    if (result.note) {
      content.push({ type: 'text', text: result.note });
    }

    return { content };
  }

  private convertResourceResultToMcp(result: ResourceReadResult) {
    return {
      contents: [
        {
          uri: result.uri,
          mimeType: 'application/json',
          text: JSON.stringify(result.data)
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

  // Connects any MCP transport (stdio, HTTP, ...) to this server instance's
  // handlers. Exposed so alternate transports (see http-server.ts) can reuse
  // the same tool/resource wiring without duplicating it.
  async connect(transport: Transport): Promise<void> {
    await this.server.connect(transport);
  }

  // Convenience wrapper for the common case: connect over stdio.
  async run(): Promise<void> {
    const transport = new StdioServerTransport();

    transport.onerror = (error) => {
      console.error('Transport error:', error);
    };

    await this.connect(transport);
    console.error('Spond MCLI server running on stdio');
  }
}
