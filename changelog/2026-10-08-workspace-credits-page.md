# Credits page moves to the workspace: /app/credits

**Before.** "Buy credits" in the chat banner pointed at `/p/<projectId>/credits`, a JSON
endpoint (no longer polled by anything) that resolved the project's brand and threw
`409 This project has no brand yet` for a brandless project — the normal case. Plans and
top-ups lived at `/p/<projectId>/settings/billing`, so buying needed a project in the URL.

**Now.** One page, `/app/credits` (`BILLING_PATH`), inside the `/app` shell, sidebar entry
visible with or without a project. Plan, upgrade, top-ups, portal, retention and cancel
actions resolve the org from the signed-in user's membership (`ORG_COOKIE` + `chooseOrg`),
owner only, never from a project or brand. Stripe return URLs (app actions and the
`/api/v1/brands/[slug]/billing/*` endpoints the CLI uses) come back to `/app/credits`.

**Old URLs.** `/p/<id>/credits` and `/p/<id>/settings/billing` redirect (303) to
`/app/credits`, keeping `?checkout=` for Stripe sessions already in flight. Billing left the
project settings sections and the canvas sheet; canvas links navigate to the page.

**Not changed.** `feega upgrade <slug>` stays brand-keyed: the CLI only opens the URL the
API returns, which now lands on `/app/credits`.
