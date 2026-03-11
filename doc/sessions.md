# Sessions

## 2026-03-11: CLI login command

### Investigation
- Opened Playwright browser at `https://spond.com/client` (already logged in)
- Token stored in `localStorage` under key `"token"` as base64-encoded JWT
- `atob(localStorage.getItem('token'))` yields a standard HS512 JWT
- Also found `refreshToken`, `tokenExpiration`, `refreshTokenExpiration` in localStorage
- API expects `Bearer <decoded-jwt>` in Authorization header

### Login flow observed
- Navigating to `/client` when logged out → redirects to `/landing/login/`
- After login on the login page → redirects back to `/client` → token set in localStorage
- Same origin (`spond.com`), so polling localStorage on the page works across the redirect

### Implementation
- `decodeTokenFromLocalStorage(rawValue)` — pure function, base64-decodes the localStorage value
- `performLogin(tokenFilePath)` — launches headed Playwright, navigates to `/client`, polls localStorage every 1s for up to 2 minutes
- `login` CLI command handled before token retrieval in `cli.ts` (doesn't need SpondCore)
- Token saved to `~/spond-token.txt` via `DEFAULT_TOKEN_FILE`

### Decisions
- Polling (1s interval) instead of network interception — simpler, works across redirects
- 2-minute timeout — generous enough for manual login
- Handles already-logged-in case automatically (token found on first poll)
