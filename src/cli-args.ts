import docopt from 'docopt';
import { SpondEventsQueryParams, SpondPostsQueryParams } from './domain-types.js';

export type CliCommand =
  | { command: 'getEvents'; params: SpondEventsQueryParams }
  | { command: 'getEventById'; eventId: string; includeMembers: boolean }
  | { command: 'getUpcomingEvents'; maxResults?: number }
  | { command: 'searchEvents'; searchTerm: string; maxResults?: number }
  | { command: 'getEventsByGroup'; groupName: string; maxResults?: number }
  | { command: 'getPosts'; params: SpondPostsQueryParams }
  | { command: 'getPostById'; postId: string }
  | { command: 'searchPosts'; searchTerm: string; maxResults?: number }
  | { command: 'getPostsByGroup'; groupName: string; maxResults?: number }
  | { command: 'getGroups' }
  | { command: 'getGroupFiles'; groupId: string }
  | { command: 'getGroupFile'; fileUrl: string; groupId: string; filePath: string }
  | { command: 'getAttachment'; url: string; groupId: string; filePath: string }
  | { command: 'acceptEvent'; eventId: string; memberId: string }
  | { command: 'declineEvent'; eventId: string; memberId: string }
  | { command: 'convertPdfToText'; inputPath: string; outputPath: string }
  | { command: 'convertDocxToText'; inputPath: string; outputPath: string }
  | { command: 'login' }
  | { command: 'agentHelp' };

const USAGE = `\
Spond CLI - Command line interface for the Spond API.

Usage:
  spond events [--max <n>] [--include-comments] [--include-hidden] [--order <order>] [--group-id <id>] [--min-end-timestamp <ts>] [--max-end-timestamp <ts>]
  spond event <eventId> [--include-members]
  spond upcoming [--max <n>]
  spond search-events <searchTerm> [--max <n>]
  spond events-by-group <groupName> [--max <n>]
  spond posts [--max <n>] [--type <type>] [--group-id <id>] [--include-read-status]
  spond post <postId>
  spond search-posts <searchTerm> [--max <n>]
  spond posts-by-group <groupName> [--max <n>]
  spond groups
  spond group-files <groupId>
  spond group-file <fileUrl> <groupId> <filePath>
  spond attachment <url> <groupId> <filePath>
  spond accept-event <eventId> <memberId>
  spond decline-event <eventId> <memberId>
  spond pdf-to-text <inputPath> <outputPath>
  spond docx-to-text <inputPath> <outputPath>
  spond login
  spond --agent-help

For AI agents:
  If you are an AI agent using this CLI, run 'spond --agent-help' for a
  condensed usage guide (auth, output format, accept/decline workflow).

Options:
  --max <n>                  Maximum number of results
  --include-comments         Include comments in the response
  --include-hidden           Include hidden events
  --include-members          Include member information
  --order <order>            Sort order (asc or desc)
  --group-id <id>            Filter by group ID
  --min-end-timestamp <ts>   Minimum end timestamp (ISO 8601)
  --max-end-timestamp <ts>   Maximum end timestamp (ISO 8601)
  --type <type>              Post type (PLAIN, POLL, PAYMENT_REQUEST)
  --include-read-status      Include read status

Accept/Decline an event:
  To accept or decline an event you need the eventId and memberId.
  The memberId is the ID of the member in the event's recipient group
  (typically your child if you are a guardian).

  Note: A person's memberId varies per group — the same person will
  have different memberIds in different groups.

  1. Find the event:     spond upcoming
  2. Get member details:  spond event <eventId> --include-members
  3. Find the memberId in recipients.group.members[] for the person
     you want to respond for.
  4. Accept or decline:   spond accept-event <eventId> <memberId>
                          spond decline-event <eventId> <memberId>
`;

export { USAGE };

