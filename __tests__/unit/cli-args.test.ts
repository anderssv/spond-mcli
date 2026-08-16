import { parseArgs, CliCommand } from '../../src/cli-args.js';

describe('CLI argument parsing', () => {
  // Event commands
  it('"events" maps to getEvents with no params', () => {
    const result = parseArgs(['events']);

    expect(result).toEqual({ command: 'getEvents', params: {} });
  });
  it('"events --max 10" maps to getEvents with max=10', () => {
    const result = parseArgs(['events', '--max', '10']);

    expect(result).toEqual({ command: 'getEvents', params: { max: 10 } });
  });

  it('"events --include-comments --include-hidden" maps to getEvents with boolean flags', () => {
    const result = parseArgs(['events', '--include-comments', '--include-hidden']);

    expect(result).toEqual({
      command: 'getEvents',
      params: { includeComments: true, includeHidden: true }
    });
  });

  it('"events --order desc" maps to getEvents with order=desc', () => {
    const result = parseArgs(['events', '--order', 'desc']);

    expect(result).toEqual({ command: 'getEvents', params: { order: 'desc' } });
  });

  it('"events --group-id abc123" maps to getEvents with groupId', () => {
    const result = parseArgs(['events', '--group-id', 'abc123']);

    expect(result).toEqual({ command: 'getEvents', params: { groupId: 'abc123' } });
  });

  it('"events --min-end-timestamp 2024-01-01T00:00:00Z" maps to getEvents with timestamp', () => {
    const result = parseArgs(['events', '--min-end-timestamp', '2024-01-01T00:00:00Z']);

    expect(result).toEqual({
      command: 'getEvents',
      params: { minEndTimestamp: '2024-01-01T00:00:00Z' }
    });
  });

  it('"event <id>" maps to getEventById with eventId', () => {
    const result = parseArgs(['event', 'evt-123']);

    expect(result).toEqual({ command: 'getEventById', eventId: 'evt-123', includeMembers: false });
  });

  it('"event <id> --include-members" maps to getEventById with includeMembers', () => {
    const result = parseArgs(['event', 'evt-123', '--include-members']);

    expect(result).toEqual({
      command: 'getEventById',
      eventId: 'evt-123',
      includeMembers: true
    });
  });

  it('"upcoming" maps to getUpcomingEvents with no params', () => {
    const result = parseArgs(['upcoming']);

    expect(result).toEqual({ command: 'getUpcomingEvents' });
  });

  it('"upcoming --max 5" maps to getUpcomingEvents with maxResults=5', () => {
    const result = parseArgs(['upcoming', '--max', '5']);

    expect(result).toEqual({ command: 'getUpcomingEvents', maxResults: 5 });
  });

  it('"search-events <term>" maps to searchEvents with searchTerm', () => {
    const result = parseArgs(['search-events', 'football']);

    expect(result).toEqual({ command: 'searchEvents', searchTerm: 'football' });
  });

  it('"search-events <term> --max 10" maps to searchEvents with maxResults', () => {
    const result = parseArgs(['search-events', 'football', '--max', '10']);

    expect(result).toEqual({
      command: 'searchEvents',
      searchTerm: 'football',
      maxResults: 10
    });
  });

  it('"events-by-group <name>" maps to getEventsByGroup with groupName', () => {
    const result = parseArgs(['events-by-group', 'Team A']);

    expect(result).toEqual({
      command: 'getEventsByGroup',
      groupName: 'Team A'
    });
  });

  it('"events-by-group <name> --max 10" maps to getEventsByGroup with maxResults', () => {
    const result = parseArgs(['events-by-group', 'Team A', '--max', '10']);

    expect(result).toEqual({
      command: 'getEventsByGroup',
      groupName: 'Team A',
      maxResults: 10
    });
  });

  // Post commands
  it('"posts" maps to getPosts with no params', () => {
    const result = parseArgs(['posts']);

    expect(result).toEqual({ command: 'getPosts', params: {} });
  });

  it('"posts --max 10" maps to getPosts with max=10', () => {
    const result = parseArgs(['posts', '--max', '10']);

    expect(result).toEqual({ command: 'getPosts', params: { max: 10 } });
  });

  it('"posts --type POLL" maps to getPosts with type=POLL', () => {
    const result = parseArgs(['posts', '--type', 'POLL']);

    expect(result).toEqual({ command: 'getPosts', params: { type: 'POLL' } });
  });

  it('"posts --group-id abc" maps to getPosts with groupId', () => {
    const result = parseArgs(['posts', '--group-id', 'abc']);

    expect(result).toEqual({ command: 'getPosts', params: { groupId: 'abc' } });
  });

  it('"post <id>" maps to getPostById with postId', () => {
    const result = parseArgs(['post', 'post-456']);

    expect(result).toEqual({ command: 'getPostById', postId: 'post-456' });
  });

  it('"search-posts <term>" maps to searchPosts with searchTerm', () => {
    const result = parseArgs(['search-posts', 'meeting']);

    expect(result).toEqual({ command: 'searchPosts', searchTerm: 'meeting' });
  });

  it('"posts-by-group <name>" maps to getPostsByGroup with groupName', () => {
    const result = parseArgs(['posts-by-group', 'Team B']);

    expect(result).toEqual({ command: 'getPostsByGroup', groupName: 'Team B' });
  });

  // Group commands
  it('"groups" maps to getGroups', () => {
    const result = parseArgs(['groups']);

    expect(result).toEqual({ command: 'getGroups' });
  });

  it('"group-files <id>" maps to getGroupFiles with groupId', () => {
    const result = parseArgs(['group-files', 'grp-789']);

    expect(result).toEqual({ command: 'getGroupFiles', groupId: 'grp-789' });
  });

  it('"group-file <url> <groupId> <path>" maps to getGroupFile', () => {
    const result = parseArgs(['group-file', 'https://example.com/f', 'grp-1', '/tmp/out.pdf']);

    expect(result).toEqual({
      command: 'getGroupFile',
      fileUrl: 'https://example.com/f',
      groupId: 'grp-1',
      filePath: '/tmp/out.pdf'
    });
  });

  // Attachment & conversion commands
  it('"attachment <url> <groupId> <path>" maps to getAttachment', () => {
    const result = parseArgs(['attachment', 'https://example.com/a', 'grp-2', '/tmp/file.bin']);

    expect(result).toEqual({
      command: 'getAttachment',
      url: 'https://example.com/a',
      groupId: 'grp-2',
      filePath: '/tmp/file.bin'
    });
  });

  it('"pdf-to-text <in> <out>" maps to convertPdfToText', () => {
    const result = parseArgs(['pdf-to-text', '/tmp/in.pdf', '/tmp/out.txt']);

    expect(result).toEqual({
      command: 'convertPdfToText',
      inputPath: '/tmp/in.pdf',
      outputPath: '/tmp/out.txt'
    });
  });

  it('"docx-to-text <in> <out>" maps to convertDocxToText', () => {
    const result = parseArgs(['docx-to-text', '/tmp/in.docx', '/tmp/out.txt']);

    expect(result).toEqual({
      command: 'convertDocxToText',
      inputPath: '/tmp/in.docx',
      outputPath: '/tmp/out.txt'
    });
  });

  // Accept/decline event commands
  it('"accept-event <eventId> <memberId>" maps to acceptEvent', () => {
    const result = parseArgs(['accept-event', 'evt-123', 'member-456']);

    expect(result).toEqual({
      command: 'acceptEvent',
      eventId: 'evt-123',
      memberId: 'member-456'
    });
  });

  it('"decline-event <eventId> <memberId>" maps to declineEvent', () => {
    const result = parseArgs(['decline-event', 'evt-123', 'member-456']);

    expect(result).toEqual({
      command: 'declineEvent',
      eventId: 'evt-123',
      memberId: 'member-456'
    });
  });

  // Login command
  it('"login" maps to login command', () => {
    const result = parseArgs(['login']);

    expect(result).toEqual({ command: 'login' });
  });

  // Agent help command
  it('"--agent-help" maps to agentHelp command', () => {
    const result = parseArgs(['--agent-help']);

    expect(result).toEqual({ command: 'agentHelp' });
  });

  // Error cases
  it('unknown command returns null', () => {
    const result = parseArgs(['nonexistent']);

    expect(result).toBeNull();
  });

  it('no arguments returns null', () => {
    const result = parseArgs([]);

    expect(result).toBeNull();
  });
});
