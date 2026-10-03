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
- Canvas node `studio_batch` (`src/lib/canvas/studio-batch-node.ts`, one row in every node
  table): shows a batch's approved/finished thumbnails and status counts
  (`/app/studio/[batchId]/card`), links to the batch grid, and outputs the approved photos as
  `images` (`approvedPhotoUrls` in `server/canvas/upstream.ts`). Added from the add bar with a
  batch picker (`/app/studio/cards?project=`); `startPreview` places one on every batch canvas.
  Needs `supabase/canvas-migrations/20261004_studio_batch_node.sql` (adds the type to
  `nodes_type_check`) applied before deploy, or creating a batch fails on the constraint.
  Limit: Calendar and Promote read media from node assets client-side, so a wire into them
  does not draft posts yet; generation nodes (image, video, composition, 3D) do receive the
  photos.
- Burger menu "Home" became "Dashboard" and points to `/app` from every canvas and page.

**Entry rule.** One table in `src/lib/server/tenancy/entry.ts` (`ARRIVAL_LANDING`): returning →
dashboard; first run, landing campaign, accepted invite → canvas. A first run is the call that
created the user's first project, so the onboarding coach and the campaign template still open
on the canvas. Deleting a project now lands on the dashboard.

**Discarded.** A separate storage for standalone motion docs (would duplicate RLS and the node
model); `/app/motion/[id]` (the editor already has a URL, and the canvas node stays its home).
