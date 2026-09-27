# An org-mate's render is visible to you too, not just to whoever generated it

`brand-knowledge` (the bucket AI renders land in) has per-user folders
(`<userId>/media/...`), and its only read policy compares the first path segment to
`auth.uid()`. Every asset-signing call site was still signing with the requesting
user's own client — so any org member other than the one who generated the file (or
that same person from another account) got no signed URL back. The image row existed,
the file existed in Storage, and it still vanished from the canvas and the Media panel.

## What changed

- `signAssetPaths` (`src/lib/server/canvas/sign-media.ts`) replaces per-call-site
  `signKnowledgePaths`/`signAssetFiles` pairs. It takes the requesting user's RLS-scoped
  client, verifies at runtime that it actually is one (`isRlsScoped`), and only then
  signs with a service-role client — reading the `assets` row through the user's client
  first is what proves org membership; signing is a separate, more permissive step that
  runs only after that proof.
- `createAssetSigningDb()` builds that service-role client from the single registered
  entry in `service-role-uses.ts` — no ad hoc `createServiceRoleDb` call at each site.
- Rewired: the canvas asset route (`/p/[projectId]/c/[canvasId]/assets/[id]`), the
  project Media library (`/p/[projectId]/assets`), and the agent's assets panel
  (`/api/v1/projects/[projectId]/agent/assets`).
- Left unchanged: `signMediaPaths` used inside generation to resolve a node run's own
  upstream reference images/videos/audio — those paths come from the run's already
  authorized inputs, not from a free org-wide asset listing, so it's a narrower case
  outside this bug's scope.

## Verification

`src/lib/server/canvas/sign-media.test.ts` — a render lands a signed URL through the
service client even though the user client's storage mock doesn't have it (proves the
membership-then-service-sign split), and a client not marked RLS-scoped is rejected
outright (proves the guard isn't decorative). Live verification against
`/p/5ae78d0a-a983-418e-b646-c25478644dc0` with a second org member was planned but
blocked: the CDP browser session in this environment failed to render any page
(`Frame with ID 0 is showing error page`) for reasons unrelated to the app.
