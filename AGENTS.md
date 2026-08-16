# Spond MCP Agents Documentation

This document describes the available agents and tools provided by the Spond MCP Server for integration with AI assistants and automation systems.

## Overview

The Spond project provides two interfaces to the Spond platform:

1. **MCP Server** — Exposes Spond functionality through the Model Context Protocol (MCP) for AI agents and assistants.
2. **CLI** — A command-line interface (`spond`) for direct human use, using the same core logic.

Both interfaces delegate to `SpondCore`, which exposes typed public methods. The MCP server's `processToolCall` is a thin adapter that maps tool names to these methods. The CLI calls the typed methods directly via a discriminated `CliCommand` union.

The Spond platform is usually accessed via App or a web client.
The address for using the web is https://spond.com/client .

## Integration

The Spond MCP Server can be integrated with:
- Claude Desktop and Claude Code
- Custom MCP clients
- Automation systems
- AI assistant applications

Refer to the main README.md file for detailed installation and configuration instructions.

## Authentication

The agents require authentication through a Bearer token in the `SPOND_TOKEN` environment variable. Three modes:
- **Real API**: Set `SPOND_TOKEN` to your actual Spond Bearer token
- **Mock mode**: Set `SPOND_TOKEN="mock-data"` for testing
- **Error**: If not set, server fails with clear error message

## Architecture

The project uses hexagonal architecture with clear separation:
- **src/index.ts**: MCP server entry point (uses @modelcontextprotocol/sdk)
- **src/cli.ts**: CLI entry point (docopt-based, delegates to core via typed methods)
- **src/cli-args.ts**: CLI argument parsing (docopt usage string + discriminated `CliCommand` union)
- **src/spond-core.ts**: Core business logic (`SpondCore`) — typed public methods called by both MCP and CLI
- **src/spond-client.ts**: Spond API client implementation
- **src/spond-client-interface.ts**: Interface for the Spond client (port)
- **src/spond-client-fake.ts**: Fake implementation for testing and demo mode
- **src/domain-types.ts**: Domain type definitions (single source of truth for all types)
- **src/domain-logic.ts**: Domain logic (registration status calculation)
- **src/token-config.ts**: Token and mock mode configuration

## MCP Tools

The server provides 17 tools:

### Event Tools
- `get_events` - Get events with filtering (includeComments, includeHidden, scheduled, order, max, timestamps, groupId)
- `get_event_by_id` - Get specific event by ID
- `get_upcoming_events` - Get future events
- `search_events` - Search events by keyword
- `get_events_by_group` - Get events from specific group by name
- `accept_event` - Accept an event invitation
- `decline_event` - Decline an event invitation

### Post Tools
- `get_posts` - Get posts with filtering (type, includeComments, includeReadStatus, max, groupId, timestamps)
- `get_post_by_id` - Get specific post by ID
- `search_posts` - Search posts by keyword
- `get_posts_by_group` - Get posts from specific group

### Group Tools
- `get_groups` - Get all groups the user is member of
- `get_group_files` - Get files from a group
- `get_group_file` - Fetch a specific file from a group

### Attachment Tools
- `get_attachment` - Fetch attachment using authenticated request
- `convert_pdf_to_text` - Convert PDF to text (requires pdftotext)
- `convert_docx_to_text` - Convert DOCX to text (requires docx2txt)

## MCP Resources

- `spond://events/upcoming` - Upcoming events
- `spond://events/all` - All events (up to 100)
- `spond://posts/recent` - Recent posts
- `spond://posts/all` - All posts (up to 50)
- `spond://groups/all` - All groups

## Development

### Runtime Management

This project uses [mise](https://mise.jdx.dev/) to manage the Node.js runtime version. The required version is pinned in `mise.toml`. Run `mise install` to install the correct Node.js version.

### Technology Stack
- **Node.js** (see `mise.toml` for pinned version): Runtime, managed via mise
- **TypeScript**: Language
- **@modelcontextprotocol/sdk**: MCP server implementation
- **Jest**: Testing framework
- **ts-jest**: TypeScript Jest transformer
- **System Dependencies**: Requires pdftotext (poppler-utils) and docx2txt for document conversion.

### Mock Mode

The server supports mock mode by setting `SPOND_TOKEN="mock-data"`. In mock mode, the server returns synthetic data instead of making actual API calls.

## Design Principles
- Keep a clear separation between the MCP server and the Spond API client.
- Focus on testing specific details efficiently, while still having some high-level tests.
- Re-use test data and test setup to avoid redundancy.
- Use correct test double terminology: "fake" = working simplified implementation (e.g. `SpondClientFake`), "mock" = records/verifies interactions, "stub" = canned data.

### Test-Driven Development (TDD)

All code changes in this project follow TDD. Use the `tdd` skill for the full process. Key points:

1. **Write the test first** — before any production code.
2. **One test at a time** — focus on the simplest next case.
3. **Red-Green-Refactor** — see the test fail, make it pass with minimal code, then refactor.
4. **Run all tests every cycle** — not just the one you're working on (`npm test`).
5. **Minimal code to pass** — if no test requires it, don't write it.
6. **Test behavior, not implementation** — check responses or state, not method calls.
7. **Refactor at the first opportunity** when tests are green.
8. **Plan tests as `[TEST]` comments** before implementing, using ZOMBIES for completeness (Zero, One, Many, Boundaries, Interfaces, Exceptions).

### Method
- Maintain a tasks list in [doc/plan.md](doc/plan.md) to track progress and completed tasks.
- Maintain a session list in doc/sessions.md to track debugging sessions and decisions.
- Update documentation as needed to reflect current state.
- Write tests first to define expected behavior.
- Make small, focused changes.
- Run tests frequently to ensure stability.
- Ask if uncertain about design or implementation details.
- Double check with the browser to verify functionality and assumptions.
- Use the Playwright MCP to inspect the https://spond.com/client website for visuals, features and network requests.
- Test changes to the code by launching the MCP server in a separate process and passing it commands.
- If you have to reload the MCP server, stop and ask the user to reload.
- If you need to verify api changes, use the Playwright MCP to inspect network traffic at https://spond.com/client.

### Reverse Engineering the Spond API
The Spond API can be reverse engineered by opening a Playwright browser at https://spond.com/client, navigating around and looking at the network traffic. The page requires login, so stop and let the user authenticate if not already logged in.

### Test Structure
- `__tests__/unit/` - Unit tests (domain logic, token validation, startup config)
- `__tests__/integration/` - Integration tests (client, error handling, server)
- `__tests__/system/` - System tests (MCP tools, real API integration)
- `__tests__/helpers/` - Test utilities, object mothers, fake clients

### Examples and Testing
Use the Playwright MCP to inspect network traffic at https://spond.com/client for API debugging and reverse engineering.

### Commands

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run integration tests with real API
npm run test:integration

# Run tests in watch mode
npm run test:watch

# Build the project
npm run build

# Start server (requires SPOND_TOKEN)
npm start

# Start server with mock data
npm run start:mock

# Start with token from ~/.config/spond/token
npm run start:with-token

# CLI - run a single command against the API
npm run cli -- <command> [options]

# CLI with mock data
npm run cli:mock -- <command> [options]

# Development mode (watch + auto-reload)
npm run dev

# Lint
npm run lint
```
