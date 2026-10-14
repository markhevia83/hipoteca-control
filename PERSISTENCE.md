# Local persistence and recovery

## User behavior

- `index.html` is the existing independent local workspace. It requires no team account and saves automatically in this browser. Keep using the same browser and site URL; embedded messaging browsers, private mode, and other devices have separate storage. Clearing site data may erase it.
- Download a JSON backup regularly. The local page can import both the versioned backup format and the original exported array. Import adds missing IDs, never replaces existing cases, preserves a pre-import snapshot, and stops on invalid/full/unavailable storage.
- `equipo.html` still requires verified team membership and server access. “Recordar sesión y guardar borradores” is an explicit personal-device opt-in. It retains the session and pending edits in browser local storage. Anyone who can access that browser profile may access its stored data; use a protected personal device.
- Local drafts are separate for each verified account. Login failure does not erase them. Existing cloud-case drafts are restored only if the server still allows that account to read the case. Closing a session hides drafts and removes the saved session, but deliberately retains recoverable drafts for the same account.
- An already open team editor can preserve edits during a connection failure. Reopening the team requires the server to verify access. Offline copies do not bypass authentication and do not synchronize between devices.
- A cloud version conflict offers recovery as a new case or explicit discard/open cloud version. It never silently overwrites the newer server version.
- No production backend, policy, account, password, or billing setting is changed by this frontend patch. A suspended backend must be restored separately before team login/sync can work.

## Test commands

Run dependency-free storage, import, and actual-handler integration tests:

    node --test tests/*.test.cjs

The integration harness executes the real inline application code in Node with an inert DOM and a synthetic Supabase client. It validates persistence and account transitions, not visual rendering or browser storage policy.

For browser/mobile viewport testing install Playwright in a development environment, serve this folder on localhost port 8765, then run:

    node tests/browser.cjs

`PLAYWRIGHT_PATH`, `CHROMIUM_PATH`, and `BASE_URL` can override the installed module, browser executable, and local test URL. This script blocks external HTTP requests and uses synthetic authentication/data; never point it at a live customer workspace.

Manual device QA before relying on an important case: create synthetic data; reload; close/reopen the browser; reopen offline; export/import a JSON copy; switch accounts; interrupt save/login; test quota/private-mode warnings. Do not claim the browser suite passed unless it actually ran.
