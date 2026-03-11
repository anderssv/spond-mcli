#!/usr/bin/env node

import { parseArgs, USAGE, CliCommand } from './cli-args.js';
import { SpondCore, CoreError } from './spond-core.js';
import { getTokenWithFileFallback } from './token-config.js';
import { SpondClient } from './spond-client.js';
import { SpondClientFake } from './spond-client-fake.js';

async function executeCommand(core: SpondCore, cmd: CliCommand): Promise<{ data: unknown; notFound?: boolean }> {
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

  const config = getTokenWithFileFallback();
  const client = config.useMockData
    ? SpondClientFake.withMockData()
    : new SpondClient(config.token, config.fetchFn);

  const core = new SpondCore(client);

  try {
    const result = await executeCommand(core, parsed);
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
