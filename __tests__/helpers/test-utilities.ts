import { jest } from '@jest/globals';
import type { SpondCore, ToolCallResultType } from '../../src/spond-core.js';

/**
 * Common test constants used across multiple test files
 */
export const TEST_CONSTANTS = {
  KNOWN_EVENT_IDS: {
    GAMING_CENTER: 'FE5E94BA079947CB98302FFF6C931963',
    HANDBALL: 'B4097F9546E2418EBF43CC92A8B906A0',
    FLEA_MARKET: '209AB44159AD4C5C88054C44A3F51CA0'
  },
  GROUP_NAMES: {
    GAMING_CENTER_JUNIOR: 'Gaming Center Junior',
    COMMUNITY_FLEA_MARKET: 'Community Flea Market 2025',
    SPORTS_CLUB_HANDBALL: 'Example Sports Club Handball G2013'
  },
  SEARCH_TERMS: {
    GAMING_CENTER: 'Gaming Center',
    FLEA_MARKET: 'flea market',
    COMMUNITY: 'Community'
  }
};

/**
 * Mock setup - this should be called at the module level, not inside functions
 */
jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

/**
 * Setup function for consistency (no-op since mock is already set up)
 */
export function setupNodeFetchMock(): void {
  // Mock is already set up at module level
}

/**
 * Creates a standardized SpondCore instance for testing
 * This function must be called after proper mocking is set up
 */
export async function createTestMcpCore(): Promise<SpondCore> {
  const { SpondCore } = await import('../../src/spond-core.js');
  const { SpondClientFake } = await import('../../src/spond-client-fake.js');
  const fakeClient = SpondClientFake.withMockData();
  return new SpondCore(fakeClient);
}

/**
 * Common assertion utilities for reducing duplicate validation code
 */
export class TestAssertions {
  /**
   * Validates that a tool call result has the expected structure
   */
  static async validateSuccessfulToolResult(result: any, expectedType?: any): Promise<void> {
    if (!expectedType) {
      const { ToolCallResultType } = await import('../../src/spond-core.js');
      expectedType = ToolCallResultType.Success;
    }
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.type).toBe(expectedType);
  }

  /**
   * Validates that a result contains an array of events
   */
  static async validateEventArray(result: any, minLength: number = 0): Promise<void> {
    await this.validateSuccessfulToolResult(result);
    expect(Array.isArray(result.data)).toBe(true);
    if (minLength > 0) {
      expect(result.data.length).toBeGreaterThanOrEqual(minLength);
    }
  }

  /**
   * Validates that events have the required structure
   */
  static validateEventStructure(events: any[]): void {
    events.forEach(event => {
      expect(event).toHaveProperty('id');
      expect(event).toHaveProperty('heading');
      expect(event).toHaveProperty('startTime');
      expect(event).toHaveProperty('endTime');
      expect(typeof event.id).toBe('string');
      expect(typeof event.heading).toBe('string');
    });
  }

  /**
   * Validates that events match a search term
   */
  static validateSearchResults(events: any[], searchTerm: string): void {
    const lowerSearchTerm = searchTerm.toLowerCase();
    events.forEach(event => {
      const matchFound = 
        event.heading?.toLowerCase().includes(lowerSearchTerm) ||
        event.description?.toLowerCase().includes(lowerSearchTerm) ||
        event.groupName?.toLowerCase().includes(lowerSearchTerm);
      expect(matchFound).toBe(true);
    });
  }

  /**
   * Validates that all events are upcoming (end time in future)
   */
  static validateUpcomingEvents(events: any[]): void {
    const now = new Date();
    events.forEach(event => {
      const endDate = new Date(event.endTime);
      expect(endDate.getTime()).toBeGreaterThan(now.getTime());
    });
  }

  /**
   * Validates that events are from a specific group
   */
  static validateGroupFilter(events: any[], groupName: string): void {
    const lowerGroupName = groupName.toLowerCase();
    events.forEach(event => {
      expect(event.groupName?.toLowerCase()).toContain(lowerGroupName);
    });
  }

  /**
   * Validates that events are sorted by start time in ascending order
   */
  static validateEventSorting(events: any[], ascending: boolean = true): void {
    if (events.length > 1) {
      for (let i = 0; i < events.length - 1; i++) {
        const current = new Date(events[i].startTime);
        const next = new Date(events[i + 1].startTime);
        
        if (ascending) {
          expect(current.getTime()).toBeLessThanOrEqual(next.getTime());
        } else {
          expect(current.getTime()).toBeGreaterThanOrEqual(next.getTime());
        }
      }
    }
  }

  /**
   * Validates MCP response structure
   */
  static validateMCPResponse(response: any, expectedId: number | string): void {
    expect(response).toBeDefined();
    expect(response.id).toBe(expectedId);
    expect(response.jsonrpc).toBe('2.0');
  }

  /**
   * Validates MCP tool call response content
   */
  static validateMCPToolResponse(response: any): void {
    expect(response.result).toBeDefined();
    expect(response.result.content).toBeDefined();
    expect(response.result.content[0].type).toBe('text');
    expect(typeof response.result.content[0].text).toBe('string');
  }

  /**
   * Validates MCP resource response content
   */
  static validateMCPResourceResponse(response: any, expectedUri: string): void {
    expect(response.result).toBeDefined();
    expect(response.result.contents).toBeDefined();
    expect(Array.isArray(response.result.contents)).toBe(true);
    expect(response.result.contents.length).toBe(1);
    
    const content = response.result.contents[0];
    expect(content.uri).toBe(expectedUri);
    expect(content.mimeType).toBe('application/json');
    expect(typeof content.text).toBe('string');
  }

  /**
   * Validates that an MCP response contains an error
   */
  static validateMCPError(response: any, expectedCode?: number): void {
    expect(response.error).toBeDefined();
    expect(response.error.code).toBeDefined();
    expect(response.error.message).toBeDefined();
    
    if (expectedCode !== undefined) {
      expect(response.error.code).toBe(expectedCode);
    }
  }
}

