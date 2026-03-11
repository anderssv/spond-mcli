import { spawn } from 'child_process';
import { MOCK_TOKEN_VALUE } from '../../src/token-config.js';

export interface MCPTestResult {
  responses: any[];
  stderr: string;
  code: number | null;
}

export class MCPTestHelper {
  static async sendMCPRequest(request: any, mockMode?: boolean): Promise<MCPTestResult> {
    return new Promise((resolve, reject) => {
      let response = '';
      let error = '';
      let timeout: NodeJS.Timeout;

      // Set up environment - use mock mode if specified or no token available
      const env = { 
        ...process.env, 
        NODE_ENV: 'production',
        SPOND_TOKEN: mockMode ? MOCK_TOKEN_VALUE : (process.env.SPOND_TOKEN || MOCK_TOKEN_VALUE)
      };

      const server = spawn('node', ['dist/index.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env
      });

      server.stdout.on('data', (data) => {
        response += data.toString();
      });

      server.stderr.on('data', (data) => {
        error += data.toString();
      });

      server.on('close', (code) => {
        clearTimeout(timeout);
        try {
          const lines = response.trim().split('\n').filter(line => line.trim());
          const jsonResponses = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              // Only log parsing errors if needed for debugging
              // console.log('Failed to parse line:', line, e);
              return null;
            }
          }).filter(Boolean);
          
          resolve({ responses: jsonResponses, stderr: error, code });
        } catch (e) {
          reject(new Error(`Failed to parse response: ${(e as Error).message}`));
        }
      });

      server.on('error', (error) => {
        reject(new Error(`Server error: ${error.message}`));
      });

      // Send initialize request first
      const initRequest = {
        jsonrpc: '2.0',
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' }
        },
        id: 0
      };

      server.stdin.write(JSON.stringify(initRequest) + '\n');
      server.stdin.write(JSON.stringify(request) + '\n');
      server.stdin.end();

      timeout = setTimeout(() => {
        if (!server.killed) {
          server.kill('SIGTERM');
          setTimeout(() => {
            if (!server.killed) {
              server.kill('SIGKILL');
            }
          }, 1000);
        }
        reject(new Error('Request timeout'));
      }, 10000);
    });
  }

  static createToolCallRequest(toolName: string, args: any, id: string | number = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      }
    };
  }

  static createResourceReadRequest(uri: string, id: string | number = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method: 'resources/read',
      params: { uri }
    };
  }

  static createToolsListRequest(id: string | number = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method: 'tools/list'
    };
  }

  static createResourcesListRequest(id: string | number = 1) {
    return {
      jsonrpc: '2.0',
      id,
      method: 'resources/list'
    };
  }
}