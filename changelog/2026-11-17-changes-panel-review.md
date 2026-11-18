# Changes panel: review before push, honest result

Bugs 4 and 5 of the traidue.com local run. They share `SourceSyncPanel.svelte`, so one PR.

Before: every changed frame was pre-checked, a row showed only the frame name and its entry file,
"Create PR" pushed at once, and the panel opened at `right: 12px` under the right sidebar. A push
with no token (`pull` null in `push.ts`) showed only "Branch feega/x" and the button still said
"Create PR".

Now:
- nothing is pre-checked;
- a row shows the route (`link.route`, else the frame name) and its changed files, each with its
  hunk, from the existing `code-import/[nodeId]/changes` patch (`filesOfPatch`);
- the push button opens a review listing exactly the files of the checked frames
  (`filesToPush`), and only "Push N files" pushes;
- the panel opens at the top left, clear of the right sidebar;
- with no PR: "Branch feega/x pushed. No PR opened: connect GitHub or set a token" plus a Copy
  branch button; the push button reads "Push and open PR", "Update branch" or "Update PR" from
  the link (`pushLabel`).

Tests: `source-changes.test.ts`.
