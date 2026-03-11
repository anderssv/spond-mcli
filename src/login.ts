import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { DEFAULT_TOKEN_FILE, validateSpondToken } from './token-config.js';

export function decodeTokenFromLocalStorage(rawValue: string | null): string | null {
  if (!rawValue) return null;
  return Buffer.from(rawValue, 'base64').toString('utf-8');
}

const SPOND_CLIENT_URL = 'https://spond.com/client';
const POLL_INTERVAL_MS = 1000;
const LOGIN_TIMEOUT_MS = 120_000;

export async function performLogin(tokenFilePath: string = DEFAULT_TOKEN_FILE): Promise<string> {
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

    mkdirSync(dirname(tokenFilePath), { recursive: true });
    writeFileSync(tokenFilePath, token, 'utf-8');
    console.error(`Token saved to ${tokenFilePath}`);
    return token;
  } finally {
    await browser.close();
  }
}

async function pollForToken(page: import('playwright').Page): Promise<string> {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const rawToken = await page.evaluate(() => window.localStorage.getItem('token'));
    const decoded = decodeTokenFromLocalStorage(rawToken);
    if (decoded) return decoded;

    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error('Login timed out — no token found after 2 minutes');
}
