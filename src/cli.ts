#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { parseArgs, USAGE, CliCommand } from './cli-args.js';
import { SpondCore, CoreError } from './spond-core.js';
import { getTokenWithFileFallback } from './token-config.js';
import { SpondClient } from './spond-client.js';
import { SpondClientFake } from './spond-client-fake.js';
import { performLogin } from './login.js';

const AGENT_HELP = `\
Spond CLI - Agent Guide

Output: every command prints JSON to stdout on success. Errors go to
stderr and the process exits non-zero.

Auth: reads SPOND_TOKEN, falling back to the token file at
~/.config/spond/token. Run 'spond-mcli login' to populate that file via
a one-time browser login, or set SPOND_TOKEN="mock-data" for mock data.

Accept/decline an event:
  1. spond-mcli upcoming
  2. spond-mcli event <eventId> --include-members
  3. Find the memberId in recipients.group.members[] for the person
     you want to respond for (memberId differs per group).
  4. spond-mcli accept-event <eventId> <memberId>
     spond-mcli decline-event <eventId> <memberId>

MCP server: run 'spond-mcli mcp' to start it over stdio.

Run 'spond-mcli --help' for the full command and flag reference.
`;

type ApiCommand = Exclude<CliCommand, { command: 'login' } | { command: 'agentHelp' } | { command: 'mcp' }>;

async function executeCommand(core: SpondCore, cmd: ApiCommand): Promise<{ data: unknown; notFound?: boolean }> {
  switch (cmd.command) {
    case 'getEvents':
      return { data: await core.getEvents(cmd.params) };
    case 'getEventById': {
      const event = await core.getEventById(cmd.eventId, cmd.includeMembers);
      return { data: event, notFound: !event };
    }
    case 'getUpcomingEvents':
      return { data: await core.getUpcomingEvents(cmd.maxResults) };
    case 'searchEvents':
      return { data: await core.searchEvents(cmd.searchTerm, cmd.maxResults) };
    case 'getEventsByGroup':
      return { data: await core.getEventsByGroup(cmd.groupName, cmd.maxResults) };
    case 'getPosts':
      return { data: await core.getPosts(cmd.params) };
    case 'getPostById': {
      const post = await core.getPostById(cmd.postId);
      return { data: post, notFound: !post };
    }
    case 'searchPosts':
      return { data: await core.searchPosts(cmd.searchTerm, cmd.maxResults) };
    case 'getPostsByGroup':
      return { data: await core.getPostsByGroup(cmd.groupName, cmd.maxResults) };
    case 'getGroups':
      return { data: await core.getGroups() };
    case 'getGroupFiles':
      return { data: await core.getGroupFiles(cmd.groupId) };
    case 'getGroupFile':
      return { data: { message: await core.getGroupFile(cmd.fileUrl, cmd.groupId, cmd.filePath) } };
    case 'getAttachment':
      return { data: { message: await core.getAttachment(cmd.url, cmd.groupId, cmd.filePath) } };
    case 'acceptEvent':
      await core.acceptEvent(cmd.eventId, cmd.memberId);
      return { data: { message: `Event ${cmd.eventId} accepted for member ${cmd.memberId}` } };
    case 'declineEvent':
      await core.declineEvent(cmd.eventId, cmd.memberId);
      return { data: { message: `Event ${cmd.eventId} declined for member ${cmd.memberId}` } };
    case 'convertPdfToText':
      return { data: { message: await core.convertPdfToText(cmd.inputPath, cmd.outputPath) } };
    case 'convertDocxToText':
      return { data: { message: await core.convertDocxToText(cmd.inputPath, cmd.outputPath) } };
  }
}

async function main(): Promise<void> {
  const parsed = parseArgs(process.argv.slice(2));
  if (!parsed) {
    console.error(USAGE);
    process.exit(1);
  }

  if (parsed.command === 'agentHelp') {
    console.log(AGENT_HELP);
    return;
  }

  if (parsed.command === 'mcp') {
    const indexJsPath = join(dirname(fileURLToPath(import.meta.url)), 'index.js');
    const child = spawn(process.execPath, [indexJsPath], { stdio: 'inherit' });
    const exitCode = await new Promise<number>((resolve) => {
      child.on('exit', (code) => resolve(code ?? 1));
    });
    process.exit(exitCode);
  }

  if (parsed.command === 'login') {
    try {
      await performLogin();
    } catch (error) {
      console.error(`Login failed: ${(error as Error).message}`);
      process.exit(1);
    }
    return;
  }

  const config = getTokenWithFileFallback();
  const client = config.useMockData
    ? SpondClientFake.withMockData()
    : new SpondClient(config.token, config.fetchFn);

  const core = new SpondCore(client);

  try {
    const result = await executeCommand(core, parsed as ApiCommand);
    if (result.notFound) {
      console.error('Not found');
      process.exit(1);
    }
    console.log(JSON.stringify(result.data, null, 2));
  } catch (error) {
    if (error instanceof CoreError) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
    throw error;
  }
}

main();
