# Plan

## Planned

- Fix user/pw login: Replace the Playwright browser-scraping login flow with direct username/password authentication against the Spond API. Look at how the Python project (github.com/Starefossen/spond-no-match-mcp) implements login via the `spond` PyPI package and replicate its API calls (login endpoint, request/response shape) instead of launching a browser and scraping a token out of `localStorage`. This removes the Playwright/Chromium dependency and the fragility that comes with it (e.g. the base64-decode bug we already hit once).
- CLI status command: Check external dependencies (pdftotext, docx2txt) and that the token works. Do not fail on missing items, just show what is working and what is not.

## Completed

- My members command (`spond-mcli my-members`): Lists memberIds of everyone you're a guardian for, across all groups, with names and group names attached — no need to dig through event details to find the right memberId. Fetches `getGroups()` once, resolves matches via a pure `resolveMyMembers()` domain function, caches the result to `~/.config/spond/members.json` (0600 permissions) with a 5-minute TTL so repeated calls don't hit the API. On refresh, only rewrites the cache (and logs to stderr) if the resolved member list actually changed. Verified end-to-end against the real API.

- Fixed a real bug found while building the above: `SpondClient.getCurrentUserProfileId()` was hardcoded to a fake ID left over from development, instead of calling the real API. It now calls `GET /core/v1/profile` (documented in the community `spond` Python package) and memoizes the result. This also fixes the existing per-event "is my kid accepted/declined" attendance-status enrichment, which silently used the wrong ID for any account other than the original developer's.

- CLI login command: Opens Playwright browser at spond.com/client, polls localStorage for token after user authenticates, and saves it (raw, no decoding — the API rejects a base64-decoded token) to `~/.config/spond/token` with 0600 permissions. Poll loop tolerates the SPA navigating mid-poll (transient `page.evaluate` failures no longer abort login). Verified end-to-end against the real API.

- Extract typed public methods from `processToolCall` (getGroups, getEvents, getEventById, getUpcomingEvents, searchEvents, getEventsByGroup, getPosts, getPostById, searchPosts, getPostsByGroup, getAttachment, getGroupFiles, getGroupFile, convertPdfToText, convertDocxToText, acceptEvent, declineEvent)
- Refactor CLI to use typed `CliCommand` discriminated union instead of MCP tool name strings
- CLI calls typed methods on `SpondCore` directly instead of `processToolCall`
- Rename `SpondMcpCore` to `SpondCore`, `spond-mcp-core.ts` to `spond-core.ts`
- Update AGENTS.md to document dual MCP/CLI architecture
