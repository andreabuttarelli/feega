# Remove leftovers of social publishing

Social publishing has been hidden behind the `social_publishing` flag since 2026-10-08. Code that
nothing reaches, or that the flag already refused, is gone. DB tables and migrations are untouched.

Deleted:

- Calendar sheet route (`/p/[projectId]/calendar`), its nav entry, sheet loader, `CanvasSheet` branch and the `Schedule` capability.
- Studio "Add to calendar": the button, the `?/calendar` action, `studio-calendar.ts`.
- `/api/v1/brands/:slug/social/{accounts,connect}`, `/publishing`, the `health/accounts/tick` cron (also from `vercel.json`) and `account-health`.
- `SOCIAL_CONNECT_LINK` and `LIST_SOCIAL_ACCOUNTS_READ` in `packages/api-contracts`, mirrored into `cli/lib/contracts`; the web MCP no longer filters tools by the flag.
- Docs: `/docs/api/posts`, the calendar endpoint in the analytics page, `api.md` posts and calendar sections.
- Files with no importer: `schedule.ts`, `schedule-planned`, `post-planning`, `post-from-nodes`, `create-post-from-nodes`, `post-delivery`, `social-history-metrics`, `platform-adult-policy`, `lib/platforms.ts`, `PostRow`, `WarningCenter` and `warnings.ts`.
- Promote's Organic post tab (it posted to a canvas action that no longer exists): `OrganicPostForm`, the create-post composer, `promoteTabsFor`/`tabFromQuery`; `promotePath` lost its `tab` argument and Promote opens straight on the paid ad form.
- Calendar-conflict, daily-digest and pre-publish-hold emails.
- CLI: unused `statusBadge`, plugin and package descriptions no longer say "social media autopilot", the MCP first-call example reads canvases.

`routeRefused` lost its `search` argument: the only action it refused was the studio calendar.

Kept on purpose:

- `calendar` canvas node type, `period-grid` and `month-grid`: existing rows and the `nodes_type_check` constraint still carry it.
- Settings connected-accounts, Facebook, LinkedIn and connect routes, Promote, Ads and `zernio.ts`: Ads redirects into the Facebook connect flow.
- `/docs/api/analytics` still documents `/brands/:slug/analytics`, an endpoint that no longer exists.
