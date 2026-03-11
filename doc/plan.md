# Plan

## Planned

- CLI status command: Check external dependencies (pdftotext, docx2txt) and that the token works. Do not fail on missing items, just show what is working and what is not.
- My members command: List memberIds of everyone you are a guardian for (across groups). This makes accept/decline easier — no need to dig through event details to find the right memberId.

## Completed

- CLI login command: Opens Playwright browser at spond.com/client, polls localStorage for token after user authenticates, base64-decodes and saves JWT to `~/.config/spond/token`

- Extract typed public methods from `processToolCall` (getGroups, getEvents, getEventById, getUpcomingEvents, searchEvents, getEventsByGroup, getPosts, getPostById, searchPosts, getPostsByGroup, getAttachment, getGroupFiles, getGroupFile, convertPdfToText, convertDocxToText, acceptEvent, declineEvent)
- Refactor CLI to use typed `CliCommand` discriminated union instead of MCP tool name strings
- CLI calls typed methods on `SpondCore` directly instead of `processToolCall`
- Rename `SpondMcpCore` to `SpondCore`, `spond-mcp-core.ts` to `spond-core.ts`
- Update AGENTS.md to document dual MCP/CLI architecture
