# A linked picture shows in the frame, the canvas and exports

Complaint: a media prop set from a link (URL) drew an empty dark box.

Two causes, both fixed:

1. **Links were stored raw.** A frame's CSP allows only the origins of project assets, and
   capture/export need the file in storage. Now every picker slot copies a link into the project:
   `importCanvasLink` (`src/lib/server/canvas/upload.ts`) fetches it server-side (`safeFetchBytes`,
   https only, the upload size caps), stores it in `canvas-assets` and registers an asset; the
   picker stores its id. Canvas action `importLink`, canvas op `import_link` for agents (MCP/CLI
   docs updated). `MediaUploader` takes a `File | URL`; `LinkUse` is gone, as no slot keeps a
   raw link any more. The browser-side `fetch` + re-upload, which CORS blocked for most hosts,
   is removed.
2. **Runtime variables shadowed the prop.** A Custom clip with a `varPrefix` reads
   `<prefix>_<prop>` from `interactive.vars` before its props, and only template-value edits
   moved those defaults. Uploads were affected too. `drivenVars`
   (`src/lib/motion/interactive/driven-vars.ts`) now runs in `setProps`; `mergeView` keeps
   `interactive` from a composition view.

Not done: keeping the original link next to the asset (no column for it without a migration).
Already-stored raw links keep rendering only where CSP allows their host.