export function parseArgs(argv: string[]): CliCommand | null {
  let args;
  try {
    args = docopt.docopt(USAGE, { argv, help: false, exit: false });
  } catch {
    return null;
  }

  if (args['events']) {
    const params: SpondEventsQueryParams = {};
    if (args['--max']) params.max = Number(args['--max']);
    if (args['--include-comments']) params.includeComments = true;
    if (args['--include-hidden']) params.includeHidden = true;
    if (args['--order']) params.order = args['--order'] as 'asc' | 'desc';
    if (args['--group-id']) params.groupId = args['--group-id'] as string;
    if (args['--min-end-timestamp']) params.minEndTimestamp = args['--min-end-timestamp'] as string;
    if (args['--max-end-timestamp']) params.maxEndTimestamp = args['--max-end-timestamp'] as string;
    return { command: 'getEvents', params };
  }

  if (args['event']) {
    return {
      command: 'getEventById',
      eventId: args['<eventId>'] as string,
      includeMembers: !!args['--include-members']
    };
  }

  if (args['upcoming']) {
    return {
      command: 'getUpcomingEvents',
      ...(args['--max'] ? { maxResults: Number(args['--max']) } : {})
    };
  }

  if (args['search-events']) {
    return {
      command: 'searchEvents',
      searchTerm: args['<searchTerm>'] as string,
      ...(args['--max'] ? { maxResults: Number(args['--max']) } : {})
    };
  }

  if (args['events-by-group']) {
    return {
      command: 'getEventsByGroup',
      groupName: args['<groupName>'] as string,
      ...(args['--max'] ? { maxResults: Number(args['--max']) } : {})
    };
  }

  if (args['posts']) {
    const params: SpondPostsQueryParams = {};
    if (args['--max']) params.max = Number(args['--max']);
    if (args['--type']) params.type = args['--type'] as 'PLAIN' | 'POLL' | 'PAYMENT_REQUEST';
    if (args['--group-id']) params.groupId = args['--group-id'] as string;
    if (args['--include-read-status']) params.includeReadStatus = true;
    return { command: 'getPosts', params };
  }

  if (args['post']) {
    return { command: 'getPostById', postId: args['<postId>'] as string };
  }

  if (args['search-posts']) {
    return {
      command: 'searchPosts',
      searchTerm: args['<searchTerm>'] as string,
      ...(args['--max'] ? { maxResults: Number(args['--max']) } : {})
    };
  }

  if (args['posts-by-group']) {
    return {
      command: 'getPostsByGroup',
      groupName: args['<groupName>'] as string,
      ...(args['--max'] ? { maxResults: Number(args['--max']) } : {})
    };
  }

  if (args['groups']) {
    return { command: 'getGroups' };
  }

  if (args['group-files']) {
    return { command: 'getGroupFiles', groupId: args['<groupId>'] as string };
  }

  if (args['group-file']) {
    return {
      command: 'getGroupFile',
      fileUrl: args['<fileUrl>'] as string,
      groupId: args['<groupId>'] as string,
      filePath: args['<filePath>'] as string
    };
  }

  if (args['attachment']) {
    return {
      command: 'getAttachment',
      url: args['<url>'] as string,
      groupId: args['<groupId>'] as string,
      filePath: args['<filePath>'] as string
    };
  }

  if (args['accept-event']) {
    return {
      command: 'acceptEvent',
      eventId: args['<eventId>'] as string,
      memberId: args['<memberId>'] as string
    };
  }

  if (args['decline-event']) {
    return {
      command: 'declineEvent',
      eventId: args['<eventId>'] as string,
      memberId: args['<memberId>'] as string
    };
  }

  if (args['pdf-to-text']) {
    return {
      command: 'convertPdfToText',
      inputPath: args['<inputPath>'] as string,
      outputPath: args['<outputPath>'] as string
    };
  }

  if (args['docx-to-text']) {
    return {
      command: 'convertDocxToText',
      inputPath: args['<inputPath>'] as string,
      outputPath: args['<outputPath>'] as string
    };
  }

  if (args['login']) {
    return { command: 'login' };
  }

  if (args['--agent-help']) {
    return { command: 'agentHelp' };
  }

  return null;
}
