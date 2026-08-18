import docopt from 'docopt';
import { SpondEventsQueryParams, SpondPostsQueryParams } from './domain-types.js';

export type CliCommand =
  | { command: 'getEvents'; params: SpondEventsQueryParams }
  | { command: 'getEventById'; eventId: string; includeMembers: boolean }
  | { command: 'getUpcomingEvents'; maxResults?: number }
  | { command: 'searchEvents'; searchTerm: string; maxResults?: number }
  | { command: 'searchAll'; searchTerm: string; maxResults?: number }
  | { command: 'searchFiles'; searchTerm: string; groupName?: string; content: boolean; maxResults?: number }
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
  | { command: 'convertXlsxToText'; inputPath: string; outputPath: string }
  | { command: 'login'; browser: boolean; username?: string; passwordFile?: string }
  | { command: 'agentHelp' }
  | { command: 'mcp'; http: boolean; port?: number }
  | { command: 'myMembers' };

const USAGE = `\
Spond CLI - Command line interface for the Spond API.

Usage:
  spond-mcli search <searchTerm> [--max <n>]
  spond-mcli search-files <searchTerm> [--group <groupName>] [--content] [--max <n>]
  spond-mcli events [--max <n>] [--include-comments] [--include-hidden] [--order <order>] [--group-id <id>] [--min-end-timestamp <ts>] [--max-end-timestamp <ts>]
  spond-mcli event <eventId> [--include-members]
  spond-mcli upcoming [--max <n>]
  spond-mcli search-events <searchTerm> [--max <n>]
  spond-mcli events-by-group <groupName> [--max <n>]
  spond-mcli posts [--max <n>] [--type <type>] [--group-id <id>] [--include-read-status]
  spond-mcli post <postId>
  spond-mcli search-posts <searchTerm> [--max <n>]
  spond-mcli posts-by-group <groupName> [--max <n>]
  spond-mcli groups
  spond-mcli group-files <groupId>
  spond-mcli group-file <fileUrl> <groupId> <filePath>
  spond-mcli attachment <url> <groupId> <filePath>
  spond-mcli accept-event <eventId> <memberId>
  spond-mcli decline-event <eventId> <memberId>
  spond-mcli my-members
  spond-mcli pdf-to-text <inputPath> <outputPath>
  spond-mcli docx-to-text <inputPath> <outputPath>
  spond-mcli xlsx-to-text <inputPath> <outputPath>
  spond-mcli login [--browser] [--username <email>] [--password-file <path>]
  spond-mcli mcp [--http] [--port <n>]
  spond-mcli --agent-help

For AI agents:
  If you are an AI agent using this CLI, run 'spond-mcli --agent-help' for a
  condensed usage guide (auth, output format, accept/decline workflow).

Search:
  'spond-mcli search <term>' is the recommended way to search — it looks
  across events, plain posts, polls, and payment requests in one call,
  tagging each result with kind ("event" or "post"). The narrower
  'search-events'/'search-posts' commands still exist if you only care
  about one type.

  'spond-mcli search-files <term>' searches group files (PDFs, DOCX,
  images, spreadsheets) by filename, across all your groups by default
  or scoped to one with --group. It's a separate command because Spond
  has no unified search across events/posts/files.
  Add --content to also download and text-search inside PDF/DOCX files
  (requires pdftotext/docx2txt) — this is much slower since every
  candidate file gets downloaded and converted, so it's opt-in.

MCP Server:
  Run 'spond-mcli mcp' to start the MCP server over stdio. This is the
  preferred way to launch it — point your MCP client's command at
  'spond-mcli' with args ['mcp'] instead of invoking dist/index.js directly.

  Run 'spond-mcli mcp --http [--port <n>]' instead to serve it over HTTP
  (default port 8080, or $PORT) for a remote deployment — e.g. a client
  connecting from another machine, not a locally-spawned process.
  The stdio and file-based auth (SPOND_TOKEN / ~/.config/spond/token)
  don't apply in HTTP mode: each request must carry its own token in an
  'Authorization: Bearer <token>' header, since a remote server can't
  read your local token file. Sequence: (1) run 'spond-mcli login'
  locally to obtain the token, (2) put that token in the Authorization
  header field of your MCP client's config for the remote endpoint
  (e.g. https://your-deployment/mcp).

Login:
  'spond-mcli login' authenticates with your Spond email and password
  (from SPOND_USERNAME/SPOND_PASSWORD, or prompted interactively) and
  saves the token directly — no browser needed.
  Use 'spond-mcli login --browser' instead if your account has 2FA
  enabled; it opens a real browser window so you can complete 2FA
  yourself, then extracts the token once you're logged in.
  Use '--username <email> --password-file <path>' for a non-interactive
  login (e.g. scripting, or a terminal that can't handle password
  prompts) — reads the password from a file instead of a prompt or
  SPOND_PASSWORD, so it never touches shell history or process args.

Options:
  --browser                  Log in via a browser window instead of email/password
                              (needed for accounts with 2FA enabled)
  --username <email>         Spond email for non-interactive login (overrides SPOND_USERNAME)
  --password-file <path>     Read the login password from this file instead of prompting
  --http                     Serve the MCP server over HTTP instead of stdio
  --port <n>                 Port for --http mode (default 8080, or $PORT)
  --max <n>                  Maximum number of results
  --include-comments         Include comments in the response
  --include-hidden           Include hidden events
  --include-members          Include member information
  --order <order>            Sort order (asc or desc)
  --group-id <id>            Filter by group ID
  --group <groupName>        Filter search-files to groups matching this name
  --content                  Also search inside PDF/DOCX file contents (slow)
  --min-end-timestamp <ts>   Minimum end timestamp (ISO 8601)
  --max-end-timestamp <ts>   Maximum end timestamp (ISO 8601)
  --type <type>              Post type (PLAIN, POLL, PAYMENT)
  --include-read-status      Include read status

Accept/Decline an event:
  To accept or decline an event you need the eventId and memberId.
  The memberId is the ID of the member in the event's recipient group
  (typically your child if you are a guardian).

  Note: A person's memberId varies per group — the same person will
  have different memberIds in different groups.

  1. Find the event:     spond-mcli upcoming
  2. Get memberIds:      spond-mcli my-members (everyone you're a guardian
                          for, across all groups — faster than digging
                          through event details). Cached to
                          ~/.config/spond/members.json for 5 minutes,
                          so repeated calls don't hit the API. Or:
                          spond-mcli event <eventId> --include-members
  3. Accept or decline:   spond-mcli accept-event <eventId> <memberId>
                          spond-mcli decline-event <eventId> <memberId>
`;

