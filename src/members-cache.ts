import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { homedir } from 'os';
import { MyMember } from './domain-logic.js';

export const DEFAULT_MEMBERS_CACHE_FILE = join(homedir(), '.config', 'spond', 'members.json');
export const MEMBERS_CACHE_TTL_MS = 5 * 60 * 1000;

export interface MembersCache {
  fetchedAt: string;
  members: MyMember[];
}

export function readMembersCache(path: string = DEFAULT_MEMBERS_CACHE_FILE): MembersCache | null {
  if (!existsSync(path)) {
    return null;
  }

  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as MembersCache;
  } catch {
    return null;
  }
}

export function writeMembersCache(
  members: MyMember[],
  path: string = DEFAULT_MEMBERS_CACHE_FILE,
  now: Date = new Date()
): void {
  mkdirSync(dirname(path), { recursive: true });
  const cache: MembersCache = { fetchedAt: now.toISOString(), members };
  writeFileSync(path, JSON.stringify(cache, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

export function isCacheFresh(cache: MembersCache | null, now: Date = new Date(), ttlMs: number = MEMBERS_CACHE_TTL_MS): boolean {
  if (!cache) {
    return false;
  }

  return now.getTime() - new Date(cache.fetchedAt).getTime() < ttlMs;
}

function memberKey(member: MyMember): string {
  return JSON.stringify(member, Object.keys(member).sort());
}

export function membersEqual(a: MyMember[], b: MyMember[]): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const aKeys = a.map(memberKey).sort();
  const bKeys = b.map(memberKey).sort();
  return aKeys.every((key, index) => key === bKeys[index]);
}
