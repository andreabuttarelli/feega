# /app is the dashboard; Photo studio and Motion are standalone tools

**Why.** Every tool lived inside a canvas: the photo studio opened as a sheet over it, the motion
editor only from a canvas node, and `/app` was a 308 to the last canvas. There was no place to
see projects side by side or to reach a tool without first opening a canvas.

**What.**
- `/app` renders a dashboard (`src/routes/app/+page.svelte`): projects (thumbnails from their
  latest images, recent canvases, new project), tools from one registry (`src/lib/tools.ts`:
  id, name, description, icon, route, status), recent studio batches and motion videos.
  Reads: `dashboardFor` in `src/lib/server/dashboard/dashboard.ts` over `repos/dashboard.ts`.
- `/app/+layout` is the shell for every `/app` page: `AppHeader` (burger menu, logo back to
  `/app`, page title, workspace switcher when the user has more than one org, credits).
  Workspace switch is `?/workspace`, which sets `dz-org` only for a real membership.
- Photo studio moved to `/app/studio` (`?project=` picks the source project, default the most
  recent) and `/app/studio/[batchId]` (+ `/zip`). The project comes from the batch, found
  across the user's orgs (`batchScope` in `dashboard/tool-scope.ts`). The rail button now
  navigates there (`NavFamily` `route`); the studio sheet is gone. Old
  `/p/[projectId]/studio/...` URLs answer 308.
- `/app/motion` lists every motion node of the org (poster, project, last edit) and creates a
  new one (`startMotion`, `src/lib/server/motion/start.ts`): on the chosen canvas, to the right
  of what is there, or on a "Motion" canvas created once per project. Storage is unchanged —
  a motion video is still a `motion` node and its editor still lives under the canvas.
- Burger menu "Home" became "Dashboard" and points to `/app` from every canvas and page.

**Entry rule.** One table in `src/lib/server/tenancy/entry.ts` (`ARRIVAL_LANDING`): returning →
dashboard; first run, landing campaign, accepted invite → canvas. A first run is the call that
created the user's first project, so the onboarding coach and the campaign template still open
on the canvas. Deleting a project now lands on the dashboard.

**Discarded.** A separate storage for standalone motion docs (would duplicate RLS and the node
model); `/app/motion/[id]` (the editor already has a URL, and the canvas node stays its home).