export { USAGE };

export function isHelpFlag(argv: string[]): boolean {
  return argv.includes('--help') || argv.includes('-h');
}

function parsePositiveInt(raw: string, flagName: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${flagName} must be a positive whole number, got: ${raw}`);
  }
  return value;
}

export function parseArgs(argv: string[]): CliCommand | null {
  let args;
  try {
    args = docopt.docopt(USAGE, { argv, help: false, exit: false });
  } catch {
    return null;
  }

  if (args['events']) {
    const params: SpondEventsQueryParams = {};
    if (args['--max']) params.max = parsePositiveInt(args['--max'] as string, '--max');
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
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['search-files']) {
    return {
      command: 'searchFiles',
      searchTerm: args['<searchTerm>'] as string,
      groupName: (args['--group'] as string | null) ?? undefined,
      content: !!args['--content'],
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['search']) {
    return {
      command: 'searchAll',
      searchTerm: args['<searchTerm>'] as string,
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['search-events']) {
    return {
      command: 'searchEvents',
      searchTerm: args['<searchTerm>'] as string,
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['events-by-group']) {
    return {
      command: 'getEventsByGroup',
      groupName: args['<groupName>'] as string,
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['posts']) {
    const params: SpondPostsQueryParams = {};
    if (args['--max']) params.max = parsePositiveInt(args['--max'] as string, '--max');
    if (args['--type']) params.type = args['--type'] as 'PLAIN' | 'POLL' | 'PAYMENT';
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
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
    };
  }

  if (args['posts-by-group']) {
    return {
      command: 'getPostsByGroup',
      groupName: args['<groupName>'] as string,
      ...(args['--max'] ? { maxResults: parsePositiveInt(args['--max'] as string, '--max') } : {})
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

  if (args['xlsx-to-text']) {
    return {
      command: 'convertXlsxToText',
      inputPath: args['<inputPath>'] as string,
      outputPath: args['<outputPath>'] as string
    };
  }

  if (args['login']) {
    return {
      command: 'login',
      browser: !!args['--browser'],
      username: (args['--username'] as string | null) ?? undefined,
      passwordFile: (args['--password-file'] as string | null) ?? undefined
    };
  }

  if (args['--agent-help']) {
    return { command: 'agentHelp' };
  }

  if (args['mcp']) {
    return {
      command: 'mcp',
      http: !!args['--http'],
      port: args['--port'] ? Number(args['--port']) : undefined
    };
  }

  if (args['my-members']) {
    return { command: 'myMembers' };
  }

  return null;
}
