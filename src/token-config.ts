/**
 * Centralized token configuration utility
 * Handles token reading from environment, .env files, and mock mode detection
 */

import { default as fetch } from 'node-fetch';
import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

export interface TokenConfig {
  token: string;
  useMockData: boolean;
  fetchFn?: typeof fetch;
}

export interface TokenValidationResult {
  isValid: boolean;
  token?: string;
  source: 'env' | 'dotenv' | 'none';
  error?: string;
}

/**
 * Magic value for enabling mock mode via SPOND_TOKEN
 */
export const MOCK_TOKEN_VALUE = 'mock-data';

/**
 * Validate that a token appears to be a valid Spond token
 * Note: Spond tokens may not follow standard JWT format
 */
export function validateSpondToken(token: string): { isValid: boolean; error?: string } {
  if (!token || typeof token !== 'string') {
    return { isValid: false, error: 'Token is empty or not a string' };
  }
  
  if (token === MOCK_TOKEN_VALUE) {
    return { isValid: true }; // Mock token is always valid
  }
  
  // Check minimum length for Spond tokens (they should be substantial)
  if (token.length < 20) {
    return { isValid: false, error: 'Token is too short to be a valid Spond token (minimum 20 characters)' };
  }
  
  // Check for reasonable token characteristics (alphanumeric + common token chars)
  const tokenPattern = /^[A-Za-z0-9+/=._-]+$/;
  if (!tokenPattern.test(token)) {
    return { isValid: false, error: 'Token contains invalid characters for a Spond token' };
  }
  
  return { isValid: true };
}

/**
 * Find and validate the Spond token from environment variable only
 * Used for regular application usage - does not load .env files
 */
export function findValidTokenFromEnv(): TokenValidationResult {
  const token = process.env.SPOND_TOKEN;
  if (!token) {
    return {
      isValid: false,
      source: 'env',
      error: 'No SPOND_TOKEN found in environment'
    };
  }
  
  const validation = validateSpondToken(token);
  return {
    isValid: validation.isValid,
    token: validation.isValid ? token : undefined,
    source: 'env',
    error: validation.error
  };
}

/**
 * Find and validate the Spond token from various sources including .env file
 * Used specifically for integration tests that need to load .env files
 */
export function findValidTokenForIntegration(): TokenValidationResult {
  // First check environment variable
  let token = process.env.SPOND_TOKEN;
  if (token) {
    const validation = validateSpondToken(token);
    return {
      isValid: validation.isValid,
      token: validation.isValid ? token : undefined,
      source: 'env',
      error: validation.error
    };
  }
  
  // Then try to load .env file and check for token
  if (existsSync('.env')) {
    try {
      // Load .env file into process.env
      config();
      
      // Check if the .env file provided a token
      token = process.env.SPOND_TOKEN;
      if (token) {
        const validation = validateSpondToken(token);
        return {
          isValid: validation.isValid,
          token: validation.isValid ? token : undefined,
          source: 'dotenv',
          error: validation.error
        };
      }
    } catch (error) {
      return {
        isValid: false,
        source: 'dotenv',
        error: `Failed to read .env file: ${error}`
      };
    }
  }
  
  return {
    isValid: false,
    source: 'none',
    error: 'No SPOND_TOKEN found in environment or .env file'
  };
}

/**
 * Read token from environment and determine if mock mode should be used
 * This is for regular application usage - does not load .env files
 * @returns Token configuration object
 * @throws Error if no valid token is found
 */
export function getTokenAndMockMode(): TokenConfig {
  // Check if mock mode is explicitly enabled
  if (process.env.SPOND_MOCK_MODE === 'true') {
    return {
      token: MOCK_TOKEN_VALUE,
      useMockData: true
    };
  }
  
  const tokenResult = findValidTokenFromEnv();
  
  // If we have a valid token, use it
  if (tokenResult.isValid && tokenResult.token) {
    return {
      token: tokenResult.token,
      useMockData: tokenResult.token === MOCK_TOKEN_VALUE
    };
  }
  
  // If no valid token found, throw an error
  throw new Error('SPOND_TOKEN environment variable is required. Set it to a valid token or "mock-data" for testing.');
}

/**
 * Get token configuration for real API tests
 * This version loads .env files for integration testing
 * @throws Error if no valid token is available for real API calls
 */
export function getTokenForRealApiTests(): TokenConfig {
  const tokenResult = findValidTokenForIntegration();
  
  if (!tokenResult.isValid || !tokenResult.token || tokenResult.token === MOCK_TOKEN_VALUE) {
    throw new Error(
      `Real API tests require a valid SPOND_TOKEN. ${tokenResult.error || 'No valid token found'}. ` +
      'Please set SPOND_TOKEN in your environment or .env file.'
    );
  }
  
  return {
    token: tokenResult.token,
    useMockData: false
  };
}

/**
 * Determine if mock mode should be used based on token value
 * @returns true if mock mode should be used
 */
export function shouldUseMockMode(): boolean {
  try {
    const config = getTokenAndMockMode();
    return config.useMockData;
  } catch {
    // If token reading fails, assume we need mock mode
    return true;
  }
}

/**
 * Create a mock token configuration for testing
 * @returns Mock token configuration
 */
export function createMockTokenConfig(): TokenConfig {
  return {
    token: MOCK_TOKEN_VALUE,
    useMockData: true
  };
}

export const DEFAULT_TOKEN_FILE = join(homedir(), '.config', 'spond', 'token');

export function getTokenWithFileFallback(tokenFilePath: string = DEFAULT_TOKEN_FILE): TokenConfig {
  try {
    return getTokenAndMockMode();
  } catch {
    // Fall back to token file
  }

  if (existsSync(tokenFilePath)) {
    const token = readFileSync(tokenFilePath, 'utf-8').trim();
    const validation = validateSpondToken(token);
    if (validation.isValid) {
      return {
        token,
        useMockData: token === MOCK_TOKEN_VALUE
      };
    }
    throw new Error(`Token in ${tokenFilePath} is invalid: ${validation.error}`);
  }

  throw new Error(
    'No SPOND_TOKEN found. Set SPOND_TOKEN environment variable or run "spond-mcli login" to save token to ~/.config/spond/token'
  );
}