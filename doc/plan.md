# Plan

## Planned

- CLI status command: Check external dependencies (pdftotext, docx2txt) and that the token works. Do not fail on missing items, just show what is working and what is not.
- Review code for clean separation between input/parsing, logic, integration. Hexagonal style.

## Completed

- Fix user/pw login (`spond-mcli login`): Replaced the Playwright browser-scraping login as the default with direct email/password authentication, matching the request/response shape documented in the community `spond` Python package (`POST /core/v1/auth2/login` with `{email, password}`, response `{accessToken: {token, expiration}}`). Credentials come from `SPOND_USERNAME`/`SPOND_PASSWORD` or an interactive terminal prompt (password input hidden via a small raw-mode reader in `src/prompt.ts`). Error messages only surface Spond's documented safe diagnostic fields (`error`, `errorKey`, `errorCode`, `message`) — never 2FA challenge tokens or phone numbers. Kept the old Playwright flow available as `spond-mcli login --browser` for accounts with 2FA enabled, since direct email/password login can't complete a 2FA challenge. Verified end-to-end against the real API — no more Chromium dependency for the default login path.

- My members command (`spond-mcli my-members`): Lists memberIds of everyone you're a guardian for, across all groups, with names and group names attached — no need to dig through event details to find the right memberId. Fetches `getGroups()` once, resolves matches via a pure `resolveMyMembers()` domain function, caches the result to `~/.config/spond/members.json` (0600 permissions) with a 5-minute TTL so repeated calls don't hit the API. On refresh, only rewrites the cache (and logs to stderr) if the resolved member list actually changed. Verified end-to-end against the real API.

- Fixed a real bug found while building the above: `SpondClient.getCurrentUserProfileId()` was hardcoded to a fake ID left over from development, instead of calling the real API. It now calls `GET /core/v1/profile` (documented in the community `spond` Python package) and memoizes the result. This also fixes the existing per-event "is my kid accepted/declined" attendance-status enrichment, which silently used the wrong ID for any account other than the original developer's.

- CLI login command: Opens Playwright browser at spond.com/client, polls localStorage for token after user authenticates, and saves it (raw, no decoding — the API rejects a base64-decoded token) to `~/.config/spond/token` with 0600 permissions. Poll loop tolerates the SPA navigating mid-poll (transient `page.evaluate` failures no longer abort login). Verified end-to-end against the real API.

- Extract typed public methods from `processToolCall` (getGroups, getEvents, getEventById, getUpcomingEvents, searchEvents, getEventsByGroup, getPosts, getPostById, searchPosts, getPostsByGroup, getAttachment, getGroupFiles, getGroupFile, convertPdfToText, convertDocxToText, acceptEvent, declineEvent)
- Refactor CLI to use typed `CliCommand` discriminated union instead of MCP tool name strings
- CLI calls typed methods on `SpondCore` directly instead of `processToolCall`
- Rename `SpondMcpCore` to `SpondCore`, `spond-mcp-core.ts` to `spond-core.ts`
- Update AGENTS.md to document dual MCP/CLI architecture