/**
 * Test data generators for consistent test scenarios
 */
export class TestDataGenerators {
  /**
   * Generate common tool call parameters for testing
   */
  static getEventParams = {
    minimal: { max: 1 },
    standard: { max: 20, includeComments: true, addProfileInfo: true },
    withDateRange: (minDate: string, maxDate: string) => ({
      minEndTimestamp: minDate,
      maxEndTimestamp: maxDate,
      max: 50
    }),
    withSorting: (order: 'asc' | 'desc' = 'asc') => ({
      max: 10,
      order
    })
  };

  /**
   * Generate test event IDs for various scenarios
   */
  static getTestEventId = {
    existing: () => TEST_CONSTANTS.KNOWN_EVENT_IDS.GAMING_CENTER,
    nonExistent: () => 'NON_EXISTENT_ID_12345'
  };

  /**
   * Generate search parameters for testing
   */
  static getSearchParams = {
    byHeading: (term: string = TEST_CONSTANTS.SEARCH_TERMS.GAMING_CENTER) => ({
      searchTerm: term,
      maxResults: 10
    }),
    byGroup: (groupName: string = TEST_CONSTANTS.SEARCH_TERMS.COMMUNITY) => ({
      groupName,
      maxResults: 20
    })
  };
}

/**
 * Common test scenarios that can be reused across multiple test files
 */
export class CommonTestScenarios {
  /**
   * Run a basic tool call validation test
   */
  static async validateBasicToolCall(
    core: SpondCore, 
    toolName: string, 
    params: any, 
    expectedType?: any
  ) {
    const result = await core.processToolCall(toolName, params);
    await TestAssertions.validateSuccessfulToolResult(result, expectedType);
    return result;
  }

  /**
   * Run a basic resource read validation test
   */
  static async validateBasicResourceRead(
    core: SpondCore,
    uri: string
  ) {
    const result = await core.processResourceRead(uri);
    expect(result).toBeDefined();
    expect(result.data).toBeDefined();
    expect(result.uri).toBe(uri);
    return result;
  }

  /**
   * Test event array results with common validations
   */
  static async validateEventArrayResult(
    core: SpondCore,
    toolName: string,
    params: any,
    minLength: number = 1
  ) {
    const result = await this.validateBasicToolCall(core, toolName, params);
    await TestAssertions.validateEventArray(result, minLength);
    TestAssertions.validateEventStructure(result.data);
    return result;
  }
}