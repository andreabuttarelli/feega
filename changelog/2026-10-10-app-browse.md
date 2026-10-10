# app_browse: the chat logs in to the user's app with a test account

## Why
To recreate a SaaS UI faithfully the agents need its logged-in screens. `browse` refuses password
fields by design and stays that way.

## What
- `app_browse` / `app_forget` web tools, in both chats through `createWebTools` + `liveWebDeps`:
  login on the first call or when the session expired, then pages (path or url on the app host only)
  photographed with a DOM digest (`ui`: texts, boxes, colours, fonts) for `recreate_ui`; steps reuse
  `walkSteps` from `browse`. Shots become project assets (canvas chat: attachment asset; motion:
  `storeImage` + `assets.push`, so `recreate_ui` sees them in the same turn).
- Table `app_accounts` (one row per project, org RLS): login url, email, `test_password` in plain
  text, `session` (cookies + localStorage), `session_until` (12 h TTL).
- Project settings → "Test app account" panel with Forget; `GET/DELETE /api/v1/projects/:id/app-account`
  (cookie or Bearer); CLI `feega app-account <projectId> [--forget]`; MCP `get_app_account`,
  `forget_app_account`.
- Budgets: 6 pages, 6 shots, 60 s, 3 calls per turn; Browserless cost metered to `ai_calls` and the
  turn cap as before.

## Decisions
- No Vault (anomalia kept the password there): these are TEST credentials the AI may see, by the
  user's decision; prompt and settings say so.
- Reused from anomalia `demo-account.ts`: login selectors (submit scoped to the password form, the
  OAuth-button fix), the "still on the login page" check, the blocked-platform host list. SSRF stays
  on the existing request fence.
- localStorage is saved with the cookies: SPAs such as Conduit keep the JWT there, and cookies alone
  never resumed the session.
- Destructive clicks (word table `DESTRUCTIVE_WORDS`) need `confirmed: true` after a yes in chat.
- Discarded: anomalia's page discovery and stored pages/instructions; the chat holds them.

## Verified
Live against demo.realworld.show with a throwaway account: phase 1 fresh login + home; phase 2, a new
Browserless session, reused the saved session (`/settings`, `/editor`). Not yet run end to end through
the chat: the migration is not applied.
