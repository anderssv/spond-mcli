import { describe, test, expect } from '@jest/globals';
import { matchesSearchTerm } from '../../src/domain-logic.js';
import { SpondPost } from '../../src/domain-types.js';

function plainPost(overrides: Partial<SpondPost> = {}): SpondPost {
  return {
    id: 'post-1',
    type: 'PLAIN',
    groupId: 'group-1',
    title: 'Dugnad lørdag',
    body: 'Vi trenger hjelp med rydding',
    ownerId: 'owner-1',
    timestamp: new Date().toISOString(),
    visibility: 'ALL',
    unread: false,
    commentsDisabled: false,
    muted: false,
    selectMemberPoll: false,
    ...overrides
  };
}

describe('matchesSearchTerm', () => {
  test('matches on a PLAIN post title', () => {
    const post = plainPost({ title: 'Dugnad lørdag' });

    expect(matchesSearchTerm(post, 'dugnad')).toBe(true);
  });

  test('matches on a PLAIN post body', () => {
    const post = plainPost({ body: 'Husk å ta med hansker' });

    expect(matchesSearchTerm(post, 'hansker')).toBe(true);
  });

  test('matches on a POLL question when title/body are absent', () => {
    const post = plainPost({
      type: 'POLL',
      title: undefined,
      body: undefined,
      poll: {
        id: 'poll-1',
        question: 'Bytte treningstid til torsdager?',
        multipleChoice: false,
        options: []
      }
    });

    expect(matchesSearchTerm(post, 'torsdager')).toBe(true);
  });

  test('matches on a POLL description', () => {
    const post = plainPost({
      type: 'POLL',
      title: undefined,
      body: undefined,
      poll: {
        id: 'poll-1',
        question: 'Spørsmål',
        description: 'Oppsal har ikke fått halltid',
        multipleChoice: false,
        options: []
      }
    });

    expect(matchesSearchTerm(post, 'oppsal')).toBe(true);
  });

  test('matches on a CLUB_PAYMENT title when title/body are absent', () => {
    const post = plainPost({
      type: 'CLUB_PAYMENT',
      title: undefined,
      body: undefined,
      clubPayment: {
        id: 'payment-1',
        title: 'Treningsavgift Bøler IF Friidrett 2023'
      }
    });

    expect(matchesSearchTerm(post, 'friidrett')).toBe(true);
  });

  test('is case-insensitive', () => {
    const post = plainPost({ title: 'Dugnad Lørdag' });

    expect(matchesSearchTerm(post, 'DUGNAD')).toBe(true);
  });

  test('returns false when nothing matches', () => {
    const post = plainPost({ title: 'Dugnad', body: 'Rydding' });

    expect(matchesSearchTerm(post, 'håndball')).toBe(false);
  });

  test('does not crash on a post with no searchable text at all', () => {
    const post = plainPost({ title: undefined, body: undefined });

    expect(matchesSearchTerm(post, 'anything')).toBe(false);
  });
});
