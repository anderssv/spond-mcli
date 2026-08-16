import { describe, test, expect, afterEach } from '@jest/globals';
import { existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readMembersCache, writeMembersCache, membersEqual, isCacheFresh, MEMBERS_CACHE_TTL_MS } from '../../src/members-cache.js';
import { MyMember } from '../../src/domain-logic.js';

function tempCachePath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'spond-members-cache-'));
  return join(dir, 'members.json');
}

const memberA: MyMember = { memberId: 'a', firstName: 'Ola', lastName: 'Nordmann', groupId: 'g1', groupName: 'Team A' };
const memberB: MyMember = { memberId: 'b', firstName: 'Kari', lastName: 'Nordmann', groupId: 'g2', groupName: 'Team B' };

describe('members-cache', () => {
  const tempPaths: string[] = [];

  afterEach(() => {
    tempPaths.forEach(p => rmSync(p, { recursive: true, force: true }));
    tempPaths.length = 0;
  });

  function newTempPath(): string {
    const path = tempCachePath();
    tempPaths.push(join(path, '..'));
    return path;
  }

  describe('readMembersCache', () => {
    test('returns null when the cache file does not exist', () => {
      const result = readMembersCache(newTempPath());

      expect(result).toBeNull();
    });

    test('returns the parsed members and fetchedAt when the cache file exists', () => {
      const path = newTempPath();
      const now = new Date('2026-01-01T12:00:00.000Z');
      writeMembersCache([memberA], path, now);

      const result = readMembersCache(path);

      expect(result).toEqual({ fetchedAt: now.toISOString(), members: [memberA] });
    });

    test('returns null when the cache file contains invalid JSON', () => {
      const path = newTempPath();
      writeFileSync(path, 'not json', 'utf-8');

      const result = readMembersCache(path);

      expect(result).toBeNull();
    });
  });

  describe('writeMembersCache', () => {
    test('creates parent directories if needed', () => {
      const path = newTempPath();

      writeMembersCache([memberA], path);

      expect(existsSync(path)).toBe(true);
    });

    test('writes the file with restrictive permissions', () => {
      const path = newTempPath();

      writeMembersCache([memberA], path);

      const mode = statSync(path).mode & 0o777;
      expect(mode).toBe(0o600);
    });
  });

  describe('membersEqual', () => {
    test('returns true for two empty lists', () => {
      expect(membersEqual([], [])).toBe(true);
    });

    test('returns true when both lists have the same members regardless of order', () => {
      expect(membersEqual([memberA, memberB], [memberB, memberA])).toBe(true);
    });

    test('returns false when a member is missing', () => {
      expect(membersEqual([memberA, memberB], [memberA])).toBe(false);
    });

    test('returns false when a member field changed', () => {
      const changed = { ...memberB, firstName: 'Changed' };

      expect(membersEqual([memberA, memberB], [memberA, changed])).toBe(false);
    });
  });

  describe('isCacheFresh', () => {
    test('returns false when there is no cache', () => {
      expect(isCacheFresh(null, new Date())).toBe(false);
    });

    test('returns true when the cache was fetched just now', () => {
      const now = new Date('2026-01-01T12:00:00.000Z');
      const cache = { fetchedAt: now.toISOString(), members: [memberA] };

      expect(isCacheFresh(cache, now)).toBe(true);
    });

    test('returns true when the cache is younger than the TTL', () => {
      const fetchedAt = new Date('2026-01-01T12:00:00.000Z');
      const now = new Date(fetchedAt.getTime() + MEMBERS_CACHE_TTL_MS - 1);
      const cache = { fetchedAt: fetchedAt.toISOString(), members: [memberA] };

      expect(isCacheFresh(cache, now)).toBe(true);
    });

    test('returns false when the cache is exactly as old as the TTL', () => {
      const fetchedAt = new Date('2026-01-01T12:00:00.000Z');
      const now = new Date(fetchedAt.getTime() + MEMBERS_CACHE_TTL_MS);
      const cache = { fetchedAt: fetchedAt.toISOString(), members: [memberA] };

      expect(isCacheFresh(cache, now)).toBe(false);
    });

    test('returns false when the cache is older than the TTL', () => {
      const fetchedAt = new Date('2026-01-01T12:00:00.000Z');
      const now = new Date(fetchedAt.getTime() + MEMBERS_CACHE_TTL_MS + 1000);
      const cache = { fetchedAt: fetchedAt.toISOString(), members: [memberA] };

      expect(isCacheFresh(cache, now)).toBe(false);
    });
  });
});
