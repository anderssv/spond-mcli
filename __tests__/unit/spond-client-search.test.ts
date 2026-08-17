import { describe, test, expect, jest } from '@jest/globals';

jest.mock('node-fetch', () => ({
  default: jest.fn()
}));

import { SpondClient } from '../../src/spond-client.js';
import type { SpondEvent, SpondPost } from '../../src/domain-types.js';

function makeEvent(id: string, heading: string): SpondEvent {
  return {
    id,
    heading,
    startTimestamp: '2026-01-01T00:00:00Z',
    endTimestamp: '2026-01-01T01:00:00Z'
  } as SpondEvent;
}

function makePost(id: string, title: string): SpondPost {
  return {
    id,
    title,
    type: 'PLAIN',
    timestamp: '2026-01-01T00:00:00Z'
  } as SpondPost;
}

function stubFetchReturningWindowedResults<T>(allResults: T[]) {
  return (async (url: string) => {
    const maxParam = Number(new URL(url).searchParams.get('max')) || allResults.length;
    return {
      ok: true,
      status: 200,
      text: async () => '',
      json: async () => allResults.slice(0, maxParam),
      headers: new Map()
    };
  }) as unknown as typeof import('node-fetch').default;
}

describe('SpondClient.searchEvents', () => {
  test('finds a match that is outside the front of the raw feed, even with a small maxResults', async () => {
    // 20 non-matching events, then the matching one — well past any small maxResults window.
    const events = [
      ...Array.from({ length: 20 }, (_, i) => makeEvent(`e${i}`, `Practice ${i}`)),
      makeEvent('match', 'Championship Final')
    ];
    const client = new SpondClient('test-token', stubFetchReturningWindowedResults(events));

    const results = await client.searchEvents('Championship', 5);

    expect(results.map(e => e.id)).toContain('match');
  });

  test('still respects maxResults as a cap on the number of returned matches', async () => {
    const events = Array.from({ length: 30 }, (_, i) => makeEvent(`e${i}`, `Practice Session ${i}`));
    const client = new SpondClient('test-token', stubFetchReturningWindowedResults(events));

    const results = await client.searchEvents('Practice', 5);

    expect(results).toHaveLength(5);
  });
});

describe('SpondClient.searchPosts', () => {
  test('finds a match that is outside the front of the raw feed, even with a small maxResults', async () => {
    const posts = [
      ...Array.from({ length: 20 }, (_, i) => makePost(`p${i}`, `Update ${i}`)),
      makePost('match', 'Workshop Announcement')
    ];
    const client = new SpondClient('test-token', stubFetchReturningWindowedResults(posts));

    const results = await client.searchPosts('Workshop', 5);

    expect(results.map(p => p.id)).toContain('match');
  });

  test('still respects maxResults as a cap on the number of returned matches', async () => {
    const posts = Array.from({ length: 30 }, (_, i) => makePost(`p${i}`, `Update ${i}`));
    const client = new SpondClient('test-token', stubFetchReturningWindowedResults(posts));

    const results = await client.searchPosts('Update', 5);

    expect(results).toHaveLength(5);
  });
});
