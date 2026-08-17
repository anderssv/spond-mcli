// Custom error types to avoid MCP SDK dependency
export enum CoreErrorCode {
  InvalidParams = -32602,
  MethodNotFound = -32601,
  InternalError = -32603
}

// Result type enum for tool calls
export enum ToolCallResultType {
  Success = 'success',
  NotFound = 'not_found'
}

export class CoreError extends Error {
  constructor(public code: CoreErrorCode, message: string) {
    super(message);
    this.name = 'CoreError';
  }
}
