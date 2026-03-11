#!/usr/bin/env node
// Quick script to investigate where Spond stores the auth token in the browser.
// Run: node examples/investigate-token.mjs
// Log in manually, then press Enter in the terminal.

import { chromium } from 'playwright';
import * as readline from 'readline';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const question = (q) => new Promise(resolve => rl.question(q, resolve));

const browser = await chromium.launch({ headless: false });
const context = await browser.newContext();
const page = await context.newPage();

await page.goto('https://spond.com/client');
console.log('Browser opened at https://spond.com/client');
console.log('Please log in manually, then press Enter here...');
await question('');

console.log('\n--- localStorage ---');
const localStorage = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    items[key] = window.localStorage.getItem(key);
  }
  return items;
});
console.log(JSON.stringify(localStorage, null, 2));

console.log('\n--- sessionStorage ---');
const sessionStorage = await page.evaluate(() => {
  const items = {};
  for (let i = 0; i < window.sessionStorage.length; i++) {
    const key = window.sessionStorage.key(i);
    items[key] = window.sessionStorage.getItem(key);
  }
  return items;
});
console.log(JSON.stringify(sessionStorage, null, 2));

console.log('\n--- cookies ---');
const cookies = await context.cookies();
console.log(JSON.stringify(cookies.map(c => ({ name: c.name, domain: c.domain, value: c.value.substring(0, 30) + '...' })), null, 2));

// Also check if there's anything in indexedDB
console.log('\n--- indexedDB databases ---');
const dbs = await page.evaluate(async () => {
  const databases = await indexedDB.databases();
  return databases.map(db => db.name);
});
console.log(JSON.stringify(dbs, null, 2));

rl.close();
await browser.close();
