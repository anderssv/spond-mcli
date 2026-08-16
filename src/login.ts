import { chromium } from 'playwright';
import nodeFetch from 'node-fetch';
import { writeFileSync, mkdirSync, chmodSync } from 'fs';
import { dirname } from 'path';
import { DEFAULT_TOKEN_FILE, validateSpondToken } from './token-config.js';
import { extractAccessToken } from './domain-logic.js';

export function extractTokenFromLocalStorage(rawValue: string | null): string | null {
  if (!rawValue) return null;
  return rawValue;
}

const SPOND_CLIENT_URL = 'https://spond.com/client';
const LOGIN_URL = 'https://api.spond.com/core/v1/auth2/login';
const POLL_INTERVAL_MS = 1000;
const LOGIN_TIMEOUT_MS = 120_000;

function saveToken(token: string, tokenFilePath: string): void {
  mkdirSync(dirname(tokenFilePath), { recursive: true });
  writeFileSync(tokenFilePath, token, { encoding: 'utf-8', mode: 0o600 });
  chmodSync(tokenFilePath, 0o600);
}

export async function performPasswordLogin(
  email: string,
  password: string,
  tokenFilePath: string = DEFAULT_TOKEN_FILE,
  fetchFn: typeof nodeFetch = nodeFetch
): Promise<string> {
  const response = await fetchFn(LOGIN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const loginResult = await response.json() as Record<string, unknown>;
  const token = extractAccessToken(loginResult);

  saveToken(token, tokenFilePath);
  console.error(`Token saved to ${tokenFilePath}`);
  return token;
}

export async function performBrowserLogin(tokenFilePath: string = DEFAULT_TOKEN_FILE): Promise<string> {
  const browser = await chromium.launch({ headless: false });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await page.goto(SPOND_CLIENT_URL);
    console.error('Browser opened at ' + SPOND_CLIENT_URL);
    console.error('Waiting for login... (timeout: 2 minutes)');

    const token = await pollForToken(page);

    const validation = validateSpondToken(token);
    if (!validation.isValid) {
      throw new Error(`Extracted token is invalid: ${validation.error}`);
    }

    saveToken(token, tokenFilePath);
    console.error(`Token saved to ${tokenFilePath}`);
    return token;
  } finally {
    await browser.close();
  }
}

interface PollablePage {
  evaluate(fn: () => string | null): Promise<string | null>;
}

export async function pollForToken(
  page: PollablePage,
  pollIntervalMs: number = POLL_INTERVAL_MS,
  timeoutMs: number = LOGIN_TIMEOUT_MS
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    let rawToken: string | null = null;
    try {
      rawToken = await page.evaluate(() => window.localStorage.getItem('token'));
    } catch {
      // The SPA can navigate mid-poll, destroying the execution context.
      // Treat that as "no token yet" and keep polling rather than aborting login.
    }

    const extracted = extractTokenFromLocalStorage(rawToken);
    if (extracted) return extracted;

    await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error('Login timed out — no token found after 2 minutes');
}
