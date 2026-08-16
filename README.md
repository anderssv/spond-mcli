# Spond MCLI

MCP server and CLI for accessing Spond's data from an LLM or the command line. Currently read-only.

This is a vibe coded project. The code is written almost entirely by AI agents, with human guidance and review.

Spond is a platform for managing sports teams, events, and communication. And can be accessed at https://spond.com.

> [!IMPORTANT]
> This is not officially supported by Spond, but is built using their public API.
> It is intended for personal use and experimentation with LLMs.
> Changes to the Spond API may break this server in the future.

> [!WARNING]  
> Using MCP servers with LLMs can lead to unexpected behavior.
> Any message in Spond can trigger the LLM to do actions,
> like mailing everything to someone (if you also have the Gmail MCP).
> Make sure you understand the risks before using this MCP server.

> [!NOTE]
> I use Claude for almost everything.
> I have much better results when using Claude Code (prefer CLI) instead of Claude Desktop (needs MCP). 
> Your mileage may vary. 
> 
> The MCP server hasn't been tested by me in a while, but I recommend using the CLI.
> Install it globally with `npm install -g .` and try telling your agent something like:
> *"Analyze the spond CLI and add info about it to the project knowledge."*

## Getting Started

1. Clone, build, and install the CLI globally:
   ```bash
   git clone <repo-url> && cd spond-mcli
   npm install
   npm run build
   npm install -g .
   ```
   This package isn't published to npm, so it must be installed from a local
   clone — `npx spond-mcli` won't work.

2. Log in to Spond:
   ```bash
   spond-mcli login
   ```
   This opens a browser window. Log in with your Spond credentials and the CLI will
   automatically extract and save your token to `~/.config/spond/token`.

3. Verify it works:
   ```bash
   spond-mcli upcoming
   ```

That's it. The CLI and MCP server both read the token from `~/.config/spond/token` automatically.

## Features
The server is (for now) read-only and provides access to Spond's core data structures:

- 🔍 **Event Retrieval**: Get Spond events with flexible filtering options
- 📅 **Upcoming Events**: Easily fetch events happening in the future
- 🔎 **Search**: Search events by keywords in title, description, or group name
- 👥 **Group Filtering**: Get events from specific groups
- 📊 **Rich Data**: Access detailed event information including attendees, locations, and metadata
- 🛡️ **Type Safety**: Full TypeScript support with comprehensive type definitions

## Prerequisites

- Node.js version pinned in `mise.toml` (run `mise install` to get it)
- A valid Spond account with API access
- Bearer token for authentication
- Accessing attachments requires:
  - pdftotext installed for PDF parsing (usually part of poppler-utils package)
  - docx2txt installed for DOCX parsing

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Build the TypeScript code:
   ```bash
   npm run build
   ```

## Authentication Setup

The server requires the `SPOND_TOKEN` environment variable to be set. This variable has three possible modes:

- **Real API mode**: Set `SPOND_TOKEN` to your actual Spond Bearer token (no "Bearer " prefix needed)
- **Mock data mode**: Set `SPOND_TOKEN="mock-data"` to use mock data for testing
- **Error mode**: If `SPOND_TOKEN` is not set or empty, the server will fail with a clear error message

> [!IMPORTANT]
> The server will no longer default to mock mode when no token is provided. You must explicitly set `SPOND_TOKEN="mock-data"` for testing.

### Getting Your Token

The easiest way to get your token is with the CLI:

```bash
spond-mcli login
```

This opens a browser, you log in, and the token is saved to `~/.config/spond/token`.
Both the CLI and MCP server read from this file automatically.

Alternatively, you can get the token manually:

1. Log into Spond web client (https://spond.com/client)
2. Open browser developer tools (F12)
3. Go to Network tab and refresh the page
4. Find any API request to `api.spond.com`
5. Copy the Bearer token from the Authorization header
6. Set it in your MCP config (see below)

## Usage

### Requirements
- Ensure you have the `SPOND_TOKEN` environment variable set as described above
- It seems to prefer downloading files to /tmp so make sure your agent has write access to that directory

### As MCP Server

The preferred way to launch the MCP server is `spond-mcli mcp`, using the globally
installed CLI (see Getting Started above). It reads the token from
`~/.config/spond/token` or `SPOND_TOKEN` automatically, same as the CLI.

Add to your MCP client configuration (e.g., Claude Desktop):

```json
{
  "mcpServers": {
    "spond": {
      "command": "spond-mcli",
      "args": ["mcp"]
    }
  }
}
```

To use mock data, or a token not already saved to `~/.config/spond/token`,
set `SPOND_TOKEN` explicitly:
```json
{
  "mcpServers": {
    "spond": {
      "command": "spond-mcli",
      "args": ["mcp"],
      "env": {
        "SPOND_TOKEN": "mock-data"
      }
    }
  }
}
```

If you haven't installed the CLI globally, you can instead run it directly from
a local clone with `node`:
```json
{
  "mcpServers": {
    "spond": {
      "command": "node",
      "args": ["/path/to/spond-mcli/dist/index.js"],
      "cwd": "/path/to/spond-mcli",
      "env": {
        "SPOND_TOKEN": "ZXlKaGJHY2lPaUpJVXpVeE1pSXNJblI1Y0NJNklrcFhWQ0o5..."
      }
    }
  }
}
```

### In Claude Code

```bash
# Preferred, once the CLI is installed globally:
$ claude mcp add spond-mcli spond-mcli mcp -e SPOND_TOKEN="your-token-here"

# Or from a local clone without a global install (adds to the current directory's
# .claude config, so you'll need to be in this directory to use it):
$ claude mcp add spond-mcli node /path/to/spond-mcli/dist/index.js -e SPOND_TOKEN="your-token-here"
```

## Available Tools

The MCP server provides comprehensive tools for accessing Spond data,
including document conversion capabilities for PDF and DOCX files.
For detailed information about all available tools and their parameters,
see the tool definitions in [src/spond-core.ts](src/spond-core.ts).

## Security Notes

- Store your token securely and don't commit it to version control
- Tokens can expire and may need periodic renewal
- Never include your token directly in MCP configuration files that might be shared

## Development & Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage

# Run integration tests with real API (requires SPOND_TOKEN)
npm run test:integration

# Run tests in watch mode
npm run test:watch
```

### Mock vs Real API Testing

- **Default Mode**: Tests use mock data (no token required)
- **Integration Mode**: Tests against real Spond API (requires `SPOND_TOKEN`)
- **Automatic Fallback**: Real API tests gracefully skip when no token is available

```bash
# Mock mode (default)
npm test

npm run test:integration
```

## License

MIT License - see LICENSE file for details.
