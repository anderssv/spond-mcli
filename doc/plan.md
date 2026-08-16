# Plan

## Planned

- Fix user/pw login: Replace the Playwright browser-scraping login flow with direct username/password authentication against the Spond API. Look at how the Python project (github.com/Starefossen/spond-no-match-mcp) implements login via the `spond` PyPI package and replicate its API calls (login endpoint, request/response shape) instead of launching a browser and scraping a token out of `localStorage`. This removes the Playwright/Chromium dependency and the fragility that comes with it (e.g. the base64-decode bug we already hit once).
- CLI status command: Check external dependencies (pdftotext, docx2txt) and that the token works. Do not fail on missing items, just show what is working and what is not.
- My members command: List memberIds of everyone you are a guardian for (across groups). This makes accept/decline easier — no need to dig through event details to find the right memberId.

## Completed

- CLI login command: Opens Playwright browser at spond.com/client, polls localStorage for token after user authenticates, and saves it (raw, no decoding — the API rejects a base64-decoded token) to `~/.config/spond/token` with 0600 permissions. Poll loop tolerates the SPA navigating mid-poll (transient `page.evaluate` failures no longer abort login). Verified end-to-end against the real API.

- Extract typed public methods from `processToolCall` (getGroups, getEvents, getEventById, getUpcomingEvents, searchEvents, getEventsByGroup, getPosts, getPostById, searchPosts, getPostsByGroup, getAttachment, getGroupFiles, getGroupFile, convertPdfToText, convertDocxToText, acceptEvent, declineEvent)
- Refactor CLI to use typed `CliCommand` discriminated union instead of MCP tool name strings
- CLI calls typed methods on `SpondCore` directly instead of `processToolCall`
- Rename `SpondMcpCore` to `SpondCore`, `spond-mcp-core.ts` to `spond-core.ts`
- Update AGENTS.md to document dual MCP/CLI architecture
